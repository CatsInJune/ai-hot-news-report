"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ExternalLink,
  MessageCircle,
  Heart,
  Repeat2,
  Eye,
  AlertTriangle,
  Zap,
  ChevronDown,
  Sparkles,
  FileText,
  BadgeCheck,
  Users,
} from "lucide-react";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Topic {
  id: string;
  title: string;
  summary: string | null;
  rawContent?: string | null;
  url: string;
  source: string;
  author: string | null;
  authorVerified?: boolean | null;
  authorFollowers?: number | null;
  publishedAt: string;
  createdAt?: string;
  realScore: number;
  hotScore: number;
  relevScore: number;
  importance?: string;
  reason?: string | null;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
}

interface Props {
  topic: Topic;
  expandAll?: boolean; // 来自 Feed 的"全部展开"全局信号
}

export default function TopicCard({ topic, expandAll }: Props) {
  const sourceLabel = SOURCE_LABELS[topic.source as SourceType] ?? topic.source;
  const sourceColor = SOURCE_COLORS[topic.source as SourceType] ?? "#71717a";

  const [expanded, setExpanded] = useState(false);

  // 全局"全部展开"切换时同步本地状态
  useEffect(() => {
    if (typeof expandAll === "boolean") setExpanded(expandAll);
  }, [expandAll]);

  // 只有原始内容才走折叠/展开；AI 相关性判断改为常驻展示
  const hasExpandable = !!topic.rawContent;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="group"
    >
      <div className="block p-4 transition-colors hover:bg-bg-surface/60 rounded-lg">
        <div className="flex gap-4 items-start">
          {/* 左侧：热度评分 */}
          <ScorePill value={topic.hotScore} />

          {/* 主体 */}
          <div className="flex-1 min-w-0">
            {/* meta：来源 / 作者 / 发布时间 / 抓取时间 */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11.5px] mb-1.5">
              <span
                className="font-medium uppercase tracking-wider text-[10.5px]"
                style={{ color: sourceColor }}
              >
                {sourceLabel}
              </span>
              {topic.author && (
                <>
                  <span className="text-text-faint">·</span>
                  <span className="text-text-muted truncate max-w-[200px] inline-flex items-center gap-0.5">
                    @{topic.author}
                    {topic.authorVerified && (
                      <BadgeCheck
                        className="w-3 h-3 text-info shrink-0"
                        strokeWidth={2.5}
                        aria-label="verified"
                      />
                    )}
                  </span>
                  {typeof topic.authorFollowers === "number" && topic.authorFollowers > 0 && (
                    <span className="text-text-faint mono inline-flex items-center gap-0.5">
                      <Users className="w-3 h-3" />
                      {formatCount(topic.authorFollowers)}
                    </span>
                  )}
                </>
              )}
              <span className="text-text-faint">·</span>
              <time className="text-text-muted mono" title={`发布: ${new Date(topic.publishedAt).toLocaleString()}`}>
                发布 {formatRelativeTime(topic.publishedAt)}
              </time>
              {topic.createdAt && (
                <>
                  <span className="text-text-faint">·</span>
                  <time className="text-text-faint mono" title={`抓取: ${new Date(topic.createdAt).toLocaleString()}`}>
                    抓取 {formatRelativeTime(topic.createdAt)}
                  </time>
                </>
              )}
              <ImportanceBadge value={topic.importance} />
            </div>

            {/* 标题 */}
            <a
              href={topic.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <h3 className="text-[14.5px] font-medium leading-snug text-text-primary group-hover:text-accent-bright transition-colors">
                {topic.title}
              </h3>
            </a>

            {/* AI 摘要 */}
            {topic.summary && (
              <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed line-clamp-2">
                {topic.summary}
              </p>
            )}

            {/* 互动数据（4 指标常驻，0 显示 —）+ 评分细节 */}
            <div className="mt-2.5 flex items-center flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-text-muted mono">
              <Metric icon={<Heart className="w-3 h-3" />} value={topic.likes} />
              <Metric icon={<Repeat2 className="w-3 h-3" />} value={topic.reposts} />
              <Metric icon={<MessageCircle className="w-3 h-3" />} value={topic.comments} />
              <Metric icon={<Eye className="w-3 h-3" />} value={topic.views} />
              <span className="text-text-faint mono tabular-nums">
                rel <span className="text-text-secondary">{topic.relevScore}</span>
              </span>
              <a
                href={topic.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-text-faint opacity-0 group-hover:opacity-100 group-hover:text-accent-bright transition-all"
              >
                Open
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* AI 相关性判断（常驻显示，不折叠） */}
            {topic.reason && (
              <div className="mt-2.5 pl-3 border-l-2 border-accent/30 text-[12.5px]">
                <div className="flex items-center gap-1 text-[10.5px] text-accent-bright uppercase tracking-wider font-medium mb-1">
                  <Sparkles className="w-3 h-3" />
                  AI 相关性判断
                </div>
                <p className="text-text-secondary leading-relaxed">
                  {topic.reason}
                </p>
              </div>
            )}

            {/* 原始内容（折叠/展开） */}
            {hasExpandable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className={cn(
                  "mt-2 inline-flex items-center gap-1 h-6 px-2 -ml-2 rounded-md text-[11px] font-medium transition-colors",
                  expanded
                    ? "text-accent-bright bg-accent-soft"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-hover/60",
                )}
              >
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
                {expanded ? "收起原文" : "查看原文"}
              </button>
            )}

            <AnimatePresence initial={false}>
              {expanded && hasExpandable && topic.rawContent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 pl-3 border-l-2 border-border-strong text-[12.5px]">
                    <div className="flex items-center gap-1 text-[10.5px] text-text-muted uppercase tracking-wider font-medium mb-1">
                      <FileText className="w-3 h-3" />
                      原始内容
                    </div>
                    <div className="markdown-body text-text-secondary leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {topic.rawContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
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
  // 0 显示 —，表示"无数据 / 该平台不适用"
  return (
    <span
      className={cn(
        "flex items-center gap-1 tabular-nums",
        value === 0 && "text-text-faint",
      )}
    >
      {icon}
      {value === 0 ? "—" : formatCount(value)}
    </span>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// 仅对 urgent / high 显示徽章，medium 和 low 不显示（避免视觉噪音）
function ImportanceBadge({ value }: { value?: string }) {
  if (value === "urgent") {
    return (
      <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-danger/15 text-danger border border-danger/30 uppercase tracking-wider">
        <Zap className="w-2.5 h-2.5" strokeWidth={2.5} />
        urgent
      </span>
    );
  }
  if (value === "high") {
    return (
      <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/12 text-warning border border-warning/25 uppercase tracking-wider">
        <AlertTriangle className="w-2.5 h-2.5" strokeWidth={2.5} />
        high
      </span>
    );
  }
  return null;
}
