# ADR-006: Client-generated UUIDv7 ids

- Status: Accepted
- Date: 2026-10-13

## Context

Offline sales need final ids before they reach the server, and ids should be time-ordered for index locality.

## Decision

- `uuidv7()` in `@unipos/core` (monotonic within a millisecond).
- A sale's primary key **is** the client id. Sale lines and payments also use client ids.
- Server-created rows use Prisma `uuid(7)` defaults.

## Consequences

Retries can never create a second copy of a sale; a primary-key conflict means "already applied".
