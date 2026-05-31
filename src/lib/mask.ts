/**
 * 敏感字段脱敏工具。所有面向前端的 API 响应都应在序列化前过一遍，
 * 避免邮箱、token 等原始值流到浏览器/截图/日志。
 */

/** 邮箱本地名脱敏：保留首字符，3+ 字符再露尾字符。`receiver@x.com` → `r***r@x.com` */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length <= 2) return `***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
