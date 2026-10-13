import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Business expenses. */
export const manifest: ModuleManifest = {
  ...MODULES["expenses"],
  nav: [
    { href: "/expenses", labelKey: "expenses", icon: "Banknote", module: "expenses", permission: "expenses.manage", order: 43 },
  ],
};
