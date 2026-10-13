/**
 * Permission strings grouped into editable roles (ADR-009). One `can()` helper
 * is used on the server (authoritative) and on the client (to hide UI).
 */

export const PERMISSIONS = {
  "dashboard.view": "View dashboard",
  "register.use": "Use the register",
  "sales.view": "View sales history",
  "sales.discount": "Apply discounts",
  "sales.discount_override": "Apply discounts above the threshold",
  "sales.price_override": "Override prices",
  "sales.void": "Void sales and lines",
  "sales.refund": "Process refunds",
  "shifts.manage": "Open and close shifts",
  "shifts.view_all": "View all shifts",
  "products.view": "View products",
  "products.edit": "Create and edit products",
  "products.import": "Import and export products",
  "inventory.view": "View stock levels",
  "inventory.adjust": "Adjust stock",
  "inventory.stocktake": "Run stocktakes",
  "inventory.transfer": "Transfer stock between locations",
  "purchasing.manage": "Manage suppliers and purchase orders",
  "customers.view": "View customers",
  "customers.edit": "Create and edit customers",
  "customers.privacy": "Export and delete customer data",
  "giftcards.manage": "Issue gift cards",
  "reports.view": "View reports",
  "reports.export": "Export reports",
  "restaurant.use": "Use tables and kitchen display",
  "restaurant.manage": "Manage floor plan and modifiers",
  "quotes.manage": "Manage quotations",
  "expenses.manage": "Manage expenses",
  "settings.view": "View settings",
  "settings.edit": "Edit business settings",
  "settings.modules": "Enable and disable modules",
  "members.manage": "Manage staff and roles",
  "audit.view": "View the audit log",
  "backup.manage": "Export and restore backups",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** A grant is a permission, a group wildcard such as `sales.*`, or `*`. */
export type Grant = Permission | `${string}.*` | "*";

export interface PermissionSubject {
  permissions: readonly string[];
}

export function can(subject: PermissionSubject | null | undefined, permission: Permission): boolean {
  if (!subject) return false;
  const [group] = permission.split(".");
  for (const g of subject.permissions) {
    if (g === "*" || g === permission || g === `${group}.*`) return true;
  }
  return false;
}

export function canAny(subject: PermissionSubject | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(subject, p));
}

export class ForbiddenError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(subject: PermissionSubject | null | undefined, permission: Permission): void {
  if (!can(subject, permission)) throw new ForbiddenError(permission);
}

/** Expand wildcards into concrete permissions (for the role editor). */
export function expandGrants(grants: readonly string[]): Permission[] {
  return ALL_PERMISSIONS.filter((p) => can({ permissions: grants }, p));
}

export function isValidGrant(g: string): g is Grant {
  if (g === "*") return true;
  if (g.endsWith(".*")) return ALL_PERMISSIONS.some((p) => p.startsWith(g.slice(0, -1)));
  return g in PERMISSIONS;
}

export const DEFAULT_ROLES: Record<string, { name: string; permissions: Grant[]; system: boolean }> = {
  owner: { name: "Owner", permissions: ["*"], system: true },
  manager: {
    name: "Manager",
    system: true,
    permissions: [
      "dashboard.view",
      "register.use",
      "sales.*",
      "shifts.*",
      "products.*",
      "inventory.*",
      "purchasing.*",
      "customers.*",
      "giftcards.*",
      "reports.*",
      "restaurant.*",
      "quotes.*",
      "expenses.*",
      "settings.view",
      "audit.view",
    ],
  },
  cashier: {
    name: "Cashier",
    system: true,
    permissions: ["register.use", "sales.view", "sales.discount", "shifts.manage", "products.view", "customers.view", "customers.edit", "restaurant.use"],
  },
  inventory: {
    name: "Inventory clerk",
    system: true,
    permissions: ["products.*", "inventory.*", "purchasing.*"],
  },
};
