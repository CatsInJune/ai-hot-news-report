# AI热点速报工具 — 技术架构文档

**版本**: v1.0  
**日期**: 2026-05-22

---

## 一、技术栈

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 全栈框架 | **Next.js** | 16.2.2 | App Router + API Routes + SSE |
| 语言 | **TypeScript** | 5.x | 全栈类型安全 |
| 样式 | **Tailwind CSS** | v4 | 原子化CSS |
| 动效 | **Framer Motion** | latest | 流畅UI动画 |
| 数据库 | **SQLite** | — | 零配置本地数据库 |
| ORM | **Prisma** | 7.x | 类型安全查询 + 迁移 |
| 数据采集 | **Firecrawl JS SDK** | latest | 网页搜索+爬虫 |
| Twitter | **twitterapi.io** | REST | X平台数据 |
| AI 分析 | **OpenRouter** via `openai` SDK | — | 多模型路由 |
| 邮件 | **Nodemailer** | latest | SMTP邮件发送 |
| 定时任务 | **node-cron** | latest | 每30分钟采集 |
| RSS 解析 | **rss-parser** | latest | 解析 RSS/Atom 源 |
| HTTP 客户端 | **axios** | latest | 爬虫请求 |
| HTML 解析 | **cheerio** | latest | 网页内容提取 |

---

## 二、目录结构

```
ai-hot-news-report/
├── docs/                          # 项目文档
│   ├── requirements.md
│   ├── architecture.md
│   ├── api-integration.md
│   └── development-guide.md
├── prisma/
│   ├── schema.prisma              # 数据库 Schema
│   └── dev.db                     # SQLite 数据库文件
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx               # 首页（热点 Feed）
│   │   ├── keywords/
│   │   │   └── page.tsx           # 关键词管理页
│   │   ├── notifications/
│   │   │   └── page.tsx           # 通知记录页
│   │   ├── settings/
│   │   │   └── page.tsx           # 设置页
│   │   └── api/
│   │       ├── keywords/
│   │       │   ├── route.ts       # GET/POST 关键词列表
│   │       │   └── [id]/route.ts  # PUT/DELETE 单个关键词
│   │       ├── topics/
│   │       │   └── route.ts       # GET 热点列表
│   │       ├── collect/
│   │       │   └── route.ts       # POST 手动触发采集
│   │       ├── notifications/
│   │       │   └── route.ts       # GET/PUT 通知列表
│   │       ├── settings/
│   │       │   └── route.ts       # GET/PUT 系统设置
│   │       └── sse/
│   │           └── route.ts       # GET SSE 实时推送流
│   ├── components/                # UI 组件
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── MonitorStatus.tsx  # 实时监控状态
│   │   ├── feed/
│   │   │   ├── TopicCard.tsx      # 热点卡片
│   │   │   ├── TopicFeed.tsx      # 瀑布流列表
│   │   │   ├── SourceTabs.tsx     # 来源 Tab 切换
│   │   │   └── ScoreRing.tsx      # AI评分环形图
│   │   ├── keywords/
│   │   │   ├── KeywordCard.tsx
│   │   │   ├── KeywordForm.tsx
│   │   │   └── KeywordList.tsx
│   │   ├── notifications/
│   │   │   └── NotificationToast.tsx
│   │   └── ui/                    # shadcn/ui 基础组件
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 客户端单例
│   │   ├── openrouter.ts          # OpenRouter AI 客户端
│   │   ├── collectors/            # 数据采集器（8个信息源）
│   │   │   ├── index.ts           # 统一调度入口（并行执行所有采集器）
│   │   │   ├── twitter.ts         # twitterapi.io（需 API Key）
│   │   │   ├── bing.ts            # Bing News RSS（免费）
│   │   │   ├── google.ts          # Google News RSS（免费）
│   │   │   ├── duckduckgo.ts      # DuckDuckGo HTML 爬取（免费）
│   │   │   ├── hackernews.ts      # HN Firebase API（免费）
│   │   │   ├── sogou.ts           # 搜狗微信文章爬取（免费）
│   │   │   ├── bilibili.ts        # B站公开 JSON API（免费）
│   │   │   └── weibo.ts           # 微博热搜 + 关键词搜索（免费）
│   │   ├── analyzer.ts            # AI 分析引擎
│   │   ├── mailer.ts              # Nodemailer 邮件服务
│   │   ├── scheduler.ts           # node-cron 定时任务
│   │   └── sse-manager.ts         # SSE 连接管理
│   └── types/
│       └── index.ts               # 全局类型定义
├── .env.local                     # 环境变量（不提交）
├── .env.example                   # 环境变量模板
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## 三、数据库 Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 关键词监控配置
model Keyword {
  id          String   @id @default(cuid())
  name        String                        // 关键词名称
  domain      String                        // 监控领域
  active      Boolean  @default(true)
  priority    String   @default("medium")   // high / medium / low
  notifyBrowser Boolean @default(true)
  notifyEmail  Boolean @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  topics      Topic[]
}

// 采集到的热点内容
model Topic {
  id           String   @id @default(cuid())
  title        String
  summary      String?                       // AI生成摘要
  url          String
  source       String                        // twitter/firecrawl/hackernews/reddit/rss
  sourceIcon   String?                       // 来源图标URL
  author       String?
  publishedAt  DateTime
  
  // AI 分析结果
  realScore    Int      @default(0)          // 真实性评分 0-100
  relevScore   Int      @default(0)          // 相关性评分 0-100
  hotScore     Int      @default(0)          // 热度评分 0-100
  
  // 互动数据（来自原始平台）
  likes        Int      @default(0)
  reposts      Int      @default(0)
  comments     Int      @default(0)
  views        Int      @default(0)
  
  // 关联关键词
  keywordId    String?
  keyword      Keyword? @relation(fields: [keywordId], references: [id])
  
  createdAt    DateTime @default(now())
  
  @@unique([url])                            // 去重
  @@index([source])
  @@index([publishedAt])
  @@index([hotScore])
}

// 通知记录
model Notification {
  id        String   @id @default(cuid())
  type      String                          // browser / email
  title     String
  content   String
  topicUrl  String?
  read      Boolean  @default(false)
  sentAt    DateTime @default(now())
}

// 系统设置
model Setting {
  key       String @id
  value     String
  updatedAt DateTime @updatedAt
}
```

