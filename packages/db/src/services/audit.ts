import type { Tx } from "../client";
import { Prisma } from "../client";

export interface Actor {
  memberId?: string | null;
  name?: string | null;
}

/** Audit log writer: one append-only row per sensitive action. */
export async function writeAudit(
  tx: Tx,
  actor: Actor | null,
  action: string,
  entity: string,
  entityId?: string | null,
  change: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  const json = (v: unknown) => (v === undefined ? undefined : v === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue));
  await tx.auditLog.create({
    data: {
      actorId: actor?.memberId ?? null,
      actorName: actor?.name ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      before: json(change.before),
      after: json(change.after),
    },
  });
}
