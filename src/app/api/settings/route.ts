import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySMTP, sendKeywordDigest, type AlertItem } from "@/lib/mailer";
import { flushAllDigests, getQueueStats } from "@/lib/notification-queue";
import {
  getWechatWebhookUrls,
  maskWebhookUrl,
  sendWechatDigest,
  verifyWechatWebhook,
} from "@/lib/wechat";

// 2 条样例命中（urgent + high），同时给邮件 / 微信测试使用
const SAMPLE_ITEMS: AlertItem[] = [
  {
    keyword: "测试关键词",
    title: "[样例] OpenAI 发布 GPT-5.5 旗舰模型",
    summary:
      "样例摘要：OpenAI 今日发布 GPT-5.5，相比上一代在长上下文、代码与工具调用上显著提升，API 价格保持不变。",
    url: "https://example.com/sample-urgent",
    source: "twitter",
    hotScore: 92,
    relevScore: 88,
    importance: "urgent",
    reason:
      "样例：高度匹配监控关键词「测试关键词」核心语义；作者为认证大 V，互动数据显著高于均值。",
  },
  {
    keyword: "测试关键词",
    title: "[样例] DeepSeek V3.2 永久降价 75%，对标 GPT-4o-mini",
    summary:
      "样例摘要：DeepSeek 宣布 V3.2 永久降价 75%，定价区间已进入开发者友好档位。",
    url: "https://example.com/sample-high",
    source: "bing",
    hotScore: 78,
    relevScore: 72,
    importance: "high",
    reason: "样例：与关键词语义相关，价格变化具备时效性，值得快速浏览。",
  },
];

export async function GET() {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  const wechatUrls = getWechatWebhookUrls();

  // 环境变量配置状态（不返回值，仅返回是否配置）
  const env = {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    twitter: !!process.env.TWITTER_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
    notificationEmail: process.env.NOTIFICATION_EMAIL ?? "",
    collectionCron: process.env.COLLECTION_CRON ?? "*/30 * * * *",
    wechat: {
      configured: wechatUrls.length > 0,
      count: wechatUrls.length,
      masked: wechatUrls.map(maskWebhookUrl),
    },
  };

  return NextResponse.json({
    settings: map,
    env,
    digestQueue: getQueueStats(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "test-smtp") {
    const r = await verifySMTP();
    return NextResponse.json(r);
  }
  if (body.action === "test-email") {
    const to = process.env.NOTIFICATION_EMAIL;
    if (!to) {
      return NextResponse.json(
        { ok: false, error: "未配置 NOTIFICATION_EMAIL" },
        { status: 400 },
      );
    }
    const sent = await sendKeywordDigest({ to, items: SAMPLE_ITEMS });
    return NextResponse.json({ ok: sent, to });
  }
  if (body.action === "test-wechat") {
    const urls = getWechatWebhookUrls();
    if (urls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "未配置 WECHAT_WEBHOOK_URL" },
        { status: 400 },
      );
    }
    const result = await sendWechatDigest({
      webhookUrls: urls,
      items: SAMPLE_ITEMS,
    });
    return NextResponse.json({
      ok: result.ok,
      sent: result.sent,
      total: urls.length,
      errors: result.errors,
    });
  }
  if (body.action === "ping-wechat") {
    // 仅发个连通测试，不带样例卡片
    const urls = getWechatWebhookUrls();
    if (urls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "未配置 WECHAT_WEBHOOK_URL" },
        { status: 400 },
      );
    }
    const results = await Promise.all(urls.map(verifyWechatWebhook));
    const ok = results.every((r) => r.ok);
    return NextResponse.json({
      ok,
      results: results.map((r, i) => ({
        url: maskWebhookUrl(urls[i]),
        ok: r.ok,
        error: r.error,
      })),
    });
  }
  if (body.action === "flush-digests") {
    const before = getQueueStats();
    await flushAllDigests();
    return NextResponse.json({ ok: true, flushed: before });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
