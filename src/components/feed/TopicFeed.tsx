"use client";

import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, RotateCcw, ChevronsDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import TopicCard from "./TopicCard";
import SourceDropdown from "./SourceDropdown";
import FilterDropdown from "./FilterDropdown";
import MultiSelectDropdown from "./MultiSelectDropdown";
import SearchBox from "@/components/layout/SearchBox";
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
  realScore: number;
  hotScore: number;
  relevScore: number;
  importance?: string;
  reason?: string | null;
  likes: number;
  reposts: number;
  comments: number;
  views: number;
  createdAt: string;
}

interface KeywordRow {
  id: string;
  name: string;
}

// === 选项常量 ===
const RANGE_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "today", label: "今天" },
  { value: "3d", label: "近 3 天" },
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
];

const IMPORTANCE_OPTIONS = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const MENTION_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "yes", label: "字面命中" },
  { value: "no", label: "AI 推断" },
];

const RELEV_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "high", label: "高 (≥80)" },
  { value: "mid", label: "中 (60-79)" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "search", label: "关键词搜索" },
  { value: "subscribed", label: "账号订阅" },
];

const SORT_OPTIONS = [
  { value: "composite", label: "综合分" },
  { value: "latest", label: "最新发布" },
  { value: "importance", label: "最高重要性" },
  { value: "relevance", label: "最相关" },
  { value: "hot", label: "最热" },
];

const SORT_HINT_BY_KEY: Record<string, string> = {
  composite: "hot × 时间衰减 + importance",
  latest: "publishedAt desc",
  importance: "urgent > high > medium > low",
  relevance: "relevScore desc",
  hot: "hotScore desc",
};

const PAGE_SIZE = 10;

