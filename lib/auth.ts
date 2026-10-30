import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db, schema } from "@/db";

export type UserRole = "REPORTER" | "OPERATOR" | "TECHNICIAN";
export type AccountStatus = "ACTIVE" | "INACTIVE";

export const AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ||
  "airport-perimeter-reporting-system-yia-secret-key-2026";

/**
 * Helper to derive a deterministic internal email from NIP when Better-Auth
 * requires an email address on the user record.
 */
export function nipToEmail(nip: string): string {
  return `${nip.trim()}@perimeter.yia.id`;
}

export const auth = betterAuth({
  secret: AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes signed cache for fast proxy checks
    },
  },
  user: {
    additionalFields: {
      nip: {
        type: "string",
        required: true,
        input: true,
      },
      role: {
        type: "string",
        required: true,
        defaultValue: "REPORTER",
        input: true,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      unit: {
        type: "string",
        required: false,
        defaultValue: "Operasional Bandara",
        input: true,
      },
      status: {
        type: "string",
        required: false,
        defaultValue: "ACTIVE",
        input: true,
      },
    },
  },
  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 30,
      usernameValidator: (val) => /^[0-9]+$/.test(val),
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
