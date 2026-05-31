import axios from "axios";
import type { RawTopic } from "@/types";

// 微博热搜公开 API（无需登录）。借鉴 yupi-hot-monitor 思路：
// 不是搜索"包含关键词的微博帖子"——那条路被反爬/登录墙堵死，
// 而是检查"关键词是否上了微博热搜"，把"上榜"本身当作信号。
const HOT_SEARCH_URL = "https://weibo.com/ajax/side/hotSearch";

interface WeiboHotItem {
  word: string;
  note?: string;
  num: number;
}

interface WeiboHotResponse {
  ok?: number;
  data?: { realtime?: WeiboHotItem[] };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s#【】「」『』""''""]/g, "");
}

export async function collectWeibo(keyword: string): Promise<RawTopic[]> {
  try {
    const res = await axios.get<WeiboHotResponse>(HOT_SEARCH_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json",
        Referer: "https://weibo.com/",
      },
      timeout: 15000,
    });

    if (res.data?.ok !== 1 || !res.data?.data?.realtime) return [];

    const kwNorm = normalize(keyword);
    const kwTokens = kwNorm
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .filter((t) => t.length >= 2);

    const results: RawTopic[] = [];
    // 热搜是"此刻正热"——上榜时间近似采集时间，给整源同一个 now
    const now = new Date();

    for (const item of res.data.data.realtime) {
      const topic = (item.note || item.word || "").trim();
      if (!topic) continue;
      const topicNorm = normalize(topic);

      // 命中规则：整串包含 / 任一长度≥2 的 token 出现在话题里
      const hit =
        topicNorm.includes(kwNorm) ||
        kwNorm.includes(topicNorm) ||
        kwTokens.some((t) => topicNorm.includes(t));
      if (!hit) continue;

      const url = `https://s.weibo.com/weibo?q=${encodeURIComponent(`#${topic}#`)}`;
      results.push({
        title: `微博热搜: ${topic}`,
        summary: `微博热搜话题「${topic}」，热度 ${item.num?.toLocaleString() ?? "未知"}`,
        url,
        source: "weibo",
        publishedAt: now,
        views: item.num ?? 0,
      });
    }

    return results;
  } catch (err) {
    console.error("[Weibo] 采集失败:", err instanceof Error ? err.message : err);
    return [];
  }
}
