# AI热点速报工具 — API 对接文档

**版本**: v1.0  
**日期**: 2026-05-22  
**数据来源**: context7 官方文档 + Firecrawl 实时搜索

---

## 一、OpenRouter（AI 分析）

**文档来源**: context7 `/llmstxt/openrouter_ai_llms-full_txt`  
**集成方式**: 使用 `openai` npm 包，修改 `baseURL` 即可，无需额外 SDK

### 安装
```bash
npm install openai
```

### 客户端初始化
```typescript
// src/lib/openrouter.ts
import OpenAI from 'openai'

export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  defaultHeaders: {
    'HTTP-Referer': 'https://ai-hot-news.local',
    'X-Title': 'AI Hot News Monitor',
  },
})
```

### 内容分析（结构化 JSON 输出）
```typescript
// src/lib/analyzer.ts
export async function analyzeContent(content: {
  title: string
  text: string
  keyword: string
  source: string
}): Promise<AnalysisResult> {
  const response = await openrouter.chat.completions.create({
    model: 'google/gemini-2.5-flash',  // 默认模型，省钱快速
    messages: [
      {
        role: 'system',
        content: `你是一个专业的资讯质量评估助手。
对输入内容进行评估，返回 JSON 格式结果。
重点识别：广告内容、营销软文、虚假信息、点击诱饵。`
      },
      {
        role: 'user',
        content: `请分析以下内容：
标题: ${content.title}
正文摘要: ${content.text.slice(0, 500)}
来源平台: ${content.source}
监控关键词: ${content.keyword}`
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'content_analysis',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            realScore:  { type: 'number', description: '真实性评分 0-100，100为完全真实' },
            relevScore: { type: 'number', description: '与关键词的相关性 0-100' },
            hotScore:   { type: 'number', description: '热度/重要性评分 0-100' },
            summary:    { type: 'string', description: '中文摘要，50字以内' },
            isSpam:     { type: 'boolean', description: '是否为广告/垃圾/营销内容' },
            reason:     { type: 'string', description: '简短判断理由，20字以内' },
          },
          required: ['realScore', 'relevScore', 'hotScore', 'summary', 'isSpam', 'reason'],
          additionalProperties: false,
        }
      }
    },
    temperature: 0.1,  // 低温度，保证稳定输出
  })

  const result = JSON.parse(response.choices[0].message.content!)
  return result as AnalysisResult
}
```

### 可用模型参考
| 模型 | 特点 | 推荐场景 |
|------|------|---------|
| `google/gemini-2.5-flash` | 最快最便宜 | 默认，批量分析 |
| `anthropic/claude-3.5-haiku` | 质量更好 | 重要内容精分析 |
| `openai/gpt-4o-mini` | 稳定备用 | 降级方案 |

---

## 二、twitterapi.io（Twitter/X 数据）

**文档来源**: Firecrawl 搜索 `docs.twitterapi.io`  
**认证方式**: `X-API-Key` 请求头，无需 OAuth  
**定价**: $0.15/1k tweets，免费注册赠 $0.1 试用额度

### 安装
```bash
# 无需 SDK，直接 fetch 调用
```

### 高级搜索（核心接口）
```typescript
// src/lib/collectors/twitter.ts
const TWITTER_API_BASE = 'https://api.twitterapi.io'

export interface Tweet {
  id: string
  url: string
  text: string
  retweetCount: number
  replyCount: number
  likeCount: number
  quoteCount: number
  viewCount: number
  createdAt: string
  author: {
    userName: string
    name: string
    followers: number
    isBlueVerified: boolean
    profilePicture: string
  }
}

export async function searchTwitter(keyword: string, options?: {
  queryType?: 'Latest' | 'Top'
  limit?: number
}): Promise<Tweet[]> {
  const params = new URLSearchParams({
    query: keyword,
    queryType: options?.queryType ?? 'Latest',
  })

  const res = await fetch(
    `${TWITTER_API_BASE}/twitter/tweet/advanced_search?${params}`,
    {
      headers: { 'X-API-Key': process.env.TWITTER_API_KEY! },
    }
  )

  if (!res.ok) {
    console.error(`Twitter API error: ${res.status}`)
    return []
  }

  const data = await res.json()
  const tweets: Tweet[] = data.tweets ?? []

  // 过滤低质量：转推数 + 点赞数不够的不要
  return tweets.filter(t =>
    (t.likeCount + t.retweetCount + t.viewCount) > 10
  )
}
```

