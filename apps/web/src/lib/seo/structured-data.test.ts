import { describe, expect, it } from "vitest";

import {
  breadcrumbStructuredData,
  siteStructuredData,
  weaponStructuredData,
} from "./structured-data";

describe("structured data (§19)", () => {
  it("builds a valid site graph with Organization, WebSite, and the app", () => {
    const graph = siteStructuredData();
    expect(graph["@context"]).toBe("https://schema.org");
    const types = (graph["@graph"] as Array<{ "@type": string }>).map((n) => n["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("WebSite");
    expect(types).toContain("SoftwareApplication");
    // No fabricated ratings/review counts anywhere.
    expect(JSON.stringify(graph)).not.toContain("aggregateRating");
    expect(JSON.stringify(graph)).not.toContain("reviewCount");
  });

  it("numbers breadcrumb positions from 1", () => {
    const crumb = breadcrumbStructuredData([
      { name: "Weapons", path: "/weapons" },
      { name: "M416", path: "/weapons/m416" },
    ]);
    const items = crumb.itemListElement as Array<{ position: number; name: string }>;
    expect(items[0]?.position).toBe(1);
    expect(items[1]?.position).toBe(2);
    expect(items[1]?.name).toBe("M416");
  });

  it("describes a weapon as a TechArticle, not a rated Product", () => {
    const data = weaponStructuredData({
      name: "M416",
      slug: "m416",
      description: "Versatile 5.56 AR.",
      weaponClass: "Assault Rifle",
    });
    expect(data["@type"]).toBe("TechArticle");
    expect(JSON.stringify(data)).not.toContain("aggregateRating");
  });
});
