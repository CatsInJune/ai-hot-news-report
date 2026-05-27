"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Radio, Target, Bell, Settings, Zap, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "热点 Feed", icon: Radio, accent: "neon-cyan" },
  { href: "/keywords", label: "关键词监控", icon: Target, accent: "neon-purple" },
  { href: "/notifications", label: "通知记录", icon: Bell, accent: "neon-pink" },
  { href: "/settings", label: "设置", icon: Settings, accent: "neon-amber" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="relative h-full glass-panel border-r border-border-default flex flex-col z-10"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border-default">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="relative shrink-0">
            <Zap className="w-7 h-7 text-neon-cyan" strokeWidth={2.5} />
            <div className="absolute -inset-1 bg-neon-cyan/20 blur-md -z-10" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col"
            >
              <span className="text-base font-bold gradient-text leading-tight">
                AI热点速报
              </span>
              <span className="text-[10px] text-text-muted font-mono leading-tight">
                v1.0 · LIVE
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* 折叠按钮 */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-bg-elevated border border-border-default flex items-center justify-center hover:border-neon-cyan transition-colors z-20"
      >
        <ChevronLeft
          className={cn(
            "w-3 h-3 text-text-secondary transition-transform",
            collapsed && "rotate-180",
          )}
        />
      </button>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                active
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
              )}
            >
              {/* 激活左侧指示线 */}
              {active && (
                <motion.div
                  layoutId="active-indicator"
                  className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r",
                    `bg-${item.accent}`,
                  )}
                  style={{
                    backgroundColor: `var(--${item.accent})`,
                    boxShadow: `0 0 12px var(--${item.accent})`,
                  }}
                />
              )}

              <Icon
                className={cn("w-5 h-5 shrink-0 transition-colors")}
                style={active ? { color: `var(--${item.accent})` } : undefined}
              />

              {!collapsed && (
                <span className="text-sm font-medium whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部信息 */}
      {!collapsed && (
        <div className="p-4 border-t border-border-default">
          <div className="text-[10px] font-mono text-text-muted leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-neon-green pulse-dot text-neon-green" />
              <span>SYSTEM ONLINE</span>
            </div>
            <div>8 个信息源</div>
            <div>每 30 分钟扫描</div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
