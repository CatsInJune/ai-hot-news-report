import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildDigestHtml } from "./mailer";
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

describe("buildDigestHtml — 官网入口", () => {
  it("默认未配置时，footer 含 vercel 主页 URL 按钮", () => {
    const html = buildDigestHtml([item]);
    expect(html).toContain("https://ai-hot-news-report.vercel.app");
    expect(html).toContain("📡 打开 AI 热点速报");
  });

  it("配了 NEXT_PUBLIC_APP_URL → 用配置的地址", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://custom.example.com/";
    const html = buildDigestHtml([item]);
    expect(html).toContain('href="https://custom.example.com"');
  });

  it("Actions 注入空串 → fallback 默认", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    const html = buildDigestHtml([item]);
    expect(html).toContain("https://ai-hot-news-report.vercel.app");
  });
});
