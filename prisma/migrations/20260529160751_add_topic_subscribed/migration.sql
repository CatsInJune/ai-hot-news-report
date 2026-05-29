-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Topic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceIcon" TEXT,
    "author" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "realScore" INTEGER NOT NULL DEFAULT 0,
    "relevScore" INTEGER NOT NULL DEFAULT 0,
    "hotScore" INTEGER NOT NULL DEFAULT 0,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "keywordMentioned" BOOLEAN NOT NULL DEFAULT false,
    "importance" TEXT NOT NULL DEFAULT 'medium',
    "subscribed" BOOLEAN NOT NULL DEFAULT false,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "keywordId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Topic" ("author", "comments", "createdAt", "hotScore", "id", "importance", "isSpam", "keywordId", "keywordMentioned", "likes", "publishedAt", "realScore", "reason", "relevScore", "reposts", "source", "sourceIcon", "summary", "title", "url", "views") SELECT "author", "comments", "createdAt", "hotScore", "id", "importance", "isSpam", "keywordId", "keywordMentioned", "likes", "publishedAt", "realScore", "reason", "relevScore", "reposts", "source", "sourceIcon", "summary", "title", "url", "views" FROM "Topic";
DROP TABLE "Topic";
ALTER TABLE "new_Topic" RENAME TO "Topic";
CREATE UNIQUE INDEX "Topic_url_key" ON "Topic"("url");
CREATE INDEX "Topic_source_idx" ON "Topic"("source");
CREATE INDEX "Topic_publishedAt_idx" ON "Topic"("publishedAt");
CREATE INDEX "Topic_hotScore_idx" ON "Topic"("hotScore");
CREATE INDEX "Topic_createdAt_idx" ON "Topic"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
