// netlify/functions/reviews-list.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  try {
    const qp = event.queryStringParameters || {};
    const slug = (qp.slug || '').trim().toLowerCase();
    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing slug' }) };
    }

    const limit = Math.max(1, Math.min(200, parseInt(qp.limit || '50', 10)));
    const includeAbandoned = qp.include_abandoned !== 'false'; // default: include
    const sinceISO = qp.since ? new Date(qp.since).toISOString() : null;
    const untilISO = qp.until ? new Date(qp.until).toISOString() : null;

    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // Build WHERE with numbered placeholders
    const where = [];
    const params = [];
    let i = 1;

    where.push(`tenant_slug = $${i++}`); params.push(slug);
    if (!includeAbandoned) where.push(`status = 'submitted'`);
    if (sinceISO) { where.push(`created_at >= $${i++}`); params.push(sinceISO); }
    if (untilISO) { where.push(`created_at < $${i++}`);  params.push(untilISO); }

    const text = `
      SELECT
        id, created_at, tenant_slug,
        status, abandoned_step, started_at, exited_at,
        kind, review_text, keywords, visit_type, parking, extra,
        posted_to_google, posted_at, ai_used, user_agent
      FROM reviews
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${i};
    `;
    params.push(limit);

    const rows = await sql(text, params);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        tenant: slug,
        params: { limit, include_abandoned: includeAbandoned, since: sinceISO, until: untilISO },
        count: rows.length,
        reviews: rows
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
