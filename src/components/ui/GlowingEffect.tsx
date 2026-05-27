"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "cyan";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}

/**
 * Aceternity GlowingEffect — 鼠标接近时卡片边缘亮起一道科技感光弧。
 * 纯 CSS + framer-motion animate，无额外依赖。
 * 包裹一个 relative 卡片，作为绝对定位子层即可。
 */
export const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.6,
    proximity = 64,
    spread = 30,
    variant = "default",
    glow = false,
    className,
    movementDuration = 1.5,
    borderWidth = 1,
    disabled = false,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;
          if (e) lastPosition.current = { x: mouseX, y: mouseY };

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(
            mouseX - center[0],
            mouseY - center[1],
          );
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "1" : "0");
          if (!isActive) return;

          const currentAngle =
            parseFloat(element.style.getPropertyValue("--start")) || 0;
          const targetAngle =
            (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) /
              Math.PI +
            90;
          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => {
              element.style.setProperty("--start", String(value));
            },
          });
        });
      },
      [inactiveZone, proximity, movementDuration],
    );

    useEffect(() => {
      if (disabled) return;
      const handleScroll = () => handleMove();
      const handlePointerMove = (e: PointerEvent) => handleMove(e);
      window.addEventListener("scroll", handleScroll, { passive: true });
      document.body.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", handleScroll);
        document.body.removeEventListener("pointermove", handlePointerMove);
      };
    }, [handleMove, disabled]);

    const gradient =
      variant === "cyan"
        ? `radial-gradient(circle, #00f5d4 10%, #00f5d400 20%),
           radial-gradient(circle at 40% 40%, #18CCFC 5%, #18CCFC00 15%),
           radial-gradient(circle at 60% 60%, #a855f7 10%, #a855f700 20%),
           repeating-conic-gradient(from 236.84deg at 50% 50%, #00f5d4 0%, #18CCFC 12.5%, #a855f7 25%, #00f5d4 50%)`
        : `radial-gradient(circle, #00f5d4 10%, #00f5d400 20%),
           radial-gradient(circle at 40% 40%, #22d3ee 5%, #22d3ee00 15%),
           radial-gradient(circle at 60% 60%, #a855f7 10%, #a855f700 20%),
           radial-gradient(circle at 40% 60%, #ec4899 10%, #ec489900 20%),
           repeating-conic-gradient(from 236.84deg at 50% 50%, #00f5d4 0%, #22d3ee 12.5%, #a855f7 25%, #ec4899 37.5%, #00f5d4 50%)`;

    return (
      <>
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": glow ? "1" : "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--gradient": gradient,
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            blur > 0 && "blur-[var(--blur)]",
            className,
            disabled && "!hidden",
          )}
        >
          <div
            className={cn(
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
            )}
          />
        </div>
      </>
    );
  },
);

GlowingEffect.displayName = "GlowingEffect";
