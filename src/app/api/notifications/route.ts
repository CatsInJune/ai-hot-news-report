import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // ?unread=1 仅返回未读数量（供 TopBar badge 轻量轮询）
  if (url.searchParams.get("unread") === "1") {
    const unread = await prisma.notification.count({ where: { read: false } });
    return NextResponse.json({ unread });
  }

  const notifications = await prisma.notification.findMany({
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ notifications });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (body.markAllRead) {
    await prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