### 查询语法参考
```
# 基本关键词
"AI编程"

# 过滤转推，只看原创
"AI编程" -is:retweet

# 仅已验证账号
"AI编程" is:verified

# 时间范围（Unix 时间戳）
"AI编程" since_time:1748000000 until_time:1748100000

# 指定语言
"AI" lang:zh

# 最少互动量
"Claude" min_faves:100
```

---

## 三、Firecrawl（网页搜索 + 爬虫）

**文档来源**: context7 `/websites/firecrawl_dev`  
**SDK**: `@mendable/firecrawl-js`

### 安装
```bash
npm install @mendable/firecrawl-js
```

### 客户端初始化
```typescript
// src/lib/collectors/firecrawl.ts
import Firecrawl from '@mendable/firecrawl-js'

export const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY!,
})
```

### 新闻搜索（带时间过滤）
```typescript
export async function searchNews(keyword: string): Promise<NewsItem[]> {
  const results = await firecrawl.search(keyword, {
    limit: 10,
    sources: [{ type: 'news' }],         // 仅搜索新闻源
    tbs: 'qdr:h',                         // 过去1小时内的新闻
  })

  return (results.news ?? []).map(item => ({
    title: item.title ?? '',
    url: item.url ?? '',
    description: item.description ?? '',
    source: 'firecrawl',
  }))
}
```

### 时间过滤参数（tbs）
| 参数值 | 含义 |
|--------|------|
| `qdr:h` | 过去 1 小时 |
| `qdr:d` | 过去 24 小时 |
| `qdr:w` | 过去 1 周 |
| `qdr:m` | 过去 1 个月 |
| `sbd:1` | 按日期排序 |
| `cdr:1,cd_min:05/01/2026,cd_max:05/22/2026` | 自定义日期范围 |

### 网页内容抓取
```typescript
export async function scrapeUrl(url: string): Promise<string> {
  const result = await firecrawl.scrape(url, {
    formats: ['markdown'],
    onlyMainContent: true,   // 过滤导航栏/广告等
    timeout: 30000,
  })
  return result.markdown ?? ''
}
```

---

## 四、Bing News（RSS，无需 Key）

**方式**: Bing News 提供免费 RSS 订阅，`rss-parser` 直接解析，中英文兼顾  
**端点**: `https://www.bing.com/news/search?q={keyword}&format=RSS`

```bash
npm install rss-parser
npm install -D @types/rss-parser
```

```typescript
// src/lib/collectors/bing.ts
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 10000 })

export interface BingNewsItem {
  title: string
  link: string
  contentSnippet: string
  pubDate: string
  source: 'bing'
}

export async function searchBingNews(keyword: string): Promise<BingNewsItem[]> {
  try {
    const url = `https://www.bing.com/news/search?q=${encodeURIComponent(keyword)}&format=RSS`
    const feed = await parser.parseURL(url)
    return feed.items.slice(0, 15).map(item => ({
      title: item.title ?? '',
      link: item.link ?? '',
      contentSnippet: item.contentSnippet ?? '',
      pubDate: item.pubDate ?? new Date().toISOString(),
      source: 'bing' as const,
    }))
  } catch {
    return []
  }
}
```

---

## 五、Google News（RSS，无需 Key）

**方式**: Google News 提供免费 RSS，支持中文搜索  
**端点**: `https://news.google.com/rss/search?q={keyword}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`

```typescript
// src/lib/collectors/google.ts
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 10000 })

export interface GoogleNewsItem {
  title: string
  link: string
  contentSnippet: string
  pubDate: string
  source: 'google'
}

export async function searchGoogleNews(keyword: string): Promise<GoogleNewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`
    const feed = await parser.parseURL(url)
    return feed.items.slice(0, 15).map(item => ({
      title: item.title ?? '',
      link: item.link ?? '',
      contentSnippet: item.contentSnippet ?? '',
      pubDate: item.pubDate ?? new Date().toISOString(),
      source: 'google' as const,
    }))
  } catch {
    return []
  }
}
```

---

## 六、DuckDuckGo（HTML 爬取，无需 Key）

**方式**: 爬取 `https://html.duckduckgo.com/html/` 轻量版页面，用 cheerio 解析  
**注意**: 间隔 ≥ 10秒，设置合理 User-Agent

