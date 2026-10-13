"use client";
import { Alert, Button, Card, Field, Input } from "@unipos/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode, googleEnabled }: { mode: "sign-in" | "sign-up"; googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    const res =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(fd.get("name")) });
    setLoading(false);
    if (res.error) {
      setError(mode === "sign-in" && res.error.status === 401 ? t("invalid") : (res.error.message ?? "Error"));
      return;
    }
    router.replace(mode === "sign-up" && next === "/" ? "/onboarding" : next);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <h1 className="mb-4 text-xl font-semibold">{mode === "sign-in" ? t("welcome") : t("createTitle")}</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
        {mode === "sign-up" ? (
          <Field label={t("name")} htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required minLength={2} />
          </Field>
        ) : null}
        <Field label={t("email")} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label={t("password")} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={8} />
        </Field>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" loading={loading}>
          {mode === "sign-in" ? t("signIn") : t("signUp")}
        </Button>
      </form>
      {googleEnabled ? (
        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: mode === "sign-up" ? "/onboarding" : next })}
        >
          {t("google")}
        </Button>
      ) : null}
      <p className="mt-4 text-center text-sm text-muted">
        {mode === "sign-in" ? t("noAccount") : t("haveAccount")}{" "}
        <Link
          className="font-medium text-primary-ink underline"
          href={`${mode === "sign-in" ? "/sign-up" : "/sign-in"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
        >
          {mode === "sign-in" ? t("signUp") : t("signIn")}
        </Link>
      </p>
    </Card>
  );
}
