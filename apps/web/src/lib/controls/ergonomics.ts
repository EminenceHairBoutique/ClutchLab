import { CONTROL_ELEMENTS } from "@clutchlab/content";

/**
 * Ergonomic analysis engine (spec §5.9): pure, versioned, explainable.
 * Coordinates are normalized landscape (x,y in [0,1], element center);
 * sizes are diameters relative to screen height; distances are computed in
 * height units assuming a 16:9 panel.
 */

export const ERGONOMICS_ENGINE_VERSION = "ergonomics-v1";

export interface PlacedElement {
  slug: string;
  x: number;
  y: number;
  size: number;
}

export type FingerZone = "left_thumb" | "right_thumb" | "left_index" | "right_index" | "other";

export interface Finding {
  severity: "info" | "warn" | "risk";
  text: string;
}

export interface ErgonomicsAnalysis {
  score: number;
  findings: Finding[];
  workloads: Record<FingerZone, string[]>;
  collisions: Array<[string, string]>;
  engineVersion: string;
}

const ASPECT = 16 / 9;

const nameOf = (slug: string): string =>
  CONTROL_ELEMENTS.find((e) => e.slug === slug)?.name ?? slug;

/** Distance between element centers in screen-height units. */
export function heightDistance(a: PlacedElement, b: PlacedElement): number {
  const dx = (a.x - b.x) * ASPECT;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function assignZone(element: PlacedElement): FingerZone {
  const left = element.x < 0.5;
  if (element.y >= 0.4) return left ? "left_thumb" : "right_thumb";
  if (element.y <= 0.2) return left ? "left_index" : "right_index";
  return "other";
}

/** Pairs that chain in real fights — long travel between them costs time. */
const CHAINED_PAIRS: Array<[string, string]> = [
  ["fire_right", "scope"],
  ["fire_right", "reload"],
  ["scope", "crouch"],
  ["fire_right", "jump"],
];

export function analyzeLayout(elements: PlacedElement[]): ErgonomicsAnalysis {
  const findings: Finding[] = [];
  const workloads: Record<FingerZone, string[]> = {
    left_thumb: [],
    right_thumb: [],
    left_index: [],
    right_index: [],
    other: [],
  };
  const bySlug = new Map(elements.map((e) => [e.slug, e]));

  for (const element of elements) {
    workloads[assignZone(element)].push(element.slug);
  }

  // Collisions: overlapping touch circles.
  const collisions: Array<[string, string]> = [];
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const a = elements[i];
      const b = elements[j];
      if (!a || !b) continue;
      if (heightDistance(a, b) < (a.size + b.size) / 2) {
        collisions.push([a.slug, b.slug]);
      }
    }
  }
  for (const [a, b] of collisions) {
    findings.push({
      severity: "risk",
      text: `${nameOf(a)} and ${nameOf(b)} overlap — mispresses under pressure are near-certain. Separate or shrink one.`,
    });
  }

  // Edge and notch risks.
  let edgeRisks = 0;
  for (const element of elements) {
    const radiusH = element.size / 2;
    const radiusW = radiusH / ASPECT;
    if (
      element.x - radiusW < 0.005 ||
      element.x + radiusW > 0.995 ||
      element.y - radiusH < 0.005 ||
      element.y + radiusH > 0.995
    ) {
      edgeRisks += 1;
      findings.push({
        severity: "warn",
        text: `${nameOf(element.slug)} sits on the screen edge — grip contact and case bezels can eat taps there.`,
      });
    }
    if (element.x > 0.42 && element.x < 0.58 && element.y < 0.08) {
      findings.push({
        severity: "warn",
        text: `${nameOf(element.slug)} sits in the notch/camera zone on many devices.`,
      });
    }
  }

  // Right-thumb congestion (the spec's canonical finding).
  const rightThumbCombat = workloads.right_thumb.filter((slug) =>
    ["fire_right", "scope", "crouch", "jump", "reload", "weapon_slot_1", "weapon_slot_2", "prone"].includes(slug),
  );
  const congested = rightThumbCombat.length > 4;
  if (congested) {
    findings.push({
      severity: "warn",
      text: `Your right thumb owns ${rightThumbCombat.length} combat actions (${rightThumbCombat
        .map(nameOf)
        .join(", ")}). Move crouch or scope to an index finger to reduce close-range input congestion.`,
    });
  }

  // Travel cost on chained actions.
  let longChains = 0;
  for (const [aSlug, bSlug] of CHAINED_PAIRS) {
    const a = bySlug.get(aSlug);
    const b = bySlug.get(bSlug);
    if (!a || !b) continue;
    const sameZone = assignZone(a) === assignZone(b);
    if (sameZone && heightDistance(a, b) > 0.45) {
      longChains += 1;
      findings.push({
        severity: "info",
        text: `${nameOf(aSlug)} → ${nameOf(bSlug)} is a long reach for one finger — expect slow transitions in fights.`,
      });
    }
  }

  // Movement stick sanity.
  const stick = bySlug.get("movement_stick");
  if (stick && stick.x > 0.4) {
    findings.push({
      severity: "warn",
      text: "The movement stick is far right of the usual left-thumb arc — deliberate for lefty layouts, an accident otherwise.",
    });
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        collisions.length * 15 -
        edgeRisks * 6 -
        (congested ? 12 : 0) -
        longChains * 4,
    ),
  );

  if (findings.length === 0) {
    findings.push({ severity: "info", text: "No collisions, edge risks, or congestion detected." });
  }

  return { score, findings, workloads, collisions, engineVersion: ERGONOMICS_ENGINE_VERSION };
}
