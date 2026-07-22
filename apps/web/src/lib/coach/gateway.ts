import "server-only";

import { AnthropicCoachProvider, MockCoachProvider, type CoachProvider } from "@clutchlab/coach";
import { getServerEnv } from "@clutchlab/config/env";

/**
 * Coach provider selection (spec §8.2 provider abstraction): the real
 * Anthropic-backed provider when credentials + model are configured, otherwise
 * the clearly-labeled mock. Model IDs come exclusively from AI_COACH_MODEL.
 */

export type CoachMode = "anthropic" | "mock";

export function coachMode(): CoachMode {
  const env = getServerEnv();
  return env.ANTHROPIC_API_KEY && env.AI_COACH_MODEL ? "anthropic" : "mock";
}

export function getCoachProvider(): CoachProvider {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY && env.AI_COACH_MODEL) {
    return new AnthropicCoachProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_COACH_MODEL });
  }
  return new MockCoachProvider();
}
