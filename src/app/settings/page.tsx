"use client";

import { Check, X, Info, Trash2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface EnvStatus {
  openrouter: boolean;
  twitter: boolean;
  firecrawl: boolean;
  smtp: boolean;
  model: string;
  notificationEmail: string;
  collectionCron: string;
  wechat: {
    configured: boolean;
    count: number;
    masked: string[];
  };
}

interface Counts {
  topics: number;
  notifications: number;
  keywords: number;
}

interface DigestStats {
  count: number;
  ageMs: number;
  emailEligible: number;
}

type ClearScope = "topics" | "notifications" | "keywords";

export default function SettingsPage() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [digestStats, setDigestStats] = useState<DigestStats | null>(null);
  const [smtpResult, setSmtpResult] = useState<string>("");
  const [emailResult, setEmailResult] = useState<string>("");
  const [flushResult, setFlushResult] = useState<string>("");
  const [wechatResult, setWechatResult] = useState<string>("");
  const [pingResult, setPingResult] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [sendingWechat, setSendingWechat] = useState(false);
  const [pinging, setPinging] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const d = await res.json();
      setEnv(d.env);
      setCounts(d.counts ?? null);
      setDigestStats(d.digestQueue ?? null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings");
      if (!res.ok || cancelled) return;
      const d = await res.json();
      if (cancelled) return;
      setEnv(d.env);
      setCounts(d.counts ?? null);
      setDigestStats(d.digestQueue ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const testSMTP = async () => {
    setTesting(true);
    setSmtpResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-smtp" }),
      });
      const data = await res.json();
      setSmtpResult(data.ok ? "ok" : data.error ?? "failed");
    } finally {
      setTesting(false);
    }
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    setEmailResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-email" }),
      });
      const data = await res.json();
      if (data.ok) setEmailResult(`已发送到 ${data.to}`);
      else setEmailResult(`失败：${data.error ?? "unknown"}`);
    } catch (err) {
      setEmailResult(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSendingTest(false);
    }
  };

  const flushDigests = async () => {
    setFlushing(true);
    setFlushResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "flush-digests" }),
      });
      const data = await res.json();
      if (data.ok) {
        const total = (data.flushed as DigestStats | undefined)?.count ?? 0;
        setFlushResult(total > 0 ? `已立即发送 ${total} 条` : "队列为空");
        await refresh();
      } else {
        setFlushResult(`失败：${data.error ?? "unknown"}`);
      }
    } catch (err) {
      setFlushResult(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setFlushing(false);
    }
  };

  const sendTestWechat = async () => {
    setSendingWechat(true);
    setWechatResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-wechat" }),
      });
      const data = await res.json();
      if (data.ok) {
        setWechatResult(`已发送到 ${data.sent}/${data.total} 个 webhook`);
      } else {
        const errMsg = data.errors?.length ? data.errors.join(" | ") : data.error ?? "unknown";
        setWechatResult(`失败：${errMsg}`);
      }
    } catch (err) {
      setWechatResult(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSendingWechat(false);
    }
  };

  const pingWechat = async () => {
    setPinging(true);
    setPingResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping-wechat" }),
      });
      const data = await res.json();
      if (data.ok) setPingResult("全部连通");
      else {
        const fail = (data.results as Array<{ ok: boolean; error?: string }> | undefined)
          ?.filter((r) => !r.ok)
          .map((r) => r.error ?? "unknown")
          .join(" | ");
        setPingResult(`失败：${fail || data.error || "unknown"}`);
      }
    } catch (err) {
      setPingResult(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 pt-10 pb-8">
      <motion.header
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight leading-tight">
          系统设置
        </h1>
        <p className="mt-2 text-[14px] text-text-secondary leading-relaxed flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-1 shrink-0 text-text-muted" />
          所有 API Key 通过项目根目录的{" "}
          <code className="text-text-primary px-1 rounded bg-bg-elevated">
            .env
          </code>{" "}
          配置，修改后需重启服务。
        </p>
      </motion.header>

      <Section title="API Keys" subtitle="数据采集与 AI 分析所需密钥">
        <Row
          label="OpenRouter"
          envVar="OPENROUTER_API_KEY"
          configured={env?.openrouter ?? false}
          required
          hint="AI 内容分析必需"
        />
        <Row
          label="Twitter"
          envVar="TWITTER_API_KEY"
          configured={env?.twitter ?? false}
          hint="twitterapi.io · 未配置时跳过 Twitter 源"
        />
        <Row
          label="Firecrawl"
          envVar="FIRECRAWL_API_KEY"
          configured={env?.firecrawl ?? false}
          hint="正文抓取 · Bing/Google/HN/Sogou 卡片"
        />
      </Section>

      <Section title="邮件推送" subtitle="关键词命中时发邮件提醒">
        <Row
          label="SMTP 服务"
          envVar="SMTP_HOST + SMTP_USER + SMTP_PASS"
          configured={env?.smtp ?? false}
          hint="未配置时不发送邮件，仅浏览器推送"
        />
        <Row
          label="收件邮箱"
          envVar="NOTIFICATION_EMAIL"
          configured={!!env?.notificationEmail}
          value={env?.notificationEmail}
        />
        {env?.smtp && (
          <div className="px-5 py-3 bg-bg-surface/40 border-t border-border-default flex items-center flex-wrap gap-3">
            <button
              onClick={testSMTP}
              disabled={testing}
              className="h-8 px-3 rounded-md border border-border-strong hover:border-accent/40 hover:text-accent-bright text-[12.5px] font-medium text-text-secondary transition-colors disabled:opacity-50"
            >
              {testing ? "测试中…" : "测试 SMTP 连接"}
            </button>
            <button
              onClick={sendTestEmail}
              disabled={sendingTest || !env.notificationEmail}
              title={!env.notificationEmail ? "需先配置 NOTIFICATION_EMAIL" : "发送一封含 2 条样例命中的 digest 邮件"}
              className="h-8 px-3 rounded-md border border-accent/30 text-accent-bright hover:bg-accent-soft text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingTest ? "发送中…" : "发送测试邮件"}
            </button>
            {smtpResult && (
              <span
                className={`text-[12.5px] font-medium ${
                  smtpResult === "ok" ? "text-accent-bright" : "text-danger"
                }`}
              >
                {smtpResult === "ok" ? "连接正常" : `失败：${smtpResult}`}
              </span>
            )}
            {emailResult && (
              <span
                className={`text-[12.5px] font-medium ${
                  emailResult.startsWith("失败") ? "text-danger" : "text-accent-bright"
                }`}
              >
                {emailResult}
              </span>
            )}
          </div>
        )}
      </Section>

      <Section title="微信推送" subtitle="企业微信群机器人 webhook，关键词命中时合并发卡片">
        <Row
          label="企业微信 Webhook"
          envVar="WECHAT_WEBHOOK_URL"
          configured={env?.wechat.configured ?? false}
          hint={
            env?.wechat.configured
              ? `已配置 ${env.wechat.count} 个 webhook · 多个用逗号分隔`
              : "群设置 → 群机器人 → 添加 → 复制 webhook URL 填入 .env"
          }
          value={env?.wechat.masked?.[0]}
        />
        {env?.wechat.configured && env.wechat.count > 1 && (
          <div className="px-5 py-2 text-[11.5px] mono text-text-muted">
            其他 webhook：
            <ul className="mt-1 space-y-0.5">
              {env.wechat.masked.slice(1).map((m) => (
                <li key={m} className="truncate text-accent-bright">{m}</li>
              ))}
            </ul>
          </div>
        )}
        {env?.wechat.configured && (
          <div className="px-5 py-3 bg-bg-surface/40 border-t border-border-default flex items-center flex-wrap gap-3">
            <button
              onClick={pingWechat}
              disabled={pinging}
              className="h-8 px-3 rounded-md border border-border-strong hover:border-accent/40 hover:text-accent-bright text-[12.5px] font-medium text-text-secondary transition-colors disabled:opacity-50"
            >
              {pinging ? "测试中…" : "Ping Webhook"}
            </button>
            <button
              onClick={sendTestWechat}
              disabled={sendingWechat}
              title="发送一条含 2 条样例命中的 digest 到企业微信群"
              className="h-8 px-3 rounded-md border border-accent/30 text-accent-bright hover:bg-accent-soft text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingWechat ? "发送中…" : "发送测试消息"}
            </button>
            {pingResult && (
              <span
                className={`text-[12.5px] font-medium ${
                  pingResult.startsWith("失败") ? "text-danger" : "text-accent-bright"
                }`}
              >
                {pingResult}
              </span>
            )}
            {wechatResult && (
              <span
                className={`text-[12.5px] font-medium ${
                  wechatResult.startsWith("失败") ? "text-danger" : "text-accent-bright"
                }`}
              >
                {wechatResult}
              </span>
            )}
          </div>
        )}
      </Section>

      <Section
        title="通知批量队列"
        subtitle="命中按 5 分钟窗口聚合，同步发到邮件 + 微信，避免轰炸"
      >
        <div className="px-5 py-3 flex items-center justify-between gap-4 text-[12.5px]">
          <div className="min-w-0 flex-1">
            {!digestStats || digestStats.count === 0 ? (
              <div className="text-text-muted">
                当前队列为空——下次命中 high/urgent 关键词时会自动入队
              </div>
            ) : (
              <>
                <div className="font-medium text-text-primary">
                  累积 {digestStats.count} 条
                </div>
                <div className="mono text-text-muted text-[11.5px] mt-0.5">
                  窗口已开 {Math.floor(digestStats.ageMs / 1000)}s · 邮件 eligible {digestStats.emailEligible}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="px-5 py-3 bg-bg-surface/40 border-t border-border-default flex items-center flex-wrap gap-3">
          <button
            onClick={flushDigests}
            disabled={flushing}
            className="h-8 px-3 rounded-md border border-border-strong hover:border-accent/40 hover:text-accent-bright text-[12.5px] font-medium text-text-secondary transition-colors disabled:opacity-50"
          >
            {flushing ? "发送中…" : "立即发送队列"}
          </button>
          {flushResult && (
            <span
              className={`text-[12.5px] font-medium ${
                flushResult.startsWith("失败") ? "text-danger" : "text-accent-bright"
              }`}
            >
              {flushResult}
            </span>
          )}
        </div>
      </Section>

      <Section title="运行时配置">
        <InfoRow label="AI 模型" value={env?.model ?? "—"} />
        <InfoRow label="采集频率" value={env?.collectionCron ?? "—"} />
      </Section>

      <DangerZone counts={counts} onCleared={refresh} />

      <Section title=".env 示例" subtitle="复制到项目根目录的 .env 文件中">
        <pre className="text-[12px] mono text-text-secondary bg-bg-elevated/60 p-4 leading-relaxed overflow-x-auto">{`OPENROUTER_API_KEY="sk-or-v1-xxx"
OPENROUTER_MODEL="deepseek/deepseek-chat-v3.1"

TWITTER_API_KEY="xxx"
FIRECRAWL_API_KEY="fc-xxx"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
NOTIFICATION_EMAIL="receiver@example.com"

# 企业微信群机器人 webhook，多个用逗号分隔
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
# 单封 digest 最多列几条（多余只显示数量）
WECHAT_DIGEST_MAX_LINES="5"

# 通知防轰炸：N 毫秒窗口聚合一封 digest；条数达 MAX 立即发
EMAIL_DIGEST_WINDOW_MS="300000"
EMAIL_DIGEST_MAX_ITEMS="20"

COLLECTION_CRON="*/30 * * * *"`}</pre>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 card overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border-default">
        <h2 className="text-[14px] font-semibold text-text-primary">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-text-muted">{subtitle}</p>
        )}
      </div>
      <div className="divide-y divide-border-default">{children}</div>
    </motion.section>
  );
}

