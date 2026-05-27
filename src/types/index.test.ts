import { describe, it, expect } from "vitest";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "./index";

describe("SOURCE_LABELS / SOURCE_COLORS", () => {
  const SOURCES: SourceType[] = [
    "twitter",
    "bing",
    "google",
    "duckduckgo",
    "hackernews",
    "sogou",
    "bilibili",
    "weibo",
  ];

  it("8 个源都有 label", () => {
    for (const s of SOURCES) {
      expect(SOURCE_LABELS[s]).toBeTruthy();
      expect(typeof SOURCE_LABELS[s]).toBe("string");
    }
  });

  it("8 个源都有合法 hex 颜色", () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const s of SOURCES) {
      expect(SOURCE_COLORS[s]).toMatch(hex);
    }
  });

  it("没有重复的 label / 颜色（防 typo）", () => {
    const labels = SOURCES.map((s) => SOURCE_LABELS[s]);
    const colors = SOURCES.map((s) => SOURCE_COLORS[s]);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
