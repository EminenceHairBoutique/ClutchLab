import { describe, expect, it } from "vitest";

import { EnvValidationError, parseServerEnv, resolveAuthMode } from "./env";

const SUPABASE_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-12345678901234567890",
};

describe("parseServerEnv", () => {
  it("accepts an empty environment in development with safe defaults", () => {
    const env = parseServerEnv({});
    expect(env.appEnv).toBe("development");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
    expect(env.AUTH_MOCK).toBe(false);
  });

  it("resolves APP_ENV override ahead of NODE_ENV", () => {
    const env = parseServerEnv({ NODE_ENV: "production", APP_ENV: "test", ...SUPABASE_VARS });
    expect(env.appEnv).toBe("test");
  });

  it("rejects production without Supabase configuration", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(EnvValidationError);
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL is required/,
    );
  });

  it("rejects AUTH_MOCK in production even when Supabase is configured", () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: "production", AUTH_MOCK: "1", ...SUPABASE_VARS }),
    ).toThrow(/AUTH_MOCK must not be enabled in production/);
  });

  it("accepts a fully configured production environment", () => {
    const env = parseServerEnv({ NODE_ENV: "production", ...SUPABASE_VARS });
    expect(env.appEnv).toBe("production");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(SUPABASE_VARS.NEXT_PUBLIC_SUPABASE_URL);
  });

  it("rejects malformed URLs", () => {
    expect(() => parseServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      EnvValidationError,
    );
  });

  it("coerces booleanish flags", () => {
    expect(parseServerEnv({ AUTH_MOCK: "true" }).AUTH_MOCK).toBe(true);
    expect(parseServerEnv({ AUTH_MOCK: "0" }).AUTH_MOCK).toBe(false);
    expect(parseServerEnv({ NEXT_PUBLIC_AUTH_GOOGLE: "1" }).NEXT_PUBLIC_AUTH_GOOGLE).toBe(true);
  });

  it("requires a model ID whenever the AI key is set (no hard-coded models)", () => {
    expect(() => parseServerEnv({ ANTHROPIC_API_KEY: "sk-ant-test-key" })).toThrow(
      /AI_COACH_MODEL is required/,
    );
    const env = parseServerEnv({
      ANTHROPIC_API_KEY: "sk-ant-test-key",
      AI_COACH_MODEL: "model-from-config",
    });
    expect(env.AI_COACH_MODEL).toBe("model-from-config");
  });

  it("requires webhook secret and price IDs whenever the Stripe key is set", () => {
    expect(() => parseServerEnv({ STRIPE_SECRET_KEY: "sk_test_123456" })).toThrow(
      /STRIPE_WEBHOOK_SECRET is required/,
    );
    expect(() => parseServerEnv({ STRIPE_SECRET_KEY: "sk_test_123456" })).toThrow(
      /STRIPE_PRICE_PRO and STRIPE_PRICE_ELITE are required/,
    );
    const env = parseServerEnv({
      STRIPE_SECRET_KEY: "sk_test_123456",
      STRIPE_WEBHOOK_SECRET: "whsec_123456789",
      STRIPE_PRICE_PRO: "price_pro",
      STRIPE_PRICE_ELITE: "price_elite",
    });
    expect(env.STRIPE_PRICE_PRO).toBe("price_pro");
  });
});

describe("resolveAuthMode", () => {
  it("uses mock mode when Supabase is not configured in development", () => {
    expect(resolveAuthMode(parseServerEnv({}))).toBe("mock");
  });

  it("uses supabase mode when configured", () => {
    expect(resolveAuthMode(parseServerEnv(SUPABASE_VARS))).toBe("supabase");
  });

  it("honours AUTH_MOCK even when Supabase is configured (non-production)", () => {
    expect(resolveAuthMode(parseServerEnv({ AUTH_MOCK: "1", ...SUPABASE_VARS }))).toBe("mock");
  });
});
