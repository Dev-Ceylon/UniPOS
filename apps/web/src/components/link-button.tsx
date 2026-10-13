import { cn } from "@unipos/ui";
import Link from "next/link";

const styles = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover",
  outline: "border border-border bg-surface hover:bg-surface-2",
  ghost: "hover:bg-surface-2",
};

/** A Next.js link styled as a button. */
export function LinkButton({
  href,
  variant = "outline",
  className,
  children,
  download,
}: {
  href: string;
  variant?: keyof typeof styles;
  className?: string;
  children: React.ReactNode;
  download?: boolean;
}) {
  const cls = cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] px-4 text-sm font-medium transition-colors",
    styles[variant],
    className,
  );
  if (download || href.startsWith("/api/")) {
    return (
      <a href={href} className={cls} download={download || undefined}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
