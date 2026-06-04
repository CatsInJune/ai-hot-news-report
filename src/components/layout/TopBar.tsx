"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bell,
  RefreshCcw,
  Settings2,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Feed", icon: LayoutGrid },
  { href: "/keywords", label: "Keywords", icon: Sparkles },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

interface Stats {
  total: number;
  today: number;
}

// 直接查 GitHub Actions Workflow Runs API 拿真实 runner 状态。
// 轮询间隔短一点，因为 GitHub 给的 rate limit 是 5000 req/hour，5s 完全够用
const POLL_INTERVAL_MS = 5 * 1000;
// 兜底：runner timeout-minutes=15，再宽容到 18min 后强制撤 loading
const MAX_WAIT_MS = 18 * 60 * 1000;

interface RunSnapshot {
  id: number;
  status: string; // queued / in_progress / completed / waiting
  conclusion: string | null; // success / failure / cancelled / null(未完成)
  createdAt: string;
  htmlUrl: string;
  event: string;
}

type RunPhase = "idle" | "queued" | "running" | "done";

export default function TopBar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0 });
  const [unread, setUnread] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  // 派发时记录的"已存在最新 run id"，用来识别"刚 dispatch 的那次"
  const baselineRunIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/topics?stats=1").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/notifications?unread=1").then((r) =>
            r.ok ? r.json() : null,
          ),
        ]);
        if (cancelled) return;
        if (a?.stats) setStats(a.stats);
        if (typeof b?.unread === "number") setUnread(b.unread);
      } catch {
        /* silent */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    const onInvalidate = () => tick();
    window.addEventListener("app:data-changed", onInvalidate);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("app:data-changed", onInvalidate);
    };
  }, []);

  // 拉一次本仓库 collect.yml 的最近 runs（拿头几条用来识别"本次"）
  const fetchLatestRuns = async (): Promise<RunSnapshot[]> => {
    try {
      const r = await fetch("/api/collect/status", { cache: "no-store" });
      if (!r.ok) return [];
      const j = await r.json();
      if (!j?.ok || !Array.isArray(j.runs)) return [];
      return j.runs as RunSnapshot[];
    } catch {
      return [];
    }
  };

  // 派发后轮询：找到 id > baseline 的新 run，跟它跑到 completed 为止
  const waitForRunCompletion = async () => {
    const startedAt = Date.now();
    let trackedRun: RunSnapshot | null = null;

    while (Date.now() - startedAt < MAX_WAIT_MS) {
      const runs = await fetchLatestRuns();
      if (!trackedRun) {
        // 还没识别到"本次"run。找 id 严格大于 baseline 的最新一条
        const candidate = runs.find(
          (r) =>
            r.event === "workflow_dispatch" &&
            (baselineRunIdRef.current === null || r.id > baselineRunIdRef.current),
        );
        if (candidate) {
          trackedRun = candidate;
          setRunPhase(candidate.status === "queued" ? "queued" : "running");
        }
      } else {
        // 已锁定本次 run，持续刷状态
        const fresh = runs.find((r) => r.id === trackedRun!.id);
        if (fresh) {
          trackedRun = fresh;
          if (fresh.status === "queued") setRunPhase("queued");
          else if (fresh.status === "in_progress") setRunPhase("running");
          else if (fresh.status === "completed") {
            setRunPhase("done");
            window.dispatchEvent(new Event("app:data-changed"));
            return;
          }
        }
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    // 超时兜底
    setRunPhase("done");
  };

  const handleCollect = async () => {
    if (collecting) return;
    setCollecting(true);
    setRunPhase("queued");
    // 派发前拿一次最新 run 列表，记录最大 id 作为 baseline
    const before = await fetchLatestRuns();
    baselineRunIdRef.current = before.length > 0 ? before[0].id : null;

    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (body?.mode === "workflow_dispatch") {
        await waitForRunCompletion();
      }
      // 本地 dev 模式（mode=local）：collectAll 同步完成，直接结束
    } catch {
      /* swallow */
    } finally {
      setCollecting(false);
      // 短延迟后回 idle，避免按钮文案瞬切
      setTimeout(() => setRunPhase("idle"), 1500);
    }
  };

  const collectLabel =
    runPhase === "queued"
      ? "排队中"
      : runPhase === "running"
        ? "采集中"
        : runPhase === "done"
          ? "已完成"
          : "Fetch";

  return (
    <header className="sticky top-0 z-30 glass-panel">
      <div className="max-w-6xl mx-auto h-14 px-6 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="relative w-7 h-7 rounded-md bg-gradient-to-br from-accent-bright to-accent flex items-center justify-center shadow-sm">
            <Activity className="w-3.5 h-3.5 text-bg-primary" strokeWidth={3} />
            <div className="absolute inset-0 rounded-md bg-accent-bright/30 blur-md -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="text-[14px] font-semibold tracking-tight">
            ai-hot-news
          </span>
        </Link>

        {/* 导航 */}
        <nav className="hidden md:flex items-center gap-0.5 text-[13px]">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            const showBadge = item.href === "/notifications" && unread > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 h-8 rounded-md transition-colors",
                  active
                    ? "text-text-primary bg-bg-hover"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-hover/50",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {showBadge && (
                  <span className="ml-0.5 min-w-[16px] px-1 h-4 rounded-full text-[9px] font-mono font-semibold bg-accent text-bg-primary flex items-center justify-center">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-x-2 -bottom-[14px] h-0.5 bg-accent-bright rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />


        {/* 右侧：状态 + fetch */}
        <div className="flex items-center gap-3 shrink-0">
          {/* live dot + counters */}
          <div className="hidden sm:flex items-center gap-2.5 px-2.5 h-8 rounded-md border border-border-default bg-bg-surface/40">
            <span className="flex items-center gap-1.5 text-[11px]">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-accent-bright opacity-60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-accent-bright" />
              </span>
              <span className="text-text-muted">live</span>
            </span>
            <span className="w-px h-3 bg-border-strong" />
            <Counter label="topics" value={stats.total} />
            <Counter label="today" value={`+${stats.today}`} accent />
          </div>

          <button
            onClick={handleCollect}
            disabled={collecting}
            aria-label="立即采集"
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium transition-all disabled:opacity-60",
              "bg-accent text-bg-primary hover:bg-accent-bright shadow-sm hover:shadow-md",
            )}
          >
            <RefreshCcw
              className={cn("w-3.5 h-3.5", collecting && "animate-spin")}
            />
            <span className="hidden md:inline">{collectLabel}</span>
          </button>
        </div>
      </div>

      {/* 移动端 nav */}
      <nav className="md:hidden flex items-center gap-0.5 px-6 h-10 border-t border-border-default text-[12px] overflow-x-auto">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-1.5 px-2.5 h-7 rounded-md shrink-0",
                active
                  ? "text-accent-bright bg-accent-soft"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <span className="flex items-center gap-1 text-[11px]">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums font-medium",
          accent ? "text-accent-bright" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </span>
  );
}
