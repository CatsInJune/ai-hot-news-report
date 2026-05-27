"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * 极光流光文字。比原 gradient-text 更冷冽，更适合"科技数据终端"风格。
 * 用法：<AuroraText>实时热点</AuroraText>
 */
export function AuroraText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-block bg-[linear-gradient(110deg,#00f5d4,#22d3ee_30%,#a855f7_60%,#ec4899_100%)] bg-[length:200%_auto] bg-clip-text font-bold text-transparent",
        "animate-[aurora-text_8s_linear_infinite]",
        className,
      )}
    >
      {children}
    </span>
  );
}
