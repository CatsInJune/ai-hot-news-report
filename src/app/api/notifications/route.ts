import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
