"use client";

import { Target } from "lucide-react";
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* 标题区 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-end justify-between gap-4 flex-wrap"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-7 h-7 text-neon-purple" />
            <h1 className="text-2xl font-bold gradient-text">关键词监控</h1>
          </div>
          <p className="text-sm text-text-muted font-mono">
            // 添加你想要追踪的关键词，AI 自动识别并第一时间推送
          </p>
        </div>

        <KeywordForm onCreated={refresh} />
      </motion.div>

      {/* 统计面板 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4 mb-8"
      >
        <StatCard label="监控中" value={active} color="neon-cyan" suffix="个" />
        <StatCard label="总数" value={total} color="neon-purple" suffix="个" />
        <StatCard
          label="已命中"
          value={keywords.reduce((sum, k) => sum + k._count.topics, 0)}
          color="neon-pink"
          suffix="次"
        />
      </motion.div>

      {/* 关键词列表 */}
      {loading ? (
        <div className="py-16 text-center text-text-muted font-mono text-sm">
          加载中...
        </div>
      ) : keywords.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-20 text-center"
        >
          <Target className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
          <p className="text-text-secondary mb-2">还没有添加任何关键词</p>
          <p className="text-xs text-text-muted font-mono">点击右上角「添加关键词」开始监控</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

function StatCard({ label, value, color, suffix }: {
  label: string; value: number; color: string; suffix: string;
}) {
  return (
    <div className="relative bg-bg-surface border border-border-default rounded-xl p-4 overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, var(--${color}), transparent)` }}
      />
      <div className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-3xl font-bold font-mono"
          style={{ color: `var(--${color})` }}
        >
          {value}
        </span>
        <span className="text-sm text-text-muted">{suffix}</span>
      </div>
    </div>
  );
}
