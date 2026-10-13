# ADR-002: Modular core with per-tenant module toggles

- Status: Accepted
- Date: 2026-10-13

## Context

The spec lists nine feature areas. Building them as one monolith makes it impossible to switch features per business type.

## Decision

- `@unipos/core` defines module ids, dependencies, business-type presets and `visibleNav()`.
- Each web module lives in `apps/web/src/modules/<name>/manifest.ts` and registers nav items with the permission they need. Routes live in `src/app` (Next.js routing), and every page/action declares the module it belongs to (`requireContext(perm, module)` / `action(perm, fn, { module })`).
- A tenant's `enabledModules` is normalized with `resolveModules()` (required modules + dependencies).
- Presets (retail, grocery, restaurant, café, services) set modules, register layout and receipt defaults.

## Consequences

Switching a tenant from Retail to Restaurant changes nav, register layout and receipts with no code change (tested in core `misc.test.ts` and E2E).
