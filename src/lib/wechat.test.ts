import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildDigestMarkdown } from "./wechat";
import type { AlertItem } from "./mailer";

const item: AlertItem = {
  keyword: "Claude",
  title: "Claude Fable 5 发布",
  summary: "新模型上线",
  url: "https://news/x",
  source: "hackernews",
  hotScore: 90,
  importance: "high",
};

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("buildDigestMarkdown — 官网入口", () => {
  it("默认未配置时，footer 含 vercel 主页 URL", () => {
    const md = buildDigestMarkdown([item]);
    expect(md).toContain("https://ai-hot-news-report.vercel.app");
    expect(md).toContain("📡 打开 AI 热点速报");
  });

  it("配了 NEXT_PUBLIC_APP_URL → 用配置的地址", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com/";
    const md = buildDigestMarkdown([item]);
    // 尾斜杠应被裁掉
    expect(md).toContain("(https://custom.example.com)");
  });

  it("NEXT_PUBLIC_APP_URL='' (Actions 注入空串) → fallback 默认", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    const md = buildDigestMarkdown([item]);
    expect(md).toContain("https://ai-hot-news-report.vercel.app");
  });

  it("非法值（不是 http/https 开头）→ fallback 默认", () => {
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url";
    const md = buildDigestMarkdown([item]);
    expect(md).toContain("https://ai-hot-news-report.vercel.app");
  });
});
