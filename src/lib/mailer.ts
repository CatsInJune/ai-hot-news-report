import nodemailer from "nodemailer";

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

export async function sendKeywordAlert(data: {
  to: string;
  keyword: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  hotScore: number;
}): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn("[Mailer] SMTP 未配置，跳过邮件发送");
    return false;
  }

  const fromName = process.env.SMTP_FROM_NAME ?? "AI热点速报工具";
  const fromUser = process.env.SMTP_USER!;

  try {
    await transporter.sendMail({
      from: `"${fromName}" <${fromUser}>`,
      to: data.to,
      subject: `🔥 关键词命中：${data.keyword}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, sans-serif; background: #0a0a0f; padding: 20px; color: #e2e8f0;">
          <div style="max-width: 600px; margin: 0 auto; background: #111118; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #00f5d4, #a855f7); height: 4px;"></div>
            <div style="padding: 24px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span style="color: #00f5d4; font-size: 12px; font-family: monospace;">// AI热点速报</span>
              </div>
              <h2 style="margin: 0 0 12px; color: #00f5d4;">🔥 关键词命中提醒</h2>
              <p style="color: #94a3b8; margin: 0 0 16px;">
                关键词 <strong style="color: #00f5d4;">${escapeHtml(data.keyword)}</strong> 出现了新内容
              </p>
              <div style="background: #161620; padding: 16px; border-radius: 8px; border-left: 4px solid #00f5d4; margin-bottom: 20px;">
                <h3 style="color: #e2e8f0; margin: 0 0 8px; font-size: 16px;">${escapeHtml(data.title)}</h3>
                <p style="color: #94a3b8; margin: 0 0 12px; font-size: 14px; line-height: 1.6;">
                  ${escapeHtml(data.summary)}
                </p>
                <div style="display: flex; gap: 12px; font-size: 12px; color: #64748b; font-family: monospace;">
                  <span>来源: <span style="color: #a855f7;">${escapeHtml(data.source)}</span></span>
                  <span>·</span>
                  <span>热度: <span style="color: #00f5d4;">${data.hotScore}/100</span></span>
                </div>
              </div>
              <a href="${data.url}"
                 style="display: inline-block; padding: 10px 24px; background: linear-gradient(90deg, #00f5d4, #a855f7); color: #0a0a0f; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
                查看原文 →
              </a>
              <p style="color: #64748b; font-size: 11px; margin: 24px 0 0; font-family: monospace;">
                此邮件由 AI热点速报工具 自动发送
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    return true;
  } catch (err) {
    console.error("[Mailer] 发送失败:", err instanceof Error ? err.message : err);
    return false;
  }
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
