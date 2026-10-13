# Contributing

1. Read [CLAUDE.md](CLAUDE.md) (rules) and the [ADRs](docs/adr/README.md).
2. Branch from `main` as `feat/<short-name>` or `fix/<short-name>`; keep PRs to about a day of work.
3. Use Conventional Commits (`feat(register): …`, `fix(db): …`) — enforced by commitlint via Husky.
4. Before pushing: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`; for DB changes also `pnpm test:integration`; for UI flows `pnpm test:e2e`.
5. Core logic (money, tax, stock, sync) needs tests first; aim to keep core coverage above 80%.
6. Schema changes: edit `packages/db/prisma/schema.prisma`, run `pnpm --filter @unipos/db migrate:dev`, and add RLS policies for new tenant tables. CI fails if migrations and schema drift.
7. Add a changeset (`pnpm changeset`) for user-visible changes. PRs are squash-merged.

New ideas outside the v1.0 scope go to issues labelled `post-v1`.
