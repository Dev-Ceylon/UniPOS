import "server-only";
import { can, ForbiddenError, type ModuleId, type Permission } from "@unipos/core";
import { withTenant, type Tx } from "@unipos/db";
import { ZodError } from "zod";
import { getAppContext, type AppContext } from "./context";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function isNextControlFlow(e: unknown): boolean {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND" || digest.startsWith("NEXT_HTTP_ERROR"));
}

/** Errors whose messages are written for users (domain errors from @unipos/db and core). */
const SAFE_ERRORS = new Set(["Error", "RangeError", "SaleError", "ShiftError", "InventoryError", "CatalogError", "SyncRejection", "UserError"]);

export class UserError extends Error {}

export function errorMessage(e: unknown): { error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ForbiddenError) return { error: `You don't have permission to do this (${e.permission}).` };
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return { error: e.issues[0]?.message ?? "Invalid input", fieldErrors };
  }
  if (e instanceof Error && SAFE_ERRORS.has(e.constructor.name)) return { error: e.message };
  console.error(e);
  return { error: "Something went wrong. Please try again." };
}

/**
 * The one wrapper every server action uses: authenticates, checks the module is
 * enabled and the permission is granted (ADR-009), then runs inside a
 * tenant-scoped transaction (ADR-001).
 */
export async function action<T>(
  permission: Permission | null,
  fn: (ctx: AppContext, tx: Tx) => Promise<T>,
  opts: { module?: ModuleId; timeout?: number } = {},
): Promise<ActionResult<T>> {
  try {
    const ctx = await getAppContext();
    if (!ctx) return { ok: false, error: "Please sign in again." };
    if (opts.module && !ctx.tenant.modules.includes(opts.module)) return { ok: false, error: "This module is turned off." };
    if (permission && !can(ctx.member, permission)) throw new ForbiddenError(permission);
    const data = await withTenant(ctx.tenantId, (tx) => fn(ctx, tx), { timeout: opts.timeout });
    return { ok: true, data };
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    return { ok: false, ...errorMessage(e) };
  }
}

/** Read helper for server components. */
export async function read<T>(ctx: AppContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTenant(ctx.tenantId, fn);
}
