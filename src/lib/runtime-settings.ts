import { prisma } from "./prisma";

const KEY_COLLECTION_ENABLED = "collection_enabled";
const KEY_LAST_COLLECTION_AT = "last_collection_at";

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

export async function getLastCollectionAt(): Promise<Date | null> {
  const row = await prisma.setting.findUnique({ where: { key: KEY_LAST_COLLECTION_AT } });
  if (!row) return null;
  const d = new Date(row.value);
  return isNaN(d.getTime()) ? null : d;
}

export async function setLastCollectionAt(date: Date): Promise<void> {
  const value = date.toISOString();
  await prisma.setting.upsert({
    where: { key: KEY_LAST_COLLECTION_AT },
    update: { value },
    create: { key: KEY_LAST_COLLECTION_AT, value },
  });
}
