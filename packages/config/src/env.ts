import { z } from "zod";

/**
 * Server-side environment validation (spec §8.3 "environment validation").
 *
 * Modes:
 * - production: Supabase URL + anon key are REQUIRED and AUTH_MOCK is forbidden —
 *   the build/boot fails fast rather than silently shipping a mocked app.
 * - development/test: Supabase config is optional. When absent (or AUTH_MOCK=1) the
 *   app runs in an explicit, visible "mock auth" mode (see auth.mock.ts adapter).
 */

const booleanish = z
  .enum(["1", "true", "0", "false"])
  .optional()
  .transform((v) => v === "1" || v === "true");

const appEnvEnum = z.enum(["development", "test", "production"]);

const rawSchema = z.object({
  NODE_ENV: appEnvEnum.default("development"),
  /** Optional override for NODE_ENV (e.g. preview deploys that build with NODE_ENV=production). */
  APP_ENV: appEnvEnum.optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  /** Server-only. Never expose to the client (spec hard rule). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  /** Direct Postgres connection for migrations/seeds/integration tests. */
  DATABASE_URL: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  /** Force the in-memory auth adapter in dev/test. Forbidden in production. */
  AUTH_MOCK: booleanish,
  NEXT_PUBLIC_AUTH_GOOGLE: booleanish,
  NEXT_PUBLIC_AUTH_APPLE: booleanish,
});

export type ServerEnv = z.infer<typeof rawSchema> & {
  /** Resolved runtime environment: APP_ENV override or NODE_ENV. */
  appEnv: z.infer<typeof appEnvEnum>;
};

export type AuthMode = "supabase" | "mock";

export class EnvValidationError extends Error {
  constructor(issues: string[]) {
    super(`Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
    this.name = "EnvValidationError";
  }
}

export type EnvSource = Record<string, string | undefined>;

export function parseServerEnv(source: EnvSource): ServerEnv {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    );
  }

  const env = parsed.data;
  const appEnv = env.APP_ENV ?? env.NODE_ENV;
  const issues: string[] = [];

  if (appEnv === "production") {
    if (!env.NEXT_PUBLIC_SUPABASE_URL) {
      issues.push("NEXT_PUBLIC_SUPABASE_URL is required in production");
    }
    if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required in production");
    }
    if (env.AUTH_MOCK) {
      issues.push("AUTH_MOCK must not be enabled in production");
    }
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return { ...env, appEnv };
}

export function resolveAuthMode(env: ServerEnv): AuthMode {
  if (env.AUTH_MOCK) return "mock";
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  // Only reachable outside production: parseServerEnv enforces Supabase config there.
  return "mock";
}

let cached: ServerEnv | undefined;

/** Memoized accessor for the running process's validated environment. */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test hook: clear the memoized environment. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
