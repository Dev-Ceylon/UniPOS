import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Gift cards as a tender. */
export const manifest: ModuleManifest = {
  ...MODULES["giftcards"],
  nav: [
    { href: "/gift-cards", labelKey: "giftCards", icon: "Gift", module: "giftcards", permission: "giftcards.manage", order: 41 },
  ],
};
