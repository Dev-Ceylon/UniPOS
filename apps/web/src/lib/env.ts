/** Server environment, read lazily so builds work without secrets. */
export const env = {
  get appUrl() {
    return process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
  get secret() {
    const s = process.env.BETTER_AUTH_SECRET;
    if (!s && process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET must be set in production");
    return s ?? "dev-only-insecure-secret-change-me-0123456789";
  },
  get google() {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    return id && secret ? { clientId: id, clientSecret: secret } : null;
  },
  get smtpUrl() {
    return process.env.SMTP_URL ?? null;
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? "UniPOS <no-reply@localhost>";
  },
};
