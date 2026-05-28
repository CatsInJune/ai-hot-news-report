import { prisma } from "@/lib/prisma";
import { analyzeBatch } from "@/lib/analyzer";
import { sseManager } from "@/lib/sse-manager";
import { sendKeywordAlert } from "@/lib/mailer";
import type { RawTopic } from "@/types";
import { collectTwitter } from "./twitter";
import { collectBing } from "./bing";
import { collectGoogle } from "./google";
import { collectDuckDuckGo } from "./duckduckgo";
import { collectHackerNews } from "./hackernews";
import { collectSogou } from "./sogou";
import { collectBilibili } from "./bilibili";
import { collectWeibo, collectWeiboHot } from "./weibo";

// 过滤阈值（写死，调阈值改这里）
const MIN_RELEV_SCORE = 50; // 关键词相关性阈值，低于则丢弃
const MAX_AGE_DAYS = 7;     // 发布时效窗口（天），超过则丢弃

export interface CollectResult {
  keyword: string;
  source: string;
  count: number;
  ok: boolean;
  error?: string;
}

interface CollectedItem {
  topic: RawTopic;
  keywordId: string | null;
  keywordName: string | null;
}

// 单个关键词全源采集
export async function collectForKeyword(keyword: string): Promise<{
  raw: RawTopic[];
  results: CollectResult[];
}> {
  const sources: Array<{ name: string; fn: () => Promise<RawTopic[]> }> = [
    { name: "twitter", fn: () => collectTwitter(keyword) },
    { name: "bing", fn: () => collectBing(keyword) },
    { name: "google", fn: () => collectGoogle(keyword) },
    { name: "duckduckgo", fn: () => collectDuckDuckGo(keyword) },
    { name: "hackernews", fn: () => collectHackerNews(keyword) },
    { name: "sogou", fn: () => collectSogou(keyword) },
    { name: "bilibili", fn: () => collectBilibili(keyword) },
    { name: "weibo", fn: () => collectWeibo(keyword) },
  ];

  const results: CollectResult[] = [];
  const raw: RawTopic[] = [];

  await Promise.allSettled(
    sources.map(async ({ name, fn }) => {
      try {
        const items = await fn();
        raw.push(...items);
        results.push({ keyword, source: name, count: items.length, ok: true });
      } catch (err) {
        results.push({
          keyword, source: name, count: 0, ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  return { raw, results };
}

// 全量采集（针对所有 active 关键词）
export async function collectAll(): Promise<{
  total: number;
  newCount: number;
  hitCount: number;
  results: CollectResult[];
  analyzed: number;
}> {
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  const allItems: CollectedItem[] = [];
  const allResults: CollectResult[] = [];

  // 并行采集每个关键词的所有信息源
  if (keywords.length > 0) {
    await Promise.allSettled(
      keywords.map(async (kw) => {
        const { raw, results } = await collectForKeyword(kw.name);
        raw.forEach((r) => allItems.push({ topic: r, keywordId: kw.id, keywordName: kw.name }));
        allResults.push(...results);
      })
    );
  }

  // 补充：微博实时热搜（无关键词）
  const hot = await collectWeiboHot();
  hot.forEach((r) => allItems.push({ topic: r, keywordId: null, keywordName: null }));
  allResults.push({ keyword: "", source: "weibo-hot", count: hot.length, ok: true });

  // URL 级别去重
  const seen = new Map<string, CollectedItem>();
  for (const it of allItems) {
    if (!it.topic.url) continue;
    if (!seen.has(it.topic.url)) {
      seen.set(it.topic.url, it);
    }
  }

  const deduped = Array.from(seen.values());

  // 先查 DB 排除已存在的 URL，避免对老数据重复跑 AI
  const existing = await prisma.topic.findMany({
    where: { url: { in: deduped.map((d) => d.topic.url) } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map((e) => e.url));
  const freshAll = deduped.filter((d) => !existingSet.has(d.topic.url));

  // 时效过滤：超过 MAX_AGE_DAYS 的内容直接丢弃，省 AI token
  const ageLimit = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const fresh = freshAll.filter((d) => d.topic.publishedAt >= ageLimit);
  const droppedByAge = freshAll.length - fresh.length;

  // AI 分析（并发 5）
  const analyzeInput = fresh.map((d, i) => ({
    id: String(i),
    input: {
      title: d.topic.title,
      text: d.topic.summary ?? d.topic.title,
      keyword: d.keywordName ?? undefined,
      source: d.topic.source,
    },
  }));

  const analyses = await analyzeBatch(analyzeInput);

  // 落库
  let newCount = 0;
  let hitCount = 0;
  let droppedBySpam = 0;
  let droppedByRelev = 0;
  for (let i = 0; i < fresh.length; i++) {
    const { topic, keywordId } = fresh[i];
    const a = analyses.get(String(i));

    // 垃圾内容：直接丢弃，不再仅靠 SSE 拦截
    if (a?.isSpam) {
      droppedBySpam++;
      continue;
    }
    // 相关性：仅对带关键词的条目过滤；无关键词的（如微博热搜）走原逻辑
    if (keywordId && a && a.relevScore < MIN_RELEV_SCORE) {
      droppedByRelev++;
      continue;
    }

    const realScore = a?.realScore ?? 50;
    const relevScore = a?.relevScore ?? (keywordId ? 50 : 30);
    const hotScore = a?.hotScore ?? Math.min(
      100,
      Math.floor(
        ((topic.likes ?? 0) + (topic.reposts ?? 0) * 2 + (topic.comments ?? 0)) / 10
      ) + 30
    );

    try {
      const created = await prisma.topic.create({
        data: {
          title: topic.title.slice(0, 500),
          summary: a?.summary ?? topic.summary?.slice(0, 2000) ?? null,
          url: topic.url,
          source: topic.source,
          author: topic.author ?? null,
          publishedAt: topic.publishedAt,
          likes: topic.likes ?? 0,
          reposts: topic.reposts ?? 0,
          comments: topic.comments ?? 0,
          views: topic.views ?? 0,
          keywordId,
          realScore,
          relevScore,
          hotScore,
          isSpam: a?.isSpam ?? false,
          reason: a?.reason ?? null,
        },
      });
      newCount++;

      // SSE 推送：低质量内容不推送
      if (!created.isSpam && created.hotScore >= 50) {
        const payload = {
          type: "new-topic",
          topic: {
            id: created.id,
            title: created.title,
            summary: created.summary,
            url: created.url,
            source: created.source,
            hotScore: created.hotScore,
            realScore: created.realScore,
            publishedAt: created.publishedAt.toISOString(),
            author: created.author,
          },
        };
        sseManager.broadcast(payload);

        // 命中关键词：额外发 alert + 写入 Notification 表 + 可选邮件
        if (keywordId && relevScore >= 60) {
          hitCount++;
          const kw = await prisma.keyword.findUnique({ where: { id: keywordId } });
          if (kw) {
            sseManager.broadcast({
              type: "alert",
              keyword: kw.name,
              topic: payload.topic,
            });
            await prisma.notification.create({
              data: {
                type: "browser",
                title: `关键词命中: ${kw.name}`,
                content: created.title,
                topicUrl: created.url,
              },
            });

            // 邮件推送（异步，不阻塞主流程）
            const notifyEmail = process.env.NOTIFICATION_EMAIL;
            if (kw.notifyEmail && notifyEmail) {
              void sendKeywordAlert({
                to: notifyEmail,
                keyword: kw.name,
                title: created.title,
                summary: created.summary ?? "",
                url: created.url,
                source: created.source,
                hotScore: created.hotScore,
              }).then((sent) => {
                if (sent) {
                  return prisma.notification.create({
                    data: {
                      type: "email",
                      title: `邮件已发送: ${kw.name}`,
                      content: created.title,
                      topicUrl: created.url,
                    },
                  });
                }
              });
            }
          }
        }
      }
    } catch {
      // URL 重复（@unique 约束）
    }
  }

  console.log(
    `[Collect] total=${deduped.length} fresh=${freshAll.length} inTime=${fresh.length} analyzed=${analyses.size} new=${newCount} hit=${hitCount} dropped(age=${droppedByAge}, spam=${droppedBySpam}, relev=${droppedByRelev})`
  );

  return {
    total: deduped.length,
    newCount,
    hitCount,
    results: allResults,
    analyzed: analyses.size,
  };
}
