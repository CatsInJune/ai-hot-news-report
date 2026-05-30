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
  ChevronDown,
  Sparkles,
  FileText,
  BadgeCheck,
  Users,
  Copy,
  Check,
  Clock,
  Flame,
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
  index?: number; // 用于错峰入场动画
}

export default function TopicCard({ topic, expandAll, index = 0 }: Props) {
  const sourceLabel = SOURCE_LABELS[topic.source as SourceType] ?? topic.source;
  const sourceColor = SOURCE_COLORS[topic.source as SourceType] ?? "#71717a";

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 全局"全部展开"切换时同步本地状态
  useEffect(() => {
    if (typeof expandAll === "boolean") setExpanded(expandAll);
  }, [expandAll]);

  // 只有原始内容才走折叠/展开；AI 相关性判断改为常驻展示
  const hasExpandable = !!topic.rawContent;
  const stats = hasExpandable ? getContentStats(topic.rawContent!) : null;

  const handleCopy = async () => {
    if (!topic.rawContent) return;
    try {
      await navigator.clipboard.writeText(topic.rawContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 静默失败：clipboard 在非 https/无权限时会拒绝；用户可手动选择文本
    }
  };

  const hotTone = getHotTone(topic.hotScore);

  return (
    <motion.article
      layout
      // 错峰从左侧画外滑入：起点在 .card 容器外 100% 处（被 overflow-hidden 裁掉）
      // 配合 stagger 形成强烈的瀑布感，每张卡顺序破出左边线
      initial={{ opacity: 0, x: "-100%" }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.09, // 10 张卡总错峰 810ms
        ease: [0.16, 0.84, 0.24, 1],
      }}
      className="group relative"
    >
      {/* 左侧热度色条：3px 宽，颜色随 hotScore 等级渐变 */}
      <div
        aria-hidden
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[2.5px] rounded-r-sm transition-opacity",
          hotTone.bar,
          // 低分时弱化，避免 41 条都是高分色块
          topic.hotScore < 60 && "opacity-40",
        )}
      />

      <div className="block px-4 py-3 pl-5 transition-colors hover:bg-bg-surface/50 rounded-md">
        {/* 顶部 meta：source · @author · time · importance dot —— 单行 11px，统一灰阶不抢戏 */}
        <div className="flex items-center gap-x-2 text-[11px] text-text-muted mb-1.5 min-w-0">
          {/* source：保留品牌色作为前置 dot，文字本身用统一灰阶 */}
          <span className="inline-flex items-center gap-1 shrink-0">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: sourceColor }}
              aria-hidden
            />
            <span className="font-medium uppercase tracking-wider text-[10px] text-text-muted">
              {sourceLabel}
            </span>
          </span>
          {topic.author && (
            <>
              <span className="text-text-faint">·</span>
              <span className="text-text-muted truncate max-w-[180px] inline-flex items-center gap-0.5 min-w-0">
                @{topic.author}
                {topic.authorVerified && (
                  <BadgeCheck className="w-3 h-3 text-info shrink-0" strokeWidth={2.5} aria-label="verified" />
                )}
              </span>
              {typeof topic.authorFollowers === "number" && topic.authorFollowers > 0 && (
                <span className="text-text-faint mono inline-flex items-center gap-0.5 shrink-0">
                  <Users className="w-3 h-3" />
                  {formatCount(topic.authorFollowers)}
                </span>
              )}
            </>
          )}
          <span className="text-text-faint shrink-0">·</span>
          <time className="text-text-muted mono shrink-0" title={`发布: ${new Date(topic.publishedAt).toLocaleString()}`}>
            {formatRelativeTime(topic.publishedAt)}
          </time>
          {topic.createdAt && (
            <time
              className="text-text-faint mono shrink-0 hidden lg:inline"
              title={`抓取: ${new Date(topic.createdAt).toLocaleString()}`}
            >
              · 抓 {formatRelativeTime(topic.createdAt)}
            </time>
          )}
          <ImportanceInline value={topic.importance} />
          {/* hot score 数值：右侧 monospace，比左侧色条更精确（高分用主题色） */}
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 mono tabular-nums text-[10.5px] shrink-0",
              hotTone.text,
            )}
            title={`HOT ${topic.hotScore}`}
          >
            <Flame className="w-3 h-3" strokeWidth={2} />
            {topic.hotScore}
          </span>
        </div>

        {/* 标题：15.5px font-medium，完整展示不截断 */}
        <a
          href={topic.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group/title"
        >
          <h3 className="text-[15.5px] font-medium leading-snug text-text-primary group-hover/title:text-accent-bright transition-colors">
            {topic.title}
          </h3>
        </a>

        {/* AI 摘要：作为副歌，line-clamp-2 防过长 */}
        {topic.summary && (
          <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed line-clamp-2">
            {topic.summary}
          </p>
        )}

        {/* 互动数据 + rel + reason + open —— 一行紧凑，0 值完全隐藏 */}
        <div className="mt-2 flex items-center gap-x-3 gap-y-1 text-[11px] text-text-muted mono flex-wrap">
          {topic.likes > 0 && <MetricCompact icon={<Heart className="w-3 h-3" />} value={topic.likes} />}
          {topic.reposts > 0 && <MetricCompact icon={<Repeat2 className="w-3 h-3" />} value={topic.reposts} />}
          {topic.comments > 0 && <MetricCompact icon={<MessageCircle className="w-3 h-3" />} value={topic.comments} />}
          {topic.views > 0 && <MetricCompact icon={<Eye className="w-3 h-3" />} value={topic.views} />}
          <span className="text-text-faint mono tabular-nums">
            rel <span className="text-text-secondary">{topic.relevScore}</span>
          </span>
          {/* AI reason：折叠成 chip，hover/focus 显示 tooltip——把常驻的 5 行块压成一个图标 */}
          {topic.reason && <ReasonChip reason={topic.reason} />}
          <a
            href={topic.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto inline-flex items-center gap-1 text-text-faint opacity-0 group-hover:opacity-100 hover:text-accent-bright transition-all"
          >
            Open
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* 原始内容触发器：带元数据预览（字数 / 阅读时长） */}
            {hasExpandable && stats && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 h-6 px-2 -ml-2 rounded-md text-[11px] font-medium transition-colors",
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
                {!expanded && (
                  <span className="text-text-faint mono tabular-nums">
                    · {formatChars(stats.chars)} · {stats.readMin} min
                  </span>
                )}
              </button>
            )}

            <AnimatePresence initial={false}>
              {expanded && hasExpandable && topic.rawContent && stats && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  {/* 阅读容器：卡中卡 */}
                  <div className="mt-2 rounded-md bg-bg-elevated/40 ring-1 ring-border-default">
                    {/* 顶部工具栏 */}
                    <div className="flex items-center gap-2 px-3 h-8 border-b border-border-default/60">
                      <FileText className="w-3 h-3 text-text-muted shrink-0" />
                      <span className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">
                        原文
                      </span>
                      <span className="text-text-faint">·</span>
                      <span className="text-[11px] text-text-faint mono tabular-nums inline-flex items-center gap-1">
                        {formatChars(stats.chars)}
                      </span>
                      <span className="text-text-faint">·</span>
                      <span className="text-[11px] text-text-faint mono tabular-nums inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {stats.readMin} min
                      </span>

                      <div className="ml-auto flex items-center gap-0.5">
                        <ToolButton
                          onClick={handleCopy}
                          title={copied ? "已复制" : "复制全文"}
                          ariaLabel="复制全文"
                        >
                          {copied ? (
                            <Check className="w-3 h-3 text-accent-bright" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </ToolButton>
                        <a
                          href={topic.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="在原站打开"
                          aria-label="在原站打开"
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* 阅读区：受限高度 + 底部渐隐 */}
                    <div className="reading-scroll px-3 pt-2.5 text-[12.5px]">
                      <div className="markdown-body text-text-secondary">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {topic.rawContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

/** 把 hotScore (0-100) 映射到色调：左侧色条 + 右上 Flame 数字共用 */
function getHotTone(value: number): { bar: string; text: string } {
  const v = Math.max(0, Math.min(100, value));
  if (v >= 85) return { bar: "bg-danger", text: "text-danger" };
  if (v >= 70) return { bar: "bg-warning", text: "text-warning" };
  if (v >= 55) return { bar: "bg-accent", text: "text-accent-bright" };
  if (v >= 40) return { bar: "bg-text-muted/60", text: "text-text-muted" };
  return { bar: "bg-text-faint/40", text: "text-text-faint" };
}

function MetricCompact({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {icon}
      {formatCount(value)}
    </span>
  );
}

/** 紧凑版 importance：inline 彩色 dot + 文字，融入 meta 行不独立占位 */
function ImportanceInline({ value }: { value?: string }) {
  if (value !== "urgent" && value !== "high") return null;
  const tone =
    value === "urgent"
      ? { dot: "bg-danger", text: "text-danger" }
      : { dot: "bg-warning", text: "text-warning" };
  return (
    <span className={cn("inline-flex items-center gap-1 shrink-0 uppercase tracking-wider text-[10px] font-medium", tone.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} aria-hidden />
      {value}
    </span>
  );
}

/** AI reason 折叠成 chip：hover/focus 浮窗显示完整理由 */
function ReasonChip({ reason }: { reason: string }) {
  return (
    <span
      className="relative inline-flex items-center gap-1 text-accent-bright/90 cursor-help group/reason"
      tabIndex={0}
      aria-label={`AI 相关性判断：${reason}`}
    >
      <Sparkles className="w-3 h-3" />
      <span className="hidden sm:inline">why</span>
      {/* 浮窗：默认隐藏，hover/focus 显示 */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full mt-1.5 z-20 w-72 max-w-[80vw] rounded-md bg-bg-elevated ring-1 ring-border-strong px-2.5 py-2 text-[11.5px] text-text-secondary leading-relaxed opacity-0 translate-y-1 transition-all duration-150 group-hover/reason:opacity-100 group-hover/reason:translate-y-0 group-focus/reason:opacity-100 group-focus/reason:translate-y-0"
      >
        <span className="flex items-center gap-1 text-[10px] text-accent-bright uppercase tracking-wider font-medium mb-1">
          <Sparkles className="w-2.5 h-2.5" />
          AI 相关性判断
        </span>
        {reason}
      </span>
    </span>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatChars(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k 字`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k 字`;
  return `${n} 字`;
}

/**
 * 估算 rawContent 元数据：字数 + 阅读时长。
 * 中文阅读速度按 ~300 字/min，英文按 ~250 词/min；混合内容用 chars/280 兜底。
 */
function getContentStats(md: string): { chars: number; readMin: number } {
  // 去掉 markdown 语法符号，按"可见字符"计数
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // 链接
    .replace(/[#>*_`~\-]+/g, " ") // 标记符号
    .replace(/\s+/g, " ")
    .trim();
  const chars = text.length;
  const readMin = Math.max(1, Math.round(chars / 280));
  return { chars, readMin };
}

function ToolButton({
  children,
  onClick,
  title,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      title={title}
      aria-label={ariaLabel ?? title}
      className="inline-flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
    >
      {children}
    </button>
  );
}

