import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Sell, take payments, receipts, shifts. */
export const manifest: ModuleManifest = {
  ...MODULES["register"],
  nav: [
    { href: "/register", labelKey: "register", icon: "ShoppingCart", module: "register", permission: "register.use", order: 1 },
    { href: "/sales", labelKey: "sales", icon: "Receipt", module: "register", permission: "sales.view", order: 20 },
    { href: "/shifts", labelKey: "shifts", icon: "Wallet", module: "register", permission: "shifts.manage", order: 21 },
  ],
};
