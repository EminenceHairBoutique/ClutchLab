/**
 * JSON-LD structured data (spec §19: structured, indexable pages). Pure
 * builders — no React — so they are unit-testable and reusable server-side.
 * Everything here is factual about the product itself; no fabricated ratings
 * or review counts (which would violate the no-invented-data rule).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const ORG_ID = `${APP_URL}/#organization`;
export const SITE_ID = `${APP_URL}/#website`;

type JsonLdObject = Record<string, unknown>;

/** Organization + WebSite + SoftwareApplication graph for the root layout. */
export function siteStructuredData(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: "ClutchLab",
        url: APP_URL,
        description:
          "Independent PUBG Mobile training companion — verified settings, personalized " +
          "sensitivity calibration, versioned meta, and post-match AI coaching.",
        logo: `${APP_URL}/icons/icon-512.png`,
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        name: "ClutchLab",
        url: APP_URL,
        publisher: { "@id": ORG_ID },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        name: "ClutchLab",
        applicationCategory: "SportsApplication",
        operatingSystem: "Web, iOS, Android",
        url: APP_URL,
        publisher: { "@id": ORG_ID },
        // Free tier exists; no fabricated aggregateRating.
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

/** BreadcrumbList for a route (schema.org). Items are {name, path}. */
export function breadcrumbStructuredData(items: Array<{ name: string; path: string }>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${APP_URL}${item.path}`,
    })),
  };
}

/**
 * A weapon reference page as a schema.org Article-like item. Deliberately NOT
 * a Product with a rating — tiers are editorial baselines, not review scores.
 */
export function weaponStructuredData(input: {
  name: string;
  slug: string;
  description: string;
  weaponClass: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${input.name} — PUBG Mobile weapon reference`,
    about: input.name,
    articleSection: input.weaponClass,
    description: input.description,
    url: `${APP_URL}/weapons/${input.slug}`,
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
  };
}
