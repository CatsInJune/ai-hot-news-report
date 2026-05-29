import Parser from "rss-parser";
import type { RawTopic } from "@/types";

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AIHotNews/1.0)" },
});

export async function collectGoogle(keyword: string): Promise<RawTopic[]> {
  try {
    // 加引号做短语精确匹配，避免"鱼皮"被字面拆词匹配到鲅鱼/医疗鱼皮等无关内容
    const phrase = keyword.includes('"') ? keyword : `"${keyword}"`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(phrase)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
    const feed = await parser.parseURL(url);

    return feed.items.slice(0, 15).map((item) => ({
      title: item.title ?? "",
      summary: item.contentSnippet ?? item.content ?? "",
      url: item.link ?? "",
      source: "google" as const,
      author: item.creator ?? item.author,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    })).filter((t) => t.title && t.url);
  } catch (err) {
    console.error("[Google] 采集失败:", err);
    return [];
  }
}
