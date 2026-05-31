import axios from "axios";
import Parser from "rss-parser";
import type { RawTopic } from "@/types";

// Reddit 提供公开 RSS（无需 OAuth），但对 UA 检查严格——
// 含 bot / monitor 字样会被 403。改用 axios 取 RSS 再 parseString，
// 显式带浏览器 UA 绕过。
const parser = new Parser();

export async function collectReddit(keyword: string): Promise<RawTopic[]> {
  try {
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(
      keyword,
    )}&sort=new&limit=25`;
    const res = await axios.get<string>(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 12000,
      validateStatus: () => true,
    });
    if (res.status !== 200 || typeof res.data !== "string") {
      console.warn(`[Reddit] HTTP ${res.status}`);
      return [];
    }
    const feed = await parser.parseString(res.data);

    return feed.items
      .slice(0, 15)
      .map((item) => {
        const snippet = (item.contentSnippet ?? item.content ?? "").trim();
        // RSS 描述里含 `submitted by /u/xxx [link] [comments]` 模板尾巴
        const cleaned = snippet
          .replace(/\s*\[link\]\s*\[comments\]\s*$/i, "")
          .trim();
        const author = item.creator ?? item.author ?? undefined;
        return {
          title: item.title ?? "",
          summary: cleaned || undefined,
          rawContent: cleaned || undefined,
          url: item.link ?? "",
          source: "reddit" as const,
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
    console.error("[Reddit] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
