import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Stock ledger, adjustments, stocktakes. */
export const manifest: ModuleManifest = {
  ...MODULES["inventory"],
  nav: [{ href: "/inventory", labelKey: "inventory", icon: "Boxes", module: "inventory", permission: "inventory.view", order: 31 }],
};
