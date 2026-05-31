import { prisma } from "@/lib/prisma";
import { analyzeBatch } from "@/lib/analyzer";
import { expandKeyword, preMatchKeyword } from "@/lib/keyword-expander";
import { detectAccounts } from "@/lib/account-detector";
import { extractContentBatch, SCRAPABLE_SOURCES } from "@/lib/extract-content";
import { sseManager } from "@/lib/sse-manager";
import { enqueueAlert } from "@/lib/notification-queue";
import { getWechatWebhookUrls } from "@/lib/wechat";
import type { RawTopic, SourceType, KeywordAccount } from "@/types";
import { collectTwitter } from "./twitter";
import { collectBing } from "./bing";
import { collectGoogle } from "./google";
import { collectHackerNews } from "./hackernews";
import { collectSogou } from "./sogou";
import { collectWeibo } from "./weibo";
import { collectBilibili } from "./bilibili";
import { collectTwitterTimeline } from "./twitter-timeline";
import { collectBilibiliUser, findBilibiliUid } from "./bilibili-user";
import { collectReddit } from "./reddit";
import { collectArxiv } from "./arxiv";
import { collectAiBlog } from "./ai-blog";
import { collectAiNewsZh } from "./ai-news-zh";
import { collectBaidu } from "./baidu";

// 过滤阈值（写死，调阈值改这里）
const MIN_RELEV_SCORE = 50;        // 一级阈值：低于直接丢
const MIN_RELEV_NO_MENTION = 65;   // 二级阈值：keywordMentioned=false 时要求更高
const MAX_AGE_DAYS = 7;            // 发布时效窗口

// 每源最大入库条数（避免某个源刷屏）
// sogou 给低配额，因为搜狗微信常有同文不同公众号转载
const SOURCE_QUOTA: Record<string, number> = {
  twitter: 15,
  weibo: 10,
  bilibili: 8,
  hackernews: 8,
  reddit: 10,
  arxiv: 6,
  ai_blog: 6,
  ai_news_zh: 6,
  baidu: 8,
  bing: 5,
  google: 5,
  sogou: 3,
};
const DEFAULT_QUOTA = 5;

export interface CollectResult {
  keyword: string;
  source: string;
  count: number;
  ok: boolean;
  error?: string;
}

interface CollectedItem {
  topic: RawTopic;
  keywordId: string;
  keywordName: string;
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/\s+/g, "").replace(/[【】\[\]()（）「」『』""''""\.,!?。，！？]/g, "");
}

