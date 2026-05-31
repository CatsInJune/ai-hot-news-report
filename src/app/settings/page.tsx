"use client";

import { Check, X, Info } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

interface EnvStatus {
  openrouter: boolean;
  twitter: boolean;
  firecrawl: boolean;
  smtp: boolean;
  model: string;
  notificationEmail: string;            // 已脱敏，如 r***r@example.com
  notificationEmailConfigured: boolean; // 真正的"是否已配置"判断
  collectionCron: string;
  wechat: {
    configured: boolean;
    count: number;
    masked: string[];
  };
}

export default function SettingsPage() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [smtpResult, setSmtpResult] = useState<string>("");
  const [emailResult, setEmailResult] = useState<string>("");
  const [wechatResult, setWechatResult] = useState<string>("");
  const [pingResult, setPingResult] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingWechat, setSendingWechat] = useState(false);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings");
      if (!res.ok || cancelled) return;
      const d = await res.json();
      if (cancelled) return;
      setEnv(d.env);
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
          configured={env?.notificationEmailConfigured ?? false}
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
              disabled={sendingTest || !env.notificationEmailConfigured}
              title={!env.notificationEmailConfigured ? "需先配置 NOTIFICATION_EMAIL" : "发送一封含 2 条样例命中的 digest 邮件"}
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

      <Section title="运行时配置">
        <InfoRow label="AI 模型" value={env?.model ?? "—"} />
        <InfoRow label="采集频率" value={env?.collectionCron ?? "—"} />
      </Section>

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

