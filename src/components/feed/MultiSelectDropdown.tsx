"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterOption } from "./FilterDropdown";

interface Props {
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  // 当未选任何项（即"全部"）时显示的标签
  allLabel?: string;
  className?: string;
}

/**
 * 多选筛选下拉。空选择 = 全部。
 * 选中状态用 ✓ 表示，按钮上显示选中数量或简短摘要。
 */
export default function MultiSelectDropdown({
  label,
  values,
  options,
  onChange,
  allLabel = "全部",
  className,
}: Props) {
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

  const isCustom = values.length > 0;
  const display = !isCustom
    ? allLabel
    : values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? values[0]
      : `${values.length} 项`;

  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  };

  return (
    <div ref={ref} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 h-8 pl-3 pr-2 rounded-md border text-[12.5px] transition-colors",
          open || isCustom
            ? "border-accent/40 bg-bg-hover text-text-primary"
            : "border-border-default bg-bg-surface/50 hover:bg-bg-hover hover:border-border-strong text-text-secondary",
        )}
      >
        <span className="text-text-muted text-[11.5px]">{label}</span>
        <span className="font-medium text-text-primary">{display}</span>
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
            className="absolute left-0 mt-2 min-w-[10rem] rounded-lg border border-border-strong bg-bg-elevated shadow-lg overflow-hidden z-30"
          >
            <ul className="py-1 max-h-[60vh] overflow-y-auto">
              {isCustom && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([]);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 h-8 text-[12.5px] text-text-muted hover:bg-bg-hover/60 hover:text-text-primary transition-colors whitespace-nowrap border-b border-border-default/50"
                  >
                    <span className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 text-left">清空（= {allLabel}）</span>
                  </button>
                </li>
              )}
              {options.map((opt) => {
                const isActive = values.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 h-8 text-[12.5px] transition-colors whitespace-nowrap",
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
                      <span className="flex-1 text-left font-medium">{opt.label}</span>
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
