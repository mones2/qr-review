// netlify/functions/reviews-owner.js
import { neon } from '@neondatabase/serverless';

export const handler = async (event, context) => {
  try {
    // Must be logged in via Netlify Identity (JWT in Authorization header)
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized: missing/invalid token' }) };
    }

    const email = (user.email || user?.app_metadata?.email || '').trim().toLowerCase();
    if (!email) {
      return { statusCode: 401, body: JSON.stringify({ ok: false, error: 'unauthorized: email not found on token' }) };
    }

    const qp = event.queryStringParameters || {};
    const slug  = (qp.slug || '').trim().toLowerCase();
    if (!slug) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing slug' }) };
    }

    // Filters
    const limit = Math.max(1, Math.min(200, parseInt(qp.limit || '50', 10)));
    const since = qp.since ? new Date(qp.since).toISOString() : null; // ISO string if valid
    const until = qp.until ? new Date(qp.until).toISOString() : null;
    const includeAbandoned = qp.include_abandoned !== 'false'; // default true

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

    // Build WHERE clauses
    const where = [sql`tenant_slug = ${slug}`];
    if (!includeAbandoned) where.push(sql`status = 'submitted'`);
    if (since) where.push(sql`created_at >= ${since}`);
    if (until) where.push(sql`created_at < ${until}`);

    // Fetch latest reviews with exit fields
    const rows = await sql`
      SELECT
        id, created_at, tenant_slug, status, abandoned_step, started_at, exited_at,
        kind, review_text,
        keywords, visit_type, parking, extra,
        posted_to_google, posted_at, ai_used, user_agent
      FROM reviews
      WHERE ${sql.join(where, sql` AND `)}
      ORDER BY created_at DESC
      LIMIT ${limit};
    `;

    // Aggregated counts for quick stats (same filters, but without LIMIT)
    const counts = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'submitted')::int  AS submitted,
        COUNT(*) FILTER (WHERE status = 'abandoned')::int  AS abandoned,
        COUNT(*) FILTER (WHERE status = 'submitted' AND kind = 'excellent')::int AS excellent,
        COUNT(*) FILTER (WHERE status = 'submitted' AND kind = 'good')::int      AS good,
        COUNT(*) FILTER (WHERE status = 'submitted' AND kind = 'bad')::int       AS bad
      FROM reviews
      WHERE ${sql.join(where, sql` AND `)}
    `;

    // Per-step breakdown for abandoned exits
    const stepRows = await sql`
      SELECT COALESCE(abandoned_step, -1) AS step, COUNT(*)::int AS count
      FROM reviews
      WHERE ${sql.join([sql`tenant_slug = ${slug}`, sql`status = 'abandoned'`, since ? sql`created_at >= ${since}` : sql`TRUE`, until ? sql`created_at < ${until}` : sql`TRUE`], sql` AND `)}
      GROUP BY abandoned_step
      ORDER BY abandoned_step ASC
    `;

    const step_counts = {};
    for (const r of stepRows) step_counts[String(r.step)] = r.count;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        tenant: slug,
        owner_email: email,
        params: { limit, since, until, include_abandoned },
        counts: counts[0] || { total: 0, submitted: 0, abandoned: 0, excellent: 0, good: 0, bad: 0 },
        step_counts, // e.g., { "0": 3, "1": 5, "2": 1, "3": 0, "4": 2 }
        count: rows.length,
        reviews: rows
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
