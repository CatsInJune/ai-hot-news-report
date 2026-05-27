import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cn, formatRelativeTime, truncate, sleep } from "./utils";

describe("cn() — Tailwind class merger", () => {
  it("合并多个 class 并去重 tailwind 冲突", () => {
    expect(cn("p-2", "p-4")).toBe("p-4"); // tailwind-merge 后效
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("支持条件 class", () => {
    expect(cn("base", false && "hidden", true && "block")).toBe("base block");
  });

  it("接受 null / undefined / 数组", () => {
    expect(cn("a", null, undefined, ["b", "c"])).toContain("a");
    expect(cn("a", null, undefined, ["b", "c"])).toContain("b");
    expect(cn("a", null, undefined, ["b", "c"])).toContain("c");
  });
});

describe("formatRelativeTime()", () => {
  // 固定 Date.now 让测试确定
  const NOW = new Date("2026-05-28T12:00:00Z").getTime();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("30 秒内 → 刚刚", () => {
    const d = new Date(NOW - 10_000);
    expect(formatRelativeTime(d)).toBe("刚刚");
  });

  it("59 秒 → 刚刚（边界）", () => {
    const d = new Date(NOW - 59_000);
    expect(formatRelativeTime(d)).toBe("刚刚");
  });

  it("分钟级", () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000))).toBe("5分钟前");
    expect(formatRelativeTime(new Date(NOW - 59 * 60_000))).toBe("59分钟前");
  });

  it("小时级", () => {
    expect(formatRelativeTime(new Date(NOW - 2 * 3600_000))).toBe("2小时前");
    expect(formatRelativeTime(new Date(NOW - 23 * 3600_000))).toBe("23小时前");
  });

  it("天级（<7 天）", () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 86400_000))).toBe("3天前");
    expect(formatRelativeTime(new Date(NOW - 6 * 86400_000))).toBe("6天前");
  });

  it("超过 7 天 → 本地日期串", () => {
    const old = new Date(NOW - 30 * 86400_000);
    const out = formatRelativeTime(old);
    // 不强校验具体格式（不同时区可能不同），只断言不是相对短语
    expect(out).not.toMatch(/前$|刚刚/);
    expect(out.length).toBeGreaterThan(0);
  });

  it("接受 ISO 字符串", () => {
    expect(formatRelativeTime(new Date(NOW - 60_000).toISOString())).toBe(
      "1分钟前",
    );
  });
});

describe("truncate()", () => {
  it("短文本不变", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello", 5)).toBe("hello"); // 等长不截
  });
  it("超长文本加 ...", () => {
    expect(truncate("hello world", 5)).toBe("hello...");
  });
  it("处理空串", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("sleep()", () => {
  it("resolve 一个 Promise", async () => {
    vi.useFakeTimers();
    const p = sleep(100);
    vi.advanceTimersByTime(100);
    await expect(p).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
