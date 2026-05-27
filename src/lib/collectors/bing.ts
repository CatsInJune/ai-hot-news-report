import Parser from "rss-parser";
import type { RawTopic } from "@/types";

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AIHotNews/1.0)" },
});

export async function collectBing(keyword: string): Promise<RawTopic[]> {
  try {
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=RSS`;
    const feed = await parser.parseURL(url);

    return feed.items.slice(0, 15).map((item) => ({
      title: item.title ?? "",
      summary: item.contentSnippet ?? item.content ?? "",
      url: item.link ?? "",
      source: "bing" as const,
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
    })).filter((t) => t.title && t.url);
  } catch (err) {
    console.error("[Bing] 采集失败:", err);
    return [];
  }
}
