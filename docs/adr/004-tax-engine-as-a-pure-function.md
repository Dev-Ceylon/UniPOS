# ADR-004: Tax engine as a pure function

- Status: Accepted
- Date: 2026-10-13

## Context

Taxes must be identical on the offline register and the server, and must support inclusive and exclusive prices and compound tiers.

## Decision

- `calculateLineTax(amount, rules)` in `@unipos/core`: inclusive rules are extracted from the shelf price (net + inclusive taxes == price, exactly), then exclusive rules are added on the net.
- Compound rules apply on base + previous taxes (by priority). Rates are basis points.
- Negative amounts (returns) are mirrored from the positive calculation.
- Rules can be limited to a location's tax region.

## Consequences

100% line coverage plus property tests for inclusive round-trips and exclusive totals.
