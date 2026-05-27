"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox, Sparkles } from "lucide-react";
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
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  const counts: Record<string, number> = { all: topics.length };
  for (const t of topics) {
    counts[t.source] = (counts[t.source] ?? 0) + 1;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <SourceTabs active={source} counts={counts} onChange={setSource} />
        <AnimatePresence>
          {newCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={fetchTopics}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-accent/30 bg-accent-soft text-[11.5px] font-medium text-accent-bright hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              {newCount} new · refresh
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="card overflow-hidden divide-y divide-border-default">
        {loading ? (
          <div className="py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="py-20 text-center">
            <Inbox className="w-9 h-9 text-text-faint mx-auto mb-3 opacity-50" />
            <p className="text-text-secondary text-[13.5px] mb-1">
              No topics yet
            </p>
            <p className="text-[11.5px] text-text-muted">
              Add a keyword and trigger{" "}
              <kbd>Fetch</kbd> to start.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="px-4 py-4 flex gap-4">
      <div className="w-11 h-11 rounded-lg skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded skeleton" />
        <div className="h-4 w-3/4 rounded skeleton" />
        <div className="h-3 w-2/3 rounded skeleton" />
      </div>
    </div>
  );
}
