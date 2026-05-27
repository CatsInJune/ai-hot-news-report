"use client";

import { Settings, Check, X, Sparkles, MessageSquare, Globe, Mail, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface EnvStatus {
  openrouter: boolean;
  twitter: boolean;
  firecrawl: boolean;
  smtp: boolean;
  model: string;
  notificationEmail: string;
  collectionCron: string;
}

export default function SettingsPage() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [smtpResult, setSmtpResult] = useState<string>("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setEnv(d.env));
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
      setSmtpResult(data.ok ? "✓ SMTP 连接正常" : `✗ ${data.error}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Settings className="w-7 h-7 text-neon-amber" />
          <h1 className="text-2xl font-bold gradient-text">系统设置</h1>
        </div>
        <p className="text-sm text-text-muted font-mono">
          // 配置说明：所有 API Key 通过项目根目录的 .env 文件配置，修改后需要重启服务
        </p>
      </motion.div>

      {/* API Keys 状态 */}
      <Section title="API Keys 配置状态" icon={Sparkles}>
        <StatusRow
          icon={Sparkles}
          label="OpenRouter (AI 分析)"
          configured={env?.openrouter ?? false}
          envVar="OPENROUTER_API_KEY"
          required
        />
        <StatusRow
          icon={MessageSquare}
          label="Twitter (twitterapi.io)"
          configured={env?.twitter ?? false}
          envVar="TWITTER_API_KEY"
          hint="未配置时跳过 Twitter 采集源"
        />
        <StatusRow
          icon={Globe}
          label="Firecrawl (网页深度抓取)"
          configured={env?.firecrawl ?? false}
          envVar="FIRECRAWL_API_KEY"
          hint="可选，用于增强爬取能力"
        />
      </Section>

      {/* 邮件 */}
      <Section title="邮件推送" icon={Mail}>
        <StatusRow
          icon={Mail}
          label="SMTP 服务"
          configured={env?.smtp ?? false}
          envVar="SMTP_HOST + SMTP_USER + SMTP_PASS"
          hint="配置后可发送关键词命中邮件"
        />
        <StatusRow
          icon={Mail}
          label="接收通知邮箱"
          configured={!!env?.notificationEmail}
          envVar="NOTIFICATION_EMAIL"
          value={env?.notificationEmail}
        />

        {env?.smtp && (
          <div className="mt-4 pt-4 border-t border-border-default">
            <button
              onClick={testSMTP}
              disabled={testing}
              className="px-4 py-2 rounded-lg bg-bg-elevated border border-border-default hover:border-neon-amber/50 text-sm transition-all disabled:opacity-50"
            >
              {testing ? "测试中..." : "测试 SMTP 连接"}
            </button>
            {smtpResult && (
              <span
                className={`ml-3 text-sm font-mono ${
                  smtpResult.startsWith("✓") ? "text-neon-green" : "text-neon-red"
                }`}
              >
                {smtpResult}
              </span>
            )}
          </div>
        )}
      </Section>

      {/* 系统配置 */}
      <Section title="系统配置" icon={Clock}>
        <ConfigRow label="AI 模型" value={env?.model ?? "-"} />
        <ConfigRow label="采集频率 (cron)" value={env?.collectionCron ?? "-"} />
      </Section>

      {/* 帮助 */}
      <Section title="配置说明">
        <pre className="text-xs font-mono text-text-secondary bg-bg-elevated p-4 rounded-lg overflow-x-auto leading-relaxed">{`# 编辑项目根目录的 .env 文件

# 必填：AI 分析能力
OPENROUTER_API_KEY="sk-or-v1-xxx"
OPENROUTER_MODEL="google/gemini-2.5-flash"

# 可选：Twitter / Firecrawl
TWITTER_API_KEY="xxx"
FIRECRAWL_API_KEY="fc-xxx"

# 可选：邮件推送
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your@gmail.com"
SMTP_PASS="your-app-password"
NOTIFICATION_EMAIL="receiver@example.com"

# 采集频率 (默认 30 分钟)
COLLECTION_CRON="*/30 * * * *"`}</pre>
        <p className="text-xs text-text-muted font-mono mt-3">
          修改 <code className="text-neon-cyan">.env</code> 文件后请重启服务: <code className="text-neon-amber">npm run dev</code>
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-bg-surface border border-border-default rounded-xl p-5"
    >
      <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2 uppercase tracking-wider font-mono">
        {Icon && <Icon className="w-4 h-4 text-neon-amber" />}
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </motion.div>
  );
}

function StatusRow({
  icon: Icon,
  label,
  configured,
  envVar,
  hint,
  value,
  required,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  configured: boolean;
  envVar: string;
  hint?: string;
  value?: string;
  required?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text-primary">{label}</span>
            {required && (
              <span className="text-[10px] text-neon-red font-mono">必填</span>
            )}
          </div>
          <code className="text-[11px] text-text-muted font-mono">{envVar}</code>
          {hint && <p className="text-xs text-text-muted mt-1">{hint}</p>}
          {value && (
            <p className="text-xs text-neon-cyan font-mono mt-1 truncate">{value}</p>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {configured ? (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-neon-green/15 text-neon-green">
            <Check className="w-3 h-3" />
            已配置
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-bg-hover text-text-muted">
            <X className="w-3 h-3" />
            未配置
          </span>
        )}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <code className="text-sm font-mono text-neon-cyan">{value}</code>
    </div>
  );
}