function Row({
  label,
  envVar,
  configured,
  hint,
  value,
  required,
}: {
  label: string;
  envVar: string;
  configured: boolean;
  hint?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-text-primary">
            {label}
          </span>
          {required && (
            <span className="px-1 h-4 rounded text-[10px] font-medium bg-danger/12 text-danger border border-danger/25 flex items-center">
              必填
            </span>
          )}
        </div>
        <code className="block text-[11.5px] mono text-text-muted mt-0.5 truncate">
          {envVar}
        </code>
        {hint && (
          <p className="text-[12px] text-text-secondary mt-1">{hint}</p>
        )}
        {value && (
          <p className="text-[12px] mono text-accent-bright mt-1 truncate">
            {value}
          </p>
        )}
      </div>
      <Pill ok={configured} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-4">
      <span className="text-[13.5px] text-text-secondary">{label}</span>
      <code className="text-[12.5px] mono text-accent-bright bg-accent-soft px-2 py-0.5 rounded">
        {value}
      </code>
    </div>
  );
}

function Pill({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium bg-accent-soft border border-accent/25 text-accent-bright">
      <Check className="w-3 h-3" strokeWidth={2.5} />
      已配置
    </span>
  ) : (
    <span className="flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium border border-border-strong text-text-muted">
      <X className="w-3 h-3" />
      未配置
    </span>
  );
}

