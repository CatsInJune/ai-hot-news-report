// 查询本仓库 collect.yml 最近的一次 workflow run 状态。
// 前端点 Fetch 派发 workflow_dispatch 后，会轮询这个 endpoint 拿真实 runner 状态，
// 直到 status === "completed"，避免靠 lastCollectionAt 间接猜测。
//
// 鉴权：浏览器同源放行；其他来源 401（避免被恶意打 GitHub API 触发 rate limit）

import { NextRequest, NextResponse } from "next/server";

interface WorkflowRun {
  id: number;
  status: "queued" | "in_progress" | "completed" | "waiting" | string;
  conclusion:
    | "success"
    | "failure"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | "neutral"
    | "stale"
    | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  event: string;
}

function authorize(req: NextRequest): NextResponse | null {
  if (req.headers.get("sec-fetch-site") === "same-origin") return null;
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const unauth = authorize(req);
  if (unauth) return unauth;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    // 本地 dev 没配 token，前端不该走到这里；直接返回 not-configured，前端跳过状态轮询
    return NextResponse.json({ ok: false, configured: false });
  }

  // per_page=5 兜底：dispatch 后 run 可能延迟 0-30s 才出现在列表里；
  // 同时偶尔会有别的事件（push 之类）穿插，多拿几条容错
  const url = `https://api.github.com/repos/${repo}/actions/workflows/collect.yml/runs?per_page=5`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-hot-news-report",
    },
    // 必须禁缓存，否则 Next.js fetch 默认 cache 会返回旧状态
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { ok: false, status: res.status, error: text },
      { status: 502 },
    );
  }

  const data = (await res.json()) as { workflow_runs?: WorkflowRun[] };
  const runs = (data.workflow_runs ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    htmlUrl: r.html_url,
    event: r.event,
  }));

  return NextResponse.json({ ok: true, configured: true, runs });
}
