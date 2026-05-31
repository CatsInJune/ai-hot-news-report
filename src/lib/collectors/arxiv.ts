import Parser from "rss-parser";
import type { RawTopic } from "@/types";

// arXiv 官方 API（Atom feed）。query 用 all:"keyword" 短语匹配，
// 限定 cs.* 分类避开物理/数学的同名论文。
const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "ai-hot-news-monitor:v1.0" },
});

const AI_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.MA", "cs.NE"];

export async function collectArxiv(keyword: string): Promise<RawTopic[]> {
  try {
    const phrase = keyword.includes('"') ? keyword : `"${keyword}"`;
    const catFilter = AI_CATS.map((c) => `cat:${c}`).join("+OR+");
    // search_query 不要 encodeURIComponent 整体（会把 ()+ 也编码导致语法失效）
    const q = `all:${encodeURIComponent(phrase)}+AND+(${catFilter})`;
    const url =
      `https://export.arxiv.org/api/query?search_query=${q}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=15`;
    const feed = await parser.parseURL(url);

    return feed.items
      .map((item) => {
        const abstract = (item.summary ?? item.contentSnippet ?? "")
          .replace(/\s+/g, " ")
          .trim();
        // entry.author 在 arxiv 是数组；rss-parser 把它拼成 creator
        const author =
          item.creator ?? (item as { author?: string }).author ?? undefined;
        return {
          title: (item.title ?? "").replace(/\s+/g, " ").trim(),
          summary: abstract.slice(0, 400),
          rawContent: abstract || undefined,
          url: item.link ?? "",
          source: "arxiv" as const,
          author,
          publishedAt: item.isoDate
            ? new Date(item.isoDate)
            : item.pubDate
              ? new Date(item.pubDate)
              : new Date(),
        };
      })
      .filter((t) => t.title && t.url);
  } catch (err) {
    console.error("[arXiv] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
