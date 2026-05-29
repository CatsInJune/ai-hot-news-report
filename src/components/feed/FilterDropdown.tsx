"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  // 用于在按钮上显示当前值简短标签（当不想直接展示完整 label 时）
  shortLabel?: (value: string) => string;
  // 当 value 不是默认值时高亮按钮
  defaultValue?: string;
  className?: string;
}

/**
 * 通用单选筛选下拉。
 * 风格对齐 SourceDropdown：紧凑、键盘可关闭、点击外部关闭。
 */
export default function FilterDropdown({
  label,
  value,
  options,
  onChange,
  shortLabel,
  defaultValue = "all",
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

  const current = options.find((o) => o.value === value);
  const display = shortLabel ? shortLabel(value) : current?.label ?? value;
  const isCustom = value !== defaultValue;

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
              {options.map((opt) => {
                const isActive = value === opt.value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
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
                      {typeof opt.count === "number" && (
                        <span
                          className={cn(
                            "text-[10.5px] mono tabular-nums",
                            isActive ? "text-accent-bright" : "text-text-faint",
                          )}
                        >
                          {opt.count}
                        </span>
                      )}
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
