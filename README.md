# UniPOS

**Modular, offline-first point of sale for small shops** — retail, grocery, restaurants, cafés and services. Built for Sri Lanka first (LKR, VAT, Sinhala and Tamil), usable anywhere.

![Register](docs/screenshots/register.png)

| Dashboard | Payment (split tender) | Kitchen display |
| --- | --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Payment](docs/screenshots/payment.png) | ![KDS](docs/screenshots/kitchen-display.png) |
| **Reports** | **Receipt editor** | **Dark mode, restaurant preset** |
| ![Reports](docs/screenshots/reports.png) | ![Receipt editor](docs/screenshots/receipt-editor.png) | ![Dark](docs/screenshots/register-dark.png) |

## Features

- **Register** — scanner-first search (USB or camera), favourites and categories, quantity/line/order discounts, price overrides (permission), split tenders (cash, card, wallet, gift card, points) with change due, hold/resume, keyboard shortcuts, 80/58 mm receipts (print, PDF, email).
- **Works offline** — installable PWA (Serwist). Catalog cached in IndexedDB (Dexie); sales go to an outbox with client UUIDv7 ids and sync to an idempotent endpoint. Negative stock is allowed offline and flagged after sync.
- **Catalog & stock** — products with variants, barcodes (generate + print labels), categories, tax classes (inclusive/exclusive/compound, per region), CSV import/export, append-only stock ledger, adjustments, stocktakes, low-stock alerts.
- **Returns & shifts** — partial refunds linked to the original sale (never more than sold), voids with permission, opening float, cash in/out, cash-up by denomination with variance.
- **Customers** — profiles, groups, notes, custom fields, purchase history, loyalty points, gift cards, personal-data export and erase.
- **Reports** — dashboard KPIs, sales by day/hour, products & profit, categories, staff, tax, tenders, inventory valuation; CSV and PDF export.
- **Restaurant** — floor plan editor, table tabs shared across devices, modifier groups, courses, kitchen display with bump/recall.
- **Multi-location & purchasing** — stock per location, transfers with in-transit state, suppliers, purchase orders, receiving into stock.
- **Quotations & expenses.**
- **Settings** — business-type presets that switch modules and defaults, module toggles, staff invites and editable roles with fine-grained permissions, cashier PINs (lockout after 5 tries), locations, receipt template editor, custom fields, theme colour, audit log, backup & restore.
- **Multi-tenant & secure** — shared Postgres with `tenantId` on every row and **forced row-level security**; one `can()` permission helper; Zod validation everywhere; audit log for sensitive actions.
- **Accessible & localized** — WCAG 2.2 AA checks with axe; English, සිංහල, தமிழ்; light/dark themes ("Classic Blue").

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Better Auth (+ organizations) · Prisma 7 + PostgreSQL · Serwist + Dexie · Tailwind CSS v4 · next-intl · pdf-lib · Vitest + fast-check · Playwright + axe-core · pnpm workspaces.

```
apps/web          Next.js app (pages, server actions, API routes, offline layer, modules/*/manifest.ts)
packages/core     Pure domain logic: money, tax, cart, payments, permissions, stock, refunds, sync, reports, receipts
packages/db       Prisma schema, migrations (RLS), withTenant(), domain services, integration tests
packages/ui       Design tokens and accessible UI primitives
docs/             Vision, ADRs, user/admin/hardware/deployment guides, security checklist, personas
```

## Quick start (local)

Requirements: Node 22, pnpm 10, PostgreSQL 15+ (or Docker).

```bash
pnpm install
docker compose up -d postgres            # or use a local Postgres
psql postgresql://postgres:postgres@localhost:5432/unipos -f packages/db/prisma/sql/setup-roles.sql
cp .env.example apps/web/.env.local      # set BETTER_AUTH_SECRET
cp .env.example packages/db/.env
pnpm db:migrate
pnpm --filter @unipos/db generate
pnpm --filter @unipos/web seed           # optional demo shops
pnpm dev                                  # http://localhost:3000
```

Demo logins after seeding: `owner@demo.unipos.app` / `demo1234` (PIN 1111, owns a retail shop and a restaurant) and `cashier@demo.unipos.app` / `demo1234` (PIN 2222).

## Tests

| Layer | Command | What it proves |
| --- | --- | --- |
| Unit + property (core) | `pnpm --filter @unipos/core test:coverage` | Tax/money/cart/refunds/ledger/sync/report maths; ~99% line coverage (gate: 80%); 10,000-product search < 100 ms |
| Unit (web) | `pnpm --filter @unipos/web test` | Register cart reducer, module registry/presets |
| Integration (Postgres) | `pnpm test:integration` | RLS tenant isolation (forged queries), sync idempotency, **500-sale offline day with forced retries → 0 lost, 0 duplicates**, refunds/voids, shifts, stocktakes, transfers, POs, CSV import, backup/restore |
| E2E (Playwright + axe) | `pnpm test:e2e` | 10 critical flows (sign-up → first sale, split tender, return, shift cash-up, offline → sync, preset switch, product + barcode scan, PIN lockout, hold/resume shortcuts, customer + loyalty + reports) and WCAG checks |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format, unit tests with coverage, the migration diff check, integration tests against Postgres, a production build and the E2E suite. CodeQL and Dependabot are enabled; tagging `vX.Y.Z` publishes a Docker image to GHCR.

## Deploy

- **Docker Compose** (self-host): `cp .env.example .env && docker compose up -d`.
- **Vercel + Neon/Supabase** or **Railway/Render** — see [docs/deployment.md](docs/deployment.md).

GitHub Pages cannot host UniPOS: it needs a server and a database.

## Documentation

- [Vision](docs/vision.md) · [Architecture decisions](docs/adr/README.md) · [CLAUDE.md rules](CLAUDE.md)
- [User guide](docs/user-guide.md) · [Admin & customization](docs/admin-guide.md) · [Hardware](docs/hardware.md) · [Deployment](docs/deployment.md)
- [Security checklist](docs/security.md) · [Personas & wireframe notes](docs/personas.md) · [Contributing](CONTRIBUTING.md)

## Roadmap after v1.0

v1.1 print bridge for ESC/POS and cash drawers, scheduled email reports · v1.2 services/salon (appointments) · v1.3 payment gateway plugins (local first), public REST API and webhooks · v2.0 online store with shared inventory, accounting export, module marketplace.

## License

MIT. "Classic Blue" is UniPOS's own theme name; UniPOS is not affiliated with or endorsed by Meta/Facebook.
