import { DRILLS } from "@clutchlab/content";
import { z } from "zod";

import { OBSERVATION_SYSTEM_PROMPT, PROMPT_VERSION, REPORT_SYSTEM_PROMPT } from "./prompts";
import {
  observationSchema,
  reportDraftSchema,
  type CoachContext,
  type CoachProvider,
  type Observation,
  type ReportDraft,
} from "./types";

/**
 * Anthropic-backed coach provider. The ONLY place that talks to the Anthropic
 * API. Model ID comes from configuration (AI_COACH_MODEL) — never hard-coded.
 * Every response is zod-validated before anything downstream sees it.
 */

const ANTHROPIC_VERSION = "2023-06-01";
/** Per-job frame budget (spec §5.13 cost guardrails). */
export const MAX_FRAMES_PER_JOB = 8;
const REQUEST_TIMEOUT_MS = 90_000;

const messagesResponseSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
  stop_reason: z.string().nullable().optional(),
});

export class CoachProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CoachProviderError";
  }
}

export interface AnthropicCoachOptions {
  apiKey: string;
  /** From AI_COACH_MODEL config. */
  model: string;
  baseUrl?: string;
  /** Injectable for tests. */
  fetchFn?: typeof fetch;
}

/** Strip ```json fences if the model added them despite instructions. */
export function extractJson(text: string): string {
  const fenced = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return (fenced?.[1] ?? text).trim();
}

export class AnthropicCoachProvider implements CoachProvider {
  readonly modelId: string;
  readonly promptVersion = PROMPT_VERSION;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: AnthropicCoachOptions) {
    this.apiKey = options.apiKey;
    this.modelId = options.model;
    this.baseUrl = options.baseUrl ?? "https://api.anthropic.com";
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async extractObservations(context: CoachContext): Promise<Observation[]> {
    const frames = context.frames.slice(0, MAX_FRAMES_PER_JOB);
    const content: unknown[] = [
      {
        type: "text",
        text:
          `Recording metadata:\n` +
          `- kind: ${context.uploadKind}\n` +
          `- label: ${JSON.stringify(context.label)}\n` +
          `- duration_seconds: ${context.durationSeconds ?? "unknown"}\n` +
          `- keyframes_provided: ${frames.length}\n` +
          (frames.length === 0
            ? "No keyframes could be extracted. Remember: return [] rather than fabricating."
            : "Keyframes follow in order; they are evenly sampled across the recording."),
      },
      ...frames.map((data) => ({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data },
      })),
    ];
    const text = await this.complete(OBSERVATION_SYSTEM_PROMPT, content, 3000);
    return this.parseJson(text, z.array(observationSchema).max(40), "observation pass");
  }

  async synthesizeReport(context: CoachContext, observations: Observation[]): Promise<ReportDraft> {
    const content = [
      {
        type: "text",
        text:
          `Recording metadata:\n` +
          `- kind: ${context.uploadKind}\n` +
          `- label: ${JSON.stringify(context.label)}\n` +
          `- duration_seconds: ${context.durationSeconds ?? "unknown"}\n\n` +
          `Validated observations (JSON):\n${JSON.stringify(observations, null, 2)}\n\n` +
          `Available drill catalog (slug list — recommend ONLY from these):\n` +
          JSON.stringify(availableDrillSlugs()),
      },
    ];
    const text = await this.complete(REPORT_SYSTEM_PROMPT, content, 2000);
    return this.parseJson(text, reportDraftSchema, "report pass");
  }

  private async complete(system: string, content: unknown[], maxTokens: number): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: this.modelId,
          max_tokens: maxTokens,
          temperature: 0.2,
          system,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CoachProviderError(
        `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const body = await response.text().catch(() => "");
      throw new CoachProviderError(
        `Anthropic API ${response.status}: ${body.slice(0, 300)}`,
        retryable,
      );
    }
    const parsed = messagesResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new CoachProviderError("Anthropic response had an unexpected shape", false);
    }
    const text = parsed.data.content.find((c) => c.type === "text")?.text;
    if (!text) {
      throw new CoachProviderError("Anthropic response contained no text block", false);
    }
    return text;
  }

  private parseJson<T>(text: string, schema: z.ZodType<T>, stage: string): T {
    let raw: unknown;
    try {
      raw = JSON.parse(extractJson(text));
    } catch {
      throw new CoachProviderError(`${stage} did not return valid JSON`, false);
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new CoachProviderError(
        `${stage} JSON failed validation: ${issue ? `${issue.path.join(".")}: ${issue.message}` : "unknown issue"}`,
        false,
      );
    }
    return result.data;
  }
}

function availableDrillSlugs(): string[] {
  return DRILLS.map((d) => d.slug);
}
