import { visibleNav, type ModuleId, type NavItemMeta, type Permission } from "@unipos/core";
import { manifest as core } from "./core/manifest";
import { manifest as register } from "./register/manifest";
import { manifest as catalog } from "./catalog/manifest";
import { manifest as inventory } from "./inventory/manifest";
import { manifest as multilocation } from "./multilocation/manifest";
import { manifest as purchasing } from "./purchasing/manifest";
import { manifest as customers } from "./customers/manifest";
import { manifest as loyalty } from "./loyalty/manifest";
import { manifest as giftcards } from "./giftcards/manifest";
import { manifest as reports } from "./reports/manifest";
import { manifest as restaurant } from "./restaurant/manifest";
import { manifest as quotes } from "./quotes/manifest";
import { manifest as expenses } from "./expenses/manifest";
import type { ModuleManifest } from "./types";

export const MODULE_REGISTRY: ModuleManifest[] = [core, register, catalog, inventory, multilocation, purchasing, customers, loyalty, giftcards, reports, restaurant, quotes, expenses];

export const ALL_NAV: NavItemMeta[] = MODULE_REGISTRY.flatMap((m) => m.nav);

export function navFor(enabled: readonly ModuleId[], can: (p: Permission) => boolean): NavItemMeta[] {
  return visibleNav(ALL_NAV, enabled, can);
}
