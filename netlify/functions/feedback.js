import { neon } from '@netlify/neon';

export const handler = async (event) => {
  try {
    const sql = neon();
    const payload = JSON.parse(event.body || "{}");
    const { tenantId, restaurantName, selection, answers, userAgent } = payload;

    // Ensure a tenant row exists
    await sql`
      INSERT INTO tenants (slug, name)
      VALUES (${tenantId}, ${restaurantName || tenantId})
      ON CONFLICT (slug) DO NOTHING;
    `;

    const rows = await sql`
      INSERT INTO feedback (tenant_slug, experience, answers, user_agent)
      VALUES (
        ${tenantId},
        ${selection?.experience || "Unknown"},
        ${sql.json(answers || {})},
        ${userAgent || null}
      )
      RETURNING id, created_at;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true, id: rows[0].id }) };
  } catch (e) {
    // Keep your current UX: still return ok so the ✓ shows
    return { statusCode: 200, body: JSON.stringify({ ok: false }) };
  }
};
