"use client";

import { motion } from "framer-motion";
import TopicFeed from "@/components/feed/TopicFeed";

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-10"
      >
        <div className="absolute -top-8 -left-12 right-0 h-48 bg-dots pointer-events-none opacity-60" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-accent-soft text-accent-bright border border-accent/20 mb-4">
            <span className="w-1 h-1 rounded-full bg-accent-bright pulse-dot" />
            Live · 12 sources streaming
          </span>

          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight leading-[1.15] text-text-primary max-w-2xl">
            AI 帮你<span className="gradient-text">盯着全网</span>
          </h1>

          <p className="mt-3 max-w-xl text-[14px] text-text-secondary leading-relaxed">
            12 个源 · 全天候扫描 · 自动过滤噪声 ·{" "}
            <span className="text-text-primary">命中关键词秒级推送</span>
          </p>

          {/* 信任锚点 */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-accent-bright" />
              Twitter · HN · Reddit · arXiv · Bing · Google · 百度 · 搜狗 · 微博 · B站 · AI 官博 · AI 媒体
            </span>
          </div>
        </div>
      </motion.section>

      {/* Section header */}
      <div className="flex items-baseline justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold text-text-primary">
            实时 Feed
          </h2>
        </div>
      </div>

      <TopicFeed />
    </div>
  );
}
