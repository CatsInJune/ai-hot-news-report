"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Radio, Inbox } from "lucide-react";
import TopicCard from "./TopicCard";
import SourceTabs from "./SourceTabs";

interface Topic {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  source: string;
  author: string | null;
  publishedAt: string;
  realScore: number;
  hotScore: number;
  relevScore: number;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  createdAt: string;
}

export default function TopicFeed() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("all");
  const [newCount, setNewCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics?source=${source}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics);
        setNewCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [source]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // SSE 连接：检测到新内容时增加计数
  useEffect(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();

    const es = new EventSource("/api/sse");
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "new-topic" || event.type === "alert") {
          setNewCount((n) => n + 1);
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      // 自动重连由浏览器处理，这里无需操作
    };

    return () => {
      es.close();
    };
  }, []);

  // 按来源分组统计
  const counts: Record<string, number> = { all: topics.length };
  for (const t of topics) {
    counts[t.source] = (counts[t.source] ?? 0) + 1;
  }

  return (
    <div>
      {/* Tabs + 新内容提示 */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <SourceTabs active={source} counts={counts} onChange={setSource} />
        <AnimatePresence>
          {newCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              onClick={fetchTopics}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon-cyan/10 border border-neon-cyan/40 text-xs font-mono text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
            >
              <Radio className="w-3 h-3" />
              {newCount} 条新内容 · 点击刷新
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Feed 列表 */}
      {loading ? (
        <div className="py-20 text-center text-text-muted font-mono text-sm">
          数据加载中...
        </div>
      ) : topics.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 text-center"
        >
          <Inbox className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-secondary mb-2">还没有采集到内容</p>
          <p className="text-xs text-text-muted font-mono">
            添加关键词后点击右上角「立即采集」开始
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
