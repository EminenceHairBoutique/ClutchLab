import { describe, expect, it } from "vitest";

import { lit, stableId, upsert } from "./sql";

describe("stableId", () => {
  it("is deterministic and namespace-scoped", () => {
    expect(stableId("weapon", "m416")).toBe(stableId("weapon", "m416"));
    expect(stableId("weapon", "m416")).not.toBe(stableId("attachment", "m416"));
  });

  it("emits valid UUID shape", () => {
    expect(stableId("x", "y")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

describe("lit", () => {
  it("escapes single quotes in strings", () => {
    expect(lit("it's a trap")).toBe("'it''s a trap'");
  });

  it("renders null, numbers, booleans", () => {
    expect(lit(null)).toBe("null");
    expect(lit(42.5)).toBe("42.5");
    expect(lit(true)).toBe("true");
  });

  it("renders text arrays as pg literals", () => {
    expect(lit(["solo", "duo"])).toBe("'{\"solo\",\"duo\"}'");
  });

  it("renders objects as escaped jsonb", () => {
    expect(lit({ a: "x'y" })).toBe(`'{"a":"x''y"}'::jsonb`);
  });

  it("rejects non-finite numbers", () => {
    expect(() => lit(Number.NaN)).toThrow();
  });
});

describe("upsert", () => {
  it("builds a well-formed idempotent statement", () => {
    const sql = upsert({
      table: "weapons",
      columns: ["slug", "name"],
      conflictTarget: "slug",
      rows: [["m416", "M416"]],
    });
    expect(sql).toContain("insert into public.weapons (slug, name) values");
    expect(sql).toContain("('m416', 'M416')");
    expect(sql).toContain("on conflict (slug) do update set");
    expect(sql).toContain("name = excluded.name");
  });

  it("throws on row arity mismatch", () => {
    expect(() =>
      upsert({ table: "t", columns: ["a", "b"], conflictTarget: "a", rows: [["only-one"]] }),
    ).toThrow(/arity/);
  });

  it("returns empty string for zero rows", () => {
    expect(upsert({ table: "t", columns: ["a"], conflictTarget: "a", rows: [] })).toBe("");
  });
});