---

## 四、数据流架构

```
┌─────────────────────────────────────────────────────┐
│                    定时任务（每30分钟）                │
│                  node-cron scheduler.ts              │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   collectors/index.ts    │
          │   并行调度5个采集器       │
          └────────────┬────────────┘
                       │
     ┌─────────────────┼─────────────────┐
     │         │       │       │         │
     ▼      ▼      ▼       ▼      ▼     ▼     ▼      ▼
  Twitter Bing Google DuckDuckGo HN  搜狗   B站   微博
     │         │       │       │         │
     └─────────┴───────┴───────┴─────────┘
                       │
          ┌────────────▼────────────┐
          │    analyzer.ts           │
          │  OpenRouter AI 分析      │
          │  - 真实性评分            │
          │  - 相关性评分            │
          │  - 热度评分              │
          │  - 摘要生成              │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │    Prisma → SQLite       │
          │    写入 Topic 表          │
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │   命中关键词？            │
          └──────┬──────────┬───────┘
                 │是         │否
          ┌──────▼──┐   ┌──▼─────────┐
          │SSE推送  │   │ 仅存库，    │
          │邮件通知 │   │ 等待查询   │
          └─────────┘   └────────────┘
```

---

## 五、SSE 实时推送设计

Next.js 16 App Router 中使用 `ReadableStream` 实现 SSE：

```typescript
// src/app/api/sse/route.ts
export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      // 注册到全局连接管理器
      sseManager.addClient(controller)
      
      // 心跳保持连接
      const heartbeat = setInterval(() => {
        controller.enqueue(`data: ${JSON.stringify({type: 'ping'})}\n\n`)
      }, 30000)
      
      // 清理
      return () => {
        clearInterval(heartbeat)
        sseManager.removeClient(controller)
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  })
}
```

---

## 六、AI 分析模块设计

使用 OpenRouter 的 **JSON Schema 结构化输出**，保证解析稳定：

