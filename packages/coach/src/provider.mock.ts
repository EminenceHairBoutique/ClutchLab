import { DRILLS } from "@clutchlab/content";

import { PROMPT_VERSION } from "./prompts";
import type { CoachContext, CoachProvider, Observation, ReportDraft } from "./types";

/**
 * MOCK coach provider (spec §0.1.7): active when no ANTHROPIC_API_KEY is
 * configured. Deterministic output derived from the upload metadata so the
 * pipeline, storage, review tools, and UI are fully exercisable — and every
 * artifact says loudly that it is a mock, with confidence 'unverified'.
 */

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const SCENARIOS: Array<{
  category: Observation["category"];
  observation: string;
  mistake: { what: string; whyItMattered: string; betterAlternative: string };
  /** Skill slugs from the training catalog to source drill recommendations. */
  drillSkills: string[];
}> = [
  {
    category: "crosshair_placement",
    observation: "Crosshair entered the doorway below chest height before the engagement.",
    mistake: {
      what: "Entered the room with the crosshair at floor level.",
      whyItMattered: "The first correction was vertical, costing the opening exchange.",
      betterAlternative: "Pin the crosshair at head height on the expected corner before committing.",
    },
    drillSkills: ["crosshair_placement"],
  },
  {
    category: "exposure",
    observation: "Held the same peek angle for several seconds after firing.",
    mistake: {
      what: "Re-peeked the identical head position twice in a row.",
      whyItMattered: "A pre-aimed opponent gets a free shot at a known pixel.",
      betterAlternative: "Move a body-width between peeks and cap exposure to short windows.",
    },
    drillSkills: ["peek_discipline"],
  },
  {
    category: "recoil",
    observation: "Spray drifted horizontally after roughly the tenth bullet.",
    mistake: {
      what: "Committed to a full-magazine spray at mid range.",
      whyItMattered: "The late-magazine spread turned a likely knock into missed shots.",
      betterAlternative: "Cut to 8–12 round bursts and reset between them at that distance.",
    },
    drillSkills: ["burst_control", "recoil_spray"],
  },
  {
    category: "decision",
    observation: "Pushed a knocked opponent while a second contact was audible nearby.",
    mistake: {
      what: "Committed to the knock without clearing the trade angle.",
      whyItMattered: "The teammate of the knocked player had a clean refrag line.",
      betterAlternative: "Use the knock as bait: hold the trade angle or reposition first.",
    },
    drillSkills: ["trade_discipline", "footstep_reading"],
  },
];

export class MockCoachProvider implements CoachProvider {
  readonly modelId = "mock-coach";
  readonly promptVersion = PROMPT_VERSION;

  async extractObservations(context: CoachContext): Promise<Observation[]> {
    const seed = hashString(context.label);
    const duration = context.durationSeconds ?? 120;
    const count = Math.min(6, 3 + (seed % 3));
    const observations: Observation[] = [];
    for (let i = 0; i < count; i++) {
      const scenario = SCENARIOS[(seed + i) % SCENARIOS.length];
      if (!scenario) continue;
      observations.push({
        tSeconds: Math.max(1, Math.floor(((i + 1) * duration) / (count + 1))),
        category: scenario.category,
        observation: `[MOCK] ${scenario.observation}`,
        inference: i % 2 === 1,
        confidence: "unverified",
      });
    }
    return observations;
  }

  async synthesizeReport(context: CoachContext, observations: Observation[]): Promise<ReportDraft> {
    const seed = hashString(context.label);
    const picked = [0, 1, 2].map((i) => SCENARIOS[(seed + i) % SCENARIOS.length]).filter(
      (s): s is (typeof SCENARIOS)[number] => s !== undefined,
    );
    const mistakes = picked.map((scenario, i) => ({
      tSeconds: observations[i]?.tSeconds ?? (i + 1) * 30,
      what: `[MOCK] ${scenario.mistake.what}`,
      whyItMattered: scenario.mistake.whyItMattered,
      betterAlternative: scenario.mistake.betterAlternative,
    }));
    const wantedSkills = picked.flatMap((s) => s.drillSkills);
    const drillSlugs = [
      ...new Set(
        wantedSkills
          .map((skill) => DRILLS.find((d) => d.skillSlug === skill)?.slug)
          .filter((slug): slug is string => slug !== undefined),
      ),
    ].slice(0, 5);

    return {
      executiveSummary:
        "[MOCK ANALYSIS — no AI credentials configured. This report exercises the pipeline and is " +
        "not real coaching.] Based on the registered metadata, the recurring themes would be " +
        "entry crosshair height, exposure discipline, and spray length management.",
      mistakes,
      drillSlugs,
      settingsNote: null,
      couldNotDetermine:
        "Everything — this is a mock analysis without video frames. With a configured provider " +
        "and uploaded footage, hit registration, exact enemy positions, and off-screen audio " +
        "context still cannot be verified from a single recording.",
      confidence: "unverified",
    };
  }
}
