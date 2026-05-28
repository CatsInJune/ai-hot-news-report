import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return d.toLocaleDateString("zh-CN");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

const SOURCE_ORIGIN: Record<string, string> = {
  sogou: "https://weixin.sogou.com",
  weibo: "https://s.weibo.com",
  bilibili: "https://www.bilibili.com",
  bing: "https://www.bing.com",
  google: "https://news.google.com",
  duckduckgo: "https://duckduckgo.com",
  hackernews: "https://news.ycombinator.com",
  twitter: "https://twitter.com",
};

export function normalizeTopicUrl(url: string | null | undefined, source: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) {
    const origin = SOURCE_ORIGIN[source];
    return origin ? `${origin}${url}` : "";
  }
  return "";
}
