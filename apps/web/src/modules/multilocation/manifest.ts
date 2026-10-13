import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Stock transfers between locations. */
export const manifest: ModuleManifest = {
  ...MODULES["multilocation"],
  nav: [{ href: "/inventory/transfers", labelKey: "transfers", icon: "ArrowLeftRight", module: "multilocation", permission: "inventory.transfer", order: 32 }],
};
