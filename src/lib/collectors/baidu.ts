import axios from "axios";
import * as cheerio from "cheerio";
import type { RawTopic } from "@/types";
import { fetchSerpViaFirecrawl } from "./serp-firecrawl-fallback";

// 百度新闻聚合（tn=news + rtt=4 按时间倒序）。
// 百度新闻没有公开 API。采用分层抓取：
//   1) 直连 axios + cheerio（0 成本，<1s，正常情况都走这条）
//   2) 触发安全验证时退到 Firecrawl HTML 模式（带反爬 + JS 渲染，~$0.002/次）
// 选 HTML 而非 markdown：SERP 卡片 markdown 化会丢卡边界，HTML 仍可用同一套 cheerio 选择器。
const BAIDU_HOST = "https://www.baidu.com";

const UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function ua(): string {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function isAntiSpider(html: string): boolean {
  return (
    html.includes("百度安全验证") ||
    html.includes("wappass") ||
    html.includes("aladdin verify")
  );
}

// "13小时前" / "昨天 11:40" / "3天前" / "2026-05-29" 等 → Date
function parsePubDate(text: string): Date | null {
  const t = text.trim();
  const now = Date.now();
  const m1 = t.match(/(\d+)\s*分钟前/);
  if (m1) return new Date(now - parseInt(m1[1], 10) * 60_000);
  const m2 = t.match(/(\d+)\s*小时前/);
  if (m2) return new Date(now - parseInt(m2[1], 10) * 3_600_000);
  const m3 = t.match(/(\d+)\s*天前/);
  if (m3) return new Date(now - parseInt(m3[1], 10) * 86_400_000);
  if (t.includes("昨天")) return new Date(now - 86_400_000);
  if (t.includes("今天") || t.includes("刚刚")) return new Date(now);
  const m4 = t.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (m4) {
    const d = new Date(+m4[1], +m4[2] - 1, +m4[3]);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseHtml(html: string): RawTopic[] {
  const $ = cheerio.load(html);
  const results: RawTopic[] = [];

  $(".result-op, .c-container")
    .slice(0, 15)
    .each((_: number, el) => {
      const $el = $(el);
      const $a = $el.find("h3 a").first();
      const title = $a.text().trim();
      const href = ($a.attr("href") ?? "").trim();
      if (!title || !href) return;
      if (!href.startsWith("http")) return;

      const metaText = $el
        .find(".c-author, .news-source, .c-color-gray, .c-color-gray2")
        .text()
        .trim();
      const publishedAt = parsePubDate(metaText) ?? new Date();

      const snippet = $el
        .find(".c-font-normal, .content-right_2s-H4, .c-summary, .c-color-text")
        .first()
        .text()
        .trim();

      const sourceName = metaText
        .replace(/\d+\s*(分钟|小时|天)前/g, "")
        .replace(/今天|昨天|刚刚/g, "")
        .replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/g, "")
        .replace(/\d{1,2}:\d{2}/g, "")
        .trim()
        .split(/\s+/)[0];

      results.push({
        title,
        summary: snippet || undefined,
        url: href,
        source: "baidu",
        author: sourceName || undefined,
        publishedAt,
      });
    });

  return results;
}

export async function collectBaidu(keyword: string): Promise<RawTopic[]> {
  const targetUrl = `${BAIDU_HOST}/s?wd=${encodeURIComponent(keyword)}&tn=news&rtt=4&ie=utf-8`;

  // 第一层：直连
  try {
    const res = await axios.get(`${BAIDU_HOST}/s`, {
      params: { wd: keyword, tn: "news", rtt: 4, ie: "utf-8" },
      headers: {
        "User-Agent": ua(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    const text = typeof res.data === "string" ? res.data : "";
    if (!isAntiSpider(text)) return parseHtml(text);

    console.warn("[Baidu] 直连触发安全验证，退到 Firecrawl");
  } catch (err) {
    console.error(
      "[Baidu] 直连失败，退到 Firecrawl:",
      err instanceof Error ? err.message : err,
    );
  }

  // 第二层：Firecrawl 兜底
  const html = await fetchSerpViaFirecrawl({
    url: targetUrl,
    isAntiSpider,
    sourceName: "Baidu",
  });
  return html ? parseHtml(html) : [];
}
