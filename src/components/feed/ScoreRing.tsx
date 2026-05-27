"use client";

interface Props {
  value: number; // 0-100
  label?: string;
  size?: number;
  color?: string;
}

export default function ScoreRing({ value, label, size = 56, color }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  // 根据分数动态选色
  const ringColor =
    color ??
    (clamped >= 80
      ? "var(--neon-cyan)"
      : clamped >= 60
        ? "var(--neon-amber)"
        : clamped >= 40
          ? "var(--neon-purple)"
          : "var(--neon-red)");

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-default)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.6s ease-out",
            filter: `drop-shadow(0 0 4px ${ringColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-sm font-bold font-mono leading-none"
          style={{ color: ringColor }}
        >
          {clamped}
        </span>
        {label && (
          <span className="text-[8px] text-text-muted font-mono mt-0.5 uppercase">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
