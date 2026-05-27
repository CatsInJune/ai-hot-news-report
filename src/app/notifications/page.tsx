"use client";

import { Mail, Globe, ExternalLink, CheckCheck, Bell } from "lucide-react";
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
    <div className="max-w-3xl mx-auto px-6 pt-10 pb-8">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight leading-tight">
              通知记录
            </h1>
            {unread > 0 && (
              <span className="px-1.5 h-5 rounded-md text-[11px] font-medium bg-accent-soft text-accent-bright border border-accent/20 flex items-center">
                {unread} 未读
              </span>
            )}
          </div>
          <p className="mt-2 text-[14px] text-text-secondary leading-relaxed">
            所有命中关键词的通知历史，按时间倒序排列。
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border-strong hover:border-accent/40 hover:text-accent-bright text-[12.5px] font-medium text-text-secondary transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            全部已读
          </button>
        )}
      </motion.header>

      {loading ? (
        <div className="card divide-y divide-border-default">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-3">
              <div className="w-7 h-7 rounded-md skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded skeleton" />
                <div className="h-3 w-3/4 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card py-16 text-center">
          <Bell className="w-9 h-9 text-text-faint mx-auto mb-3 opacity-50" />
          <p className="text-text-secondary text-[13.5px] mb-1">
            还没有通知
          </p>
          <p className="text-[11.5px] text-text-muted">
            添加关键词后，命中的内容会在这里展示
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden divide-y divide-border-default">
          <AnimatePresence>
            {items.map((n) => {
              const Icon = n.type === "email" ? Mail : Globe;
              const accent = n.type === "email" ? "info" : "accent-bright";
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex gap-3 px-4 py-3.5 transition-colors hover:bg-bg-hover/40 ${
                    n.read ? "opacity-65" : ""
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center border ${
                        n.read
                          ? "bg-bg-hover border-border-default text-text-muted"
                          : accent === "info"
                            ? "bg-info/10 border-info/20 text-info"
                            : "bg-accent-soft border-accent/20 text-accent-bright"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="text-[13.5px] font-medium text-text-primary truncate">
                        {n.title}
                      </h3>
                      <time className="text-[11px] text-text-muted mono shrink-0 tabular-nums">
                        {formatRelativeTime(n.sentAt)}
                      </time>
                    </div>
                    <p className="text-[12.5px] text-text-secondary leading-snug line-clamp-2">
                      {n.content}
                    </p>
                    {n.topicUrl && (
                      <a
                        href={n.topicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[11.5px] text-text-muted hover:text-accent-bright font-medium transition-colors"
                      >
                        查看原文
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {!n.read && (
                    <span className="shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-accent-bright pulse-dot" />
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
