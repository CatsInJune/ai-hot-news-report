"use client";

import { motion } from "framer-motion";
import {
  ExternalLink,
  MessageCircle,
  Heart,
  Repeat2,
  Eye,
  Flame,
} from "lucide-react";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

export default function TopicCard({ topic }: { topic: Topic }) {
  const sourceLabel = SOURCE_LABELS[topic.source as SourceType] ?? topic.source;
  const sourceColor = SOURCE_COLORS[topic.source as SourceType] ?? "#71717a";
  const isHot = topic.hotScore >= 80;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="group"
    >
      <a
        href={topic.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 transition-colors hover:bg-bg-surface/60 rounded-lg"
      >
        <div className="flex gap-4 items-start">
          {/* 左侧：热度评分 */}
          <ScorePill value={topic.hotScore} />

          {/* 主体 */}
          <div className="flex-1 min-w-0">
            {/* meta */}
            <div className="flex items-center gap-2 text-[11.5px] mb-1.5">
              <span
                className="font-medium uppercase tracking-wider text-[10.5px]"
                style={{ color: sourceColor }}
              >
                {sourceLabel}
              </span>
              {topic.author && (
                <>
                  <span className="text-text-faint">·</span>
                  <span className="text-text-muted truncate max-w-[160px]">
                    @{topic.author}
                  </span>
                </>
              )}
              <span className="text-text-faint">·</span>
              <time className="text-text-muted mono">
                {formatRelativeTime(topic.publishedAt)}
              </time>
              {isHot && (
                <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/12 text-warning border border-warning/25">
                  <Flame className="w-2.5 h-2.5" />
                  hot
                </span>
              )}
            </div>

            {/* 标题 */}
            <h3 className="text-[14.5px] font-medium leading-snug text-text-primary group-hover:text-accent-bright transition-colors line-clamp-2">
              {topic.title}
            </h3>

            {/* 摘要 */}
            {topic.summary && (
              <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed line-clamp-2">
                {topic.summary}
              </p>
            )}

            {/* 互动数据 */}
            <div className="mt-2.5 flex items-center gap-3.5 text-[11px] text-text-muted mono">
              {topic.likes > 0 && (
                <Metric icon={<Heart className="w-3 h-3" />} value={topic.likes} />
              )}
              {topic.reposts > 0 && (
                <Metric
                  icon={<Repeat2 className="w-3 h-3" />}
                  value={topic.reposts}
                />
              )}
              {topic.comments > 0 && (
                <Metric
                  icon={<MessageCircle className="w-3 h-3" />}
                  value={topic.comments}
                />
              )}
              {topic.views > 0 && (
                <Metric icon={<Eye className="w-3 h-3" />} value={topic.views} />
              )}
              <span className="ml-auto inline-flex items-center gap-1 text-text-faint opacity-0 group-hover:opacity-100 group-hover:text-accent-bright transition-all">
                Open
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </a>
    </motion.article>
  );
}

function ScorePill({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 80
      ? { fg: "text-warning", bg: "bg-warning/8", ring: "ring-warning/20" }
      : v >= 60
        ? { fg: "text-accent-bright", bg: "bg-accent-soft", ring: "ring-accent/20" }
        : v >= 40
          ? { fg: "text-text-secondary", bg: "bg-bg-elevated", ring: "ring-border-strong" }
          : { fg: "text-text-muted", bg: "bg-bg-elevated", ring: "ring-border-default" };

  return (
    <div
      className={cn(
        "shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center ring-1",
        tone.bg,
        tone.ring,
      )}
    >
      <span className={cn("text-[15px] font-semibold mono leading-none", tone.fg)}>
        {v}
      </span>
      <span className="text-[8.5px] text-text-faint mono tracking-wider mt-0.5">
        HOT
      </span>
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1 tabular-nums">
      {icon}
      {formatCount(value)}
    </span>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
