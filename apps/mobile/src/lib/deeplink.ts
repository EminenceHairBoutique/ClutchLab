/**
 * Deep link routing (spec §20 Phase 9): `clutchlab://<tab>` (custom scheme)
 * and `https://clutchlab.app/<path>` (universal/app links) both resolve to a
 * tab. Account-bound paths open in the web app until mobile auth ships —
 * buildWebUrl() constructs those. No react-native imports (unit-testable).
 */

export const TABS = ["home", "meta", "training", "more"] as const;
export type Tab = (typeof TABS)[number];

export const WEB_APP_URL = "https://clutchlab.app";

/** First path segment → tab. Web-only sections fall back to the More tab. */
const PATH_TO_TAB: Record<string, Tab> = {
  "": "home",
  home: "home",
  meta: "meta",
  weapons: "meta",
  training: "training",
  drills: "training",
  coach: "more",
  settings: "more",
  controls: "more",
  pros: "more",
  community: "more",
  billing: "more",
  profile: "more",
  more: "more",
};

/** Parse a deep link URL into a tab; null when the URL is not ours. */
export function tabForUrl(url: string): Tab | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol === "clutchlab:") {
    // clutchlab://meta → host carries the destination (path on some platforms).
    const target = (parsed.host || parsed.pathname.replaceAll("/", "")).toLowerCase();
    return PATH_TO_TAB[target] ?? null;
  }
  if (parsed.protocol === "https:" && parsed.host === "clutchlab.app") {
    const [first] = parsed.pathname.split("/").filter(Boolean);
    return PATH_TO_TAB[(first ?? "").toLowerCase()] ?? null;
  }
  return null;
}

/** Web URL for features that need an account until mobile auth ships. */
export function buildWebUrl(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${WEB_APP_URL}${clean}`;
}
