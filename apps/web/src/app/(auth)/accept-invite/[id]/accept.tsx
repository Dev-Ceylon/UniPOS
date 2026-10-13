"use client";
import { Alert, Button, Field, Input } from "@unipos/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptInvitation } from "./actions";

export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="mt-4 flex flex-col gap-3"
      action={(fd) =>
        start(async () => {
          const res = await acceptInvitation(invitationId, String(fd.get("pin")));
          if (!res.ok) setError(res.error);
          else router.replace("/");
        })
      }
    >
      <Field label="PIN (4–6 digits)" htmlFor="pin">
        <Input id="pin" name="pin" inputMode="numeric" pattern="\d{4,6}" required autoComplete="off" />
      </Field>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button type="submit" loading={pending}>
        Accept invitation
      </Button>
    </form>
  );
}
