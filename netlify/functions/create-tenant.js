// Create a tenant and link current user as owner (JWT required)
import { neon } from '@neondatabase/serverless';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

export const handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
    }

    const claims = context.clientContext?.user;
    if (!claims?.email) return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    const ownerEmail = String(claims.email).toLowerCase();

    const body = JSON.parse(event.body || '{}');
    const name = String(body.name || '').trim();
    const slug = slugify(body.slug || name);
    if (!name || !slug) return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing name/slug' }) };

    const brand_color = body.brand_color || null;
    const google_maps_url = body.google_maps_url || null;
    const keywords = Array.isArray(body.keywords) ? body.keywords : [];
    const timezone = body.timezone || null;
    const visit_types = Array.isArray(body.visit_types) ? body.visit_types : null;
    const parking_options = Array.isArray(body.parking_options) ? body.parking_options : null;

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Ensure slug is free
    const hit = await sql/*sql*/`SELECT 1 FROM tenants WHERE slug = ${slug} LIMIT 1;`;
    if (hit.length) return { statusCode: 409, body: JSON.stringify({ ok: false, error: 'slug taken' }) };

    // Insert tenant (try full set; fallback if some columns don’t exist)
    let inserted;
    try {
      inserted = await sql/*sql*/`
        INSERT INTO tenants (slug, name, brand_color, timezone, google_maps_url, keywords, visit_types, parking_options)
        VALUES (${slug}, ${name}, ${brand_color}, ${timezone}, ${google_maps_url}, ${sql.json(keywords)}, ${sql.json(visit_types)}, ${sql.json(parking_options)})
        RETURNING slug, name, brand_color, timezone, google_maps_url, keywords;
      `;
    } catch (_e) {
      // Minimal schema fallback
      inserted = await sql/*sql*/`
        INSERT INTO tenants (slug, name, google_maps_url, keywords)
        VALUES (${slug}, ${name}, ${google_maps_url}, ${sql.json(keywords)})
        RETURNING slug, name, google_maps_url, keywords;
      `;
    }

    // Link owner (idempotent)
    await sql/*sql*/`
      INSERT INTO tenant_owners (tenant_slug, owner_email)
      VALUES (${slug}, ${ownerEmail})
      ON CONFLICT DO NOTHING;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true, tenant: inserted[0] }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
