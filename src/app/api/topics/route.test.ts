import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { topicMock } = vi.hoisted(() => ({
  topicMock: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { topic: topicMock },
}));

vi.mock("@/lib/utils", () => ({
  normalizeTopicUrl: (url: string) => url,
}));

import { GET } from "./route";

function makeReq(query: Record<string, string>) {
  const params = new URLSearchParams(query).toString();
  return new NextRequest(`http://localhost/api/topics?${params}`);
}

beforeEach(() => {
  topicMock.findMany.mockReset();
  topicMock.count.mockReset();
  topicMock.groupBy.mockReset();
});

describe("GET /api/topics", () => {
  it("默认查询：传 isSpam=false、hotScore>=30、综合分排序", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({}));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.isSpam).toBe(false);
    expect(arg.where.hotScore).toEqual({ gte: 30 });
  });

  it("range=today 应转换为 publishedAt >= 当日 00:00", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ range: "today" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.publishedAt.gte).toBeInstanceOf(Date);
    const date: Date = arg.where.publishedAt.gte;
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it("range=7d 应转换为 publishedAt >= 7 天前", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ range: "7d" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    const date: Date = arg.where.publishedAt.gte;
    const diff = Date.now() - date.getTime();
    expect(diff).toBeGreaterThan(7 * 24 * 3600 * 1000 - 1000);
    expect(diff).toBeLessThan(7 * 24 * 3600 * 1000 + 1000);
  });

  it("importance 多选：传 in", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ importance: "high,urgent" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.importance).toEqual({ in: ["high", "urgent"] });
  });

  it("mentioned=yes → keywordMentioned=true", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ mentioned: "yes" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.keywordMentioned).toBe(true);
  });

  it("mentioned=no → keywordMentioned=false", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ mentioned: "no" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.keywordMentioned).toBe(false);
  });

  it("relevBucket=high → relevScore >= 80", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ relevBucket: "high" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.relevScore).toEqual({ gte: 80 });
  });

  it("relevBucket=mid → relevScore 60-79", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ relevBucket: "mid" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.relevScore).toEqual({ gte: 60, lt: 80 });
  });

  it("sourceType=subscribed → subscribed=true", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ sourceType: "subscribed" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.subscribed).toBe(true);
  });

  it("sourceType=search → subscribed=false", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ sourceType: "search" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.subscribed).toBe(false);
  });

  it("keywordId=xxx → where.keywordId 精确匹配", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ keywordId: "k123" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.keywordId).toBe("k123");
  });

  it("keywordId=all → 不加条件", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ keywordId: "all" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.keywordId).toBeUndefined();
  });

  it("综合分排序：fetchLimit 比 limit 大（要多拉候选）", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ sort: "composite", limit: "30" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    // limit*3 = 90，但 max 100，所以是 100
    expect(arg.take).toBe(100);
  });

  it("非综合分排序：fetchLimit = limit × 2", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ sort: "latest", limit: "30" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.take).toBe(60);
  });

  it("综合分排序：JS 端会按时间衰减 + importance 加权重排（最 urgent 排前）", async () => {
    // 旧 + low 排前，新 + urgent 排后，验证排序后 urgent 在前
    const oldLow = {
      id: "old",
      hotScore: 90,
      relevScore: 50,
      importance: "low",
      publishedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      source: "twitter",
      url: "u1",
    };
    const newUrgent = {
      id: "new",
      hotScore: 50,
      relevScore: 50,
      importance: "urgent",
      publishedAt: new Date(),
      source: "twitter",
      url: "u2",
    };
    topicMock.findMany.mockResolvedValueOnce([oldLow, newUrgent]);
    const res = await GET(makeReq({ sort: "composite" }));
    const body = await res.json();
    expect(body.topics[0].id).toBe("new");
    expect(body.topics[1].id).toBe("old");
  });

  it("source 与 q 同时传入：source 用作筛选, q 走 OR(title/summary contains)", async () => {
    topicMock.findMany.mockResolvedValueOnce([]);
    await GET(makeReq({ source: "twitter", q: "claude" }));
    const arg = topicMock.findMany.mock.calls[0][0];
    expect(arg.where.source).toBe("twitter");
    expect(arg.where.OR).toEqual([
      { title: { contains: "claude" } },
      { summary: { contains: "claude" } },
    ]);
  });

  it("stats=sources 走 groupBy 分支", async () => {
    topicMock.groupBy.mockResolvedValueOnce([
      { source: "twitter", _count: { _all: 5 } },
      { source: "bing", _count: { _all: 3 } },
    ]);
    const res = await GET(makeReq({ stats: "sources" }));
    const body = await res.json();
    expect(body.counts).toEqual({ twitter: 5, bing: 3, all: 8 });
  });

  it("stats=1 走 count 分支", async () => {
    topicMock.count.mockResolvedValueOnce(100).mockResolvedValueOnce(8);
    const res = await GET(makeReq({ stats: "1" }));
    const body = await res.json();
    expect(body.stats).toEqual({ total: 100, today: 8 });
  });
});
