CREATE TABLE IF NOT EXISTS app_state (
  id TEXT PRIMARY KEY,
  owner_sub TEXT,
  data JSONB NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 12,
  revision BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_state
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS owner_sub TEXT,
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_state TO progress_tracker_electron_app;
GRANT USAGE ON SCHEMA public TO progress_tracker_electron_app;

COMMENT ON COLUMN app_state.owner_sub IS
  'OIDC subject that owns this state row; NULL intentionally preserves unclaimed legacy rows such as main.';
COMMENT ON COLUMN app_state.revision IS
  'Monotonically increasing optimistic concurrency version for user-owned state.';
