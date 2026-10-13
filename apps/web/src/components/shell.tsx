"use client";
import type { NavItemMeta } from "@unipos/core";
import { Button, cn, Dialog, Select } from "@unipos/ui";
import { LogOut, Menu, Moon, Sun, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { endCashierSession, setLocalePref, setLocation, setThemePref, switchTenant } from "@/lib/shell-actions";
import { NAV_ICONS } from "./icons";
import { PinDialog } from "./pin-dialog";
import { SyncIndicator } from "./sync-indicator";

export interface ShellProps {
  tenantName: string;
  tenantId: string;
  memberships: { tenantId: string; name: string }[];
  memberName: string;
  cashierSwitched: boolean;
  nav: NavItemMeta[];
  locations: { id: string; name: string }[];
  locationId: string;
  locale: string;
  theme: string | undefined;
  children: React.ReactNode;
}

export function Shell(p: ShellProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [, start] = useTransition();
  const isRegister = pathname.startsWith("/register") || pathname.startsWith("/kitchen");

  const navList = (
    <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
      {p.nav.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`) && !p.nav.some((n) => n.href !== item.href && n.href.startsWith(item.href) && pathname.startsWith(n.href)));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary-soft text-primary" : "text-fg hover:bg-surface-2",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {t("skipToContent")}
      </a>
      <aside className={cn("no-print hidden w-60 shrink-0 flex-col border-r border-border bg-surface", isRegister ? "xl:flex" : "lg:flex")}>
        <div className="flex h-14 items-center border-b border-border px-4">
          {p.memberships.length > 1 ? (
            <Select
              aria-label="Business"
              className="h-9 text-sm font-semibold text-primary"
              value={p.tenantId}
              onChange={(e) =>
                start(async () => {
                  await switchTenant(e.target.value);
                  window.location.assign("/");
                })
              }
            >
              {p.memberships.map((m) => (
                <option key={m.tenantId} value={m.tenantId}>
                  {m.name}
                </option>
              ))}
            </Select>
          ) : (
            <Link href="/" className="truncate text-lg font-bold text-primary">
              {p.tenantName}
            </Link>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{navList}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur">
          <Button variant="ghost" size="icon" className={isRegister ? "xl:hidden" : "lg:hidden"} aria-label={t("menu")} onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className={cn("truncate font-semibold", isRegister ? "xl:hidden" : "lg:hidden")}>{p.tenantName}</span>
          <div className="ml-auto flex items-center gap-2">
            <SyncIndicator />
            {p.locations.length > 1 ? (
              <Select
                aria-label={t("location")}
                className="h-9 w-auto max-w-40"
                value={p.locationId}
                onChange={(e) =>
                  start(async () => {
                    await setLocation(e.target.value);
                    router.refresh();
                  })
                }
              >
                {p.locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setPinOpen(true)} title={t("switchCashier")}>
              <UserRound className="h-4 w-4" aria-hidden />
              <span className="hidden max-w-32 truncate sm:inline">{p.memberName}</span>
              <span className="sr-only sm:hidden">{t("switchCashier")}</span>
            </Button>
            {p.cashierSwitched ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  start(async () => {
                    await endCashierSession();
                    router.refresh();
                  })
                }
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">End cashier session</span>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("theme")}
              onClick={() =>
                start(async () => {
                  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
                  document.documentElement.dataset.theme = dark ? "light" : "dark";
                  await setThemePref(dark ? "light" : "dark");
                })
              }
            >
              <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
              <Moon className="h-4 w-4 dark:hidden" aria-hidden />
            </Button>
            <Select
              aria-label={t("language")}
              className="h-9 w-auto"
              value={p.locale}
              onChange={(e) =>
                start(async () => {
                  await setLocalePref(e.target.value);
                  router.refresh();
                })
              }
            >
              <option value="en">EN</option>
              <option value="si">සිං</option>
              <option value="ta">த</option>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("signOut")}
              onClick={async () => {
                await endCashierSession();
                await authClient.signOut();
                router.replace("/sign-in");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main id="main" className={cn("flex-1", isRegister ? "" : "p-4 lg:p-6")}>
          {p.children}
        </main>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title={p.tenantName} size="sm" className="mt-0 ml-0 h-dvh max-h-dvh rounded-none">
        {navList}
      </Dialog>
      <PinDialog open={pinOpen} onClose={() => setPinOpen(false)} />
    </div>
  );
}
