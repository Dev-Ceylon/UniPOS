import type { ModuleMeta, NavItemMeta } from "@unipos/core";

/**
 * A module registers its nav items (routes live under src/app), and its
 * permissions/settings come from @unipos/core. Enabling or disabling a module
 * per tenant changes nav, register and receipts with no code change (ADR-002).
 */
export interface ModuleManifest extends ModuleMeta {
  nav: NavItemMeta[];
}