```bash
npm install axios cheerio
npm install -D @types/cheerio
```

```typescript
// src/lib/collectors/duckduckgo.ts
import axios from 'axios'
import * as cheerio from 'cheerio'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

export interface DDGResult {
  title: string
  url: string
  snippet: string
  source: 'duckduckgo'
}

export async function searchDuckDuckGo(keyword: string): Promise<DDGResult[]> {
  try {
    const res = await axios.post(
      'https://html.duckduckgo.com/html/',
      new URLSearchParams({ q: keyword, kl: 'cn-zh' }),
      { headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
    )
    const $ = cheerio.load(res.data)
    const results: DDGResult[] = []

    $('.result__body').slice(0, 10).each((_, el) => {
      const title = $(el).find('.result__title').text().trim()
      const url   = $(el).find('.result__url').text().trim()
      const snippet = $(el).find('.result__snippet').text().trim()
      if (title && url) results.push({ title, url: `https://${url}`, snippet, source: 'duckduckgo' })
    })
    return results
  } catch {
    return []
  }
}
```

---

## 七、Hacker News（免费 Firebase API，无需 Key）

**端点**: `https://hacker-news.firebaseio.com/v0/`  
**特点**: 无 Rate Limit，实时数据，技术社区深度内容

```typescript
// src/lib/collectors/hackernews.ts
const HN_BASE = 'https://hacker-news.firebaseio.com/v0'

export interface HNStory {
  id: number
  title: string
  url?: string
  score: number
  by: string
  time: number
  descendants: number
  source: 'hackernews'
}

export async function getTopHNStories(limit = 20): Promise<HNStory[]> {
  const idsRes = await fetch(`${HN_BASE}/topstories.json`)
  const ids: number[] = await idsRes.json()

  const stories = await Promise.all(
    ids.slice(0, limit).map(id =>
      fetch(`${HN_BASE}/item/${id}.json`).then(r => r.json())
    )
  )
  return (stories.filter(s => s?.url) as HNStory[]).map(s => ({ ...s, source: 'hackernews' as const }))
}
```

---

## 八、搜狗微信（公众号文章爬取，无需 Key）

**端点**: `https://weixin.sogou.com/weixin?type=2&query={keyword}`  
**特点**: 独家微信公众号内容，国内资讯首选  
**注意**: 有反爬验证码，需设置 User-Agent + 间隔 ≥ 15秒，失败降级处理

```typescript
// src/lib/collectors/sogou.ts
import axios from 'axios'
import * as cheerio from 'cheerio'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://weixin.sogou.com/',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

export interface SogouArticle {
  title: string
  url: string
  snippet: string
  pubDate: string
  account: string   // 公众号名称
  source: 'sogou'
}

export async function searchSogouWechat(keyword: string): Promise<SogouArticle[]> {
  try {
    const res = await axios.get('https://weixin.sogou.com/weixin', {
      params: { type: 2, query: keyword, ie: 'utf8' },
      headers: HEADERS,
      timeout: 15000,
    })

    // 遭遇验证码页面时降级返回空
    if (res.data.includes('antispider') || res.data.includes('VerifyCode')) {
      console.warn('[Sogou] 触发反爬，跳过本次采集')
      return []
    }

    const $ = cheerio.load(res.data)
    const results: SogouArticle[] = []

    $('.news-list li').slice(0, 10).each((_, el) => {
      const title   = $(el).find('h3 a').text().trim()
      const url     = $(el).find('h3 a').attr('href') ?? ''
      const snippet = $(el).find('p.txt-info').text().trim()
      const account = $(el).find('.account').text().trim()
      const dateStr = $(el).find('.s2').text().trim()
      if (title && url) {
        results.push({ title, url, snippet, pubDate: dateStr, account, source: 'sogou' })
      }
    })
    return results
  } catch {
    return []
  }
}
```

---

