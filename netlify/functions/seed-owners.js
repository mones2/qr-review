import { neon } from '@neondatabase/serverless';

export const handler = async () => {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    // make sure this row links the owner to the tenant
    await sql`
      INSERT INTO tenant_owners (tenant_slug, owner_email, role, status)
      VALUES ('cedars', 'monesgharaibeh@gmail.com', 'owner', 'active')
      ON CONFLICT (tenant_slug, owner_email) DO UPDATE
      SET role = EXCLUDED.role, status = EXCLUDED.status;
    `;

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(e) }) };
  }
};
