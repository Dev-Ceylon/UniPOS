# ADR-009: Permission strings and editable roles

- Status: Accepted
- Date: 2026-10-13

## Context

Shops need custom roles (e.g. supervisor) and fine-grained control of refunds, voids and discounts.

## Decision

- Permissions are strings like `sales.refund`; roles hold grants including wildcards (`sales.*`, `*`).
- One `can()` helper (core) runs on server (authoritative) and client (hiding UI).
- Default roles: Owner, Manager, Cashier, Inventory clerk; custom roles via Settings → Staff & roles.

## Consequences

Single place to audit authorization; unit tests cover wildcard semantics and default roles.
