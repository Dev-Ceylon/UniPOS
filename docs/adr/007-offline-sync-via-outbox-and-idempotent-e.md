# ADR-007: Offline sync via outbox and idempotent endpoint

- Status: Accepted
- Date: 2026-10-13

## Context

The register must keep selling with no connection and never lose or duplicate a sale.

## Decision

- The register writes each completed sale to IndexedDB (Dexie) `sales` and `outbox` tables in one transaction, then the `SyncEngine` posts batches (≤50) to `POST /api/v1/sync` with exponential backoff and jitter.
- The server applies each op in its own tenant transaction; replays return `duplicate` (by op id or sale id). One bad op is `rejected` without blocking the batch.
- The server is the source of truth for the catalog (`GET /api/v1/catalog` → Dexie cache); the client is the source of truth for its own sales (prices on the sale are kept), but totals are recomputed and must match.
- Negative stock is allowed offline and flagged (`negative_stock:…`) after sync; unauthorized price overrides and discounts are flagged for review.

## Consequences

`packages/db/test/sync.test.ts` runs the 8-hour / 500-sale offline scenario with forced partial failures, concurrent replays and a final retry: 500 sales, 0 duplicates, ledger consistent.
