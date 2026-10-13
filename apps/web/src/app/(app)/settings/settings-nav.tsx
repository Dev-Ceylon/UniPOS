"use client";
import { cn } from "@unipos/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNav({ sections }: { sections: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col">
      {sections.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={path === s.href ? "page" : undefined}
          className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium", path === s.href ? "bg-primary-soft text-primary" : "hover:bg-surface-2")}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
