import { z } from "zod";

/**
 * Client-safe environment. Only NEXT_PUBLIC_* values, accessed as literal
 * `process.env.NEXT_PUBLIC_*` property reads so Next.js can inline them at build time.
 * Validation stays permissive here — strict enforcement happens server-side in env.ts.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_AUTH_GOOGLE: z.enum(["1", "true", "0", "false"]).optional(),
  NEXT_PUBLIC_AUTH_APPLE: z.enum(["1", "true", "0", "false"]).optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;

/** Blank ("") env values are treated as unset (see env.ts blankToUndefined). */
const blank = (v: string | undefined): string | undefined => (v === "" ? undefined : v);

export const clientEnv: ClientEnv = clientSchema.parse({
  NEXT_PUBLIC_APP_URL: blank(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_SUPABASE_URL: blank(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: blank(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_SENTRY_DSN: blank(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_AUTH_GOOGLE: blank(process.env.NEXT_PUBLIC_AUTH_GOOGLE),
  NEXT_PUBLIC_AUTH_APPLE: blank(process.env.NEXT_PUBLIC_AUTH_APPLE),
});

export function isOAuthEnabled(provider: "google" | "apple"): boolean {
  const value =
    provider === "google" ? clientEnv.NEXT_PUBLIC_AUTH_GOOGLE : clientEnv.NEXT_PUBLIC_AUTH_APPLE;
  return value === "1" || value === "true";
}
