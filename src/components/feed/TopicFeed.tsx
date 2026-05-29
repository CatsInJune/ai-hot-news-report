"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, RotateCcw, ChevronsDown } from "lucide-react";
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

export default function TopicFeed() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchTopics = useCallback(async () => {
    try {
      const effectiveSource = debouncedQ ? "all" : source;
      const params = new URLSearchParams({
        source: effectiveSource,
        limit: "50",
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
        setTopics(data.topics);
      }
    } finally {
      setLoading(false);
    }
  }, [source, debouncedQ, range, importance, keywordId, mentioned, relevBucket, sourceType, sort]);

  // 同步最新 fetchTopics 到 ref，供 SSE handler 调用
  useEffect(() => {
    fetchRef.current = fetchTopics;
  }, [fetchTopics]);

  useEffect(() => {
    fetchTopics();
    const onInvalidate = () => fetchTopics();
    window.addEventListener("app:data-changed", onInvalidate);
    return () => window.removeEventListener("app:data-changed", onInvalidate);
  }, [fetchTopics]);

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

      <div className="card overflow-hidden divide-y divide-border-default">
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
          <AnimatePresence mode="popLayout">
            {topics.map((t) => (
              <TopicCard key={t.id} topic={t} expandAll={expandAll} />
            ))}
          </AnimatePresence>
        )}
      </div>
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
