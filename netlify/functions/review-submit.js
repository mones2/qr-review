// netlify/functions/review-submit.js
import { neon } from '@neondatabase/serverless';

const ALLOWED_KINDS = new Set(['excellent', 'good', 'bad']);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const body = JSON.parse(event.body || '{}');

    // --- Required base field ---
    const tenant_slug = String(body.tenant_slug || '').trim().toLowerCase();
    if (!tenant_slug) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing tenant_slug' }) };
    }

    // --- Detect abandoned vs submitted ---
    const isAbandoned = body.status === 'abandoned' || body.abandoned === true;
    const status = isAbandoned ? 'abandoned' : 'submitted';

    // --- Common optional fields from the wizard ---
    const kindRaw = String(body.kind || '').trim().toLowerCase();
    const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : null;

    const review_text = (body.review_text ?? '').toString().trim();

    // normalize keywords -> array of strings
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.slice(0, 32).map(x => String(x).trim()).filter(Boolean)
      : [];

    const visit_type = (body.visit_type ?? '').toString().trim();
    const parking    = (body.parking ?? '').toString().trim();
    const extra      = (body.extra ?? '').toString();

    const posted_to_google = !!body.posted_to_google;
    const posted_at = body.posted_at ? String(body.posted_at) : null;
    const ai_used   = !!body.ai_used;
    const ua        = event.headers['user-agent'] || '';

    // Exit tracking fields
    const started_at = body.started_at ? String(body.started_at) : null;
    let abandoned_step = Number.isInteger(body.abandoned_step) ? body.abandoned_step : parseInt(body.abandoned_step, 10);
    if (Number.isNaN(abandoned_step)) abandoned_step = null;
    if (abandoned_step != null) {
      // clamp to 0..4
      abandoned_step = Math.max(0, Math.min(4, abandoned_step));
    }
    const exited_at = new Date().toISOString();

    // --- Validate per mode ---
    if (!isAbandoned) {
      // Submitted review must have valid kind + non-empty text
      if (!kind || !review_text) {
        return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'invalid payload (kind/review_text required)' }) };
      }
    }
    // Abandoned mode allows missing kind/review_text.

    // --- Build INSERT dynamically but explicit columns for clarity ---
    if (isAbandoned) {
      await sql`
        INSERT INTO reviews
          (tenant_slug, status, abandoned_step, started_at, exited_at,
           kind, review_text, keywords, visit_type, parking, extra,
           posted_to_google, posted_at, ai_used, user_agent)
        VALUES
          (${tenant_slug}, 'abandoned', ${abandoned_step}, ${started_at}, ${exited_at},
           ${kind}, ${review_text}, ${JSON.stringify(keywords)}::jsonb, ${visit_type}, ${parking}, ${extra},
           ${posted_to_google}, ${posted_at}, ${ai_used}, ${ua});
      `;
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'abandoned' }) };
    } else {
      await sql`
        INSERT INTO reviews
          (tenant_slug, status, kind, review_text, keywords, visit_type, parking, extra,
           posted_to_google, posted_at, ai_used, user_agent, started_at)
        VALUES
          (${tenant_slug}, 'submitted', ${kind}, ${review_text}, ${JSON.stringify(keywords)}::jsonb,
           ${visit_type}, ${parking}, ${extra}, ${posted_to_google}, ${posted_at}, ${ai_used}, ${ua},
           ${started_at});
      `;
      return { statusCode: 200, body: JSON.stringify({ ok: true, mode: 'submitted' }) };
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
