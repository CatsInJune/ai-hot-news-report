import nodemailer from "nodemailer";
import { SOURCE_LABELS, type SourceType } from "@/types";

/** 单条命中卡片，由 collector 推进 digest 队列 */
export interface AlertItem {
  keyword: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  hotScore: number;
  relevScore?: number;
  importance?: string; // urgent / high / medium / low
  reason?: string | null;
  publishedAt?: Date;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

/** 发送一封 digest 邮件，包含 1..N 条命中 */
export async function sendKeywordDigest(data: {
  to: string;
  items: AlertItem[];
}): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Mailer] SMTP 未配置，跳过邮件发送");
    return false;
  }
  if (data.items.length === 0) return false;

  const fromName = process.env.SMTP_FROM_NAME ?? "AI 热点速报";
  const fromUser = process.env.SMTP_USER!;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromUser}>`,
      to: data.to,
      subject: buildSubject(data.items),
      html: buildDigestHtml(data.items),
      // 默认 Date 头是 GMT，部分客户端（含 Outlook web 某些时区设置）不会转本地
      // → 强制写本地 +0800 这种带 offset 的 RFC2822，所有客户端都能正确解读
      date: formatRFC2822(new Date()),
    });
    return true;
  } catch (err) {
    console.error("[Mailer] 发送失败:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * 兼容旧入口：单条命中直接发一封"digest 含 1 条"邮件。
 * 新代码请用 enqueueAlert（see mailer-queue.ts）走批量。
 */
export async function sendKeywordAlert(data: {
  to: string;
  keyword: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  hotScore: number;
  relevScore?: number;
  importance?: string;
  reason?: string | null;
}): Promise<boolean> {
  return sendKeywordDigest({
    to: data.to,
    items: [
      {
        keyword: data.keyword,
        title: data.title,
        summary: data.summary,
        url: data.url,
        source: data.source,
        hotScore: data.hotScore,
        relevScore: data.relevScore,
        importance: data.importance,
        reason: data.reason,
      },
    ],
  });
}

export async function verifySMTP(): Promise<{ ok: boolean; error?: string }> {
  const transporter = createTransporter();
  if (!transporter) return { ok: false, error: "SMTP 未配置" };

  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ===== 内部：模板构建 =====

/** 邮件主题：含计数 + importance 统计 + 关键词列表 */
function buildSubject(items: AlertItem[]): string {
  const stats: Record<string, number> = {};
  for (const it of items) {
    const k = it.importance ?? "medium";
    stats[k] = (stats[k] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (stats.urgent) parts.push(`urgent×${stats.urgent}`);
  if (stats.high) parts.push(`high×${stats.high}`);
  const tag = parts.length > 0 ? `[${parts.join(" ")}] ` : "";

  const keywords = Array.from(new Set(items.map((i) => i.keyword)));
  const keywordStr = keywords.length <= 3
    ? keywords.join("、")
    : `${keywords.slice(0, 3).join("、")} 等 ${keywords.length} 个`;

  if (items.length === 1) {
    return `${tag}🔥 ${keywords[0]}：${truncate(items[0].title, 40)}`;
  }
  return `${tag}🔥 ${items.length} 条命中 · ${keywordStr}`;
}

/**
 * 用 table 布局拼模板，避免 Gmail/Outlook 对 flex 的支持差。
 * 整体仍是深色卡片视觉，但所有结构都是 table-row。
 */
function buildDigestHtml(items: AlertItem[]): string {
  const itemBlocks = items.map((it) => renderItem(it)).join("");
  const count = items.length;
  const keywords = Array.from(new Set(items.map((i) => i.keyword)));
  const keywordChips = keywords
    .map(
      (k) =>
        `<span style="display:inline-block;padding:2px 8px;margin:0 4px 4px 0;border-radius:999px;background:#0f3a35;color:#5eead4;font-size:11px;font-family:monospace;">${escapeHtml(k)}</span>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0a0a0f;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#111118;border-radius:12px;overflow:hidden;border:1px solid #1f1f2e;">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#00f5d4,#a855f7);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px;">
              <div style="font-family:monospace;color:#00f5d4;font-size:11px;letter-spacing:0.05em;margin-bottom:6px;">// AI 热点速报</div>
              <div style="font-size:18px;font-weight:600;color:#e2e8f0;margin:0 0 6px;">🔥 ${count} 条命中提醒</div>
              <div style="font-size:12px;color:#94a3b8;margin-bottom:14px;">
                关键词 ${keywordChips}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 8px;">
              ${itemBlocks}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #1f1f2e;">
              <div style="font-family:monospace;font-size:11px;color:#475569;">
                本邮件按 5 分钟窗口聚合，避免轰炸。<br>
                由 AI 热点速报工具自动发送。
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderItem(it: AlertItem): string {
  const importanceBadge = renderImportanceBadge(it.importance);
  const sourceLabel = SOURCE_LABELS[it.source as SourceType] ?? it.source;
  const relevChip =
    typeof it.relevScore === "number"
      ? `<span style="color:#475569;">·</span> <span style="font-family:monospace;color:#94a3b8;">rel ${it.relevScore}</span>`
      : "";
  const summaryBlock = it.summary
    ? `<div style="color:#cbd5e1;font-size:13.5px;line-height:1.65;margin:8px 0 10px;">${escapeHtml(it.summary)}</div>`
    : "";
  const reasonBlock = it.reason
    ? `<div style="margin-top:8px;padding:8px 10px;border-left:2px solid #a855f7;background:#181828;font-size:11.5px;color:#a5b4fc;line-height:1.55;">
        <span style="font-family:monospace;color:#c084fc;font-size:10px;letter-spacing:0.04em;">✦ AI · WHY</span><br>
        ${escapeHtml(it.reason)}
      </div>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;background:#161620;border-radius:10px;border-left:3px solid #00f5d4;">
    <tr>
      <td style="padding:14px 16px;">
        <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:6px;">
          <span style="color:#a855f7;">${escapeHtml(sourceLabel)}</span>
          <span style="color:#475569;">·</span>
          <span style="color:#94a3b8;">关键词 ${escapeHtml(it.keyword)}</span>
          <span style="color:#475569;">·</span>
          <span style="color:#fb923c;">hot ${it.hotScore}</span>
          ${relevChip}
          ${importanceBadge}
        </div>
        <div style="font-size:15px;font-weight:600;color:#f1f5f9;line-height:1.45;margin:0 0 4px;">
          ${escapeHtml(it.title)}
        </div>
        ${summaryBlock}
        ${reasonBlock}
        <div style="margin-top:12px;">
          <a href="${encodeAttr(it.url)}" style="display:inline-block;padding:8px 16px;background:#00f5d4;color:#0a0a0f;text-decoration:none;border-radius:6px;font-weight:600;font-size:12.5px;">
            查看原文 →
          </a>
        </div>
      </td>
    </tr>
  </table>`;
}

function renderImportanceBadge(importance?: string): string {
  if (importance !== "urgent" && importance !== "high") return "";
  const color = importance === "urgent" ? "#ef4444" : "#f59e0b";
  const bg = importance === "urgent" ? "#3b1212" : "#3a2a0d";
  return `<span style="display:inline-block;margin-left:6px;padding:1px 6px;border-radius:4px;background:${bg};color:${color};font-family:monospace;font-size:10px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">${importance}</span>`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 给 href 用，escape 引号即可（其它字符 URL 已编码过） */
function encodeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}

/**
 * 把 Date 格式化成 RFC 2822 含本地时区 offset（如 `Mon, 01 Jun 2026 00:50:22 +0800`）。
 * Outlook web、Gmail 等都依赖 offset 把时间正确转换到收件人本地时区显示。
 */
function formatRFC2822(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = days[d.getDay()];
  const date = pad(d.getDate());
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const offTotalMin = -d.getTimezoneOffset();
  const sign = offTotalMin >= 0 ? "+" : "-";
  const absOff = Math.abs(offTotalMin);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${day}, ${date} ${month} ${year} ${h}:${m}:${s} ${sign}${offH}${offM}`;
}
