import "server-only";
import { can, type Permission } from "@unipos/core";
import { NextResponse } from "next/server";
import { getAppContext, type AppContext } from "./context";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Route-handler guard: session + tenant + permission. */
export async function apiContext(permission?: Permission): Promise<AppContext | NextResponse> {
  const ctx = await getAppContext();
  if (!ctx) return json({ error: "unauthorized" }, { status: 401 });
  if (permission && !can(ctx.member, permission)) return json({ error: "forbidden", permission }, { status: 403 });
  return ctx;
}
