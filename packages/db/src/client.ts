import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

export { Prisma, PrismaClient };

const globalForPrisma = globalThis as unknown as { __uniposPrisma?: PrismaClient };

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!url) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString: url, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  return new PrismaClient({ adapter });
}

/** Shared client (connects as the RLS-restricted app role). */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__uniposPrisma) globalForPrisma.__uniposPrisma = createPrismaClient();
  return globalForPrisma.__uniposPrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getPrisma() as unknown as Record<string | symbol, unknown>;
    const v = client[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
});

export type Tx = Prisma.TransactionClient;

/**
 * Run `fn` in a transaction scoped to one tenant. Sets `app.tenant_id` for the
 * transaction so Postgres RLS filters every query (ADR-001). All business data
 * access goes through here.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  opts: { client?: PrismaClient; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel } = {},
): Promise<T> {
  if (!tenantId) throw new Error("withTenant: tenantId is required");
  const client = opts.client ?? getPrisma();
  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    },
    { timeout: opts.timeout ?? 20_000, maxWait: 10_000, isolationLevel: opts.isolationLevel },
  );
}
