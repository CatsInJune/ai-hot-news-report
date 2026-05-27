"use client";

import { motion } from "framer-motion";
import { SOURCE_LABELS, SOURCE_COLORS, type SourceType } from "@/types";

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

export default function SourceTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 -mb-2">
      {SOURCES.map((src) => {
        const label = src === "all" ? "全部" : SOURCE_LABELS[src];
        const color = src === "all" ? "#00f5d4" : SOURCE_COLORS[src as SourceType];
        const count = counts[src] ?? 0;
        const isActive = active === src;

        return (
          <button
            key={src}
            onClick={() => onChange(src)}
            className="relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap"
            style={{
              color: isActive ? color : "var(--text-secondary)",
              backgroundColor: isActive
                ? `color-mix(in srgb, ${color} 12%, transparent)`
                : "transparent",
            }}
          >
            {isActive && (
              <motion.div
                layoutId="source-tab-bg"
                className="absolute inset-0 rounded-lg border"
                style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {label}
              {count > 0 && (
                <span
                  className="text-[10px] font-mono px-1 rounded"
                  style={{
                    color: isActive ? color : "var(--text-muted)",
                    backgroundColor: isActive
                      ? `color-mix(in srgb, ${color} 20%, transparent)`
                      : "var(--bg-hover)",
                  }}
                >
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
