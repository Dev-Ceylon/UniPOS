-- The tenant of the current transaction, set by withTenant() via
-- set_config('app.tenant_id', …, true). Empty/unset → NULL, so rows can never be
-- created or seen without a tenant (ADR-001).
CREATE OR REPLACE FUNCTION unipos_current_tenant() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '') $$;
