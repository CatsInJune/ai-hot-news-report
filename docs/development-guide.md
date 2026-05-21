# AI热点速报工具 — 开发指南

**版本**: v1.0  
**日期**: 2026-05-22

---

## 一、环境准备

### 前置要求
- Node.js >= 20.x
- npm >= 10.x
- Git

### API Keys（需要提前注册）
| 服务 | 注册地址 | 说明 |
|------|---------|------|
| OpenRouter | https://openrouter.ai | 免费注册，按量计费 |
| twitterapi.io | https://twitterapi.io/dashboard | 免费注册，赠 $0.1 额度 |
| Firecrawl | https://firecrawl.dev | 免费注册，有免费额度 |

---

## 二、开发步骤

### Step 1：项目初始化

```bash
# 创建 Next.js 16 项目
npx create-next-app@latest ai-hot-news-report \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --no-turbopack

cd ai-hot-news-report

# 安装核心依赖
npm install \
  @prisma/client \
  prisma \
  openai \
  @mendable/firecrawl-js \
  nodemailer \
  node-cron \
  rss-parser \
  axios \
  cheerio \
  framer-motion \
  @radix-ui/react-icons \
  class-variance-authority \
  clsx \
  tailwind-merge

npm install -D \
  @types/nodemailer \
  @types/node-cron \
  @types/rss-parser

# 初始化 Prisma（SQLite）
npx prisma init --datasource-provider sqlite

# 创建 .env.local（复制 .env.example 并填入真实值）
cp .env.example .env.local
```

**验收标准**：`npm run dev` 能启动，访问 `http://localhost:3000` 显示 Next.js 默认页面

---

### Step 2：数据库 Schema 与迁移

1. 将 `docs/architecture.md` 中的 Schema 写入 `prisma/schema.prisma`
2. 执行迁移：
```bash
npx prisma migrate dev --name init
npx prisma generate
```

**验收标准**：`prisma/dev.db` 文件生成，`npx prisma studio` 能查看空表

---

### Step 3：UI 框架搭建

按照 `docs/architecture.md` 中的配色系统和组件结构：

1. 配置 Tailwind 自定义颜色变量（`tailwind.config.ts`）
2. 创建根布局（`src/app/layout.tsx`）—— 侧边栏 + 主内容区
3. 创建 `Sidebar.tsx`（折叠导航）
4. 创建 `TopBar.tsx`（顶部状态栏）
5. 创建 `MonitorStatus.tsx`（脉冲指示器）

**验收标准**：页面显示暗黑主题布局，侧边栏可展开/收起，响应式正常

---

### Step 4：关键词管理

1. API Routes: `src/app/api/keywords/route.ts`（GET 列表 + POST 创建）
2. API Routes: `src/app/api/keywords/[id]/route.ts`（PUT 更新 + DELETE 删除）
3. 页面: `src/app/keywords/page.tsx`
4. 组件: `KeywordList.tsx` + `KeywordForm.tsx` + `KeywordCard.tsx`

**验收标准**：能增删改查关键词，数据持久化到 SQLite，UI 动效正常

---

### Step 5：多源数据采集引擎

按顺序开发各采集器（参考 `docs/api-integration.md`）：

1. `src/lib/collectors/twitter.ts` — twitterapi.io
2. `src/lib/collectors/firecrawl.ts` — Firecrawl 新闻搜索
3. `src/lib/collectors/hackernews.ts` — HN 免费 API
4. `src/lib/collectors/reddit.ts` — Reddit JSON API
5. `src/lib/collectors/rss.ts` — RSS 解析
6. `src/lib/collectors/index.ts` — 统一调度（并行执行）
7. API Route: `src/app/api/collect/route.ts`（手动触发）

**频率控制要求**：
- 每个采集器有独立错误处理
- 单个源失败不影响其他源
- Reddit/RSS 请求间隔 ≥ 5秒

