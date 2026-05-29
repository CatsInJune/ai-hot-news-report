import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractContent, SCRAPABLE_SOURCES } from "@/lib/extract-content";

/**
 * 按需补抓某条 Topic 的原文（采集时漏抓或失败的兜底入口）。
 * 大部分 Topic 在采集阶段就已经抓过了，这里命中缓存直接返回。
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id },
    select: { id: true, url: true, source: true, rawContent: true },
  });
  if (!topic) {
    return NextResponse.json({ ok: false, error: "topic 不存在" }, { status: 404 });
  }

  if (topic.rawContent) {
    return NextResponse.json({ ok: true, rawContent: topic.rawContent, cached: true });
  }

  if (!SCRAPABLE_SOURCES.has(topic.source)) {
    return NextResponse.json(
      { ok: false, error: `${topic.source} 类型不支持抓原文` },
      { status: 400 },
    );
  }

  const content = await extractContent(topic.url);
  if (!content) {
    return NextResponse.json({ ok: false, error: "未抓到正文" }, { status: 502 });
  }

  await prisma.topic.update({ where: { id }, data: { rawContent: content } });
  return NextResponse.json({ ok: true, rawContent: content, cached: false });
}
