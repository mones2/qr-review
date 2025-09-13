// netlify/functions/reviews-owner.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  try {
    // Must be logged in via Netlify Identity (JWT in Authorization header)
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized: missing/invalid token' }) };
    }

    const email =
      (user.email || user?.app_metadata?.email || '').trim().toLowerCase();
    if (!email) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized: email not found on token' }) };
    }

    const slug = (event.queryStringParameters?.slug || '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(50, parseInt(event.queryStringParameters?.limit || '20', 10)));
    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing slug' }) };
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Verify ownership (RBAC): email must be linked to tenant in tenant_owners
    const owner = await sql`
      SELECT 1
      FROM tenant_owners
      WHERE tenant_slug = ${slug} AND owner_email = ${email}
      LIMIT 1;
    `;
    if (owner.length === 0) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'forbidden: not an owner for this tenant' }) };
    }

    // Fetch latest reviews for this tenant
    const rows = await sql`
      SELECT id, created_at, tenant_slug, kind, review_text,
             keywords, visit_type, parking, extra,
             posted_to_google, posted_at, ai_used
      FROM reviews
      WHERE tenant_slug = ${slug}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, tenant: slug, owner_email: email, count: rows.length, reviews: rows }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
