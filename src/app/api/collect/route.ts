import { NextRequest, NextResponse } from "next/server";
import { collectAll } from "@/lib/collectors";

export const maxDuration = 120;

function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  // 未配置 CRON_SECRET 视为本地开发模式：放行，方便 curl 手动触发
  if (!secret) return null;
  const expected = `Bearer ${secret}`;
  if (req.headers.get("authorization") !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function run() {
  const startedAt = Date.now();
  try {
    const result = await collectAll();
    const elapsed = Date.now() - startedAt;
    return NextResponse.json({ ok: true, elapsed, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// Vercel Cron 用 GET 调用
export async function GET(req: NextRequest) {
  return authorize(req) ?? run();
}

// 保留 POST 给手动触发（curl）
export async function POST(req: NextRequest) {
  return authorize(req) ?? run();
}
