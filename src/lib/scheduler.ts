import cron from "node-cron";
import { prisma } from "./prisma";

// 注意：collectors 在 callback 内 dynamic import，这样 dev HMR 改了 collector
// 代码后，下一次 cron 触发拿到的是最新模块，而不是 server 启动时缓存的旧版本

let isCollecting = false;
let started = false;

export function startScheduler() {
  if (started) {
    console.log("[Scheduler] 已启动，跳过");
    return;
  }
  started = true;

  const collectionCron = process.env.COLLECTION_CRON ?? "*/30 * * * *";
  console.log(`[Scheduler] 启动定时任务: ${collectionCron}`);

  // 主定时任务：每 30 分钟采集
  cron.schedule(
    collectionCron,
    async () => {
      if (isCollecting) {
        console.log("[Scheduler] 上次采集尚未完成，跳过本次");
        return;
      }

      isCollecting = true;
      const startedAt = Date.now();
      console.log("[Scheduler] 开始定时采集 @", new Date().toISOString());

      try {
        const { collectAll } = await import("./collectors");
        const r = await collectAll();
        console.log(
          `[Scheduler] 采集完成: ${r.newCount} 条新内容, ${r.hitCount} 条命中, 耗时 ${Date.now() - startedAt}ms`
        );
      } catch (err) {
        console.error("[Scheduler] 采集出错:", err);
      } finally {
        isCollecting = false;
      }
    },
    { timezone: "Asia/Shanghai" }
  );

  // 数据清理任务：每天凌晨 2 点清理 7 天前的旧数据
  cron.schedule(
    "0 2 * * *",
    async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      try {
        const topics = await prisma.topic.deleteMany({
          where: { createdAt: { lt: cutoff } },
        });
        const notifs = await prisma.notification.deleteMany({
          where: { sentAt: { lt: cutoff } },
        });
        console.log(`[Scheduler] 清理完成: ${topics.count} 条 topic + ${notifs.count} 条 notification`);
      } catch (err) {
        console.error("[Scheduler] 清理出错:", err);
      }
    },
    { timezone: "Asia/Shanghai" }
  );

  console.log("[Scheduler] 所有定时任务已注册");
}
