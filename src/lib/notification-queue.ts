/**
 * 通知聚合队列：N 分钟窗口内累积命中，到点合并发送给所有已配置 channel
 * （邮件 + 企业微信群机器人）。
 *
 * 触发 flush 的条件（任一满足）：
 *   1. 距离窗口开启已过 DIGEST_WINDOW_MS（默认 5 分钟）
 *   2. 队列累积条目数达到 DIGEST_MAX_ITEMS（默认 20）
 *
 * 单 Node 进程内存队列。进程崩溃会丢未发条目——对当前规模可接受。
 *
 * 每条 AlertItem 自带 channel opt-in 信息（perKw 标志）。flush 时按 channel
 * 各自过滤，例如某关键词关了邮件，它的 item 不会进邮件 digest，但仍会进微信
 * （企业微信通道是全局开关，没有 per-keyword 配置）。
 */

import { prisma } from "@/lib/prisma";
import { sendKeywordDigest, type AlertItem } from "./mailer";
import { sendWechatDigest, getWechatWebhookUrls } from "./wechat";

const DIGEST_WINDOW_MS = parseInt(
  process.env.EMAIL_DIGEST_WINDOW_MS ?? String(5 * 60 * 1000),
);
const DIGEST_MAX_ITEMS = parseInt(process.env.EMAIL_DIGEST_MAX_ITEMS ?? "20");

interface QueuedItem {
  item: AlertItem;
  // 每个 channel 的 opt-in。来自关键词配置 / 全局 env，enqueue 时计算好
  emailOptIn: boolean;
  wechatOptIn: boolean;
}

interface QueueState {
  items: QueuedItem[];
  timer: ReturnType<typeof setTimeout> | null;
  windowStart: number;
}

// 全局单桶：当前模型里收件人就是操作者本人，分桶意义不大
const state: QueueState = { items: [], timer: null, windowStart: 0 };

async function flush(): Promise<void> {
  if (state.items.length === 0) return;
  const drained = state.items.splice(0, state.items.length);
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  state.windowStart = 0;

  // ---- 邮件通道 ----
  const emailTo = process.env.NOTIFICATION_EMAIL?.trim();
  const emailItems = drained.filter((q) => q.emailOptIn).map((q) => q.item);
  const emailSent =
    emailTo && emailItems.length > 0
      ? await sendKeywordDigest({ to: emailTo, items: emailItems })
      : false;

  // ---- 企业微信通道 ----
  const wechatUrls = getWechatWebhookUrls();
  const wechatItems = drained.filter((q) => q.wechatOptIn).map((q) => q.item);
  const wechatResult =
    wechatUrls.length > 0 && wechatItems.length > 0
      ? await sendWechatDigest({ webhookUrls: wechatUrls, items: wechatItems })
      : null;

  // ---- 落 Notification 记录便于历史回溯 ----
  const channels: string[] = [];
  if (emailSent) channels.push(`email×${emailItems.length}`);
  if (wechatResult?.ok) channels.push(`wechat×${wechatResult.sent}`);
  if (channels.length > 0) {
    const firstTitle = drained[0]?.item.title.slice(0, 80) ?? "";
    const moreSuffix =
      drained.length > 1
        ? ` 等 ${drained.length} 条`
        : "";
    try {
      await prisma.notification.create({
        data: {
          type: channels.length > 1 ? "multi" : channels[0].split("×")[0],
          title: `digest[${channels.join(",")}]`,
          content: `${firstTitle}${moreSuffix}`,
          topicUrl: drained[0]?.item.url ?? null,
        },
      });
    } catch (err) {
      console.warn(
        "[NotificationQueue] 通知记录写入失败:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  if (wechatResult && !wechatResult.ok) {
    console.warn(
      "[NotificationQueue] 微信通道全部失败:",
      wechatResult.errors.join(" | "),
    );
  }
}

/**
 * 把一条命中推进队列。emailOptIn / wechatOptIn 来自关键词的 notifyEmail / notifyWechat
 * 配置；最终是否真发还要看全局 env（NOTIFICATION_EMAIL / WECHAT_WEBHOOK_URL）是否配了目标。
 */
export function enqueueAlert(
  item: AlertItem,
  opts: { emailOptIn: boolean; wechatOptIn: boolean },
): void {
  state.items.push({
    item,
    emailOptIn: opts.emailOptIn,
    wechatOptIn: opts.wechatOptIn,
  });

  // 达上限立刻 flush（防单封超长）
  if (state.items.length >= DIGEST_MAX_ITEMS) {
    void flush();
    return;
  }

  // 窗口已开就只追加
  if (state.timer) return;

  state.windowStart = Date.now();
  state.timer = setTimeout(() => {
    void flush();
  }, DIGEST_WINDOW_MS);
  if (state.timer && typeof state.timer === "object" && "unref" in state.timer) {
    (state.timer as NodeJS.Timeout).unref();
  }
}

/** 主动 flush（手动促发 / SIGTERM 兜底） */
export async function flushAllDigests(): Promise<void> {
  await flush();
}

/** 队列快照，供 settings 页面展示 */
export function getQueueStats(): {
  count: number;
  ageMs: number;
  emailEligible: number;
  wechatEligible: number;
} {
  const now = Date.now();
  return {
    count: state.items.length,
    ageMs: state.windowStart ? now - state.windowStart : 0,
    emailEligible: state.items.filter((q) => q.emailOptIn).length,
    wechatEligible: state.items.filter((q) => q.wechatOptIn).length,
  };
}
