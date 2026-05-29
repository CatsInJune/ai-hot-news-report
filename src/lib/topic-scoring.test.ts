import { describe, it, expect } from "vitest";
import { compositeScore, sortTopics, type ScorableTopic } from "./topic-scoring";

function topic(partial: Partial<ScorableTopic> & { publishedAt: Date | string }): ScorableTopic {
  return {
    hotScore: 50,
    relevScore: 50,
    importance: "medium",
    ...partial,
  };
}

const now = new Date("2026-05-30T12:00:00Z");

describe("compositeScore()", () => {
  it("刚发布（0 小时）：score ≈ hotScore + importanceWeight", () => {
    const t = topic({ hotScore: 80, importance: "medium", publishedAt: now });
    const s = compositeScore(t, now);
    // 0 hours decay = 1, medium weight = 0
    expect(s).toBeCloseTo(80, 1);
  });

  it("48 小时（半衰期）：hotScore 分量 = 原值 / e", () => {
    const t = topic({
      hotScore: 100,
      importance: "medium",
      publishedAt: new Date(now.getTime() - 48 * 3600 * 1000),
    });
    const s = compositeScore(t, now);
    // 100 × e^(-1) = 36.79
    expect(s).toBeCloseTo(100 / Math.E, 1);
  });

  it("urgent 加 30，high 加 15，low 减 15", () => {
    const base = topic({ hotScore: 50, publishedAt: now });
    expect(compositeScore({ ...base, importance: "urgent" }, now)).toBeCloseTo(80, 1);
    expect(compositeScore({ ...base, importance: "high" }, now)).toBeCloseTo(65, 1);
    expect(compositeScore({ ...base, importance: "medium" }, now)).toBeCloseTo(50, 1);
    expect(compositeScore({ ...base, importance: "low" }, now)).toBeCloseTo(35, 1);
  });

  it("旧但 urgent vs 新但 low：综合分能拉开差距", () => {
    // 24h 前的 urgent
    const oldUrgent = topic({
      hotScore: 60,
      importance: "urgent",
      publishedAt: new Date(now.getTime() - 24 * 3600 * 1000),
    });
    // 刚发布的 low
    const newLow = topic({ hotScore: 60, importance: "low", publishedAt: now });
    // oldUrgent: 60 × e^(-0.5) + 30 ≈ 36.4 + 30 = 66.4
    // newLow: 60 + (-15) = 45
    expect(compositeScore(oldUrgent, now)).toBeGreaterThan(compositeScore(newLow, now));
  });

  it("未知 importance：weight 当 0 处理", () => {
    const t = topic({ hotScore: 50, importance: "unknown", publishedAt: now });
    expect(compositeScore(t, now)).toBeCloseTo(50, 1);
  });
});

describe("sortTopics()", () => {
  const t1 = topic({
    hotScore: 90,
    relevScore: 50,
    importance: "low",
    publishedAt: new Date(now.getTime() - 72 * 3600 * 1000), // 3 天前
  });
  const t2 = topic({
    hotScore: 50,
    relevScore: 95,
    importance: "urgent",
    publishedAt: now, // 刚发布
  });
  const t3 = topic({
    hotScore: 70,
    relevScore: 70,
    importance: "high",
    publishedAt: new Date(now.getTime() - 6 * 3600 * 1000), // 6 小时前
  });

  it("composite：考虑时间衰减 + importance 加权", () => {
    const result = sortTopics([t1, t2, t3], "composite", now);
    // t1: 90 × e^(-1.5) + (-15) ≈ 20.1 - 15 = 5.1
    // t2: 50 + 30 = 80
    // t3: 70 × e^(-0.125) + 15 ≈ 61.8 + 15 = 76.8
    expect(result[0]).toBe(t2);
    expect(result[1]).toBe(t3);
    expect(result[2]).toBe(t1);
  });

  it("latest：按 publishedAt desc", () => {
    const result = sortTopics([t1, t3, t2], "latest", now);
    expect(result).toEqual([t2, t3, t1]);
  });

  it("importance：urgent > high > medium > low", () => {
    const result = sortTopics([t1, t2, t3], "importance", now);
    expect(result[0]).toBe(t2); // urgent
    expect(result[1]).toBe(t3); // high
    expect(result[2]).toBe(t1); // low
  });

  it("relevance：按 relevScore desc", () => {
    const result = sortTopics([t1, t2, t3], "relevance", now);
    expect(result[0]).toBe(t2); // 95
    expect(result[1]).toBe(t3); // 70
    expect(result[2]).toBe(t1); // 50
  });

  it("importance 相同时按 publishedAt desc 决断", () => {
    const a = topic({ importance: "high", publishedAt: new Date(now.getTime() - 1000) });
    const b = topic({ importance: "high", publishedAt: now });
    expect(sortTopics([a, b], "importance", now)).toEqual([b, a]);
  });

  it("relevance 相同时按 publishedAt desc 决断", () => {
    const a = topic({ relevScore: 80, publishedAt: new Date(now.getTime() - 1000) });
    const b = topic({ relevScore: 80, publishedAt: now });
    expect(sortTopics([a, b], "relevance", now)).toEqual([b, a]);
  });

  it("hot：按 hotScore desc，不考虑时间衰减 / importance", () => {
    // hot=90 但 importance=low + 旧
    const a = topic({
      hotScore: 90,
      importance: "low",
      publishedAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000),
    });
    // hot=70 但 importance=urgent + 新
    const b = topic({ hotScore: 70, importance: "urgent", publishedAt: now });
    // composite 会让 b 排前；但 hot 排序应该让 a (90) 排前
    const result = sortTopics([b, a], "hot", now);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });
});
