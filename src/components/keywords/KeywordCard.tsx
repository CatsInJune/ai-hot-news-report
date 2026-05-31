"use client";

import { motion } from "framer-motion";
import { Trash2, Power, Bell, Mail, Hash, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Keyword {
  id: string;
  name: string;
  domain: string;
  active: boolean;
  priority: string;
  notifyBrowser: boolean;
  notifyEmail: boolean;
  notifyWechat: boolean;
  createdAt: string;
  _count: { topics: number };
}

const PRIORITY = {
  high: { label: "High", tone: "text-warning bg-warning/10 border-warning/25" },
  medium: { label: "Med", tone: "text-text-secondary bg-bg-hover border-border-strong" },
  low: { label: "Low", tone: "text-text-muted bg-bg-hover/60 border-border-default" },
} as const;

export default function KeywordCard({
  keyword,
  onChanged,
}: {
  keyword: Keyword;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const p =
    PRIORITY[keyword.priority as keyof typeof PRIORITY] ?? PRIORITY.medium;

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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="group card card-hover card-glow p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className={cn(
              "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
              keyword.active ? "bg-accent-bright pulse-dot" : "bg-text-faint",
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14.5px] font-medium text-text-primary truncate">
                {keyword.name}
              </h3>
              <span
                className={cn(
                  "px-1.5 h-4 rounded text-[10px] font-medium border flex items-center",
                  p.tone,
                )}
              >
                {p.label}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1 text-[11.5px] text-text-muted">
              <Hash className="w-2.5 h-2.5" />
              <span>{keyword.domain}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <IconBtn
            onClick={toggleActive}
            disabled={busy}
            label={keyword.active ? "暂停监控" : "启用监控"}
            active={keyword.active}
          >
            <Power className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn
            onClick={handleDelete}
            disabled={busy}
            label="删除"
            danger
          >
            <Trash2 className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border-default flex items-center justify-between">
        <div className="flex items-baseline gap-1.5 mono">
          <span className="text-text-muted text-[11px]">hits</span>
          <span className="text-[15px] font-semibold text-accent-bright tabular-nums">
            {keyword._count.topics}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {keyword.notifyBrowser && (
            <span title="浏览器推送" className="inline-flex p-1 rounded bg-bg-hover">
              <Bell className="w-3 h-3 text-accent-bright" />
            </span>
          )}
          {keyword.notifyEmail && (
            <span title="邮件推送" className="inline-flex p-1 rounded bg-bg-hover">
              <Mail className="w-3 h-3 text-info" />
            </span>
          )}
          {keyword.notifyWechat && (
            <span title="微信推送" className="inline-flex p-1 rounded bg-bg-hover">
              <MessageCircle className="w-3 h-3 text-accent-bright" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function IconBtn({
  onClick,
  disabled,
  label,
  children,
  active,
  danger,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
        danger
          ? "text-text-muted hover:text-danger hover:bg-danger/10"
          : active
            ? "text-accent-bright hover:bg-bg-hover"
            : "text-text-muted hover:text-text-primary hover:bg-bg-hover",
      )}
    >
      {children}
    </button>
  );
}
