"use server";
import { OnboardingSchema } from "@unipos/core";
import { bootstrapTenant, getPrisma } from "@unipos/db";
import { cookies, headers } from "next/headers";
import { auth } from "@/lib/auth";
import { errorMessage } from "@/lib/actions";
import { hashPin } from "@/lib/pin";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "shop"
  );
}

export async function createBusiness(raw: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const h = await headers();
    const session = await auth.api.getSession({ headers: h });
    if (!session) return { ok: false, error: "Please sign in again." };
    const rate = String(raw.taxRate ?? "").trim();
    const input = OnboardingSchema.parse({
      ...raw,
      taxRateBp: rate ? Math.round(Number(rate) * 100) : undefined,
      taxName: String(raw.taxName ?? "").trim() || undefined,
    });
    const slug = `${slugify(input.businessName)}-${Math.random().toString(36).slice(2, 7)}`;
    const org = await auth.api.createOrganization({ body: { name: input.businessName, slug }, headers: h });
    if (!org) return { ok: false, error: "Could not create the business" };
    const member = await getPrisma().member.findFirstOrThrow({ where: { tenantId: org.id, userId: session.user.id } });
    await bootstrapTenant({
      tenantId: org.id,
      ownerMemberId: member.id,
      ownerName: session.user.name,
      businessType: input.businessType,
      currency: input.currency,
      locale: input.locale,
      timezone: input.timezone,
      locationName: input.locationName,
      taxName: input.taxName,
      taxRateBp: input.taxRateBp,
      taxInclusive: input.taxInclusive,
      pinHash: await hashPin(input.pin),
      seedDemo: input.seedDemo,
    });
    await auth.api.setActiveOrganization({ body: { organizationId: org.id }, headers: h });
    (await cookies()).set("NEXT_LOCALE", input.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e).error };
  }
}
