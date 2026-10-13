import "server-only";
import { prisma } from "@unipos/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { env } from "./env";
import { sendMail } from "./mail";

export const auth = betterAuth({
  appName: "UniPOS",
  baseURL: env.appUrl,
  secret: env.secret,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
  socialProviders: env.google ? { google: env.google } : {},
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  rateLimit: {
    enabled: process.env.DISABLE_RATE_LIMIT !== "1",
    window: 60,
    max: 120,
    storage: "memory",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  trustedOrigins: [env.appUrl],
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 24 * 7,
      schema: {
        organization: { modelName: "tenant" },
        member: { fields: { organizationId: "tenantId" } },
        invitation: {
          fields: { organizationId: "tenantId" },
          additionalFields: { roleId: { type: "string", required: false, input: true } },
        },
      },
      async sendInvitationEmail(data) {
        const url = `${env.appUrl}/accept-invite/${data.id}`;
        await sendMail({
          to: data.email,
          subject: `You're invited to ${data.organization.name} on UniPOS`,
          text: `${data.inviter.user.name} invited you to join ${data.organization.name}.\n\nAccept the invitation: ${url}\n\nThe link expires in 7 days.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
