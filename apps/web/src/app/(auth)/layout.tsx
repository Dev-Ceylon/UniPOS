import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-3xl font-bold tracking-tight text-primary-ink">UniPOS</p>
          <p className="text-sm text-muted">{t("tagline")}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
