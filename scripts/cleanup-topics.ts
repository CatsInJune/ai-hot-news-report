// 一次性清理脚本：按新阈值删除存量脏数据
// 用法：npx tsx scripts/cleanup-topics.ts [--dry]
import { prisma } from "../src/lib/prisma";

const MIN_RELEV_SCORE = 50;
const MAX_AGE_DAYS = 7;

async function main() {
  const dryRun = process.argv.includes("--dry");
  const ageLimit = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const where = {
    OR: [
      { isSpam: true },
      { publishedAt: { lt: ageLimit } },
      {
        AND: [
          { keywordId: { not: null } },
          { relevScore: { lt: MIN_RELEV_SCORE } },
        ],
      },
    ],
  };

  const total = await prisma.topic.count();
  const matchCount = await prisma.topic.count({ where });

  console.log(`存量 Topic 总数：${total}`);
  console.log(`命中清理条件：${matchCount}`);
  console.log(`  - 时效窗口：< ${ageLimit.toISOString()}（${MAX_AGE_DAYS} 天前）`);
  console.log(`  - 相关性阈值：keywordId != null 且 relevScore < ${MIN_RELEV_SCORE}`);
  console.log(`  - 垃圾标识：isSpam = true`);

  if (dryRun) {
    console.log("\n[--dry] 仅预览，未实际删除。去掉 --dry 重跑生效。");
    return;
  }

  const result = await prisma.topic.deleteMany({ where });
  console.log(`\n已删除 ${result.count} 条 Topic`);
}

main()
  .catch((err) => {
    console.error("清理失败：", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
