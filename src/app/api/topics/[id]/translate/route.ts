import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  translateMarkdown,
  parseTranslations,
  isSupportedLang,
  DEFAULT_TARGET_LANG,
} from "@/lib/translator";

/**
 * 把指定 Topic 的 rawContent 翻译为目标语言。
 * 命中 translations 缓存直接返回；否则调 LLM 并写回缓存。
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    let body: { targetLang?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      /* 允许空 body，走默认语言 */
    }

    const targetLang =
      typeof body.targetLang === "string" && body.targetLang.trim()
        ? body.targetLang.trim()
        : DEFAULT_TARGET_LANG;

    if (!isSupportedLang(targetLang)) {
      return NextResponse.json(
        { ok: false, error: `不支持的目标语言：${targetLang}` },
        { status: 400 },
      );
    }

    const topic = await prisma.topic.findUnique({
      where: { id },
      select: { id: true, rawContent: true, translations: true },
    });
    if (!topic) {
      return NextResponse.json({ ok: false, error: "topic 不存在" }, { status: 404 });
    }
    if (!topic.rawContent) {
      return NextResponse.json(
        { ok: false, error: "该 Topic 没有原文可翻译" },
        { status: 400 },
      );
    }

    const cache = parseTranslations(topic.translations);
    if (cache[targetLang]) {
      return NextResponse.json({
        ok: true,
        text: cache[targetLang],
        lang: targetLang,
        cached: true,
      });
    }

    if (!process.env.DEEPSEEK_API_KEY && !process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "未配置 AI key（DEEPSEEK_API_KEY / OPENROUTER_API_KEY）" },
        { status: 503 },
      );
    }

    const translated = await translateMarkdown(topic.rawContent, targetLang);
    if (!translated) {
      return NextResponse.json(
        { ok: false, error: "翻译失败或超时" },
        { status: 502 },
      );
    }

    const nextCache = { ...cache, [targetLang]: translated };
    await prisma.topic.update({
      where: { id },
      data: { translations: JSON.stringify(nextCache) },
    });

    return NextResponse.json({
      ok: true,
      text: translated,
      lang: targetLang,
      cached: false,
    });
  } catch (err) {
    // 兜底：任何未预期的异常都返回 JSON，避免前端 res.json() 拿到空 body
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[translate] 未捕获异常:", msg);
    return NextResponse.json(
      { ok: false, error: `服务异常：${msg}` },
      { status: 500 },
    );
  }
}