```typescript
// 请求格式
const response = await openai.chat.completions.create({
  model: 'google/gemini-2.5-flash',
  messages: [...],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'content_analysis',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          realScore:   { type: 'number', description: '真实性评分 0-100' },
          relevScore:  { type: 'number', description: '关键词相关性 0-100' },
          hotScore:    { type: 'number', description: '热度评分 0-100' },
          summary:     { type: 'string', description: '50字摘要' },
          isSpam:      { type: 'boolean', description: '是否为广告/垃圾' },
        },
        required: ['realScore', 'relevScore', 'hotScore', 'summary', 'isSpam'],
        additionalProperties: false,
      }
    }
  }
})
```

**默认模型**: `google/gemini-2.5-flash`（速度快、成本低，约 $0.001/次分析）

---

## 七、UI 设计规范

### 配色系统
```css
--bg-primary:    #0a0a0f;   /* 主背景：深黑 */
--bg-surface:    #111118;   /* 卡片背景 */
--bg-hover:      #1a1a24;   /* 悬浮状态 */
--neon-cyan:     #00f5d4;   /* 主强调色：霓虹青 */
--neon-purple:   #a855f7;   /* 副强调色：霓虹紫 */
--neon-green:    #22c55e;   /* 成功/活跃 */
--neon-amber:    #f59e0b;   /* 警告/中等 */
--text-primary:  #e2e8f0;   /* 主文字 */
--text-muted:    #64748b;   /* 次要文字 */
--border:        #1e293b;   /* 边框 */
```

### 核心动效
- **监控脉冲**：活跃关键词旁的绿色呼吸灯
- **卡片进入**：从下方淡入 + 轻微缩放（Framer Motion）
- **扫描线**：卡片悬浮时顶部扫描线划过
- **数字滚动**：统计数字更新时滚动动画
- **侧边栏折叠**：平滑展开/收起

### 响应式断点
- 手机（< 768px）：隐藏侧边栏，底部 Tab 导航
- 平板（768-1024px）：侧边栏图标模式
- 桌面（> 1024px）：侧边栏完整展示

---

## 八、安全设计

| 风险 | 措施 |
|------|------|
| API Key 泄露 | 所有 Key 存 `.env.local`，API Routes 调用，不暴露前端 |
| 爬虫被封 | 每源间隔 ≥ 10秒，随机 User-Agent，失败降级不中断 |
| SQL 注入 | Prisma 参数化查询，无裸 SQL |
| XSS | Next.js 默认 HTML 转义，用户输入 sanitize |
| 邮件注入 | Nodemailer 自动处理，收件人白名单 |

---

## 九、技术选型决策记录

### 9.1 实时通信：SSE vs Socket.io

**结论：选 SSE**

| 维度 | SSE | Socket.io |
|------|-----|-----------|
| 通信方向 | 服务端 → 客户端（单向） | 双向 |
| 依赖 | 零依赖，浏览器原生支持 | 需安装客户端 + 服务端包 |
| Next.js 集成 | 原生 `ReadableStream`，无需配置 | 需要独立 WS 服务器或适配层 |
| 多实例部署 | 无状态，天然支持 | 有状态，需 Redis sticky session |
| 包体积 | 0 KB | ~40 KB（客户端） |

**本项目数据流方向**：
```
服务端 ──推送新热点──▶ 浏览器
服务端 ──推送通知──▶  浏览器
（浏览器不需要向服务端发送实时消息）
```

本项目只需单向推送，SSE 完全满足需求。Socket.io 的双向能力在此场景是多余的复杂度。

**何时应改用 Socket.io**：若未来需要用户在页面实时触发采集并看进度、多用户协作编辑关键词列表等**双向交互**场景，再引入 Socket.io。

---

### 9.2 定时任务：node-cron vs Vercel Cron Jobs

**结论：本地/VPS 用 node-cron，Vercel 部署改用 Vercel Cron Jobs**

| 维度 | node-cron | Vercel Cron Jobs |
|------|-----------|-----------------|
| 运行环境 | Node.js 长驻进程 | Serverless 函数触发 |
| 配置方式 | `instrumentation.ts` 启动注册 | `vercel.json` 声明 |
| 适合场景 | 本地开发 / VPS 部署 | Vercel 托管 |
| 限制 | 需要持续运行的服务器 | 免费版最短间隔 1 分钟 |

当前默认使用 node-cron，部署到 Vercel 时替换为：
```json
// vercel.json
{
  "crons": [{ "path": "/api/collect", "schedule": "*/30 * * * *" }]
}
```
