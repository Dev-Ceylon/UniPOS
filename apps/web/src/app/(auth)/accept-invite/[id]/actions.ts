"use server";
import { PinSchema } from "@unipos/core";
import { getPrisma, withTenant, writeAudit } from "@unipos/db";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hashPin } from "@/lib/pin";

export async function acceptInvitation(invitationId: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = PinSchema.safeParse(pin);
  if (!parsed.success) return { ok: false, error: "PIN must be 4–6 digits" };
  const h = await headers();
  const prisma = getPrisma();
  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite) return { ok: false, error: "Invitation not found" };
  try {
    await auth.api.acceptInvitation({ body: { invitationId }, headers: h });
  } catch (e) {
    return { ok: false, error: (e as Error).message || "Could not accept the invitation" };
  }
  const session = await auth.api.getSession({ headers: h });
  const member = await prisma.member.findFirst({ where: { tenantId: invite.tenantId, userId: session!.user.id } });
  if (!member) return { ok: false, error: "Membership was not created" };
  await prisma.member.update({ where: { id: member.id }, data: { roleId: invite.roleId, pinHash: await hashPin(parsed.data), displayName: session!.user.name } });
  await auth.api.setActiveOrganization({ body: { organizationId: invite.tenantId }, headers: h });
  await withTenant(invite.tenantId, (tx) => writeAudit(tx, { memberId: member.id, name: session!.user.name }, "member.join", "Member", member.id, { after: { roleId: invite.roleId } }));
  return { ok: true };
}
