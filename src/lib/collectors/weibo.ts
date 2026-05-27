import axios from "axios";
import type { RawTopic } from "@/types";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  Referer: "https://weibo.com/",
  "Accept-Language": "zh-CN,zh;q=0.9",
};

interface WeiboHotItem {
  word: string;
  note?: string;
  num?: number;
  raw_hot?: number;
}

// 微博实时热搜（不需要关键词，直接返回 Top N）
export async function collectWeiboHot(): Promise<RawTopic[]> {
  try {
    const res = await axios.get("https://weibo.com/ajax/side/hotSearch", {
      headers: HEADERS,
      timeout: 10000,
    });

    const items: WeiboHotItem[] = res.data?.data?.realtime ?? [];
    return items.slice(0, 20).map((item) => ({
      title: item.note || item.word || "",
      summary: item.note || item.word || "",
      url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(item.word)}%23`,
      source: "weibo" as const,
      publishedAt: new Date(),
      views: item.num ?? 0,
    })).filter((t) => t.title);
  } catch (err) {
    console.error("[Weibo Hot] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}

// 通过 m.weibo.cn 移动端 API 关键词搜索（更友好的 JSON 格式）
export async function collectWeibo(keyword: string): Promise<RawTopic[]> {
  try {
    const res = await axios.get("https://m.weibo.cn/api/container/getIndex", {
      params: { containerid: `100103type=1&q=${keyword}` },
      headers: HEADERS,
      timeout: 12000,
    });

    const cards = res.data?.data?.cards ?? [];
    const results: RawTopic[] = [];

    for (const card of cards) {
      if (card.card_type === 9 && card.mblog) {
        const m = card.mblog;
        const text = (m.text ?? "").replace(/<[^>]+>/g, "");
        if (!text) continue;
        results.push({
          title: text.slice(0, 80),
          summary: text,
          url: `https://m.weibo.cn/detail/${m.id}`,
          source: "weibo",
          author: m.user?.screen_name,
          publishedAt: m.created_at ? new Date(m.created_at) : new Date(),
          likes: m.attitudes_count ?? 0,
          reposts: m.reposts_count ?? 0,
          comments: m.comments_count ?? 0,
        });
        if (results.length >= 10) break;
      }
    }

    return results;
  } catch (err) {
    console.error("[Weibo] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
