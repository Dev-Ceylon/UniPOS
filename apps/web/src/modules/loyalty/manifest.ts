import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Points earned and redeemed. */
export const manifest: ModuleManifest = {
  ...MODULES["loyalty"],
  nav: [],
};
