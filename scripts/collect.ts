// GitHub Actions runner 入口：直接在 runner 里跑 collectAll()，
// 跳过 Vercel serverless 60s 函数超时限制。
//
// 用法：tsx scripts/collect.ts
//
// 依赖 env：DATABASE_URL + DEEPSEEK_API_KEY + 其余可选 collector / 通知配置
// 与 /api/collect 的差异：进程一次性，跑完即退；要主动 flush 通知队列
// （5 分钟窗口的 setTimeout 在进程退出后不会 fire，否则邮件 / 微信会丢）。

import { collectAll } from "@/lib/collectors";
import { flushAllDigests } from "@/lib/notification-queue";
import { prisma } from "@/lib/prisma";

async function main() {
  const startedAt = Date.now();
  const result = await collectAll();
  await flushAllDigests();
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[Collect] done in ${elapsed}s`, JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error("[Collect] failed:", err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
