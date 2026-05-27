"use client";

import { Bell, Mail, Globe, ExternalLink, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { formatRelativeTime } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  topicUrl: string | null;
  read: boolean;
  sentAt: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setItems(data.notifications);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    refresh();
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-7 h-7 text-neon-pink" />
            <h1 className="text-2xl font-bold gradient-text">通知记录</h1>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-neon-pink/20 text-neon-pink">
                {unread} 未读
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted font-mono">
            // 所有触发关键词的通知历史，按时间倒序
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            全部标记已读
          </button>
        )}
      </motion.div>

      {loading ? (
        <div className="py-16 text-center text-text-muted font-mono text-sm">加载中...</div>
      ) : items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center">
          <Bell className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-secondary mb-2">还没有任何通知</p>
          <p className="text-xs text-text-muted font-mono">
            添加关键词后，命中的内容会在这里显示
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {items.map((n) => {
              const Icon = n.type === "email" ? Mail : Globe;
              const color = n.type === "email" ? "neon-purple" : "neon-cyan";
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-4 p-4 rounded-lg border transition-colors ${
                    n.read
                      ? "bg-bg-surface/50 border-border-default/50"
                      : "bg-bg-surface border-border-default"
                  } hover:border-neon-cyan/30`}
                >
                  <div className="shrink-0 mt-1">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        color: `var(--${color})`,
                        backgroundColor: `color-mix(in srgb, var(--${color}) 12%, transparent)`,
                      }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-sm font-bold text-text-primary truncate">
                        {n.title}
                      </h3>
                      <span className="text-[11px] text-text-muted font-mono shrink-0">
                        {formatRelativeTime(n.sentAt)}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-2 mb-1">
                      {n.content}
                    </p>
                    {n.topicUrl && (
                      <a
                        href={n.topicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-neon-cyan/70 hover:text-neon-cyan font-mono"
                      >
                        <span>查看原文</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {!n.read && (
                    <div className="shrink-0 w-2 h-2 rounded-full bg-neon-pink mt-2 pulse-dot text-neon-pink" />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
