"use server";
import { restoreBackup, type Backup } from "@unipos/db";
import { action, UserError } from "@/lib/actions";

export async function restoreBackupAction(text: string) {
  return action(
    "backup.manage",
    async (ctx, tx) => {
      let data: Backup;
      try {
        data = JSON.parse(text);
      } catch {
        throw new UserError("The file is not valid JSON");
      }
      return restoreBackup(tx, ctx, data);
    },
    { timeout: 600_000 },
  );
}
