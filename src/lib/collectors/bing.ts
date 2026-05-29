import Parser from "rss-parser";
import type { RawTopic } from "@/types";

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AIHotNews/1.0)" },
});

export async function collectBing(keyword: string): Promise<RawTopic[]> {
  try {
    // 加引号做短语精确匹配，避免被字面拆词
    const phrase = keyword.includes('"') ? keyword : `"${keyword}"`;
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(phrase)}&format=RSS`;
    const feed = await parser.parseURL(url);

    return feed.items.slice(0, 15).map((item) => {
      const snippet = item.contentSnippet ?? item.content ?? "";
      return {
        title: item.title ?? "",
        summary: snippet,
        // Bing News RSS 的 snippet 通常是新闻摘要，作为原文展示
        rawContent: snippet || undefined,
        url: item.link ?? "",
        source: "bing" as const,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      };
    }).filter((t) => t.title && t.url);
  } catch (err) {
    console.error("[Bing] 采集失败:", err);
    return [];
  }
}
