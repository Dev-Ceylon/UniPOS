import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Quotations that convert to sales. */
export const manifest: ModuleManifest = {
  ...MODULES["quotes"],
  nav: [{ href: "/quotes", labelKey: "quotes", icon: "FileText", module: "quotes", permission: "quotes.manage", order: 42 }],
};
