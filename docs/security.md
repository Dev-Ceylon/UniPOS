# Security review checklist (OWASP-based)

| Area | Control | Where |
| --- | --- | --- |
| Broken access control | Every server action/route checks a permission with `can()`; modules are checked server-side | `apps/web/src/lib/actions.ts`, `lib/api.ts` |
| Tenant isolation | Postgres RLS forced on all tenant tables; app role cannot bypass; isolation tests in CI | `packages/db/prisma/migrations/*_rls`, `packages/db/test/rls.test.ts` |
| Injection | Prisma parameterized queries; raw SQL only with tagged templates or fixed table names | `packages/db/src/services/*` |
| Input validation | Zod on every action and the sync endpoint; money parsed to integers | `@unipos/core` schemas |
| Authentication | Better Auth (scrypt passwords, secure cookies), sign-in/sign-up rate limits (5/min) | `apps/web/src/lib/auth.ts` |
| PIN brute force | Scrypt-hashed PINs, 5 attempts then 15 min lock, per-device rate limit, audit entries | `apps/web/src/lib/shell-actions.ts` |
| Sync abuse | Batches ≤100 ops, per-device rate limit, totals recomputed server-side, unknown cashiers/variants rejected | `api/v1/sync`, `services/sync.ts` |
| Sensitive actions | Refunds, voids, price overrides, discount thresholds, settings, staff, backups → permission + audit log | `writeAudit` calls |
| XSS | React escaping; no `dangerouslySetInnerHTML`; CSP, `X-Frame-Options: DENY`, `nosniff` | `apps/web/next.config.ts` |
| CSV injection | Cells starting with `= + - @` are prefixed on export | `packages/core/src/csv.ts` |
| Secrets | Env vars only; `.env*` git-ignored; secret scanning + Dependabot + CodeQL workflows | `.github/` |
| Dependencies | `pnpm audit` in CI | `.github/workflows/ci.yml` |
| Personal data | Export and erase per customer, consent flag, retention setting | Customers, Settings → Business |

Known follow-ups: move rate limits to Redis for multi-instance deployments; add 2FA (Better Auth two-factor plugin) for owners; external penetration test before public launch.
