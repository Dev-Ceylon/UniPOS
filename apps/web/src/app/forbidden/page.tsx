import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function Forbidden() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">403</h1>
      <p className="text-muted">{t("forbidden")}</p>
      <Link className="text-primary underline" href="/dashboard">
        {t("back")}
      </Link>
    </main>
  );
}
