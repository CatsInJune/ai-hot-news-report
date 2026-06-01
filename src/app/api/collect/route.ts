import { NextRequest, NextResponse } from "next/server";
import { collectAll } from "@/lib/collectors";

export const maxDuration = 120;

// 允许调用的来源：
// 1) 未配置 CRON_SECRET（本地开发）：放行
// 2) 浏览器同源请求（前端 Fetch 按钮）：浏览器自动加 Sec-Fetch-Site: same-origin，
//    JS 无法伪造、跨站请求会是 cross-site，正好用作"是不是本站页面来的"判据
// 3) 携带正确 Bearer 的外部调用：GitHub Actions / Vercel Cron / curl
function authorize(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  if (req.headers.get("sec-fetch-site") === "same-origin") return null;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return null;
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
