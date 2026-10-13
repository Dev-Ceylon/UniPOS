import { Alert, Card } from "@unipos/ui";
import { getPrisma } from "@unipos/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/context";
import { AcceptInvite } from "./accept";

export default async function AcceptInvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-up?next=${encodeURIComponent(`/accept-invite/${id}`)}`);
  const invite = await getPrisma().invitation.findUnique({ where: { id }, include: { tenant: true } });
  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return <Alert tone="danger">This invitation is invalid or has expired.</Alert>;
  }
  if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return <Alert tone="warning">This invitation was sent to {invite.email}. Sign in with that email to accept it.</Alert>;
  }
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">Join {invite.tenant.name}</h1>
      <p className="mt-1 text-sm text-muted">You have been invited to work at {invite.tenant.name}. Choose a PIN for quick sign-in at the register.</p>
      <AcceptInvite invitationId={id} />
    </Card>
  );
}
