// netlify/functions/reviews-owner.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  try {
    const slug = (event.queryStringParameters?.slug || '').trim().toLowerCase();
    if (!slug) return { statusCode: 400, body: JSON.stringify({ ok:false, error:'missing slug' }) };

    // 1) Must be logged in via Netlify Identity
    const user = context.clientContext && context.clientContext.user;
    const email = user && (user.email || user?.app_metadata?.provider && user?.email); // email on the token
    if (!email) return { statusCode: 401, body: JSON.stringify({ ok:false, error:'unauthorized' }) };

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // 2) Must be an owner of this tenant
    const owners = await sql`
      SELECT 1 AS ok FROM tenant_owners
      WHERE tenant_slug = ${slug} AND owner_email = ${email} AND status = 'active'
      LIMIT 1;
    `;
    if (!owners.length) {
      return { statusCode: 403, body: JSON.stringify({ ok:false, error:'forbidden' }) };
    }

    // 3) Return reviews
    const rows = await sql`
      SELECT id, created_at, tenant_slug, kind, review_text,
             keywords, visit_type, parking, extra,
             posted_to_google, posted_at, ai_used
      FROM reviews
      WHERE tenant_slug = ${slug}
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    return { statusCode: 200, body: JSON.stringify({ ok:true, count: rows.length, reviews: rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
