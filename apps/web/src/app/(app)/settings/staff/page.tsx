import { getPrisma } from "@unipos/db";
import { PageHeader } from "@unipos/ui";
import { read } from "@/lib/actions";
import { requireContext } from "@/lib/context";
import { RolesEditor, StaffList } from "./staff";

export const metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const ctx = await requireContext("members.manage");
  const prisma = getPrisma();
  const [members, invites] = await Promise.all([
    prisma.member.findMany({ where: { tenantId: ctx.tenantId }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({ where: { tenantId: ctx.tenantId, status: "pending", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const roles = await read(ctx, (tx) => tx.role.findMany({ orderBy: [{ system: "desc" }, { name: "asc" }] }));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff & roles" description="Invite staff by email. Everyone gets a PIN for fast cashier switching at the till." />
      <StaffList
        members={members.map((m) => ({
          id: m.id,
          name: m.displayName || m.user.name,
          email: m.user.email,
          owner: m.role === "owner",
          roleId: m.roleId ?? "",
          active: m.active,
          hasPin: !!m.pinHash,
          locked: !!m.pinLockedUntil && m.pinLockedUntil > new Date(),
          allowedLocationIds: m.allowedLocationIds,
        }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, roleId: i.roleId ?? "" }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name, key: r.key }))}
        locations={ctx.locations.map((l) => ({ id: l.id, name: l.name }))}
      />
      <RolesEditor roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name, permissions: r.permissions, system: r.system }))} />
    </div>
  );
}
