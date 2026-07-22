import { describe, expect, it } from "vitest";

import {
  AnthropicCoachProvider,
  CoachProviderError,
  MAX_FRAMES_PER_JOB,
  extractJson,
} from "./provider.anthropic";
import type { CoachContext } from "./types";

const context: CoachContext = {
  uploadKind: "clip",
  label: "Livik hot drop",
  durationSeconds: 60,
  frames: [],
};

const goodObservations = [
  {
    tSeconds: 12,
    category: "crosshair_placement",
    observation: "Crosshair sits at knee height while crossing the courtyard.",
    inference: false,
    confidence: "medium",
  },
];

function textResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }], stop_reason: "end_turn" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
}

function providerWith(
  response: Response | ((call: number) => Response),
  captured: CapturedRequest[] = [],
): AnthropicCoachProvider {
  let call = 0;
  const fetchFn: typeof fetch = async (input, init) => {
    captured.push({
      url: String(input),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      headers: new Headers(init?.headers),
    });
    call += 1;
    return typeof response === "function" ? response(call) : response;
  };
  return new AnthropicCoachProvider({
    apiKey: "test-key",
    model: "model-from-config",
    fetchFn,
  });
}

describe("AnthropicCoachProvider", () => {
  it("sends the configured model — never a hard-coded one — and parses observations", async () => {
    const captured: CapturedRequest[] = [];
    const provider = providerWith(textResponse(goodObservations), captured);
    const observations = await provider.extractObservations(context);
    expect(observations).toHaveLength(1);
    expect(observations[0]?.category).toBe("crosshair_placement");
    expect(captured[0]?.body.model).toBe("model-from-config");
    expect(captured[0]?.headers.get("x-api-key")).toBe("test-key");
    expect(provider.modelId).toBe("model-from-config");
  });

  it("caps frames per job (cost guardrail)", async () => {
    const captured: CapturedRequest[] = [];
    const provider = providerWith(textResponse(goodObservations), captured);
    const manyFrames = Array.from({ length: 20 }, (_, i) => `frame${i}`);
    await provider.extractObservations({ ...context, frames: manyFrames });
    const content = captured[0]?.body.messages as Array<{ content: unknown[] }>;
    const blocks = content[0]?.content ?? [];
    const imageBlocks = blocks.filter((b) => (b as { type: string }).type === "image");
    expect(imageBlocks).toHaveLength(MAX_FRAMES_PER_JOB);
  });

  it("tolerates markdown fences despite instructions", async () => {
    const fenced = new Response(
      JSON.stringify({
        content: [{ type: "text", text: "```json\n" + JSON.stringify(goodObservations) + "\n```" }],
      }),
      { status: 200 },
    );
    const provider = providerWith(fenced);
    const observations = await provider.extractObservations(context);
    expect(observations).toHaveLength(1);
  });

  it("marks 429/5xx as retryable and 4xx as not", async () => {
    const rateLimited = providerWith(new Response("rate limit", { status: 429 }));
    await expect(rateLimited.extractObservations(context)).rejects.toMatchObject({
      name: "CoachProviderError",
      retryable: true,
    });
    const badRequest = providerWith(new Response("bad request", { status: 400 }));
    await expect(badRequest.extractObservations(context)).rejects.toMatchObject({
      name: "CoachProviderError",
      retryable: false,
    });
  });

  it("rejects invalid JSON and schema-violating payloads without retry", async () => {
    const notJson = providerWith(
      new Response(JSON.stringify({ content: [{ type: "text", text: "I think that..." }] }), {
        status: 200,
      }),
    );
    await expect(notJson.extractObservations(context)).rejects.toThrowError(CoachProviderError);

    const badShape = providerWith(textResponse([{ tSeconds: -1 }]));
    await expect(badShape.extractObservations(context)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("synthesizes and validates a report draft", async () => {
    const draft = {
      executiveSummary: "Crosshair discipline is the main recurring theme in this clip.",
      mistakes: [
        {
          tSeconds: 12,
          what: "Crossed open ground with the crosshair at knee height.",
          whyItMattered: "First contact required a large vertical correction.",
          betterAlternative: "Hold head height on the nearest likely peek angle.",
        },
      ],
      drillSlugs: ["head_height_walls"],
      settingsNote: null,
      couldNotDetermine: "Whether shots registered — the video cannot prove hit registration.",
      confidence: "medium",
    };
    const captured: CapturedRequest[] = [];
    const provider = providerWith(textResponse(draft), captured);
    const result = await provider.synthesizeReport(context, goodObservations.map((o) => ({
      ...o,
      category: "crosshair_placement" as const,
      confidence: "medium" as const,
      inference: false,
    })));
    expect(result.executiveSummary).toContain("Crosshair discipline");
    // the request must carry the observations and the drill catalog
    const content = captured[0]?.body.messages as Array<{ content: Array<{ text?: string }> }>;
    const text = content[0]?.content[0]?.text ?? "";
    expect(text).toContain("Validated observations");
    expect(text).toContain("head_height_walls");
  });
});

describe("extractJson", () => {
  it("passes plain JSON through and strips fences", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson('```\n[1,2]\n```')).toBe("[1,2]");
  });
});
