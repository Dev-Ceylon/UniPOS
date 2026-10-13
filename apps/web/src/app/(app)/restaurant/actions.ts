"use server";
import { writeAudit } from "@unipos/db";
import { z } from "zod";
import { action } from "@/lib/actions";

const TableSchema = z.object({
  name: z.string().trim().min(1).max(20),
  seats: z.number().int().min(1).max(50),
  area: z.string().trim().min(1).max(40),
  shape: z.enum(["square", "round", "long"]),
});

export async function saveTable(id: string | null, input: unknown) {
  return action(
    "restaurant.manage",
    async (ctx, tx) => {
      const d = TableSchema.parse(input);
      const t = id
        ? await tx.diningTable.update({ where: { id }, data: d })
        : await tx.diningTable.create({ data: { ...d, locationId: ctx.locationId, x: 20, y: 20 } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "table.save", "DiningTable", t.id);
      return t.id;
    },
    { module: "restaurant" },
  );
}

export async function moveTable(id: string, x: number, y: number) {
  return action(
    "restaurant.manage",
    async (_ctx, tx) => {
      await tx.diningTable.update({ where: { id }, data: { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) } });
      return true;
    },
    { module: "restaurant" },
  );
}

export async function deleteTable(id: string) {
  return action(
    "restaurant.manage",
    async (_ctx, tx) => {
      await tx.tableTab.deleteMany({ where: { tableId: id } });
      await tx.diningTable.update({ where: { id }, data: { deletedAt: new Date() } });
      return true;
    },
    { module: "restaurant" },
  );
}

export async function bumpTicket(id: string, status: "in_progress" | "ready" | "bumped" | "new") {
  return action(
    "restaurant.use",
    async (_ctx, tx) => {
      await tx.kitchenTicket.update({ where: { id }, data: { status, bumpedAt: status === "bumped" ? new Date() : null } });
      return true;
    },
    { module: "restaurant" },
  );
}
