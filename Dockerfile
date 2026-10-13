# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @unipos/db generate && NEXT_OUTPUT=standalone pnpm --filter @unipos/web build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd -r unipos && useradd -r -g unipos unipos
COPY --from=build --chown=unipos:unipos /app/apps/web/.next/standalone ./
COPY --from=build --chown=unipos:unipos /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=unipos:unipos /app/apps/web/public ./apps/web/public
# Migrations (run with: docker compose run --rm migrate)
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --from=build /app/packages/db/prisma.config.ts ./packages/db/
USER unipos
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# Separate target with the Prisma CLI for migrations.
FROM deps AS migrate
COPY packages/db packages/db
WORKDIR /app/packages/db
CMD ["sh", "-c", "psql \"$MIGRATE_DATABASE_URL\" -f prisma/sql/setup-roles.sql || true; npx prisma migrate deploy"]
