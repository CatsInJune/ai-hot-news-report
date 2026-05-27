"use client";

import { motion } from "framer-motion";
import { ExternalLink, MessageCircle, Heart, Repeat2, Eye } from "lucide-react";
import ScoreRing from "./ScoreRing";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "@/types";
import { formatRelativeTime } from "@/lib/utils";

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
}

interface Props {
  topic: Topic;
}

export default function TopicCard({ topic }: Props) {
  const sourceLabel = SOURCE_LABELS[topic.source as SourceType] ?? topic.source;
  const sourceColor = SOURCE_COLORS[topic.source as SourceType] ?? "#64748b";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2 }}
      className="scan-line-overlay group relative bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-neon-cyan/30 transition-colors"
    >
      {/* 顶部渐变条 */}
      <div
        className="h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${sourceColor}, transparent)` }}
      />

      <div className="p-5">
        {/* 头部：来源标签 + 时间 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wide"
              style={{
                color: sourceColor,
                backgroundColor: `color-mix(in srgb, ${sourceColor} 15%, transparent)`,
                border: `1px solid color-mix(in srgb, ${sourceColor} 30%, transparent)`,
              }}
            >
              {sourceLabel}
            </span>
            {topic.author && (
              <span className="text-[11px] text-text-muted truncate max-w-[120px]">
                @{topic.author}
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-muted font-mono">
            {formatRelativeTime(topic.publishedAt)}
          </span>
        </div>

        {/* 主体：标题 + 摘要 + 评分 */}
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-text-primary leading-snug mb-2 line-clamp-2 group-hover:text-neon-cyan transition-colors">
              {topic.title}
            </h3>
            {topic.summary && (
              <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
                {topic.summary}
              </p>
            )}
          </div>

          {/* 评分环 */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <ScoreRing value={topic.hotScore} label="热度" />
          </div>
        </div>

        {/* 底部：互动数据 + 原文链接 */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
          <div className="flex items-center gap-4 text-[11px] text-text-muted font-mono">
            {topic.likes > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {formatCount(topic.likes)}
              </span>
            )}
            {topic.reposts > 0 && (
              <span className="flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                {formatCount(topic.reposts)}
              </span>
            )}
            {topic.comments > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {formatCount(topic.comments)}
              </span>
            )}
            {topic.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {formatCount(topic.views)}
              </span>
            )}
          </div>

          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-neon-cyan/70 hover:text-neon-cyan font-mono opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <span>原文</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
