import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySMTP } from "@/lib/mailer";

export async function GET() {
  const settings = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  // 环境变量配置状态（不返回值，仅返回是否配置）
  const env = {
    openrouter: !!process.env.OPENROUTER_API_KEY,
    twitter: !!process.env.TWITTER_API_KEY,
    firecrawl: !!process.env.FIRECRAWL_API_KEY,
    smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    model: process.env.OPENROUTER_MODEL ?? "google/gemini-2.5-flash",
    notificationEmail: process.env.NOTIFICATION_EMAIL ?? "",
    collectionCron: process.env.COLLECTION_CRON ?? "*/30 * * * *",
  };

  return NextResponse.json({ settings: map, env });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "test-smtp") {
    const r = await verifySMTP();
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
