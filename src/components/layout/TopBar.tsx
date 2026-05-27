"use client";

import { RefreshCcw, Search } from "lucide-react";
import { motion } from "framer-motion";
import MonitorStatus from "./MonitorStatus";
import { useState } from "react";

export default function TopBar() {
  const [collecting, setCollecting] = useState(false);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await fetch("/api/collect", { method: "POST" });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setCollecting(false), 800);
    }
  };

  return (
    <header className="h-16 shrink-0 glass-panel border-b border-border-default px-6 flex items-center justify-between z-10">
      {/* 左侧：监控状态 */}
      <MonitorStatus />

      {/* 中间：搜索框 */}
      <div className="hidden md:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="搜索热点内容..."
            className="w-full h-9 pl-10 pr-4 rounded-lg bg-bg-elevated border border-border-default text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all"
          />
        </div>
      </div>

      {/* 右侧：手动采集 */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={handleCollect}
          disabled={collecting}
          whileTap={{ scale: 0.95 }}
          className="group relative h-9 px-4 rounded-lg bg-bg-elevated border border-border-default hover:border-neon-cyan/50 text-sm font-medium text-text-primary transition-all flex items-center gap-2 disabled:opacity-60"
        >
          <RefreshCcw
            className={`w-4 h-4 text-neon-cyan ${collecting ? "animate-spin" : ""}`}
          />
          <span>{collecting ? "采集中..." : "立即采集"}</span>
        </motion.button>
      </div>
    </header>
  );
}
