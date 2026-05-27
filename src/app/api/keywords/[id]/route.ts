import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.domain === "string") data.domain = body.domain.trim();
  if (["high", "medium", "low"].includes(body.priority)) data.priority = body.priority;
  if (typeof body.notifyBrowser === "boolean") data.notifyBrowser = body.notifyBrowser;
  if (typeof body.notifyEmail === "boolean") data.notifyEmail = body.notifyEmail;
  if (typeof body.active === "boolean") data.active = body.active;

  try {
    const keyword = await prisma.keyword.update({ where: { id }, data });
    return NextResponse.json({ keyword });
  } catch {
    return NextResponse.json({ error: "关键词不存在" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.keyword.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "关键词不存在" }, { status: 404 });
  }
}
