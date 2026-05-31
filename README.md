# AI 热点速报工具

围绕**关键词**做精准全网追踪：12 个信源全天候扫描，AI 自动过滤噪声，命中即推送邮件 + 企业微信。

不做"领域热点 Feed"，只做"我关心的人/事在哪儿被提到了"。

## 核心能力

- 🔍 **关键词追踪**：AI 自动扩展同义词、handle、缩写等变体，覆盖中英文表达
- 👤 **账号订阅**：识别关键词背后的人，直接拉取其 Twitter / B 站 timeline，绕过搜索词
- 📡 **12 信源并行**：Twitter / HN / Reddit / arXiv / Bing / Google / 百度 / 搜狗 / 微博 / B站 / AI 官博 / AI 中文媒体
- 🧠 **AI 双重打分**：相关性 + 重要性两维度评分，自动判定 spam，high/urgent 才推送
- 📄 **正文抓取**：Firecrawl + LLM 清洗，从原网页抽真实正文，剔除导航/广告/评论
- 🌐 **一键翻译**：原文支持简/繁/英/日/韩 5 语切换，结果按目标语言缓存
- 🔔 **聚合通知**：5 分钟窗口合并 digest，同时发邮件 + 企业微信，避免轰炸
- ⚡ **实时推流**：SSE 命中即弹窗，浏览器/手机同步亮起

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 16 · React 19 · Tailwind v4 |
| 数据 | Prisma 7 + SQLite (better-sqlite3 adapter) |
| AI | DeepSeek 直连（v3 $0.07/$0.27 per 1M），OpenRouter 作为备用 |
| 抓取 | Firecrawl + rss-parser + cheerio |
| 实时 | Next.js ReadableStream + 全局 SSE 单例 |
| 调度 | node-cron + instrumentation.ts |
| 通知 | nodemailer · 企业微信群机器人 webhook |
| 测试 | vitest |

## 快速开始

### 1. 安装

```bash
git clone https://github.com/CatsInJune/ai-hot-news-report.git
cd ai-hot-news-report
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，按需填入：

```bash
cp .env.example .env
```

**最小可用配置**（只需一个 AI key 即可启动）：

```bash
# AI 分析（必填二选一，推荐 DeepSeek 直连）
DEEPSEEK_API_KEY="sk-xxx"

# 数据库
DATABASE_URL="file:./dev.db"
```

**完整功能**还需要：

```bash
# Twitter 采集（twitterapi.io）
TWITTER_API_KEY="xxx"

# 正文抓取（不配则只用 RSS snippet）
FIRECRAWL_API_KEY="fc-xxx"

# 邮件通知（SMTP）
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="xxx@qq.com"
SMTP_PASS="授权码"
NOTIFICATION_EMAIL="收件邮箱"

# 企业微信群机器人（推荐！5 分钟接入）
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
```

### 3. 初始化数据库

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. 启动

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

### 5. 添加关键词

进入 `/keywords` 页面 → 新建关键词 → AI 会自动扩展变体并检测关联账号。

手动触发一次采集（默认每 30 分钟自动跑一次）：

```bash
curl -X POST http://localhost:3000/api/collect
```

## 通知配置

### 邮件 SMTP

设置页 → **邮件推送** → 测试 SMTP 连接 / 发送测试邮件。

QQ 邮箱配置示例：

```
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="你的QQ邮箱@qq.com"
SMTP_PASS="在QQ邮箱设置→账户里生成的授权码（16位）"
```

### 企业微信群机器人（推荐）

1. 下载企业微信 app（个人也能注册，**完全免费、无需营业执照**）
2. 创建一个内部群（自己一人也行）→ 群设置 → 群机器人 → 添加 → 复制 webhook URL
3. 填入 `.env`：
   ```
   WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
   ```
   多个群用逗号分隔，会同时推送
4. 重启 dev server，设置页 → **微信推送** → Ping Webhook 验证

想让通知同步到**手机微信**：企业微信 → 我 → 关注的企业 → 绑定个人微信。

## 项目结构

```
src/
├── app/
│   ├── api/             # API 路由
│   │   ├── collect/         # 触发采集
│   │   ├── keywords/        # 关键词 CRUD + AI 扩展
│   │   ├── notifications/   # 通知列表
│   │   ├── settings/        # 系统设置 + 测试入口
│   │   ├── sse/             # 实时推流
│   │   └── topics/          # 话题列表 + 翻译 + 按需补抓
│   ├── keywords/        # 关键词管理页
│   ├── notifications/   # 通知历史页
│   ├── settings/        # 系统设置页
│   └── page.tsx         # 实时 Feed 主页
├── components/
│   ├── feed/            # TopicCard / TopicFeed / 筛选下拉
│   ├── keywords/        # 关键词卡片 / 表单
│   ├── layout/          # TopBar / SearchBox
│   └── ui/              # 通用组件
└── lib/
    ├── collectors/      # 12 个信源采集器 + 共享工具
    ├── analyzer.ts      # AI 双重评分
    ├── extract-content.ts  # Firecrawl + LLM 正文抽取
    ├── translator.ts    # 多语言翻译
    ├── mailer.ts        # 邮件 digest 模板
    ├── wechat.ts        # 企业微信 markdown digest
    ├── notification-queue.ts  # 5min 窗口聚合，多 channel 同步推
    ├── scheduler.ts     # cron 定时调度
    └── sse-manager.ts   # SSE 全局单例
