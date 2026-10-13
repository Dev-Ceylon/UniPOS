# ADR-005: Append-only stock ledger

- Status: Accepted
- Date: 2026-10-13

## Context

Overwriting stock counts loses history and breaks offline merges.

## Decision

- Every movement (sale, return, adjust, receive, transfer_out/in, stocktake, opening, void) is a `StockMovement` row; updates are blocked by a trigger.
- `StockLevel.onHand` is a cache updated in the same transaction with an atomic upsert (`recordMovements`).
- `rebuildStockLevels()` recomputes the cache from the ledger and is the test oracle.
- Stocktakes post the variance (counted − expected) on top of current stock, so sales during the count are not lost.

## Consequences

Property test: cached levels equal the ledger sum for any sequence of movement batches; integration tests check `rebuildStockLevels() == 0` after every flow.
