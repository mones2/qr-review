import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  try {
    const slug = (event.queryStringParameters?.slug || '').trim().toLowerCase();
    if (!slug) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing slug' }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const rows = await sql`
      SELECT owner_email, role, status
      FROM tenant_owners
      WHERE tenant_slug = ${slug}
      ORDER BY owner_email;
    `;
    return { statusCode: 200, body: JSON.stringify({ ok:true, owners: rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(e) }) };
  }
};
