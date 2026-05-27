"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import KeywordForm from "@/components/keywords/KeywordForm";
import KeywordCard from "@/components/keywords/KeywordCard";

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

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = keywords.filter((k) => k.active).length;
  const total = keywords.length;
  const hits = keywords.reduce((sum, k) => sum + k._count.topics, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-8">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8 flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight leading-tight">
            关键词监控
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary leading-relaxed max-w-xl">
            告诉 AI 你在意什么，命中相关内容时第一时间推送给你。
          </p>
        </div>
        <KeywordForm onCreated={refresh} />
      </motion.header>

      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="监控中" value={active} accent />
        <StatCard label="总数" value={total} />
        <StatCard label="累计命中" value={hits} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4">
              <div className="h-4 w-2/3 rounded skeleton mb-2" />
              <div className="h-3 w-1/3 rounded skeleton" />
            </div>
          ))}
        </div>
      ) : keywords.length === 0 ? (
        <div className="card py-16 text-center">
          <p className="text-text-secondary text-[14px] mb-1">
            还没有关键词
          </p>
          <p className="text-[12px] text-text-muted">
            点击右上角 <span className="text-accent-bright font-medium">Add keyword</span>{" "}
            开始监控
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence>
            {keywords.map((k) => (
              <KeywordCard key={k.id} keyword={k} onChanged={refresh} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="text-[11.5px] text-text-muted mb-1">{label}</div>
      <div
        className={`text-[26px] font-semibold tabular-nums mono leading-none ${
          accent ? "text-accent-bright" : "text-text-primary"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
