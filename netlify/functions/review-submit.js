import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const body = JSON.parse(event.body || '{}');

    // minimal required fields
    const tenant_slug = String(body.tenant_slug || '').trim().toLowerCase();
    const kind        = String(body.kind || '').trim().toLowerCase();   // 'excellent' | 'good' | 'bad'
    const review_text = String(body.review_text || '').trim();

    if (!tenant_slug || !['excellent','good','bad'].includes(kind) || !review_text) {
      return { statusCode: 400, body: JSON.stringify({ ok:false, error:'invalid payload' }) };
    }

    // optional fields from your wizard
    const keywords   = body.keywords || [];
    const visit_type = body.visit_type || '';
    const parking    = body.parking || '';
    const extra      = body.extra || '';
    const posted_to_google = !!body.posted_to_google;
    const posted_at  = body.posted_at || null;
    const ai_used    = !!body.ai_used;

    const ua = event.headers['user-agent'] || '';

    await sql`
      INSERT INTO reviews
        (tenant_slug, kind, review_text, keywords, visit_type, parking, extra,
         posted_to_google, posted_at, ai_used, user_agent)
      VALUES
        (${tenant_slug}, ${kind}, ${review_text},
         ${JSON.stringify(keywords)}::jsonb, ${visit_type}, ${parking}, ${extra},
         ${posted_to_google}, ${posted_at}, ${ai_used}, ${ua});
    `;

    return { statusCode: 200, body: JSON.stringify({ ok:true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok:false, error:String(e) }) };
  }
};
