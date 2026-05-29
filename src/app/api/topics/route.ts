import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTopicUrl } from "@/lib/utils";
import { sortTopics, type SortKey } from "@/lib/topic-scoring";
import type { Prisma } from "@/generated/prisma/client";

// 时间范围 → 起始时间
function rangeToSince(range: string | null): Date | null {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  switch (range) {
    case "today": {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "3d":
      return new Date(now - 3 * day);
    case "7d":
      return new Date(now - 7 * day);
    case "30d":
      return new Date(now - 30 * day);
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const stats = searchParams.get("stats");

  if (stats === "1") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, today] = await Promise.all([
      prisma.topic.count(),
      prisma.topic.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    return NextResponse.json({ stats: { total, today } });
  }

  if (stats === "sources") {
    const rows = await prisma.topic.groupBy({
      by: ["source"],
      where: { isSpam: false, hotScore: { gte: 30 } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    let all = 0;
    for (const r of rows) {
      counts[r.source] = r._count._all;
      all += r._count._all;
    }
    counts.all = all;
    return NextResponse.json({ counts });
  }

  // === 列表查询 ===
  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") ?? "30");
  const q = searchParams.get("q")?.trim();

  // 新增筛选参数
  const range = searchParams.get("range"); // today/3d/7d/30d/all
  const importanceParam = searchParams.get("importance"); // 逗号分隔
  const keywordId = searchParams.get("keywordId");
  const mentioned = searchParams.get("mentioned"); // yes/no/all
  const relevBucket = searchParams.get("relevBucket"); // high/mid/all
  const sourceType = searchParams.get("sourceType"); // search/subscribed/all
  const sort = (searchParams.get("sort") ?? "composite") as SortKey;

  const where: Prisma.TopicWhereInput = {
    isSpam: false,
    hotScore: { gte: 30 },
  };

  if (source && source !== "all") where.source = source;
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { summary: { contains: q } },
    ];
  }

  const since = rangeToSince(range);
  if (since) where.publishedAt = { gte: since };

  if (importanceParam) {
    const importances = importanceParam.split(",").filter(Boolean);
    if (importances.length > 0) where.importance = { in: importances };
  }

  if (keywordId && keywordId !== "all") where.keywordId = keywordId;

  if (mentioned === "yes") where.keywordMentioned = true;
  else if (mentioned === "no") where.keywordMentioned = false;

  if (relevBucket === "high") where.relevScore = { gte: 80 };
  else if (relevBucket === "mid") where.relevScore = { gte: 60, lt: 80 };

  if (sourceType === "subscribed") where.subscribed = true;
  else if (sourceType === "search") where.subscribed = false;

  // 综合分排序需要 JS 端算（依赖时间衰减），先 take 多一点候选；其他排序统一走应用层逻辑保持一致
  const fetchLimit = sort === "composite" ? Math.max(limit * 3, 100) : limit * 2;

  const candidates = await prisma.topic.findMany({
    where,
    orderBy: [{ hotScore: "desc" }, { publishedAt: "desc" }],
    take: fetchLimit,
  });

  const sorted = sortTopics(candidates, sort).slice(0, limit);

  return NextResponse.json({
    topics: sorted.map((t) => ({ ...t, url: normalizeTopicUrl(t.url, t.source) })),
  });
}
