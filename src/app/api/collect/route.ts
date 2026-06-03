// 主动采集入口。两种执行路径：
//  - 配了 GITHUB_TOKEN + GITHUB_REPO（生产 Vercel）：派发 GitHub Actions
//    workflow_dispatch，由 runner 跑 collectAll，避开 Vercel 60s 函数超时
//  - 否则（本地 dev）：同进程直接跑 collectAll，方便调试
//
// 鉴权：浏览器同源放行（点 Fetch 按钮）；其他来源一律 401。
// 不再需要 CRON_SECRET——定时调度走 GitHub Actions schedule 本身的 token

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

function authorize(req: NextRequest): NextResponse | null {
  // 浏览器同源：浏览器自动加 Sec-Fetch-Site: same-origin，JS 无法伪造
  if (req.headers.get("sec-fetch-site") === "same-origin") return null;
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

async function dispatchWorkflow(token: string, repo: string): Promise<NextResponse> {
  // ref 用 main 分支；workflow 文件名固定 collect.yml
  const url = `https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-hot-news-report",
    },
    body: JSON.stringify({ ref: "main" }),
  });
  if (res.status === 204) {
    return NextResponse.json({ ok: true, mode: "workflow_dispatch" });
  }
  const text = await res.text().catch(() => "");
  return NextResponse.json(
    { ok: false, mode: "workflow_dispatch", status: res.status, error: text },
    { status: 502 },
  );
}

async function runLocally(): Promise<NextResponse> {
  const { collectAll } = await import("@/lib/collectors");
  const startedAt = Date.now();
  try {
    const result = await collectAll();
    return NextResponse.json({ ok: true, mode: "local", elapsed: Date.now() - startedAt, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mode: "local", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function trigger(): Promise<NextResponse> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (token && repo) return dispatchWorkflow(token, repo);
  // Vercel 上没配 token 等于忘了配——本想派发的，落到本地分支会必然 504
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        ok: false,
        error: "GITHUB_TOKEN/GITHUB_REPO not configured on Vercel; cannot dispatch workflow",
      },
      { status: 503 },
    );
  }
  return runLocally();
}

export async function POST(req: NextRequest) {
  return authorize(req) ?? trigger();
}
