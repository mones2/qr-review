import { neon } from '@neondatabase/serverless';

export const handler = async () => {
  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);

    await sql`CREATE TABLE IF NOT EXISTS tenants (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand_primary TEXT,
      google_place_id TEXT,
      google_maps_url TEXT,
      keywords JSONB,
      highlight_options JSONB,
      negative_questions JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

    await sql`CREATE TABLE IF NOT EXISTS feedback (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
      experience TEXT NOT NULL,
      answers JSONB NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );`;

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
