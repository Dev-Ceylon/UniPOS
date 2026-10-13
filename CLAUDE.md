# UniPOS — rules for AI assistants and contributors

Read `docs/vision.md` (what we build) and `docs/adr/` (how). Work one checklist item at a time; write tests first for core logic.

## Layout

- `packages/core` — pure TypeScript: money, tax, cart, payments, permissions, stock, refunds, sync contract, reports, receipts, CSV, presets. **No framework or DB imports.**
- `packages/db` — Prisma schema + migrations (incl. RLS), `withTenant()`, domain services (sync, sales, inventory, catalog, shifts, customers, backup). Integration tests run against Postgres.
- `packages/ui` — design tokens (Classic Blue) and accessible primitives.
- `apps/web` — Next.js 16 app router. Modules: `src/modules/<name>/manifest.ts`. Offline layer: `src/offline` (Dexie + outbox). Server actions use `action()` from `src/lib/actions.ts`.

## Never do

- Never use floats for money. Amounts are integer minor units (`Minor`); use `parseMoney`, `formatMoney`, `allocate`, `toDecimalString`.
- Never touch business data outside `withTenant(tenantId, …)` / `action()` / `read()`. Never bypass RLS or connect the app as the table owner.
- Never write a server action or route handler without a `can()` permission check (use `action(permission, …)` or `apiContext(permission)`) and Zod validation.
- Never update or delete `StockMovement` or `AuditLog` rows; record a new movement instead (`recordMovements`).
- Never generate sale ids on the server; sales use the client UUIDv7.
- Never query `member`/`invitation` without filtering by `tenantId` (they are outside RLS).
- Refunds, voids, price overrides, discounts above the threshold, settings and staff changes must write the audit log (`writeAudit`).
- Don't add a new tenant table without `tenantId @default(dbgenerated("unipos_current_tenant()"))` and an RLS policy in a migration (the RLS test fails otherwise).

## Commands

```bash
pnpm install
pnpm db:migrate              # owner URL in MIGRATE_DATABASE_URL
pnpm --filter @unipos/web seed
pnpm dev                     # http://localhost:3000
pnpm typecheck && pnpm lint
pnpm --filter @unipos/core test:coverage
pnpm --filter @unipos/db test:integration   # needs Postgres (TEST_ADMIN_DATABASE_URL)
pnpm --filter @unipos/web test:e2e
```

## Conventions

Conventional Commits, short-lived `feat/…` branches, squash merges. Keep UI strings in `apps/web/messages/*.json` where practical (en, si, ta).
