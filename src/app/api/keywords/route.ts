import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const keywords = await prisma.keyword.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { topics: true } },
    },
  });
  return NextResponse.json({ keywords });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "关键词名称不能为空" }, { status: 400 });
  }

  const keyword = await prisma.keyword.create({
    data: {
      name: body.name.trim(),
      domain: body.domain?.trim() || "通用",
      priority: ["high", "medium", "low"].includes(body.priority) ? body.priority : "medium",
      notifyBrowser: body.notifyBrowser !== false,
      notifyEmail: !!body.notifyEmail,
      active: body.active !== false,
    },
  });

  return NextResponse.json({ keyword });
}
