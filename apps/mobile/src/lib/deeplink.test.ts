import { describe, expect, it } from "vitest";

import { buildWebUrl, tabForUrl } from "./deeplink";

describe("tabForUrl", () => {
  it("routes custom-scheme links to tabs", () => {
    expect(tabForUrl("clutchlab://home")).toBe("home");
    expect(tabForUrl("clutchlab://meta")).toBe("meta");
    expect(tabForUrl("clutchlab://training")).toBe("training");
    expect(tabForUrl("clutchlab://coach")).toBe("more");
  });

  it("routes universal links, including web-only sections, to the closest tab", () => {
    expect(tabForUrl("https://clutchlab.app/")).toBe("home");
    expect(tabForUrl("https://clutchlab.app/weapons/m416")).toBe("meta");
    expect(tabForUrl("https://clutchlab.app/training/drills/peek_timer")).toBe("training");
    expect(tabForUrl("https://clutchlab.app/billing")).toBe("more");
  });

  it("rejects foreign or malformed URLs", () => {
    expect(tabForUrl("https://example.com/meta")).toBeNull();
    expect(tabForUrl("clutchlab://unknown-section")).toBeNull();
    expect(tabForUrl("not a url")).toBeNull();
  });
});

describe("buildWebUrl", () => {
  it("builds account-feature URLs against the web app", () => {
    expect(buildWebUrl("/coach")).toBe("https://clutchlab.app/coach");
    expect(buildWebUrl("billing")).toBe("https://clutchlab.app/billing");
  });
});
