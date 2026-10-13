import { exportBackup, getPrisma, withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiContext("backup.manage");
  if (ctx instanceof NextResponse) return ctx;
  const t = await getPrisma().tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const backup = await withTenant(
    ctx.tenantId,
    (tx) =>
      exportBackup(tx, ctx, {
        id: t.id,
        name: t.name,
        businessType: t.businessType,
        currency: t.currency,
        locale: t.locale,
        timezone: t.timezone,
        enabledModules: t.enabledModules,
        settings: t.settings,
        theme: t.theme,
      }),
    { timeout: 120_000 },
  );
  return new Response(JSON.stringify(backup), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="unipos-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
