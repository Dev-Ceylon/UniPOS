# ADR-012: Authentication with Better Auth and cashier PINs

- Status: Accepted
- Date: 2026-10-13

## Context

Auth.js is in maintenance mode; cashiers share a till and full logins are too slow at the counter.

## Decision

- Better Auth with email/password, optional Google, and the organization plugin (organization → `tenant`, member → `member` with `tenantId`, invitations with a `roleId`).
- Each member has a 4–6 digit PIN (scrypt). `switchCashier(pin)` sets a signed, httpOnly cookie for 12 h; the cashier then acts instead of the device's signed-in user. Five wrong PINs lock for 15 minutes; attempts are rate-limited and audited.
- PIN switching needs a connection; offline, the current cashier stays signed in.

## Consequences

Fast cashier changes without sharing passwords; all switches appear in the audit log.
