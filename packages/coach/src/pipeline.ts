import { DRILLS } from "@clutchlab/content";
import { z } from "zod";

import {
  observationSchema,
  reportDraftSchema,
  type AnalysisResult,
  type CoachContext,
  type CoachProvider,
} from "./types";

/**
 * Two-pass analysis (spec §5.13): (a) structured per-segment observations,
 * (b) a synthesis pass producing the report. Both passes are re-validated here
 * even though providers validate internally — the pipeline is the trust
 * boundary the rest of the system relies on.
 */

export class CoachPipelineError extends Error {
  constructor(
    message: string,
    readonly stage: "observations" | "report",
  ) {
    super(message);
    this.name = "CoachPipelineError";
  }
}

const KNOWN_DRILL_SLUGS: ReadonlySet<string> = new Set(DRILLS.map((d) => d.slug));

export async function runAnalysis(
  provider: CoachProvider,
  context: CoachContext,
): Promise<AnalysisResult> {
  const observationsResult = z
    .array(observationSchema)
    .max(40)
    .safeParse(await provider.extractObservations(context));
  if (!observationsResult.success) {
    throw new CoachPipelineError(
      `provider returned invalid observations: ${observationsResult.error.issues[0]?.message ?? "unknown"}`,
      "observations",
    );
  }
  const observations = observationsResult.data;
  if (observations.length === 0) {
    // Honest failure beats a fabricated report: with nothing observable
    // (e.g. no extractable frames) there is nothing to coach.
    throw new CoachPipelineError(
      "no observations could be made from this recording — nothing analyzable was available",
      "observations",
    );
  }

  const draftResult = reportDraftSchema.safeParse(
    await provider.synthesizeReport(context, observations),
  );
  if (!draftResult.success) {
    throw new CoachPipelineError(
      `provider returned an invalid report: ${draftResult.error.issues[0]?.message ?? "unknown"}`,
      "report",
    );
  }
  const draft = draftResult.data;

  // Drill assignments must reference the real catalog (FK in the database).
  const unknownDrillSlugs = draft.drillSlugs.filter((slug) => !KNOWN_DRILL_SLUGS.has(slug));
  const drillSlugs = draft.drillSlugs.filter((slug) => KNOWN_DRILL_SLUGS.has(slug));

  return {
    observations,
    draft: { ...draft, drillSlugs },
    unknownDrillSlugs,
    modelId: provider.modelId,
    promptVersion: provider.promptVersion,
  };
}
