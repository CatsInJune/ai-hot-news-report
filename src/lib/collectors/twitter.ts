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

export async function collectTwitter(keyword: string): Promise<RawTopic[]> {
  const apiKey = process.env.TWITTER_API_KEY;
  if (!apiKey) {
    console.log("[Twitter] 未配置 TWITTER_API_KEY，跳过");
    return [];
  }

  try {
    const params = new URLSearchParams({ query: keyword, queryType: "Latest" });
    const res = await fetch(
      `${TWITTER_API_BASE}/twitter/tweet/advanced_search?${params}`,
      {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.error(`[Twitter] API ${res.status}`);
      return [];
    }

    const data = await res.json();
    const tweets: Tweet[] = data.tweets ?? [];

    return tweets
      .filter((t) => (t.likeCount ?? 0) + (t.retweetCount ?? 0) + (t.viewCount ?? 0) > 10)
      .slice(0, 15)
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
