import { PRESETS } from "@unipos/core";
import { describe, expect, it } from "vitest";
import { ALL_NAV, MODULE_REGISTRY, navFor } from "./registry";

describe("module registry", () => {
  it("every module has a manifest and nav items point at their own module", () => {
    expect(MODULE_REGISTRY.map((m) => m.id).sort()).toEqual(
      Object.keys(PRESETS.retail.modules.reduce((a, m) => ({ ...a, [m]: 1 }), {} as Record<string, number>))
        .concat("restaurant")
        .sort(),
    );
    for (const m of MODULE_REGISTRY) for (const n of m.nav) expect(n.module).toBe(m.id);
    expect(new Set(ALL_NAV.map((n) => n.href)).size).toBe(ALL_NAV.length);
  });

  it("presets change the navigation with no code change", () => {
    const all = () => true;
    const retail = navFor(PRESETS.retail.modules, all).map((n) => n.href);
    const restaurant = navFor(PRESETS.restaurant.modules, all).map((n) => n.href);
    expect(retail).toContain("/inventory/transfers");
    expect(retail).not.toContain("/kitchen");
    expect(restaurant).toContain("/kitchen");
    expect(restaurant).not.toContain("/inventory/transfers");
    expect(navFor(PRESETS.retail.modules, (p) => p === "register.use").map((n) => n.href)).toEqual(["/register"]);
  });
});