**验收标准**：调用 `POST /api/collect` 后，各来源数据入库，可在 Prisma Studio 查看

---

### Step 6：OpenRouter AI 分析

1. `src/lib/openrouter.ts` — 客户端初始化
2. `src/lib/analyzer.ts` — 分析引擎（JSON Schema 结构化输出）
3. 集成到采集流程：采集 → AI 分析 → 过滤 → 入库

**验收标准**：入库的 Topic 都有 realScore/relevScore/hotScore/summary 字段

---

### Step 7：热点 Feed + SSE 推送

1. `src/lib/sse-manager.ts` — SSE 连接管理（维护客户端连接池）
2. API Route: `src/app/api/sse/route.ts` — SSE 流式端点
3. API Route: `src/app/api/topics/route.ts` — 获取热点列表
4. 组件: `TopicCard.tsx` + `TopicFeed.tsx` + `SourceTabs.tsx` + `ScoreRing.tsx`
5. 首页: `src/app/page.tsx` — 接入 SSE，实时更新 Feed

**验收标准**：
- 新数据入库时，页面无刷新自动更新
- Tab 切换正常
- ScoreRing 环形评分图正确显示

---

### Step 8：邮件推送 + 定时任务

1. `src/lib/mailer.ts` — Nodemailer 邮件服务
2. `src/lib/scheduler.ts` — node-cron（每30分钟）
3. `src/instrumentation.ts` — 在 Next.js 启动时注册定时任务
4. 设置页面: `src/app/settings/page.tsx` — 邮件 SMTP 配置

**验收标准**：
- 手动触发采集后，命中关键词会收到邮件
- 定时任务每30分钟自动运行（查看服务端日志确认）

---

## 三、测试检查清单

### 功能测试
- [ ] 添加关键词 "AI"，采集后能找到相关内容
- [ ] 过滤掉评分 < 60 的低质量内容
- [ ] SSE 连接稳定，30秒心跳正常
- [ ] 邮件格式正确，可点击原文链接
- [ ] 5个信息源都有数据入库
- [ ] 手机端布局正常

### 性能测试
- [ ] 首屏加载 < 2秒
- [ ] 单次采集耗时 < 30秒（有AI分析）
- [ ] 1000条数据后 Feed 滚动流畅

### 异常测试
- [ ] 某个采集源 API 挂掉，其他源正常采集
- [ ] OpenRouter API Key 无效时，优雅报错不崩溃
- [ ] 重复 URL 的数据不会重复入库（unique 约束）
- [ ] 邮件 SMTP 配置错误时，给用户友好提示

---

## 四、部署说明

### 本地开发
```bash
npm run dev
```

### 生产构建
```bash
npm run build
npm start
```

### 注意事项
- `node-cron` 只在 Node.js 环境中运行，不支持 Vercel Serverless
- 如需部署到服务器，推荐：Railway / Render / VPS（保持 Node.js 进程）
- Vercel 部署需要改用外部触发（如 Vercel Cron Jobs）

---

## 五、数据清理策略

```typescript
// 定期清理7天前的旧数据（在 scheduler.ts 中加入）
cron.schedule('0 2 * * *', async () => {  // 每天凌晨2点
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  await prisma.topic.deleteMany({
    where: { createdAt: { lt: cutoff } }
  })
  await prisma.notification.deleteMany({
    where: { sentAt: { lt: cutoff } }
  })
})
```

---

## 六、后续 — Agent Skills 封装（Step 2 阶段）

Web 版完成并验收后，将以下功能封装为 Claude Code Skill：

| Skill 功能 | 描述 |
|-----------|------|
| `get-hot-topics` | 获取当前热点列表，支持按来源/时间过滤 |
| `add-keyword` | 添加监控关键词 |
| `check-keyword` | 查询某关键词的命中情况 |
| `run-collection` | 手动触发一次全量采集 |
| `get-analysis` | 获取某条内容的 AI 分析报告 |
