import "server-only";
import { env } from "./env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer | Uint8Array; contentType?: string }[];
}

/** Sends mail through SMTP_URL; without it, logs to the console (dev). */
export async function sendMail(msg: MailMessage): Promise<{ delivered: boolean }> {
  if (!env.smtpUrl) {
    console.info(`[mail:dev] to=${msg.to} subject=${msg.subject}\n${msg.text}`);
    return { delivered: false };
  }
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport(env.smtpUrl);
  await transport.sendMail({
    from: env.mailFrom,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    attachments: msg.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content) })),
  });
  return { delivered: true };
}
