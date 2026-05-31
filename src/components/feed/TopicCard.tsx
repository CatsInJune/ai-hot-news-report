"use client";

import { useEffect, useRef, useState } from "react";
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
  Languages,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_LANGS,
  DEFAULT_TARGET_LANG,
  isSupportedLang,
  parseTranslations,
} from "@/lib/translator";

interface Topic {
  id: string;
  title: string;
  summary: string | null;
  rawContent?: string | null;
  translations?: string | null;
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

const LANG_PREF_KEY = "preferredTranslateLang";

function readPreferredLang(): string {
  if (typeof window === "undefined") return DEFAULT_TARGET_LANG;
  try {
    const v = window.localStorage.getItem(LANG_PREF_KEY);
    if (v && isSupportedLang(v)) return v;
  } catch {
    /* localStorage 不可用就用默认 */
  }
  return DEFAULT_TARGET_LANG;
}

export default function TopicCard({ topic, expandAll, index = 0 }: Props) {
  const sourceLabel = SOURCE_LABELS[topic.source as SourceType] ?? topic.source;
  const sourceColor = SOURCE_COLORS[topic.source as SourceType] ?? "#71717a";

  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // 翻译相关状态
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>(() =>
    parseTranslations(topic.translations),
  );
  const [currentLang, setCurrentLang] = useState<string>(DEFAULT_TARGET_LANG);
  const [viewMode, setViewMode] = useState<"original" | "translated">("original");
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  // 客户端 mount 后再读 localStorage（SSR 兼容）
  useEffect(() => {
    setCurrentLang(readPreferredLang());
  }, []);

  // topic.translations 变化（例如 fetch-raw 后）→ 同步本地 map
  useEffect(() => {
    setTranslatedMap(parseTranslations(topic.translations));
  }, [topic.translations]);

  // 全局"全部展开"切换时同步本地状态
  useEffect(() => {
    if (typeof expandAll === "boolean") setExpanded(expandAll);
  }, [expandAll]);

  // 点击外部关闭语言下拉
  useEffect(() => {
    if (!langMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!langMenuRef.current) return;
      if (!langMenuRef.current.contains(e.target as Node)) setLangMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [langMenuOpen]);

  // 只有原始内容才走折叠/展开；AI 相关性判断改为常驻展示
  const hasExpandable = !!topic.rawContent;

  // 当前展示的正文：译文优先（已切换到 translated 模式且有对应语言译文），否则原文
  const translatedText = translatedMap[currentLang] ?? null;
  const displayContent =
    viewMode === "translated" && translatedText ? translatedText : topic.rawContent ?? "";
  const showingTranslated = viewMode === "translated" && !!translatedText;
  const stats = hasExpandable ? getContentStats(displayContent) : null;

  const currentLangLabel =
    SUPPORTED_LANGS.find((l) => l.code === currentLang)?.label ?? currentLang;

  const handleCopy = async () => {
    if (!displayContent) return;
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 静默失败：clipboard 在非 https/无权限时会拒绝；用户可手动选择文本
    }
  };

  const persistLang = (code: string) => {
    try {
      window.localStorage.setItem(LANG_PREF_KEY, code);
    } catch {
      /* 无 localStorage 就算了 */
    }
  };

  const requestTranslate = async (lang: string) => {
    // 已有缓存直接切换，不发请求
    if (translatedMap[lang]) {
      setViewMode("translated");
      setTranslateError(null);
      return;
    }
    if (!topic.rawContent) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await fetch(`/api/topics/${topic.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang: lang }),
      });
      // 容错解析：dev server 重启/超时可能让 body 为空，直接 res.json() 会抛 SyntaxError
      const raw = await res.text();
      let data: { ok?: boolean; text?: string; error?: string } = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            `服务器返回非 JSON 响应（HTTP ${res.status}）：${raw.slice(0, 120)}`,
          );
        }
      } else {
        throw new Error(`服务器空响应（HTTP ${res.status}），可能 dev server 未重启或请求被中断`);
      }
      if (!res.ok || !data.ok || typeof data.text !== "string") {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setTranslatedMap((prev) => ({ ...prev, [lang]: data.text as string }));
      setViewMode("translated");
    } catch (err) {
      setTranslateError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslateClick = () => {
    if (translating) return;
    // 已经在译文模式 → 切回原文
    if (showingTranslated) {
      setViewMode("original");
      return;
    }
    // 否则翻译为当前语言（命中缓存秒切，否则发请求）
    requestTranslate(currentLang);
  };

  const handleLangSelect = (code: string) => {
    setLangMenuOpen(false);
    setCurrentLang(code);
    persistLang(code);
    // 选了新语言就主动尝试翻译（命中缓存直接切，否则发请求）
    requestTranslate(code);
  };

  const hotTone = getHotTone(topic.hotScore);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, x: "-100%" }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.09,
        ease: [0.16, 0.84, 0.24, 1],
      }}
      className="group relative"
    >
      <div
        aria-hidden
        className={cn(
          "absolute left-0 top-3 bottom-3 w-[2.5px] rounded-r-sm transition-opacity",
          hotTone.bar,
          topic.hotScore < 60 && "opacity-40",
        )}
      />

      <div className="block px-4 py-3 pl-5 transition-colors hover:bg-bg-surface/50 rounded-md">
        <div className="flex items-center gap-x-2 text-[11px] text-text-muted mb-1.5 min-w-0">
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

        {topic.summary && (
          <p className="mt-1.5 text-[13px] text-text-secondary leading-relaxed line-clamp-2">
            {topic.summary}
          </p>
        )}

        <div className="mt-2 flex items-center gap-x-3 gap-y-1 text-[11px] text-text-muted mono flex-wrap">
          {topic.likes > 0 && <MetricCompact icon={<Heart className="w-3 h-3" />} value={topic.likes} />}
          {topic.reposts > 0 && <MetricCompact icon={<Repeat2 className="w-3 h-3" />} value={topic.reposts} />}
          {topic.comments > 0 && <MetricCompact icon={<MessageCircle className="w-3 h-3" />} value={topic.comments} />}
          {topic.views > 0 && <MetricCompact icon={<Eye className="w-3 h-3" />} value={topic.views} />}
          <span className="text-text-faint mono tabular-nums">
            rel <span className="text-text-secondary">{topic.relevScore}</span>
          </span>
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
              <div className="mt-2 rounded-md bg-bg-elevated/40 ring-1 ring-border-default">
                {/* 顶部工具栏 */}
                <div className="flex items-center gap-2 px-3 h-8 border-b border-border-default/60">
                  <FileText className="w-3 h-3 text-text-muted shrink-0" />
                  <span className="text-[10.5px] text-text-muted uppercase tracking-wider font-medium">
                    {showingTranslated ? "译文" : "原文"}
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
                    {/* 翻译控件：图标按钮 + 语言下拉 */}
                    <div ref={langMenuRef} className="relative inline-flex items-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTranslateClick();
                        }}
                        disabled={translating}
                        title={
                          translating
                            ? "翻译中…"
                            : showingTranslated
                              ? "切回原文"
                              : `翻译为${currentLangLabel}`
                        }
                        aria-label={
                          showingTranslated ? "切回原文" : `翻译为${currentLangLabel}`
                        }
                        className={cn(
                          "inline-flex items-center justify-center w-6 h-6 rounded transition-colors disabled:cursor-not-allowed",
                          showingTranslated
                            ? "text-accent-bright bg-accent-soft hover:bg-accent-soft"
                            : "text-text-muted hover:text-text-primary hover:bg-bg-hover",
                        )}
                      >
                        {translating ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : translateError ? (
                          <AlertCircle className="w-3 h-3 text-danger" />
                        ) : (
                          <Languages className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLangMenuOpen((v) => !v);
                        }}
                        title="选择目标语言"
                        aria-label="选择目标语言"
                        className="inline-flex items-center gap-0.5 h-6 px-1 rounded text-[10.5px] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        {currentLangLabel}
                        <ChevronDown
                          className={cn(
                            "w-2.5 h-2.5 transition-transform",
                            langMenuOpen && "rotate-180",
                          )}
                        />
                      </button>
                      {langMenuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 z-30 w-max whitespace-nowrap rounded-md bg-bg-elevated ring-1 ring-border-strong shadow-lg py-1"
                        >
                          {SUPPORTED_LANGS.map((lang) => {
                            const cached = !!translatedMap[lang.code];
                            const active = lang.code === currentLang;
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                role="menuitem"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLangSelect(lang.code);
                                }}
                                className={cn(
                                  "flex items-center justify-between w-full px-4 py-1.5 text-[11.5px] gap-4 whitespace-nowrap transition-colors",
                                  active
                                    ? "text-accent-bright bg-accent-soft"
                                    : "text-text-secondary hover:bg-bg-hover",
                                )}
                              >
                                <span className="inline-flex items-center gap-1.5 shrink-0">
                                  {active ? (
                                    <Check className="w-2.5 h-2.5 shrink-0" />
                                  ) : (
                                    <span className="w-2.5 shrink-0" aria-hidden />
                                  )}
                                  <span>{lang.label}</span>
                                </span>
                                {cached && (
                                  <span
                                    className="text-[9px] uppercase tracking-wider text-text-faint shrink-0"
                                    title="已缓存"
                                  >
                                    cached
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <ToolButton
                      onClick={handleCopy}
                      title={copied ? "已复制" : showingTranslated ? "复制译文" : "复制全文"}
                      ariaLabel={showingTranslated ? "复制译文" : "复制全文"}
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

                {/* 翻译状态条：译文模式 / 错误 / 已有同语言缓存可一键查看 */}
                {(showingTranslated || translateError) && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 text-[11px] border-b border-border-default/60",
                      translateError
                        ? "bg-danger/5 text-danger"
                        : "bg-accent-soft/40 text-accent-bright",
                    )}
                  >
                    {translateError ? (
                      <>
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">翻译失败：{translateError}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTranslateError(null);
                          }}
                          className="ml-auto text-text-muted hover:text-text-primary"
                        >
                          关闭
                        </button>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 shrink-0" />
                        <span>已翻译为 {currentLangLabel}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewMode("original");
                          }}
                          className="ml-auto text-text-muted hover:text-text-primary underline-offset-2 hover:underline"
                        >
                          显示原文
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* 阅读区 */}
                <div className="reading-scroll px-3 pt-2.5 text-[12.5px]">
                  <div className="markdown-body text-text-secondary">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {displayContent}
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

function ReasonChip({ reason }: { reason: string }) {
  return (
    <span
      className="relative inline-flex items-center gap-1 text-accent-bright/90 cursor-help group/reason"
      tabIndex={0}
      aria-label={`AI 相关性判断：${reason}`}
    >
      <Sparkles className="w-3 h-3" />
      <span className="hidden sm:inline">why</span>
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

function getContentStats(md: string): { chars: number; readMin: number } {
  const text = md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~\-]+/g, " ")
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
