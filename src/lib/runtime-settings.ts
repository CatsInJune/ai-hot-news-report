import { prisma } from "./prisma";

const KEY_COLLECTION_ENABLED = "collection_enabled";

export async function getCollectionEnabled(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_COLLECTION_ENABLED } });
  // 未设置时默认开启
  if (!row) return true;
  return row.value === "true";
}

export async function setCollectionEnabled(enabled: boolean): Promise<void> {
  const value = enabled ? "true" : "false";
  await prisma.setting.upsert({
    where: { key: KEY_COLLECTION_ENABLED },
    update: { value },
    create: { key: KEY_COLLECTION_ENABLED, value },
  });
}
