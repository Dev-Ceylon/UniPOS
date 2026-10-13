import { getPrisma } from "@unipos/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
