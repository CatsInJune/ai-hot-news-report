"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function TopBar() {
  const pathname = usePathname();
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0 });
  const [collecting, setCollecting] = useState(false);
  const [unread, setUnread] = useState(0);

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

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch("/api/collect", { method: "POST" });
    } finally {
      setTimeout(() => setCollecting(false), 600);
    }
  };

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
            <span className="hidden md:inline">
              {collecting ? "Fetching" : "Fetch"}
            </span>
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