## 九、B站（Bilibili 公开 JSON API，无需 Key）

**端点**: `https://api.bilibili.com/x/web-interface/search/type`  
**特点**: 国内科技视频丰富，UP主观点鲜明，趋势敏感

```typescript
// src/lib/collectors/bilibili.ts
import axios from 'axios'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Referer': 'https://www.bilibili.com',
}

export interface BiliVideo {
  title: string
  url: string
  description: string
  author: string
  play: number
  danmaku: number
  pubdate: number
  source: 'bilibili'
}

export async function searchBilibili(keyword: string): Promise<BiliVideo[]> {
  try {
    const res = await axios.get('https://api.bilibili.com/x/web-interface/search/type', {
      params: { search_type: 'video', keyword, order: 'pubdate', page: 1 },
      headers: HEADERS,
      timeout: 10000,
    })

    if (res.data.code !== 0) return []

    return (res.data.data?.result ?? []).slice(0, 10).map((v: any) => ({
      title: v.title.replace(/<[^>]+>/g, ''),  // 去除高亮 HTML 标签
      url: `https://www.bilibili.com/video/${v.bvid}`,
      description: v.description ?? '',
      author: v.author ?? '',
      play: v.play ?? 0,
      danmaku: v.video_review ?? 0,
      pubdate: v.pubdate ?? 0,
      source: 'bilibili' as const,
    }))
  } catch {
    return []
  }
}
```

---

## 十、微博（热搜 + 关键词搜索，无需 Key）

**热搜端点**: `https://weibo.com/ajax/side/hotSearch`（JSON，返回实时热搜榜）  
**搜索端点**: `https://s.weibo.com/weibo?q={keyword}` （HTML 爬取）  
**特点**: 国内热点传播最快，实时性极强

```typescript
// src/lib/collectors/weibo.ts
import axios from 'axios'
import * as cheerio from 'cheerio'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Referer': 'https://weibo.com/',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

export interface WeiboHotTopic {
  title: string
  url: string
  hotValue: number
  source: 'weibo'
}

// 获取微博实时热搜榜（无需关键词，直接返回热搜 Top 50）
export async function getWeiboHotSearch(): Promise<WeiboHotTopic[]> {
  try {
    const res = await axios.get('https://weibo.com/ajax/side/hotSearch', {
      headers: HEADERS,
      timeout: 10000,
    })
    const items = res.data?.data?.realtime ?? []
    return items.slice(0, 20).map((item: any) => ({
      title: item.note ?? item.word ?? '',
      url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(item.word)}%23`,
      hotValue: item.num ?? 0,
      source: 'weibo' as const,
    })).filter((t: WeiboHotTopic) => t.title)
  } catch {
    return []
  }
}

export interface WeiboPost {
  title: string
  url: string
  snippet: string
  pubDate: string
  author: string
  source: 'weibo'
}

// 关键词搜索微博内容
export async function searchWeibo(keyword: string): Promise<WeiboPost[]> {
  try {
    const res = await axios.get('https://s.weibo.com/weibo', {
      params: { q: keyword, typeall: 1, suball: 1, timescope: 'custom:2024-01-01-0:2030-12-31-0' },
      headers: { ...HEADERS, Cookie: 'SUB=; SUBP=;' },  // 游客 Cookie
      timeout: 15000,
    })
    const $ = cheerio.load(res.data)
    const results: WeiboPost[] = []

    $('.card-wrap').slice(0, 10).each((_, el) => {
      const content = $(el).find('.txt').text().trim()
      const author  = $(el).find('.name').text().trim()
      const time    = $(el).find('.from a').first().text().trim()
      const href    = $(el).find('.from a').first().attr('href') ?? ''
      if (content) {
        results.push({
          title: content.slice(0, 60),
          url: href.startsWith('http') ? href : `https://weibo.com${href}`,
          snippet: content,
          pubDate: time,
          author,
          source: 'weibo' as const,
        })
      }
    })
    return results
  } catch {
    return []
  }
}

---

## 十一、Prisma + SQLite 初始化

**文档来源**: context7 `/websites/prisma_io` (v7)

### 初始化命令
```bash
npx prisma init --datasource-provider sqlite
```

