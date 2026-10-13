# Deployment

UniPOS needs a Node.js server and PostgreSQL 15+. It cannot run on static hosting.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | App connection as `unipos_app` (RLS enforced). |
| `MIGRATE_DATABASE_URL` | ✅ for migrations | Owner connection used by `prisma migrate deploy`. |
| `BETTER_AUTH_SECRET` | ✅ | 32+ random characters (`openssl rand -base64 32`). Also signs cashier PIN tokens. |
| `BETTER_AUTH_URL` | ✅ | Public URL, e.g. `https://pos.example.com`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google". |
| `SMTP_URL`, `MAIL_FROM` | optional | Invitations and emailed receipts (`smtps://user:pass@smtp.example.com:465`). Without it, mail is logged. |
| `DATABASE_POOL_SIZE` | optional | Default 10. |

## Database setup (once)

```bash
psql "$OWNER_URL" -f packages/db/prisma/sql/setup-roles.sql   # creates unipos_app (change its password!)
MIGRATE_DATABASE_URL="$OWNER_URL" pnpm db:migrate
```

On managed Postgres (Neon, Supabase, RDS) run the same SQL as the database owner and set a strong password for `unipos_app` with `ALTER ROLE unipos_app PASSWORD '…'`.

## Docker Compose (self-hosting)

```bash
cp .env.example .env    # set BETTER_AUTH_SECRET and passwords
docker compose up -d    # postgres + migrate + web on :3000
# optional demo data, from a checkout with Node 22 + pnpm:
DATABASE_URL=postgresql://unipos_app:unipos_app@localhost:5432/unipos pnpm --filter @unipos/web seed
```

## Vercel + Neon/Supabase

1. Create the database, run the setup SQL and migrations from your machine or CI.
2. Import the repo in Vercel, root directory `apps/web`, build command `cd ../.. && pnpm build`, install command `pnpm install`.
3. Set the environment variables above. `DATABASE_URL` should use the pooled connection string with the `unipos_app` user.

## Railway / Render

Use the Dockerfile. Add a Postgres service, run the setup SQL once, set env vars, and add `pnpm db:migrate` as a pre-deploy command.

## Operations

- Health check: `GET /api/health`.
- Backups: Postgres point-in-time recovery plus per-shop JSON export (Settings → Backup).
- Scaling out: the in-memory rate limiters are per instance; put Redis behind `src/lib/rate-limit.ts` before running several instances.
