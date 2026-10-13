# ADR-001: Tenancy: shared database with row-level security

- Status: Accepted
- Date: 2026-10-13

## Context

UniPOS serves many shops from one Postgres database. A missed `where tenantId = …` must never leak another shop's data.

## Decision

- Every business table has a `tenantId` column, defaulted from `unipos_current_tenant()` (the transaction setting `app.tenant_id`).
- Postgres RLS is **enabled and forced** on every tenant table with a policy `tenantId = unipos_current_tenant()` for reads and writes.
- The app connects as `unipos_app`, which owns no tables and has `NOBYPASSRLS`. Migrations run as the owner role.
- All business data access goes through `withTenant(tenantId, fn)` (packages/db/src/client.ts), which opens a transaction and sets `app.tenant_id` locally, so the setting never leaks across pooled connections.
- An empty or unset setting resolves to `NULL`, so nothing is visible and nothing can be inserted without a tenant.
- Better Auth tables (`user`, `session`, `account`, `verification`, `tenant`, `member`, `invitation`) are outside RLS because sign-in must look across tenants; code that reads `member`/`invitation` always filters by `tenantId` explicitly.

## Consequences

Cheap to run (one database), and two independent guards. `packages/db/test/rls.test.ts` proves tenant A cannot read or write tenant B's rows even with forged queries, and fails if a new tenant table lacks a policy.
