import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Tables, modifiers, kitchen display. */
export const manifest: ModuleManifest = {
  ...MODULES["restaurant"],
  nav: [
    { href: "/kitchen", labelKey: "kitchen", icon: "ChefHat", module: "restaurant", permission: "restaurant.use", order: 2 },
    { href: "/restaurant", labelKey: "floorPlan", icon: "LayoutGrid", module: "restaurant", permission: "restaurant.manage", order: 35 },
  ],
};
