import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeTopicUrl } from "@/lib/utils";

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

  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") ?? "30");
  const q = searchParams.get("q")?.trim();

  const topics = await prisma.topic.findMany({
    where: {
      ...(source && source !== "all" ? { source } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { summary: { contains: q } },
            ],
          }
        : {}),
      isSpam: false,
      hotScore: { gte: 30 },
    },
    orderBy: [{ hotScore: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    topics: topics.map((t) => ({ ...t, url: normalizeTopicUrl(t.url, t.source) })),
  });
}
