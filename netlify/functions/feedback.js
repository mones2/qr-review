import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    const payload = JSON.parse(event.body || "{}");
    const { tenantId, restaurantName, selection, answers, userAgent } = payload;

    await sql`INSERT INTO tenants (slug, name)
              VALUES (${tenantId}, ${restaurantName || tenantId})
              ON CONFLICT (slug) DO NOTHING;`;

const rows = await sql`
  INSERT INTO feedback (tenant_slug, experience, answers, user_agent)
  VALUES (
    ${tenantId},
    ${selection?.experience || "Unknown"},
    ${JSON.stringify(answers || {})}::jsonb,
    ${userAgent || null}
  )
  RETURNING id, created_at;
`;


    return { statusCode: 200, body: JSON.stringify({ ok: true, id: rows[0].id }) };
  } catch {
    return { statusCode: 200, body: JSON.stringify({ ok: false }) };
  }
};


