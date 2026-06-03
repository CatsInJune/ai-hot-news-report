// Next.js 在 server 启动时自动调用 register()
// 仅在长进程环境（本地 dev / 自建部署）启用 node-cron；
// Vercel serverless 跳过——生产环境定时采集由 GitHub Actions
// (.github/workflows/collect.yml) 直接调用 `npm run collect` 完成。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.VERCEL === "1") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
