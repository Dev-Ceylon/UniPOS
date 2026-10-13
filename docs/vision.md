# UniPOS — vision

UniPOS is an open-source, modular, offline-first point of sale for small shops — retail, grocery, restaurants, cafés and services — starting with Sri Lanka and usable anywhere.

A small shop should be able to run a full trading day on UniPOS, online or offline, without help.

## Principles

1. **Layers, not a monolith.** A small core (tenants, catalog, stock ledger, sales, payments) plus modules that a business turns on: inventory, customers, loyalty, gift cards, reports, restaurant, multi-location, purchasing, quotations, expenses.
2. **Offline by design.** The register writes every sale locally first (client UUIDv7 ids, outbox) and syncs to an idempotent endpoint. A dropped connection only delays sync.
3. **Money is exact.** Integer minor units, a pure tax engine (inclusive, exclusive, compound), allocations that always add up.
4. **Every movement is recorded.** Append-only stock ledger and audit log.
5. **Safe multi-tenancy.** One database, `tenantId` everywhere, Postgres row-level security as a second guard.
6. **Fast at the counter.** Scanner-first search, keyboard shortcuts, PIN cashier switching, 3-item sale in under 15 seconds.
7. **Accessible and local.** WCAG 2.2 AA on core screens; English, Sinhala and Tamil.

## Stack (after the spec review)

Next.js 16 · TypeScript strict · Better Auth (organizations) · Prisma + PostgreSQL everywhere · Serwist + Dexie for offline · Tailwind CSS v4 with CSS-variable theming ("Classic Blue") · next-intl · Vitest + fast-check · Playwright + axe.

Card payments are recorded from a separate terminal in v1; gateways come later as plugins. Receipts print through the browser (80 mm / 58 mm CSS); ESC/POS and cash drawers via a print bridge in v1.1.

## Scope

v1.0 is the "In scope" list of the development plan: tenants and roles, catalog and stock, register with discounts/taxes/split tenders/hold/receipts/returns, shifts and cash-up, offline selling, customers/loyalty/gift cards, reports with CSV/PDF, restaurant tables/modifiers/KDS, multi-location transfers and purchase orders, settings (presets, module toggles, tax rules, receipt template, custom fields, theme), audit log, backup, three locales.

Out of scope for v1.0: integrated card gateways, online store, appointments, scheduled emails/SMS, public REST API and webhooks, accounting integrations, native apps, multi-currency in one store.
