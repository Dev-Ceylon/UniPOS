"use client";
import { Alert, Button, Input } from "@unipos/ui";
import { useState } from "react";
import { toast } from "sonner";
import { useAction } from "@/components/use-action";
import { restoreBackupAction } from "./actions";

export function RestoreForm() {
  const [text, setText] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const { run, pending } = useAction();
  return (
    <div className="flex flex-col gap-3">
      <input
        type="file"
        accept="application/json,.json"
        aria-label="Backup file"
        className="text-sm"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > 200 * 1024 * 1024) return toast.error("File too large");
          setText(await f.text());
        }}
      />
      <Input
        placeholder='Type "RESTORE" to confirm'
        aria-label="Confirmation"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="max-w-xs"
      />
      <div>
        <Button
          variant="danger"
          disabled={!text || confirmText !== "RESTORE"}
          loading={pending}
          onClick={() => run(() => restoreBackupAction(text!), { onOk: setDone, success: "Backup restored" })}
        >
          Restore backup
        </Button>
      </div>
      {done !== null ? <Alert tone="success">Restored {done} records.</Alert> : null}
    </div>
  );
}
