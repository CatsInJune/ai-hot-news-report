"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Aceternity BackgroundBeams — 移植自 ui.aceternity.com。
 * 已替换渐变色为本项目的 cyan/emerald/violet 配色。
 * pointer-events 关闭。建议只在 Hero 区域局部使用以保证性能。
 */
export const BackgroundBeams = React.memo(
  ({ className }: { className?: string }) => {
    const paths = [
      "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
      "M-340 -200C-340 -200 -270 205 190 330C650 455 720 860 720 860",
      "M-300 -212C-300 -212 -228 195 228 318C684 441 756 845 756 845",
      "M-260 -224C-260 -224 -186 185 266 305C718 425 792 830 792 830",
      "M-220 -236C-220 -236 -144 175 304 293C752 411 828 815 828 815",
      "M-180 -248C-180 -248 -102 165 342 281C786 397 864 800 864 800",
      "M-140 -260C-140 -260 -60 155 380 269C820 383 900 785 900 785",
      "M-100 -272C-100 -272 -18 145 418 257C854 369 936 770 936 770",
      "M-60 -284C-60 -284 24 135 456 245C888 355 972 755 972 755",
      "M-20 -296C-20 -296 66 125 494 233C922 341 1008 740 1008 740",
      "M20 -308C20 -308 108 115 532 221C956 327 1044 725 1044 725",
      "M60 -320C60 -320 150 105 570 209C990 313 1080 710 1080 710",
    ];

    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center",
          className,
        )}
      >
        <svg
          className="pointer-events-none absolute z-0 h-full w-full"
          viewBox="0 0 696 316"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          {paths.map((path, index) => (
            <motion.path
              key={`beam-path-${index}`}
              d={path}
              stroke={`url(#beamGradient-${index})`}
              strokeOpacity="0.5"
              strokeWidth="0.6"
            />
          ))}
          <defs>
            {paths.map((path, index) => (
              <motion.linearGradient
                id={`beamGradient-${index}`}
                key={`beam-grad-${index}`}
                initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
                animate={{
                  x1: ["0%", "100%"],
                  x2: ["0%", "95%"],
                  y1: ["0%", "100%"],
                  y2: ["0%", `${93 + Math.random() * 8}%`],
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: Math.random() * 10,
                }}
              >
                <stop stopColor="#00f5d4" stopOpacity="0" />
                <stop stopColor="#00f5d4" />
                <stop offset="32.5%" stopColor="#18CCFC" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </motion.linearGradient>
            ))}
          </defs>
        </svg>
      </div>
    );
  },
);

BackgroundBeams.displayName = "BackgroundBeams";
