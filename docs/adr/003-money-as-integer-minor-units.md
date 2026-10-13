# ADR-003: Money as integer minor units

- Status: Accepted
- Date: 2026-10-13

## Context

Floating point arithmetic produces rounding errors in totals, tax and refunds.

## Decision

- All amounts are `Int` minor units (cents) plus the tenant currency. `currencyExponent()` knows 0/2/3-decimal currencies.
- Rounding is half-away-from-zero and symmetric for negatives so refunds mirror sales.
- `allocate()` splits amounts with the largest-remainder method so parts always sum to the total.
- Never use floats for money; parse user input with `parseMoney()` and display with `formatMoney()`.

## Consequences

Property tests (fast-check) prove allocations and decimal round-trips are exact.