### 客户端单例
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 迁移命令
```bash
npx prisma migrate dev --name init      # 开发环境迁移
npx prisma generate                      # 生成客户端类型
npx prisma studio                        # 可视化数据库管理
```

---

## 十二、node-cron（定时任务）

**文档来源**: context7 `/websites/nodecron`

### 安装
```bash
npm install node-cron
npm install -D @types/node-cron
```

### 定时采集任务
```typescript
// src/lib/scheduler.ts
import cron from 'node-cron'
import { runAllCollectors } from './collectors'

let isRunning = false

export function startScheduler() {
  // 每 30 分钟执行一次: '*/30 * * * *'
  cron.schedule('*/30 * * * *', async () => {
    if (isRunning) {
      console.log('[Scheduler] 上次采集尚未完成，跳过本次')
      return
    }

    isRunning = true
    console.log('[Scheduler] 开始定时采集', new Date().toISOString())

    try {
      await runAllCollectors()
    } catch (err) {
      console.error('[Scheduler] 采集出错:', err)
    } finally {
      isRunning = false
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai',
  })

  console.log('[Scheduler] 定时任务已启动，每30分钟采集一次')
}
```

### 在 Next.js 中启动定时任务

在 `instrumentation.ts`（Next.js 15+ 支持）中初始化：

```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler')
    startScheduler()
  }
}
```

---

## 十三、Nodemailer（邮件推送）

**文档来源**: context7 `/nodemailer/nodemailer-homepage`

### 安装
```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### 邮件服务
```typescript
// src/lib/mailer.ts
import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendKeywordAlert(data: {
  to: string
  keyword: string
  title: string
  summary: string
  url: string
  source: string
  hotScore: number
}) {
  const transporter = createTransporter()

  await transporter.sendMail({
    from: `"AI 热点雷达" <${process.env.SMTP_USER}>`,
    to: data.to,
    subject: `🔥 关键词命中：${data.keyword} | ${data.title.slice(0, 30)}...`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00f5d4;">🔥 关键词命中提醒</h2>
        <p>关键词 <strong>${data.keyword}</strong> 出现了新内容：</p>
        <div style="background: #111; padding: 16px; border-radius: 8px; border-left: 4px solid #00f5d4;">
          <h3 style="color: #e2e8f0; margin: 0 0 8px;">${data.title}</h3>
          <p style="color: #94a3b8; margin: 0 0 12px;">${data.summary}</p>
          <div style="display: flex; gap: 12px; font-size: 12px; color: #64748b;">
            <span>来源: ${data.source}</span>
            <span>热度评分: ${data.hotScore}/100</span>
          </div>
        </div>
        <a href="${data.url}" style="display: inline-block; margin-top: 16px;
          padding: 10px 24px; background: #00f5d4; color: #0a0a0f;
          text-decoration: none; border-radius: 6px; font-weight: bold;">
          查看原文 →
        </a>
      </div>
    `,
  })
}
```

### Gmail 配置
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-16-char-app-password  # 需要开启两步验证后生成应用密码
```

---

## 十四、环境变量模板

```env
# .env.example

# 数据库
DATABASE_URL="file:./prisma/dev.db"

# AI 分析
OPENROUTER_API_KEY=sk-or-v1-xxx

# 数据采集
TWITTER_API_KEY=xxx
FIRECRAWL_API_KEY=fc-xxx

# 邮件推送
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_MODEL=google/gemini-2.5-flash   # 可替换为其他模型
```

---

## 十五、频率控制与错误处理

```typescript
// src/lib/utils/rate-limiter.ts

// 采集器间隔延迟
export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 带重试的 fetch
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok) return res
      if (res.status === 429) {  // Rate limited
        await sleep(60000)        // 等1分钟
        continue
      }
    } catch {
      if (i === retries) throw new Error(`Fetch failed after ${retries} retries`)
      await sleep(2000 * (i + 1))
    }
  }
  throw new Error('Max retries reached')
}

// 采集器执行规则
// - Twitter:    每次最多拉 20 条
// - Firecrawl:  每次搜索间隔 10 秒
// - HN:         并发 20 个详情请求
// - Reddit:     每个 subreddit 间隔 5 秒
// - RSS:        并发解析所有源
```
