import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // 注：name 设计为不可编辑。改名需求请走"删除 + 新建"——避免历史 Topic 被
  // 重命名后的语义污染（变体/别名都是基于原 name 抓的）。
  const data: Record<string, unknown> = {};
  if (typeof body.domain === "string") data.domain = body.domain.trim();
  if (["high", "medium", "low"].includes(body.priority)) data.priority = body.priority;
  if (typeof body.notifyBrowser === "boolean") data.notifyBrowser = body.notifyBrowser;
  if (typeof body.notifyEmail === "boolean") data.notifyEmail = body.notifyEmail;
  if (typeof body.notifyWechat === "boolean") data.notifyWechat = body.notifyWechat;
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
