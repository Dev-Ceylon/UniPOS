# ADR-010: Custom fields as JSONB validated per tenant

- Status: Accepted
- Date: 2026-10-13

## Context

Shops want extra fields (brand, expiry, birthday) without schema migrations.

## Decision

- `Product.customFields` and `Customer.customFields` are JSONB.
- Field definitions live in tenant settings; `buildCustomFieldSchema(defs)` builds a Zod schema that validates and coerces input server-side.

## Consequences

Fields are added from Settings with no migration; invalid values are rejected with field errors.
