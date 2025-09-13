// Check if a slug is free (public)
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  try {
    const slug = String(event.queryStringParameters?.slug || '').trim().toLowerCase();
    if (!slug) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing slug' }) };
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const r = await sql/*sql*/`SELECT 1 FROM tenants WHERE slug = ${slug} LIMIT 1;`;
    return { statusCode: 200, body: JSON.stringify({ ok:true, available: r.length === 0 }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