function DangerZone({
  counts,
  onCleared,
}: {
  counts: Counts | null;
  onCleared: () => void;
}) {
  const [scope, setScope] = useState<Set<ClearScope>>(
    new Set(["topics", "notifications"]),
  );
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState<string>("");

  const toggle = (k: ClearScope) => {
    setScope((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
    setResult("");
  };

  const totalToDelete = (() => {
    if (!counts) return 0;
    let n = 0;
    if (scope.has("topics")) n += counts.topics;
    if (scope.has("notifications")) n += counts.notifications;
    if (scope.has("keywords")) n += counts.keywords;
    return n;
  })();

  const handleClear = async () => {
    if (scope.size === 0) return;
    setClearing(true);
    setResult("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clear-data",
          scope: Array.from(scope),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const parts: string[] = [];
        if (typeof data.cleared?.topics === "number")
          parts.push(`${data.cleared.topics} 条话题`);
        if (typeof data.cleared?.notifications === "number")
          parts.push(`${data.cleared.notifications} 条通知`);
        if (typeof data.cleared?.keywords === "number")
          parts.push(`${data.cleared.keywords} 个关键词`);
        setResult(`已清空：${parts.join(" / ") || "无"}`);
        onCleared();
        // 通知其他常驻组件（TopBar / Feed 等）立即拉取最新数据
        window.dispatchEvent(new CustomEvent("app:data-changed"));
      } else {
        setResult(`失败：${data.error ?? "unknown"}`);
      }
    } catch (err) {
      setResult(`失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 card overflow-hidden border-danger/30"
      style={{ borderColor: "color-mix(in oklab, var(--danger) 25%, transparent)" }}
    >
      <div className="px-5 py-3 border-b border-border-default bg-danger/5">
        <h2 className="text-[14px] font-semibold text-danger flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          危险操作
        </h2>
        <p className="mt-0.5 text-[12px] text-text-muted">
          清空后不可恢复。建议在测试或重置阶段使用。
        </p>
      </div>

      <div className="divide-y divide-border-default">
        <ScopeRow
          label="话题数据"
          desc="所有采集到的 Topic 记录"
          count={counts?.topics ?? 0}
          checked={scope.has("topics")}
          onToggle={() => toggle("topics")}
        />
        <ScopeRow
          label="通知记录"
          desc="所有 Notification 记录（不影响关键词配置）"
          count={counts?.notifications ?? 0}
          checked={scope.has("notifications")}
          onToggle={() => toggle("notifications")}
        />
        <ScopeRow
          label="关键词配置"
          desc="所有 Keyword 记录（删除后采集器将无关键词可监控）"
          count={counts?.keywords ?? 0}
          checked={scope.has("keywords")}
          onToggle={() => toggle("keywords")}
          danger
        />
      </div>

      <div className="px-5 py-3 bg-bg-surface/40 border-t border-border-default flex items-center gap-3 flex-wrap">
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={scope.size === 0 || clearing}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-md text-[12.5px] font-medium transition-colors",
              "border border-danger/30 text-danger hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空所选
          </button>
        ) : (
          <>
            <span className="text-[12.5px] text-text-secondary">
              将删除约 <strong className="text-danger mono">{totalToDelete}</strong>{" "}
              条记录，确定？
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="h-8 px-3 rounded-md text-[12.5px] font-medium bg-danger text-bg-primary hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {clearing ? "清空中…" : "确认清空"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={clearing}
              className="h-8 px-3 rounded-md text-[12.5px] font-medium border border-border-strong text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </>
        )}
        {result && (
          <span
            className={cn(
              "text-[12.5px] font-medium",
              result.startsWith("失败")
                ? "text-danger"
                : "text-accent-bright",
            )}
          >
            {result}
          </span>
        )}
      </div>
    </motion.section>
  );
}

function ScopeRow({
  label,
  desc,
  count,
  checked,
  onToggle,
  danger,
}: {
  label: string;
  desc: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  return (
    <label className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-bg-hover/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium text-text-primary">
            {label}
          </span>
          {danger && (
            <span className="px-1 h-4 rounded text-[10px] font-medium bg-danger/12 text-danger border border-danger/25 flex items-center">
              谨慎
            </span>
          )}
        </div>
        <p className="text-[12px] text-text-secondary mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[12.5px] mono tabular-nums text-text-muted">
          {count}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 accent-danger"
        />
      </div>
    </label>
  );
}
