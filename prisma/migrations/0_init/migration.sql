-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL DEFAULT '通用',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "notifyBrowser" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifyWechat" BOOLEAN NOT NULL DEFAULT false,
    "aliases" TEXT,
    "accounts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "rawContent" TEXT,
    "translations" TEXT,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceIcon" TEXT,
    "author" TEXT,
    "authorVerified" BOOLEAN,
    "authorFollowers" INTEGER,
    "publishedAt" TIMESTAMP(3) NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "topicUrl" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
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

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
