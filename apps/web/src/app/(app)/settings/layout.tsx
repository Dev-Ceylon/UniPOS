import { can, type Permission } from "@unipos/core";
import { requireContext } from "@/lib/context";
import { SettingsNav } from "./settings-nav";

const SECTIONS: { href: string; label: string; permission: Permission }[] = [
  { href: "/settings", label: "Business", permission: "settings.view" },
  { href: "/settings/locations", label: "Locations", permission: "settings.view" },
  { href: "/settings/staff", label: "Staff & roles", permission: "members.manage" },
  { href: "/settings/modules", label: "Modules", permission: "settings.modules" },
  { href: "/settings/receipt", label: "Receipt", permission: "settings.edit" },
  { href: "/settings/custom-fields", label: "Custom fields", permission: "settings.edit" },
  { href: "/settings/theme", label: "Theme", permission: "settings.edit" },
  { href: "/settings/backup", label: "Backup", permission: "backup.manage" },
  { href: "/settings/audit", label: "Audit log", permission: "audit.view" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext("settings.view");
  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <SettingsNav sections={SECTIONS.filter((s) => can(ctx.member, s.permission)).map(({ href, label }) => ({ href, label }))} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
