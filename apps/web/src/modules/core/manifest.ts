import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Business, locations, staff and settings. */
export const manifest: ModuleManifest = {
  ...MODULES["core"],
  nav: [
    { href: "/dashboard", labelKey: "dashboard", icon: "LayoutDashboard", module: "core", permission: "dashboard.view", order: 10 },
    { href: "/settings", labelKey: "settings", icon: "Settings", module: "core", permission: "settings.view", order: 100 },
  ],
};
