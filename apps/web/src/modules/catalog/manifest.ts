import { MODULES } from "@unipos/core";
import type { ModuleManifest } from "../types";

/** Products, variants, categories, taxes. */
export const manifest: ModuleManifest = {
  ...MODULES["catalog"],
  nav: [
    { href: "/products", labelKey: "products", icon: "Package", module: "catalog", permission: "products.view", order: 30 },
  ],
};
