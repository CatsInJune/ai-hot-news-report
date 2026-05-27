"use client";

import { motion } from "framer-motion";
import { Trash2, Power, Bell, Mail, Hash } from "lucide-react";
import { useState } from "react";

interface Keyword {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  priority: string;
  notifyBrowser: boolean;
  notifyEmail: boolean;
  createdAt: string;
  _count: { topics: number };
}

interface Props {
  keyword: Keyword;
  onChanged: () => void;
}

const PRIORITY_STYLES = {
  high: { color: "neon-red", label: "高" },
  medium: { color: "neon-amber", label: "中" },
  low: { color: "neon-green", label: "低" },
};

export default function KeywordCard({ keyword, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const priority = PRIORITY_STYLES[keyword.priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.medium;

  const toggleActive = async () => {
    setBusy(true);
    try {
      await fetch(`/api/keywords/${keyword.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !keyword.active }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确认删除关键词「${keyword.name}」？`)) return;
    setBusy(true);
    try {
      await fetch(`/api/keywords/${keyword.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="scan-line-overlay group relative bg-bg-surface border border-border-default rounded-xl p-5 hover:border-neon-cyan/30 transition-all"
    >
      {/* 顶部：状态指示器 */}
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden rounded-t-xl">
        <div
          className={`h-full transition-opacity ${keyword.active ? "opacity-100" : "opacity-20"}`}
          style={{ background: `linear-gradient(90deg, transparent, var(--${priority.color}), transparent)` }}
        />
      </div>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* 状态点 */}
          <div className="mt-1.5 shrink-0">
            <div
              className={`w-2 h-2 rounded-full ${keyword.active ? "pulse-dot" : ""}`}
              style={{
                color: keyword.active ? `var(--${priority.color})` : "var(--text-muted)",
                backgroundColor: keyword.active ? `var(--${priority.color})` : "var(--text-muted)",
              }}
            />
          </div>

          {/* 名称 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-text-primary truncate">
                {keyword.name}
              </h3>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                style={{
                  color: `var(--${priority.color})`,
                  backgroundColor: `color-mix(in srgb, var(--${priority.color}) 15%, transparent)`,
                }}
              >
                {priority.label}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-text-muted">
              <Hash className="w-3 h-3" />
              <span>{keyword.domain}</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={toggleActive}
            disabled={busy}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              keyword.active
                ? "text-neon-green hover:bg-bg-hover"
                : "text-text-muted hover:bg-bg-hover"
            }`}
            title={keyword.active ? "暂停监控" : "启用监控"}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-neon-red hover:bg-bg-hover transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 统计行 */}
      <div className="flex items-center justify-between pt-3 border-t border-border-default">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-text-secondary">
            <span className="font-mono">命中</span>
            <span className="text-neon-cyan font-bold font-mono">{keyword._count.topics}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {keyword.notifyBrowser && (
            <Bell className="w-3.5 h-3.5 text-neon-cyan" />
          )}
          {keyword.notifyEmail && (
            <Mail className="w-3.5 h-3.5 text-neon-purple" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
