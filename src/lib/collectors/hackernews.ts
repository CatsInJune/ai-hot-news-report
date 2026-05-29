import type { RawTopic } from "@/types";

const HN_BASE = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
}

// HN Algolia API：支持关键词搜索（HN 自己的 Firebase API 不支持关键词检索）
async function searchHN(keyword: string): Promise<HNItem[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=story&hitsPerPage=15`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.hits ?? []).map((h: { objectID: string; title: string; url?: string; points?: number; author: string; created_at_i: number; num_comments?: number }) => ({
    id: parseInt(h.objectID),
    title: h.title,
    url: h.url,
    score: h.points ?? 0,
    by: h.author,
    time: h.created_at_i,
    descendants: h.num_comments ?? 0,
  }));
}

// 判断是否包含中文字符——HN 是英文社区，纯中文关键词搜索命中率几乎为 0，跳过省 AI token
function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fff]/.test(s);
}

export async function collectHackerNews(keyword?: string): Promise<RawTopic[]> {
  try {
    let items: HNItem[];

    if (keyword) {
      if (hasChinese(keyword)) return [];
      items = await searchHN(keyword);
    } else {
      // 无关键词时拉取 topstories Top 20
      const idsRes = await fetch(`${HN_BASE}/topstories.json`, {
        signal: AbortSignal.timeout(10000),
      });
      const ids: number[] = await idsRes.json();
      items = await Promise.all(
        ids.slice(0, 20).map((id) =>
          fetch(`${HN_BASE}/item/${id}.json`).then((r) => r.json())
        )
      );
    }

    return items
      .filter((s) => s && s.url && s.title)
      .map((s) => ({
        title: s.title,
        summary: "",
        url: s.url!,
        source: "hackernews" as const,
        author: s.by,
        publishedAt: new Date(s.time * 1000),
        likes: s.score,
        comments: s.descendants ?? 0,
      }));
  } catch (err) {
    console.error("[HackerNews] 采集失败:", err);
    return [];
  }
}
