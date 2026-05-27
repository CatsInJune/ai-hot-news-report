"use client";

import { motion } from "framer-motion";
import { SOURCE_LABELS, type SourceType } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  active: string;
  counts: Record<string, number>;
  onChange: (source: string) => void;
}

const SOURCES: Array<SourceType | "all"> = [
  "all",
  "twitter",
  "bing",
  "google",
  "duckduckgo",
  "hackernews",
  "sogou",
  "bilibili",
  "weibo",
];

const LABEL_OVERRIDE: Record<string, string> = {
  all: "All",
  twitter: "Twitter",
  bing: "Bing",
  google: "Google",
  duckduckgo: "DuckDuckGo",
  hackernews: "HN",
  sogou: "搜狗",
  bilibili: "B站",
  weibo: "微博",
};

export default function SourceTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto text-[12.5px]">
      {SOURCES.map((src) => {
        const label = LABEL_OVERRIDE[src] ?? SOURCE_LABELS[src as SourceType];
        const count = counts[src] ?? 0;
        const isActive = active === src;

        return (
          <button
            key={src}
            onClick={() => onChange(src)}
            className={cn(
              "relative px-2.5 h-7 rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5",
              isActive
                ? "text-text-primary bg-bg-hover"
                : "text-text-muted hover:text-text-secondary hover:bg-bg-hover/40",
            )}
          >
            <span className="font-medium">{label}</span>
            <span
              className={cn(
                "text-[10.5px] mono tabular-nums",
                isActive ? "text-accent-bright" : "text-text-faint",
              )}
            >
              {count}
            </span>
            {isActive && (
              <motion.span
                layoutId="src-tab-indicator"
                className="absolute inset-x-2 -bottom-px h-0.5 bg-accent-bright rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
