// Update tenant basics (JWT + ownership required)
import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ ok:false, error:'method not allowed' }) };

    const claims = context.clientContext?.user;
    if (!claims?.email) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };
    const email = String(claims.email).toLowerCase();

    const b = JSON.parse(event.body || '{}');
    const slug = String(b.slug || '').trim().toLowerCase();
    if (!slug) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing slug' }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Verify ownership
    const own = await sql/*sql*/`
      SELECT 1 FROM tenant_owners WHERE tenant_slug = ${slug} AND lower(owner_email) = ${email} LIMIT 1;
    `;
    if (!own.length) return { statusCode: 403, body: JSON.stringify({ ok:false, error:'forbidden' }) };

    // Build update set
    const name = b.name ?? null;
    const brand_color = b.brand_color ?? null;
    const google_maps_url = b.google_maps_url ?? null;
    const timezone = b.timezone ?? null;
    const keywords = Array.isArray(b.keywords) ? b.keywords : null;
    const visit_types = Array.isArray(b.visit_types) ? b.visit_types : null;
    const parking_options = Array.isArray(b.parking_options) ? b.parking_options : null;

    // Try full update; fallback if columns missing
    try {
      await sql/*sql*/`
        UPDATE tenants SET
          name = COALESCE(${name}, name),
          brand_color = COALESCE(${brand_color}, brand_color),
          timezone = COALESCE(${timezone}, timezone),
          google_maps_url = COALESCE(${google_maps_url}, google_maps_url),
          keywords = COALESCE(${keywords ? sql.json(keywords) : null}, keywords),
          visit_types = COALESCE(${visit_types ? sql.json(visit_types) : null}, visit_types),
          parking_options = COALESCE(${parking_options ? sql.json(parking_options) : null}, parking_options)
        WHERE slug = ${slug};
      `;
    } catch (_e) {
      await sql/*sql*/`
        UPDATE tenants SET
          name = COALESCE(${name}, name),
          google_maps_url = COALESCE(${google_maps_url}, google_maps_url),
          keywords = COALESCE(${keywords ? sql.json(keywords) : null}, keywords)
        WHERE slug = ${slug};
      `;
    }

    const out = await sql/*sql*/`
      SELECT slug, name, brand_color, timezone, google_maps_url, keywords
      FROM tenants WHERE slug = ${slug};
    `;
    return { statusCode: 200, body: JSON.stringify({ ok:true, tenant: out[0] }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
