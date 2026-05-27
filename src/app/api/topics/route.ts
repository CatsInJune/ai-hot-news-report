import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") ?? "30");

  const topics = await prisma.topic.findMany({
    where: {
      ...(source && source !== "all" ? { source } : {}),
      isSpam: false,
      hotScore: { gte: 30 },
    },
    orderBy: [{ hotScore: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ topics });
}