export default function TopicFeed() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});

  // 新增的筛选状态
  const [range, setRange] = useState("all");
  const [importance, setImportance] = useState<string[]>([]);
  const [keywordId, setKeywordId] = useState("all");
  const [mentioned, setMentioned] = useState("all");
  const [relevBucket, setRelevBucket] = useState("all");
  const [sourceType, setSourceType] = useState("all");
  const [sort, setSort] = useState("composite");
  // 全局展开/收起所有卡片的 reason+rawContent
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);

  const [keywords, setKeywords] = useState<KeywordRow[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  // 用于 SSE 突发事件去抖：burst 期间累积事件只触发一次刷新
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 给 SSE handler 拿到最新版 fetchTopics（避免 effect 每次都重连 SSE）
  const fetchRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(() => setDebouncedQ(term), term ? 220 : 0);
    return () => clearTimeout(id);
  }, [q]);

  // 拉关键词列表（多关键词时给筛选器用）
  useEffect(() => {
    let cancelled = false;
    fetch("/api/keywords")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.keywords) return;
        setKeywords(
          (d.keywords as Array<{ id: string; name: string }>).map((k) => ({ id: k.id, name: k.name }))
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // page 通过 ref 让 fetchTopics 不依赖它，避免 setPage → fetchTopics 重建 → useEffect 重新触发的循环
  const pageRef = useRef(1);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // 分页器是 fixed 定位，永远悬浮视窗底部。navRef 仍保留供后续可能的扩展用
  const navRef = useRef<HTMLElement | null>(null);
  // 翻页时滚到 cards 容器顶部（feed 列表起点），让用户从头看新内容
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToTopRef = useRef(false);

  /** 拉取当前页（page state 通过 ref 读，不进依赖）。SSE 刷新和筛选变更都走这一条路径 */
  const fetchTopics = useCallback(async () => {
    try {
      const effectiveSource = debouncedQ ? "all" : source;
      const offset = (pageRef.current - 1) * PAGE_SIZE;
      const params = new URLSearchParams({
        source: effectiveSource,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
      });
      if (debouncedQ) params.set("q", debouncedQ);
      if (range !== "all") params.set("range", range);
      if (importance.length > 0) params.set("importance", importance.join(","));
      if (keywordId !== "all") params.set("keywordId", keywordId);
      if (mentioned !== "all") params.set("mentioned", mentioned);
      if (relevBucket !== "all") params.set("relevBucket", relevBucket);
      if (sourceType !== "all") params.set("sourceType", sourceType);

      const res = await fetch(`/api/topics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [source, debouncedQ, range, importance, keywordId, mentioned, relevBucket, sourceType, sort]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /**
   * 切页：标记"需要滚到 cards 顶部"，setPage 触发拉新数据；
   * topics 渲染完成后 useLayoutEffect 把 cards 顶部对齐到视窗（带平滑滚动）。
   * 配合 fixed 分页器：用户切完页直接看到新一页第一条，分页器始终在视窗底部触手可及。
   */
  const goToPage = useCallback((next: number) => {
    const clamped = Math.max(1, Math.min(pageCount, next));
    if (clamped === pageRef.current) return;
    shouldScrollToTopRef.current = true;
    setPage(clamped);
  }, [pageCount]);

  // topics 变化后把 cards 容器顶部对齐到视窗——用 instant scroll（不 smooth），
  // 把视觉舞台让给 cards 的错峰滑入动画。两个动画叠在一起会模糊感知。
  useLayoutEffect(() => {
    if (!shouldScrollToTopRef.current || !cardsContainerRef.current) return;
    shouldScrollToTopRef.current = false;
    const cardTop = cardsContainerRef.current.getBoundingClientRect().top;
    const targetOffset = 80;
    const delta = cardTop - targetOffset;
    if (Math.abs(delta) > 1) {
      window.scrollBy({ top: delta, behavior: "instant" as ScrollBehavior });
    }
  }, [topics]);

  // 同步最新 fetchTopics 到 ref，供 SSE handler 调用
  useEffect(() => {
    fetchRef.current = fetchTopics;
  }, [fetchTopics]);

  // 筛选/排序变更：重置到第 1 页（page N 在新筛选下可能不存在）
  const filterFingerprint = `${source}|${debouncedQ}|${range}|${importance.join(",")}|${keywordId}|${mentioned}|${relevBucket}|${sourceType}|${sort}`;
  useEffect(() => {
    setPage(1);
    pageRef.current = 1;
  }, [filterFingerprint]);

  // page / filter 变更 → 拉数据
  useEffect(() => {
    fetchTopics();
    const onInvalidate = () => fetchTopics();
    window.addEventListener("app:data-changed", onInvalidate);
    return () => window.removeEventListener("app:data-changed", onInvalidate);
  }, [fetchTopics, page]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/topics?stats=sources`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) setSourceCounts(data.counts ?? {});
      } catch {
        /* silent */
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    const onInvalidate = () => tick();
    window.addEventListener("app:data-changed", onInvalidate);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("app:data-changed", onInvalidate);
    };
  }, []);

  useEffect(() => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource("/api/sse");
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "new-topic" || event.type === "alert") {
          // burst 期间累积，800ms 静默后才刷新——避免一次 fetch 触发 N 个事件就 N 次重拉
          if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = setTimeout(() => {
            fetchRef.current();
          }, 800);
        }
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  const keywordOptions = useMemo(() => {
    return [
      { value: "all", label: "全部关键词" },
      ...keywords.map((k) => ({ value: k.id, label: k.name })),
    ];
  }, [keywords]);

  const hasActiveFilter =
    range !== "all" ||
    importance.length > 0 ||
    keywordId !== "all" ||
    mentioned !== "all" ||
    relevBucket !== "all" ||
    sourceType !== "all" ||
    source !== "all" ||
    sort !== "composite";

  const resetFilters = () => {
    setRange("all");
    setImportance([]);
    setKeywordId("all");
    setMentioned("all");
    setRelevBucket("all");
    setSourceType("all");
    setSource("all");
    setSort("composite");
  };

  const showKeywordFilter = keywords.length > 1;

  return (
    <div>
      {/* 顶部第一行：搜索 + Source */}
      <div className="flex items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} className="flex-1 min-w-0 max-w-md" />
        <SourceDropdown active={source} counts={sourceCounts} onChange={setSource} />
      </div>

      {/* 顶部第二行：筛选 + 排序 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <FilterDropdown label="时间" value={range} options={RANGE_OPTIONS} onChange={setRange} />
        <MultiSelectDropdown
          label="重要性"
          values={importance}
          options={IMPORTANCE_OPTIONS}
          onChange={setImportance}
        />
        {showKeywordFilter && (
          <FilterDropdown
            label="关键词"
            value={keywordId}
            options={keywordOptions}
            onChange={setKeywordId}
          />
        )}
        <FilterDropdown
          label="命中"
          value={mentioned}
          options={MENTION_OPTIONS}
          onChange={setMentioned}
        />
        <FilterDropdown
          label="相关性"
          value={relevBucket}
          options={RELEV_OPTIONS}
          onChange={setRelevBucket}
        />
        <FilterDropdown
          label="来源类型"
          value={sourceType}
          options={SOURCE_TYPE_OPTIONS}
          onChange={setSourceType}
        />

        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[11.5px] text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
              title="重置全部筛选"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          )}
          <FilterDropdown
            label="排序"
            value={sort}
            options={SORT_OPTIONS}
            onChange={setSort}
            defaultValue="composite"
            shortLabel={(v) => SORT_OPTIONS.find((o) => o.value === v)?.label ?? v}
          />
        </div>
      </div>

      {/* 排序提示行 + 全部展开 */}
      <div className="mb-3 flex items-center justify-between gap-3 text-[11.5px] text-text-muted">
        <div>
          {topics.length > 0 && (
            <>
              <span className="mono tabular-nums text-text-secondary">{topics.length}</span> topics ·
              sorted by{" "}
              <span className="text-text-secondary">
                {SORT_OPTIONS.find((o) => o.value === sort)?.label}
              </span>{" "}
              <span className="text-text-faint">({SORT_HINT_BY_KEY[sort]})</span>
            </>
          )}
        </div>
        {topics.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            className="flex items-center gap-1 h-7 px-2 rounded-md hover:bg-bg-hover hover:text-text-primary transition-colors text-text-muted"
          >
            <ChevronsDown
              className={cn("w-3.5 h-3.5 transition-transform", expandAll && "rotate-180")}
            />
            {expandAll ? "收起全部原文" : "展开全部原文"}
          </button>
        )}
      </div>

      <div ref={cardsContainerRef} className="card divide-y divide-border-default overflow-hidden">
        {loading ? (
          <div className="py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="py-20 text-center">
            <Inbox className="w-9 h-9 text-text-faint mx-auto mb-3 opacity-50" />
            {debouncedQ ? (
              <>
                <p className="text-text-secondary text-[13.5px] mb-1">
                  没有匹配「{debouncedQ}」的话题
                </p>
                <p className="text-[11.5px] text-text-muted">换个关键词或清空搜索</p>
              </>
            ) : hasActiveFilter ? (
              <>
                <p className="text-text-secondary text-[13.5px] mb-1">当前筛选条件下没有结果</p>
                <p className="text-[11.5px] text-text-muted">
                  试试{" "}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-accent-bright hover:underline"
                  >
                    重置筛选
                  </button>
                </p>
              </>
            ) : (
              <>
                <p className="text-text-secondary text-[13.5px] mb-1">No topics yet</p>
                <p className="text-[11.5px] text-text-muted">
                  Add a keyword and trigger <kbd>Fetch</kbd> to start.
                </p>
              </>
            )}
          </div>
        ) : (
          // key={page} 让整个列表在翻页时强制 remount——所有 TopicCard 重新走 initial→animate，
          // 触发完整的错峰瀑布滑入。SSE 更新 page 不变，已渲染卡保持，新增卡仍可独立动画
          <div key={`p-${page}`} className="contents">
            {topics.map((t, i) => (
              <TopicCard key={t.id} topic={t} expandAll={expandAll} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* 分页器：fixed 定位悬浮在视窗底部，完全脱离文档流。
          docHeight/scrollY 怎么变都不会影响其视觉位置。 */}
      {pageCount > 1 && !loading && topics.length > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          pageSize={PAGE_SIZE}
          onChange={goToPage}
          navRef={navRef}
        />
      )}

      {/* 底部留白：让 cards 能滚动到 fixed nav 之上，不被 nav 遮挡 */}
      {pageCount > 1 && <div aria-hidden className="h-20" />}
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

/**
 * 生成带省略号的页码序列。如 page=7 pageCount=20 → [1, '…', 5, 6, 7, 8, 9, '…', 20]
 * 永远显示首页 + 末页 + 当前页两侧 2 页。
 */
function buildPageItems(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items: (number | "…")[] = [1];
  const left = Math.max(2, page - 2);
  const right = Math.min(pageCount - 1, page + 2);
  if (left > 2) items.push("…");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < pageCount - 1) items.push("…");
  items.push(pageCount);
  return items;
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
  navRef,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (next: number) => void;
  navRef?: React.MutableRefObject<HTMLElement | null>;
}) {
  const items = buildPageItems(page, pageCount);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  // fixed 定位：让分页器完全脱离文档流，永远悬浮在视窗底部。
  // 这样 docHeight / scrollY 怎么变都不会影响 nav 视觉位置。
  // 外层 fixed 横跨视窗，内层 max-w-6xl + mx-auto 与 feed 列宽对齐。
  return (
    <div className="fixed inset-x-0 bottom-3 z-30 px-6 pointer-events-none">
      <div className="max-w-6xl mx-auto">
        <nav
          ref={navRef}
          aria-label="分页"
          className="pointer-events-auto flex flex-wrap items-center justify-between gap-4 px-3 py-2 rounded-lg bg-bg-surface/95 backdrop-blur-md ring-1 ring-border-default shadow-lg shadow-black/30 supports-backdrop-filter:bg-bg-surface/80"
        >
      {/* 左：范围文字 */}
      <div className="flex items-baseline gap-1.5 text-[11.5px] text-text-muted">
        <span className="mono tabular-nums text-text-secondary">{start}–{end}</span>
        <span className="text-text-faint">of</span>
        <span className="mono tabular-nums text-text-secondary">{total}</span>
      </div>

      {/* 右：页码控件 */}
      <div className="inline-flex items-center gap-0.5">
        <PageNavBtn
          disabled={page <= 1}
          onClick={() => onChange(1)}
          ariaLabel="第一页"
        >
          <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2} />
        </PageNavBtn>
        <PageNavBtn
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          ariaLabel="上一页"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
        </PageNavBtn>

        <div className="mx-1 flex items-center gap-0.5">
          {items.map((it, i) =>
            it === "…" ? (
              <span
                key={`e${i}`}
                className="inline-flex items-center justify-center w-7 h-7 text-text-faint text-[11px] select-none"
                aria-hidden
              >
                …
              </span>
            ) : (
              <PageBtn
                key={it}
                active={it === page}
                onClick={() => onChange(it)}
                ariaLabel={`第 ${it} 页`}
              >
                {it}
              </PageBtn>
            ),
          )}
        </div>

        <PageNavBtn
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          ariaLabel="下一页"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PageNavBtn>
        <PageNavBtn
          disabled={page >= pageCount}
          onClick={() => onChange(pageCount)}
          ariaLabel="最后一页"
        >
          <ChevronsRight className="w-3.5 h-3.5" strokeWidth={2} />
        </PageNavBtn>
      </div>
    </nav>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md text-[12px] mono tabular-nums transition-colors",
        active
          ? "bg-accent text-bg-primary font-semibold shadow-sm"
          : "text-text-secondary font-medium hover:bg-bg-hover hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

function PageNavBtn({
  children,
  disabled,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors",
        disabled
          ? "text-text-faint/40 cursor-not-allowed"
          : "text-text-muted hover:bg-bg-hover hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
