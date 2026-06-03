/**
 * 企业微信群机器人 webhook 推送。
 *
 * 步骤：企业微信群 → 群机器人 → 添加 → 复制 webhook URL，
 * 形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
 *
 * 限制：单 webhook 20 条/分钟（超频被限 10 min）。
 *       markdown content 上限 4096 字节，超长会被截断。
 */

import { SOURCE_LABELS, type SourceType } from "@/types";
import type { AlertItem } from "./mailer";

const MAX_BYTES = 3800; // 留点 buffer，4096 是硬上限
const MAX_LINES_DEFAULT = parseInt(
  process.env.WECHAT_DIGEST_MAX_LINES ?? "5",
);

/** 解析 env：支持单个 URL 或逗号分隔多个 */
export function getWechatWebhookUrls(): string[] {
  const raw = process.env.WECHAT_WEBHOOK_URL?.trim();
  if (!raw) return [];
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http"));
}

/** 把 webhook URL 脱敏用于显示（保留前 60 字符 + key 后 4 位） */
export function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    const key = u.searchParams.get("key") ?? "";
    const tail = key.slice(-4);
    return `${u.origin}${u.pathname}?key=***${tail}`;
  } catch {
    return "**** invalid url ****";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 发送 markdown 消息到单个 webhook，针对 45033 并发限流自动重试 */
async function postMarkdown(
  webhookUrl: string,
  content: string,
  attempt = 1,
): Promise<{ ok: boolean; error?: string }> {
  const MAX_ATTEMPTS = 3;
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: { content },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode && data.errcode !== 0) {
      // 45033 = api concurrent out of limit；指数退避重试
      if (data.errcode === 45033 && attempt < MAX_ATTEMPTS) {
        const backoff = attempt * 1500;
        console.warn(
          `[WeChat] 45033 并发限流，${backoff}ms 后重试（第 ${attempt + 1}/${MAX_ATTEMPTS} 次）`,
        );
        await sleep(backoff);
        return postMarkdown(webhookUrl, content, attempt + 1);
      }
      return { ok: false, error: `errcode=${data.errcode} ${data.errmsg ?? ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** 把 1..N 条命中发到一个或多个 webhook */
export async function sendWechatDigest(data: {
  webhookUrls: string[];
  items: AlertItem[];
}): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  if (data.items.length === 0 || data.webhookUrls.length === 0) {
    return { ok: false, sent: 0, errors: [] };
  }
  const content = buildDigestMarkdown(data.items);
  // 串行发送：企业微信 webhook 对同 IP 并发非常敏感（45033），不能 Promise.all
  const results: Array<{ ok: boolean; error?: string }> = [];
  for (let i = 0; i < data.webhookUrls.length; i++) {
    if (i > 0) await sleep(1200); // webhook 间留间隔，避免限流
    results.push(await postMarkdown(data.webhookUrls[i], content));
  }
  const sent = results.filter((r) => r.ok).length;
  const errors = results.filter((r) => !r.ok).map((r) => r.error ?? "unknown");
  if (sent > 0) {
    console.log(
      `[WeChat] digest 已发送 sent=${sent}/${data.webhookUrls.length} items=${data.items.length}`,
    );
  }
  return { ok: sent > 0, sent, errors };
}

/** 给单个 webhook 发条 ping 测试连通性 */
export async function verifyWechatWebhook(
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const content = `**🛠 AI 热点速报 · 连通测试**\n\n> ${new Date().toLocaleString()}\n> 你看到这条说明 webhook 工作正常。`;
  return postMarkdown(webhookUrl, content);
}

// ===== 模板 =====

function importanceColor(importance?: string): "warning" | "info" | "comment" {
  if (importance === "urgent") return "warning"; // 橙
  if (importance === "high") return "info"; // 绿（企业微信里偏蓝绿）
  return "comment"; // 灰
}

/**
 * 用 importance 排序，urgent 在前。
 * 截断到 MAX_LINES 条，剩余只显示数字。
 */
function buildDigestMarkdown(itemsRaw: AlertItem[]): string {
  // 按 importance 降序
  const order = (i: AlertItem) =>
    i.importance === "urgent" ? 0 : i.importance === "high" ? 1 : 2;
  const items = [...itemsRaw].sort((a, b) => order(a) - order(b));

  const stats: Record<string, number> = {};
  for (const it of items) {
    const k = it.importance ?? "medium";
    stats[k] = (stats[k] ?? 0) + 1;
  }
  const tagParts: string[] = [];
  if (stats.urgent)
    tagParts.push(`<font color="warning">URGENT×${stats.urgent}</font>`);
  if (stats.high) tagParts.push(`<font color="info">HIGH×${stats.high}</font>`);

  const keywords = Array.from(new Set(items.map((i) => i.keyword)));
  const keywordStr = keywords.map((k) => `\`${escapeMd(k)}\``).join(" ");

  const shown = items.slice(0, MAX_LINES_DEFAULT);
  const overflow = items.length - shown.length;

  const header =
    items.length === 1
      ? `**🔥 命中提醒**　${tagParts.join(" ")}`
      : `**🔥 ${items.length} 条命中提醒**　${tagParts.join(" ")}`;

  const blocks = shown.map((it) => renderItemBlock(it));
  const footer = overflow > 0 ? `\n\n> 余下 ${overflow} 条未在此展示（已写入邮件 digest / 应用首页）` : "";

  let content = `${header}\n\n关键词 ${keywordStr}\n\n---\n\n${blocks.join("\n\n---\n\n")}${footer}`;

  // 4096 字节硬上限，超就按字符截
  if (byteLen(content) > MAX_BYTES) {
    content = truncateBytes(content, MAX_BYTES - 80) + "\n\n> ⚠️ 内容超长已截断";
  }
  return content;
}

function renderItemBlock(it: AlertItem): string {
  const sourceLabel = SOURCE_LABELS[it.source as SourceType] ?? it.source;
  const color = importanceColor(it.importance);
  const importanceTag = it.importance
    ? `<font color="${color}">${it.importance.toUpperCase()}</font>`
    : "";
  const relevStr =
    typeof it.relevScore === "number" ? ` · rel ${it.relevScore}` : "";

  const meta = `${importanceTag} · ${escapeMd(sourceLabel)} · 关键词 \`${escapeMd(it.keyword)}\` · hot ${it.hotScore}${relevStr}`;
  const title = `[${escapeMd(it.title)}](${it.url})`;
  const summary = it.summary
    ? `\n> ${escapeMd(truncate(it.summary, 140))}`
    : "";
  const reason = it.reason
    ? `\n> <font color="comment">✦ AI: ${escapeMd(truncate(it.reason, 100))}</font>`
    : "";

  return `${meta}\n**${title}**${summary}${reason}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function byteLen(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function truncateBytes(s: string, maxBytes: number): string {
  if (byteLen(s) <= maxBytes) return s;
  // 二分法粗略找截断点
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (byteLen(s.slice(0, mid)) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo);
}

/** 企业微信 markdown 不支持完整 md，且部分字符会破坏渲染。基础转义。 */
function escapeMd(s: string): string {
  return s.replace(/[\\`*_[\]()<>]/g, (c) => `\\${c}`);
}
