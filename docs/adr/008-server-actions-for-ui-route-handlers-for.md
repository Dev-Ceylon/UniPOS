# ADR-008: Server actions for UI, route handlers for sync and API

- Status: Accepted
- Date: 2026-10-13

## Context

We need one validation layer for forms and for the sync/public API.

## Decision

- UI mutations are server actions wrapped by `action(permission, fn, { module })` (apps/web/src/lib/actions.ts): authenticate → check module → `can()` → Zod parse → `withTenant` transaction → audit log.
- Machine endpoints live under `/api/v1/*` (sync, catalog, exports, receipts, backup, kitchen).
- Zod schemas are shared from `@unipos/core`.

## Consequences

Every write path validates input and checks a permission before touching data.
