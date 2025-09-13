// netlify/functions/migrate.js
import { neon } from '@neondatabase/serverless';

export const handler = async () => {
  const sql = neon(process.env.NETLIFY_DATABASE_URL);

  try {
    // (Neon usually has pgcrypto enabled; create if missing for gen_random_uuid)
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
    } catch (_) {
      // ignore if not permitted on this role/DB
    }

    // --- Core tables (no-ops if already exist) ---
    await sql`CREATE TABLE IF NOT EXISTS tenants (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand_primary TEXT,
      google_place_id TEXT,
      google_maps_url TEXT,
      keywords JSONB DEFAULT '[]'::jsonb,
      highlight_options JSONB DEFAULT '[]'::jsonb,
      negative_questions JSONB DEFAULT '{}'::jsonb,
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

    await sql`CREATE TABLE IF NOT EXISTS reviews (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      tenant_slug     TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
      kind            TEXT CHECK (kind IN ('excellent','good','bad')),
      review_text     TEXT,
      keywords        JSONB NOT NULL DEFAULT '[]'::jsonb,
      visit_type      TEXT,
      parking         TEXT,
      extra           TEXT,
      posted_to_google BOOLEAN NOT NULL DEFAULT FALSE,
      posted_at       TIMESTAMPTZ,
      ai_used         BOOLEAN NOT NULL DEFAULT FALSE,
      user_agent      TEXT
    );`;

    await sql`CREATE TABLE IF NOT EXISTS tenant_owners (
      tenant_slug TEXT NOT NULL REFERENCES tenants(slug) ON DELETE CASCADE,
      owner_email TEXT NOT NULL,
      role TEXT DEFAULT 'owner',
      status TEXT DEFAULT 'active',
      PRIMARY KEY (tenant_slug, owner_email)
    );`;

    // --- Schema migrations for exit tracking on reviews ---
    // 1) Allow saving partial/abandoned rows: make kind/review_text nullable if they aren't already.
    try { await sql`ALTER TABLE reviews ALTER COLUMN kind DROP NOT NULL;`; } catch (_) {}
    try { await sql`ALTER TABLE reviews ALTER COLUMN review_text DROP NOT NULL;`; } catch (_) {}

    // 2) Add status + timestamps + step number for exits.
    await sql`ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'submitted'
        CHECK (status IN ('submitted','abandoned')),
      ADD COLUMN IF NOT EXISTS abandoned_step INTEGER,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS exited_at TIMESTAMPTZ
    ;`;

    // --- Helpful indexes ---
    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_tenant_created
      ON reviews (tenant_slug, created_at DESC);`;

    await sql`CREATE INDEX IF NOT EXISTS idx_reviews_status_step
      ON reviews (tenant_slug, status, abandoned_step, created_at DESC);`;

    await sql`CREATE INDEX IF NOT EXISTS idx_tenant_owners_email
      ON tenant_owners (owner_email, tenant_slug);`;

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e) }) };
  }
};
