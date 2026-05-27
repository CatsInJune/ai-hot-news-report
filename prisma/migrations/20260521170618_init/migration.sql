-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '通用',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notifyBrowser" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Topic" (
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
    "likes" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "keywordId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Topic_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Topic_url_key" ON "Topic"("url");

-- CreateIndex
CREATE INDEX "Topic_source_idx" ON "Topic"("source");

-- CreateIndex
CREATE INDEX "Topic_publishedAt_idx" ON "Topic"("publishedAt");

-- CreateIndex
CREATE INDEX "Topic_hotScore_idx" ON "Topic"("hotScore");

-- CreateIndex
CREATE INDEX "Topic_createdAt_idx" ON "Topic"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_sentAt_idx" ON "Notification"("sentAt");