// 单个关键词全源采集（关键词搜索 + 账号订阅）
export async function collectForKeyword(
  keyword: string,
  accounts: KeywordAccount[] = []
): Promise<{ raw: RawTopic[]; results: CollectResult[] }> {
  const sources: Array<{ name: string; fn: () => Promise<RawTopic[]> }> = [
    { name: "twitter", fn: () => collectTwitter(keyword) },
    { name: "bing", fn: () => collectBing(keyword) },
    { name: "google", fn: () => collectGoogle(keyword) },
    { name: "hackernews", fn: () => collectHackerNews(keyword) },
    { name: "sogou", fn: () => collectSogou(keyword) },
    { name: "weibo", fn: () => collectWeibo(keyword) },
    { name: "bilibili", fn: () => collectBilibili(keyword) },
    { name: "reddit", fn: () => collectReddit(keyword) },
    { name: "arxiv", fn: () => collectArxiv(keyword) },
    { name: "ai_blog", fn: () => collectAiBlog(keyword) },
    { name: "ai_news_zh", fn: () => collectAiNewsZh(keyword) },
    { name: "baidu", fn: () => collectBaidu(keyword) },
  ];

  // 账号订阅源：每个识别到的账号一个 collector
  for (const acc of accounts) {
    if (acc.platform === "twitter" && acc.handle) {
      const handle = acc.handle;
      sources.push({
        name: `twitter:@${handle}`,
        fn: () => collectTwitterTimeline(handle),
      });
    } else if (acc.platform === "bilibili") {
      const uid = acc.uid;
      const name = acc.name;
      sources.push({
        name: `bilibili:${acc.uid ?? acc.name}`,
        fn: async () => {
          let mid = uid;
          if (!mid && name) mid = (await findBilibiliUid(name)) ?? undefined;
          if (!mid) return [];
          return collectBilibiliUser(mid);
        },
      });
    }
  }

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
  dropped: { title: number; age: number; spam: number; relev: number; quota: number };
}> {
  const keywords = await prisma.keyword.findMany({ where: { active: true } });

  const allItems: CollectedItem[] = [];
  const allResults: CollectResult[] = [];
  // 每个关键词的变体列表（pre-match 用），keywordId → aliases[]
  const aliasMap = new Map<string, string[]>();

  // 串行处理每个关键词
  for (const kw of keywords) {
    // 并行：扩展关键词变体 + 检测平台账号
    const [aliases, accounts] = await Promise.all([
      expandKeyword(kw),
      detectAccounts(kw),
    ]);
    aliasMap.set(kw.id, aliases);
    const { raw, results } = await collectForKeyword(kw.name, accounts);
    raw.forEach((r) => allItems.push({ topic: r, keywordId: kw.id, keywordName: kw.name }));
    allResults.push(...results);
  }

  // URL 级别去重
  const seen = new Map<string, CollectedItem>();
  for (const it of allItems) {
    if (!it.topic.url) continue;
    if (!seen.has(it.topic.url)) seen.set(it.topic.url, it);
  }
  const deduped = Array.from(seen.values());

  // 同源同标题去重（sogou 跨公众号转载，标题相同 URL 不同）
  const titleSeen = new Set<string>();
  const titleDeduped: CollectedItem[] = [];
  for (const it of deduped) {
    const key = `${it.topic.source}::${normalizeTitle(it.topic.title)}`;
    if (titleSeen.has(key)) continue;
    titleSeen.add(key);
    titleDeduped.push(it);
  }
  const droppedByTitle = deduped.length - titleDeduped.length;

  // 排除已存在的 URL
  const existing = await prisma.topic.findMany({
    where: { url: { in: titleDeduped.map((d) => d.topic.url) } },
    select: { url: true },
  });
  const existingSet = new Set(existing.map((e) => e.url));
  const freshAll = titleDeduped.filter((d) => !existingSet.has(d.topic.url));

  // 时效过滤
  const ageLimit = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const fresh = freshAll.filter((d) => d.topic.publishedAt >= ageLimit);
  const droppedByAge = freshAll.length - fresh.length;

  // AI 分析（带 pre-match hint）
  // 订阅来源（账号 timeline）走"订阅模式"评分：评估"值不值得看"，而不是"是否在讲鱼皮"
  const analyzeInput = fresh.map((d, i) => {
    const aliases = aliasMap.get(d.keywordId) ?? [d.keywordName];
    const fullText = `${d.topic.title}\n${d.topic.summary ?? ""}`;
    const preMatch = d.topic.subscribed
      ? { matched: true, matchedTerms: [`[订阅:${d.topic.author ?? d.keywordName}]`] }
      : preMatchKeyword(fullText, aliases);
    return {
      id: String(i),
      input: {
        title: d.topic.title,
        text: d.topic.summary ?? d.topic.title,
        keyword: d.keywordName,
        source: d.topic.source,
        preMatch,
        subscribed: d.topic.subscribed,
      },
    };
  });

  const analyses = await analyzeBatch(analyzeInput);

  // 按源分组并按 (relevScore desc, hotScore desc) 排序，准备应用配额
  type Candidate = { idx: number; item: CollectedItem; relev: number; hot: number };
  const bySource = new Map<string, Candidate[]>();
  for (let i = 0; i < fresh.length; i++) {
    const item = fresh[i];
    const a = analyses.get(String(i));
    if (!a) continue;
    if (a.isSpam) continue;
    // 订阅来源走宽松路径：跳过双门槛检查（账号 timeline 内在相关）
    if (!item.topic.subscribed) {
      if (a.relevScore < MIN_RELEV_SCORE) continue;
      if (!a.keywordMentioned && a.relevScore < MIN_RELEV_NO_MENTION) continue;
    }
    const arr = bySource.get(item.topic.source) ?? [];
    arr.push({ idx: i, item, relev: a.relevScore, hot: a.hotScore });
    bySource.set(item.topic.source, arr);
  }
  for (const arr of bySource.values()) {
    arr.sort((a, b) => b.relev - a.relev || b.hot - a.hot);
  }

  // 应用配额，得到最终入库候选
  const finalCandidates: Candidate[] = [];
  for (const [source, arr] of bySource.entries()) {
    const quota = SOURCE_QUOTA[source] ?? DEFAULT_QUOTA;
    finalCandidates.push(...arr.slice(0, quota));
  }

  let newCount = 0;
  let hitCount = 0;
  let droppedBySpam = 0;
  let droppedByRelev = 0;
  let droppedByQuota = 0;

  // 统计被过滤的原因（细致 log）
  for (let i = 0; i < fresh.length; i++) {
    const a = analyses.get(String(i));
    if (!a) continue;
    if (a.isSpam) droppedBySpam++;
    else if (a.relevScore < MIN_RELEV_SCORE) droppedByRelev++;
    else if (!a.keywordMentioned && a.relevScore < MIN_RELEV_NO_MENTION) droppedByRelev++;
  }
  // 配额淘汰数 = 进入 bySource 的总数 - 最终候选数
  let inQuotaInput = 0;
  for (const arr of bySource.values()) inQuotaInput += arr.length;
  droppedByQuota = inQuotaInput - finalCandidates.length;

  // 抓正文：对 bing/google/hackernews/sogou 这些 URL 指向真实文章的源，
  // 在落库前并发抓 Firecrawl + LLM 清洗，把全文写入 rawContent。
  // 跳过指向社交媒体的 URL——这些站点我们有原生采集器（twitter），
  // 网页抓回来的是"原帖 + 他人回复 + 互动数据"混合体，不是文章。
  const SOCIAL_HOSTS = /(?:^|\.)((x|twitter|t)\.co|x\.com|twitter\.com|mastodon\.[\w-]+|bsky\.app|threads\.net)$/i;
  const isSocialUrl = (u: string): boolean => {
    try {
      return SOCIAL_HOSTS.test(new URL(u).hostname);
    } catch {
      return false;
    }
  };

  const extractMap = new Map<number, string>(); // idx -> extracted content
  const toExtract: { idx: number; url: string; title?: string }[] = [];
  let skippedSocial = 0;
  for (const cand of finalCandidates) {
    if (!SCRAPABLE_SOURCES.has(cand.item.topic.source)) continue;
    if (!cand.item.topic.url) continue;
    if (isSocialUrl(cand.item.topic.url)) {
      skippedSocial++;
      continue;
    }
    toExtract.push({
      idx: cand.idx,
      url: cand.item.topic.url,
      title: cand.item.topic.title,
    });
  }
  if (skippedSocial > 0) {
    console.log(`[Extract] skipped ${skippedSocial} social-media URL(s)`);
  }
  if (toExtract.length > 0) {
    const extracted = await extractContentBatch(
      toExtract.map((t) => ({ url: t.url, title: t.title })),
      5,
    );
    toExtract.forEach(({ idx }, i) => {
      const content = extracted[i];
      if (content) extractMap.set(idx, content);
    });
    const okCount = Array.from(extractMap.values()).filter(Boolean).length;
    console.log(`[Extract] tried=${toExtract.length} ok=${okCount}`);
  }

  // 落库
  for (const cand of finalCandidates) {
    const { item, idx } = cand;
    const a = analyses.get(String(idx))!;
    const { topic, keywordId } = item;
    const fallbackHot = Math.min(
      100,
      Math.floor(((topic.likes ?? 0) + (topic.reposts ?? 0) * 2 + (topic.comments ?? 0)) / 10) + 30
    );

    try {
      const created = await prisma.topic.create({
        data: {
          title: topic.title.slice(0, 500),
          // summary 字段存 AI 生成的 50 字摘要（卡片紧凑展示）
          summary: a.summary ?? topic.summary?.slice(0, 200) ?? null,
          // rawContent 优先级：抓取到的全文 > collector 自带的（如推文 text）
          // bilibili（视频无字幕）不抓也无 collector 原文 → 永远为 null
          rawContent:
            extractMap.get(cand.idx) ?? topic.rawContent?.slice(0, 4000) ?? null,
          url: topic.url,
          source: topic.source,
          author: topic.author ?? null,
          authorVerified: topic.authorVerified ?? null,
          authorFollowers: topic.authorFollowers ?? null,
          publishedAt: topic.publishedAt,
          likes: topic.likes ?? 0,
          reposts: topic.reposts ?? 0,
          comments: topic.comments ?? 0,
          views: topic.views ?? 0,
          keywordId,
          realScore: a.realScore,
          relevScore: a.relevScore,
          hotScore: a.hotScore ?? fallbackHot,
          isSpam: a.isSpam,
          reason: a.reason,
          keywordMentioned: a.keywordMentioned,
          importance: a.importance,
          subscribed: topic.subscribed ?? false,
        },
      });
      newCount++;

      // SSE 推送
      if (created.hotScore >= 50) {
        const payload = {
          type: "new-topic" as const,
          topic: {
            id: created.id,
            title: created.title,
            summary: created.summary,
            url: created.url,
            source: created.source as SourceType,
            hotScore: created.hotScore,
            realScore: created.realScore,
            publishedAt: created.publishedAt.toISOString(),
            author: created.author,
          },
        };
        sseManager.broadcast(payload);

        // 命中关键词推送（双门槛已通过）
        if (a.relevScore >= 60) {
          hitCount++;
          const kw = await prisma.keyword.findUnique({ where: { id: keywordId } });
          if (kw) {
            sseManager.broadcast({ type: "alert", keyword: kw.name, topic: payload.topic });
            await prisma.notification.create({
              data: {
                type: "browser",
                title: `[${a.importance}] ${kw.name}`,
                content: created.title,
                topicUrl: created.url,
              },
            });

            // 命中聚合通道：high/urgent 入队，5 分钟窗口合并发邮件 + 微信
            // - emailOptIn / wechatOptIn 来自关键词的 notifyEmail / notifyWechat 开关
            // - 是否真发还要全局 env 配了目标（邮箱地址 / 群机器人 webhook）
            const hasEmailTarget = !!process.env.NOTIFICATION_EMAIL;
            const hasWechatTarget = getWechatWebhookUrls().length > 0;
            const shouldNotify = a.importance === "high" || a.importance === "urgent";
            if (shouldNotify && (hasEmailTarget || hasWechatTarget)) {
              enqueueAlert(
                {
                  keyword: kw.name,
                  title: created.title,
                  summary: created.summary ?? "",
                  url: created.url,
                  source: created.source,
                  hotScore: created.hotScore,
                  relevScore: created.relevScore,
                  importance: created.importance,
                  reason: created.reason,
                  publishedAt: created.publishedAt,
                },
                {
                  emailOptIn: kw.notifyEmail,
                  wechatOptIn: kw.notifyWechat,
                },
              );
            }
          }
        }
      }
    } catch (err) {
      // URL 重复（@unique 约束）是预期的，其他错误要曝出来便于诊断
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Unique constraint")) {
        console.error("[Collect] topic.create 失败:", msg);
      }
    }
  }

  console.log(
    `[Collect] total=${deduped.length} titleDeduped=${titleDeduped.length} fresh=${fresh.length} ` +
      `analyzed=${analyses.size} new=${newCount} hit=${hitCount} ` +
      `dropped(title=${droppedByTitle}, age=${droppedByAge}, spam=${droppedBySpam}, relev=${droppedByRelev}, quota=${droppedByQuota})`
  );

  return {
    total: deduped.length,
    newCount,
    hitCount,
    results: allResults,
    analyzed: analyses.size,
    dropped: {
      title: droppedByTitle,
      age: droppedByAge,
      spam: droppedBySpam,
      relev: droppedByRelev,
      quota: droppedByQuota,
    },
  };
}
