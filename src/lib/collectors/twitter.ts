import type { RawTopic } from "@/types";

const TWITTER_API_BASE = "https://api.twitterapi.io";

interface TweetAuthor {
  userName?: string;
  name?: string;
  followers?: number;
  isBlueVerified?: boolean;
}

interface Tweet {
  id: string;
  url?: string;
  text: string;
  retweetCount?: number;
  replyCount?: number;
  likeCount?: number;
  viewCount?: number;
  createdAt?: string;
  author?: TweetAuthor;
}

async function fetchTweets(
  apiKey: string,
  query: string,
  queryType: "Top" | "Latest"
): Promise<Tweet[]> {
  const params = new URLSearchParams({ query, queryType });
  const res = await fetch(
    `${TWITTER_API_BASE}/twitter/tweet/advanced_search?${params}`,
    {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    console.error(`[Twitter] API ${res.status} (${queryType})`);
    return [];
  }
  const data = await res.json();
  return data.tweets ?? [];
}

// 复合质量判定：高互动单条放行 / 优质作者 + 轻量互动放行 / 其他丢弃
function isQualityTweet(t: Tweet): boolean {
  // 排除以 @user 开头的回复推文（即使 API 端没过滤掉）
  if (/^\s*@\w+/.test(t.text)) return false;

  const likes = t.likeCount ?? 0;
  const rt = t.retweetCount ?? 0;
  const views = t.viewCount ?? 0;
  const replies = t.replyCount ?? 0;
  const followers = t.author?.followers ?? 0;
  const verified = t.author?.isBlueVerified ?? false;

  // 信号 1：单条互动够高，作者无关
  if (likes >= 20 || rt >= 5 || views >= 5000 || replies >= 10) return true;

  // 信号 2：优质作者 + 起码有点反馈（避免大V随手发的废话）
  if ((followers >= 500 || verified) && (likes >= 3 || views >= 500)) return true;

  return false;
}

function engagement(t: Tweet): number {
  return (t.likeCount ?? 0) + (t.retweetCount ?? 0) * 2 + (t.replyCount ?? 0);
}

export async function collectTwitter(keyword: string): Promise<RawTopic[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    console.log("[Twitter] 未配置 TWITTER_API_KEY，跳过");
    return [];
  }

  try {
    // 短语精确匹配 + 排除回复 / 转推，提高相关性
    const phrase = keyword.includes('"') ? keyword : `"${keyword}"`;
    const query = `${phrase} -filter:replies -filter:retweets`;

    const [top, latest] = await Promise.all([
      fetchTweets(apiKey, query, "Top"),
      fetchTweets(apiKey, query, "Latest"),
    ]);

    // 按 id 去重，Top 优先保留
    const merged = new Map<string, Tweet>();
    [...top, ...latest].forEach((t) => {
      if (!merged.has(t.id)) merged.set(t.id, t);
    });

    return Array.from(merged.values())
      .filter(isQualityTweet)
      .sort((a, b) => engagement(b) - engagement(a))
      .slice(0, 20)
      .map((t) => ({
        title: t.text.slice(0, 120),
        summary: t.text,
        url: t.url ?? `https://twitter.com/${t.author?.userName ?? "i"}/status/${t.id}`,
        source: "twitter" as const,
        author: t.author?.name ?? t.author?.userName,
        publishedAt: t.createdAt ? new Date(t.createdAt) : new Date(),
        likes: t.likeCount ?? 0,
        reposts: t.retweetCount ?? 0,
        comments: t.replyCount ?? 0,
        views: t.viewCount ?? 0,
      }));
  } catch (err) {
    console.error("[Twitter] 采集失败:", err);
    return [];
  }
}
