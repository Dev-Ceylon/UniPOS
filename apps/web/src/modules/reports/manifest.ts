import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Dashboards and exportable reports. */
export const manifest: ModuleManifest = {
  ...MODULES["reports"],
  nav: [
    { href: "/reports", labelKey: "reports", icon: "BarChart3", module: "reports", permission: "reports.view", order: 50 },
  ],
};
