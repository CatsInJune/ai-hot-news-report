"use client";

import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import TopicFeed from "@/components/feed/TopicFeed";

export default function HomePage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Radio className="w-7 h-7 text-neon-cyan" />
          <h1 className="text-2xl font-bold gradient-text">实时热点 Feed</h1>
        </div>
        <p className="text-sm text-text-muted font-mono">
          // 8 个信息源并行扫描 · AI 智能过滤 · 实时推送
        </p>
      </motion.div>

      <TopicFeed />
    </div>
  );
}
