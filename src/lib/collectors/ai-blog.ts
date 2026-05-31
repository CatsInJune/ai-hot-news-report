import { collectAggregatedRss, type RssFeedConfig } from "./rss-aggregator";
import type { RawTopic } from "@/types";

// AI 公司官方博客 RSS。
// 不收 Anthropic / Meta AI 因为它们当前没有公开稳定的 RSS 入口；
// 这两家的内容会从 Reddit / arXiv / Baidu News 这些聚合源覆盖到。
const FEEDS: RssFeedConfig[] = [
  { name: "OpenAI", url: "https://openai.com/news/rss.xml" },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/" },
  { name: "HuggingFace", url: "https://huggingface.co/blog/feed.xml" },
  { name: "DeepMind", url: "https://deepmind.google/blog/rss.xml" },
];

export async function collectAiBlog(keyword: string): Promise<RawTopic[]> {
  return collectAggregatedRss(keyword, FEEDS, "ai_blog", 30);
}
