-- Run once per database as a superuser/owner BEFORE migrations.
-- Creates the application role. The app connects as unipos_app, which does
-- not own the tables and cannot bypass row-level security (ADR-001).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'unipos_app') THEN
    CREATE ROLE unipos_app LOGIN PASSWORD 'unipos_app' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO unipos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO unipos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO unipos_app;
