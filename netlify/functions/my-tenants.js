// Owner's tenant list (JWT required)
import { neon } from '@neondatabase/serverless';

export const handler = async (_event, context) => {
  try {
    const claims = context.clientContext?.user;
    if (!claims?.email) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized' }) };
    }
    const email = String(claims.email).toLowerCase();
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    const rows = await sql/*sql*/`
      SELECT t.slug, t.name,
             COALESCE(t.brand_color, '#22c55e') AS brand_color,
             t.timezone, t.google_maps_url, t.keywords
      FROM tenant_owners o
      JOIN tenants t ON t.slug = o.tenant_slug
      WHERE lower(o.owner_email) = ${email}
      ORDER BY t.name;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true, tenants: rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
