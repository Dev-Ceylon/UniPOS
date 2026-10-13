import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Customers and purchase history. */
export const manifest: ModuleManifest = {
  ...MODULES["customers"],
  nav: [{ href: "/customers", labelKey: "customers", icon: "Users", module: "customers", permission: "customers.view", order: 40 }],
};
