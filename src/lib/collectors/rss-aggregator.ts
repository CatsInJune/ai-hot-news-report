import Parser from "rss-parser";
import type { RawTopic, SourceType } from "@/types";

// 多 RSS 聚合 collector 的共享工具：
// 这些源（官博/中文媒体）不支持关键词搜索 API，只能全量拉 RSS 再客户端 filter。
// 加 5 分钟模块级缓存避免 N 个关键词 × M 个 feed 反复抓同一份 RSS。

const parser = new Parser({
  timeout: 12000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AIHotNews/1.0)" },
});

const TTL_MS = 5 * 60 * 1000;
type CacheEntry = { ts: number; items: Parser.Item[] };
const feedCache = new Map<string, CacheEntry>();

async function fetchFeed(url: string): Promise<Parser.Item[]> {
  const cached = feedCache.get(url);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.items;
  try {
    const feed = await parser.parseURL(url);
    const items = feed.items ?? [];
    feedCache.set(url, { ts: Date.now(), items });
    return items;
  } catch (err) {
    console.warn(
      `[RSS] ${url} 拉取失败:`,
      err instanceof Error ? err.message : err,
    );
    // 失败时不更新 cache，下次重试；但如果有旧 cache 就用旧的兜底
    return cached?.items ?? [];
  }
}

export interface RssFeedConfig {
  name: string;
  url: string;
}

/**
 * 拉取多个 RSS feed，按关键词（标题或正文 contains，大小写不敏感）过滤。
 * 每个 feed 取前 maxPerFeed 条做关键词过滤，避免 archive 巨大的 feed（如 OpenAI 978 条）扫全表。
 */
export async function collectAggregatedRss(
  keyword: string,
  feeds: RssFeedConfig[],
  source: SourceType,
  maxPerFeed = 30,
): Promise<RawTopic[]> {
  const kwLower = keyword.toLowerCase();
  const results: RawTopic[] = [];

  const allItems = await Promise.all(feeds.map((f) => fetchFeed(f.url)));

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    const items = allItems[i].slice(0, maxPerFeed);
    for (const item of items) {
      const title = (item.title ?? "").trim();
      const snippet = (item.contentSnippet ?? item.content ?? "").trim();
      const hay = `${title}\n${snippet}`.toLowerCase();
      if (!hay.includes(kwLower)) continue;

      results.push({
        title,
        summary: snippet.slice(0, 400) || undefined,
        rawContent: snippet || undefined,
        url: item.link ?? "",
        source,
        author: feed.name,
        publishedAt: item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : new Date(),
      });
    }
  }

  return results.filter((t) => t.title && t.url);
}
