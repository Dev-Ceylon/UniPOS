import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { getAppContext } from "@/lib/context";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UniPOS", template: "%s · UniPOS" },
  description: "Modular, offline-first point of sale",
  applicationName: "UniPOS",
  appleWebApp: { capable: true, title: "UniPOS", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1877F2" },
    { media: "(prefers-color-scheme: dark)", color: "#18191A" },
  ],
  width: "device-width",
  initialScale: 1,
};

const RADIUS: Record<string, string> = { none: "0rem", sm: "0.25rem", md: "0.5rem", lg: "0.875rem" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const store = await cookies();
  const theme = store.get("unipos_theme")?.value;
  const ctx = await getAppContext().catch(() => null);
  const style = ctx
    ? ({ "--primary": ctx.tenant.theme.primary, "--radius": RADIUS[ctx.tenant.theme.radius] ?? "0.5rem" } as React.CSSProperties)
    : undefined;
  return (
    <html lang={locale} data-theme={theme === "dark" || theme === "light" ? theme : undefined} style={style} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {children}
          <Toaster richColors position="top-center" closeButton />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
