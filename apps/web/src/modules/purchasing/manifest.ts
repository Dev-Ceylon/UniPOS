import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Suppliers, purchase orders, receiving. */
export const manifest: ModuleManifest = {
  ...MODULES["purchasing"],
  nav: [{ href: "/purchasing", labelKey: "purchasing", icon: "Truck", module: "purchasing", permission: "purchasing.manage", order: 33 }],
};
