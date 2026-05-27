"use client";

import { useEffect, useState } from "react";

export default function MonitorStatus() {
  const [stats, setStats] = useState({ total: 0, today: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/topics?stats=1");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats ?? { total: 0, today: 0 });
        }
      } catch {
        // 静默失败
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4">
      {/* 实时监控指示器 */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className="w-2 h-2 rounded-full bg-neon-green pulse-dot text-neon-green"
            style={{ color: "var(--neon-green)" }}
          />
        </div>
        <span className="text-xs font-mono text-text-secondary uppercase tracking-wider">
          监控中
        </span>
      </div>

      <div className="h-4 w-px bg-border-default" />

      {/* 统计数据 */}
      <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">总数</span>
          <span className="text-neon-cyan font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">今日</span>
          <span className="text-neon-purple font-bold">+{stats.today}</span>
        </div>
      </div>
    </div>
  );
}
