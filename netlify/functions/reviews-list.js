// netlify/functions/reviews-list.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  try {
    const slug = (event.queryStringParameters?.slug || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || '10', 10)));
    if (!slug) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing slug' }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const rows = await sql`
      SELECT id, created_at, tenant_slug, kind, review_text,
             keywords, visit_type, parking, extra,
             posted_to_google, posted_at, ai_used
      FROM reviews
      WHERE tenant_slug = ${slug}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    return { statusCode: 200, body: JSON.stringify({ ok:true, count: rows.length, reviews: rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error: String(e) }) };
  }
};
