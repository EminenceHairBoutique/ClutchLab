import { TIERABLE_WEAPONS } from "@clutchlab/content";
import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Indexable pages (spec §19). Weapon slugs come from the bundled catalog. */
export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/meta",
    "/weapons",
    "/settings",
    "/controls",
    "/training",
    "/coach",
    "/maps",
    "/pros",
    "/community",
  ].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly" as const,
  }));

  const weaponRoutes = TIERABLE_WEAPONS.map((weapon) => ({
    url: `${BASE}/weapons/${weapon.slug}`,
    changeFrequency: "weekly" as const,
  }));

  return [...staticRoutes, ...weaponRoutes];
}