```

## 关键设计

### 双门槛 + 配额机制

```
relevScore < 50           → 直接丢
!keywordMentioned && relevScore < 65  → 丢（字面没命中又不够相关）
subscribed=true           → 跳过门槛（账号订阅来的内容内在相关）
```

每个信源都有入库配额（twitter=15 / weibo=10 / bing=5 / sogou=3 ...），防单源刷屏。

### 通知阈值

- **浏览器 SSE**：relevScore ≥ 60 且 !isSpam
- **邮件 + 微信**：仅 `importance ∈ {high, urgent}` 触发

### 5 分钟窗口聚合

命中入队 → 5 分钟内累积 → 一次性发：
- 邮件 1 封 digest（按 importance 排序，含 AI reason 折叠块）
- 企业微信 1 条 markdown 卡片（5 条以内全展示，多余只显示数量）

避免"5 条命中 → 5 封邮件 + 5 条微信"轰炸。

### AI 模型策略

DeepSeek 直连优先（`deepseek-chat`，便宜 10×），未配置时回退 OpenRouter。`src/lib/openrouter.ts` 自动切换。

## 常用命令

```bash
# 开发
npm run dev

# 测试（vitest）
npm test
npm run test:watch

# 类型检查
npx tsc --noEmit

# Lint
npm run lint

# 数据库迁移
npx prisma migrate dev --name <migration_name>
npx prisma generate

# 清空 Topic / Notification（保留 Keyword 配置）
node -e "const Database=require('better-sqlite3');const db=new Database('./dev.db');db.prepare('DELETE FROM Topic').run();db.prepare('DELETE FROM Notification').run();db.close()"

# 触发一次采集
curl -X POST http://localhost:3000/api/collect
```

## 环境变量速查

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | ⭐ | DeepSeek 直连，优先于 OpenRouter |
| `OPENROUTER_API_KEY` | ⭐ | DeepSeek 未配时回退方案 |
| `DATABASE_URL` | ✅ | SQLite 路径，默认 `file:./dev.db` |
| `TWITTER_API_KEY` | | twitterapi.io，未配则跳过 Twitter |
| `FIRECRAWL_API_KEY` | | 正文深度抓取，未配则只用 RSS snippet |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | | 邮件通道 |
| `NOTIFICATION_EMAIL` | | 收件邮箱 |
| `WECHAT_WEBHOOK_URL` | | 企业微信通道（多个用逗号分隔） |
| `WECHAT_DIGEST_MAX_LINES` | | 单条 digest 最多展示几条命中，默认 5 |
| `EMAIL_DIGEST_WINDOW_MS` | | 聚合窗口毫秒，默认 300000（5min） |
| `EMAIL_DIGEST_MAX_ITEMS` | | 单封 digest 上限，默认 20 |
| `COLLECTION_CRON` | | cron 表达式，默认 `*/30 * * * *` |
| `CLEAN_RAW_WITH_LLM` | | 是否用 LLM 清洗正文，默认 `true` |

⭐ = `DEEPSEEK_API_KEY` 或 `OPENROUTER_API_KEY` 至少配置一个

## 注意事项

- **改 schema 后必须重启 dev server**：Prisma client 是进程内单例，热重载不会更新
- **改 `.env` 后必须重启 dev server**：Next.js 不会自动重载环境变量
- **dev.db 会被 .gitignore**：迁移文件已纳入版本控制，重新克隆只需 `prisma migrate dev`
- **历史数据不会自动补字段**：例如新增"翻译缓存"后，旧 Topic 的 `translations` 仍为空，按需翻译才会写入

## License

私人项目，未公开 license。

