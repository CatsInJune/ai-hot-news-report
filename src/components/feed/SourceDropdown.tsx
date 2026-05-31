"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { SOURCE_LABELS, type SourceType } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  active: string;
  counts: Record<string, number>;
  onChange: (source: string) => void;
}

// 顺序按类别分组：海外社交 → 搜索 → 国内社交 → AI 专栏
const SOURCES: Array<SourceType | "all"> = [
  "all",
  "twitter",
  "hackernews",
  "reddit",
  "arxiv",
  "bing",
  "google",
  "baidu",
  "sogou",
  "weibo",
  "bilibili",
  "ai_blog",
  "ai_news_zh",
];

// 只覆盖需要简写的（HN）；其它直接走 SOURCE_LABELS
const LABEL_OVERRIDE: Record<string, string> = {
  all: "All",
  hackernews: "HN",
};

function labelOf(src: string) {
  return LABEL_OVERRIDE[src] ?? SOURCE_LABELS[src as SourceType] ?? src;
}

export default function SourceDropdown({ active, counts, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount = counts[active] ?? 0;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-8 pl-3 pr-2 rounded-md border text-[12.5px] transition-colors",
          open
            ? "border-accent/40 bg-bg-hover text-text-primary"
            : "border-border-default bg-bg-surface/50 hover:bg-bg-hover hover:border-border-strong text-text-secondary",
        )}
      >
        <span className="text-text-muted text-[11.5px]">Source</span>
        <span className="font-medium text-text-primary">{labelOf(active)}</span>
        <span className="text-[10.5px] mono text-accent-bright tabular-nums">
          {activeCount}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-56 rounded-lg border border-border-strong bg-bg-elevated shadow-lg overflow-hidden z-30"
          >
            <ul className="py-1 max-h-[60vh] overflow-y-auto">
              {SOURCES.map((src) => {
                const isActive = active === src;
                const count = counts[src] ?? 0;
                return (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(src);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 h-8 text-[12.5px] transition-colors",
                        isActive
                          ? "text-text-primary bg-bg-hover"
                          : "text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "w-3.5 h-3.5 shrink-0 flex items-center justify-center",
                          isActive ? "text-accent-bright" : "opacity-0",
                        )}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                      <span className="flex-1 text-left font-medium">
                        {labelOf(src)}
                      </span>
                      <span
                        className={cn(
                          "text-[10.5px] mono tabular-nums",
                          isActive ? "text-accent-bright" : "text-text-faint",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
