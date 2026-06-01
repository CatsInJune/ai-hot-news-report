# AI Hot News Monitor

[简体中文](./README.zh-CN.md) · **English**

Keyword-centric, full-web tracking: 12 sources scanned around the clock, noise filtered by AI, hits delivered to email + WeChat Work in real time.

Not a "topic feed" — this is **"where on the internet are the people and things I care about being mentioned right now?"**

## Highlights

- 🔍 **Keyword tracking** — AI auto-expands synonyms, handles, and abbreviations across Chinese and English
- 👤 **Account subscription** — detects accounts behind keywords and pulls their Twitter / Bilibili timelines directly, bypassing search
- 📡 **12 sources in parallel** — Twitter / HN / Reddit / arXiv / Bing / Google / Baidu / Sogou / Weibo / Bilibili / AI vendor blogs / Chinese AI media
- 🧠 **Two-axis AI scoring** — relevance + importance, automatic spam filtering, only `high` / `urgent` get pushed
- 📄 **Article extraction** — Firecrawl + LLM cleanup pulls real article body from the original page, strips nav / ads / comments
- 🌐 **One-click translation** — Simplified / Traditional Chinese / English / Japanese / Korean, cached per target language
- 🔔 **Digest notifications** — 5-minute rolling window batches alerts into a single email + WeChat Work card, no more bombing
- ⚡ **Realtime push** — SSE pops new hits to the browser the moment they land

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 · React 19 · Tailwind v4 |
| Data | Prisma 7 + PostgreSQL (pg adapter) |
| AI | DeepSeek direct API ($0.07 / $0.27 per 1M for v3), OpenRouter fallback |
| Scraping | Firecrawl + rss-parser + cheerio |
| Realtime | Next.js ReadableStream + global SSE singleton |
| Scheduling | node-cron + instrumentation.ts |
| Notifications | nodemailer · WeChat Work group bot webhook |
| Testing | vitest |

## Quick start

### 1. Install

```bash
git clone https://github.com/CatsInJune/ai-hot-news-report.git
cd ai-hot-news-report
npm install
```

### 2. Configure env

Copy the example file and fill in what you need:

```bash
cp .env.example .env
```

**Minimum viable config** (one AI key is enough to boot):

```bash
# AI analysis (one required; DeepSeek direct API recommended)
DEEPSEEK_API_KEY="sk-xxx"

# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ai_hot_news"
```

**Full feature set** also wants:

```bash
# Twitter collector (via twitterapi.io)
TWITTER_API_KEY="xxx"

# Article extraction (without it you only get RSS snippets)
FIRECRAWL_API_KEY="fc-xxx"

# Email notifications (SMTP)
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="xxx@qq.com"
SMTP_PASS="auth-code"
NOTIFICATION_EMAIL="you@example.com"

# WeChat Work group bot (recommended! 5-minute setup)
WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
```

### 3. Start PostgreSQL & initialize the database

Spin up a local Postgres via Docker (one-time):

```bash
docker compose up -d db
```

Then apply migrations and generate the Prisma client:

```bash
npx prisma migrate deploy
npx prisma generate
```

> Already have a hosted Postgres (Neon, Supabase, Vercel Postgres, etc.)? Just set `DATABASE_URL` in `.env` and skip the Docker step.

### 4. Boot

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Add a keyword

Go to `/keywords` → add one. The AI will auto-expand variants and detect related accounts.

Trigger a collection manually (runs every 30 min automatically by default):

```bash
curl -X POST http://localhost:3000/api/collect
```

## Notification setup

### Email SMTP

Settings page → **邮件推送 (Email)** → Test SMTP / send test email.

QQ Mail example:

```
SMTP_HOST="smtp.qq.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-qq@qq.com"
SMTP_PASS="16-char auth code from QQ Mail settings → account"
```

### WeChat Work group bot (recommended)

WeChat (personal) does **not** allow third-party API push. The cleanest path is **WeChat Work (企业微信) group bot**, which is free for individuals and takes ~5 minutes:

1. Download the WeChat Work app (anyone can register a company — no business license needed, completely free)
2. Create an internal group (you-only is fine) → Group settings → Group bot → Add → copy the webhook URL
3. Put it in `.env`:
   ```
   WECHAT_WEBHOOK_URL="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
   ```
   Multiple groups? Comma-separate URLs, all get pushed.
4. Restart `dev`, go to Settings → **微信推送 (WeChat)** → click **Ping Webhook** to verify

To mirror messages to your **personal WeChat**: in the WeChat Work app → Me → 关注的企业 → bind personal WeChat.

## Layout

```
src/
├── app/
│   ├── api/             # Routes
│   │   ├── collect/         # Trigger collection
│   │   ├── keywords/        # Keyword CRUD + AI expansion
│   │   ├── notifications/   # Notification history
│   │   ├── settings/        # System settings + test hooks
│   │   ├── sse/             # Realtime stream
│   │   └── topics/          # Topic list + translation + on-demand extraction
│   ├── keywords/        # Keyword management page
│   ├── notifications/   # Notification history page
│   ├── settings/        # System settings page
│   └── page.tsx         # Realtime feed home
├── components/
│   ├── feed/            # TopicCard / TopicFeed / filter dropdowns
│   ├── keywords/        # Keyword card / form
│   ├── layout/          # TopBar / SearchBox
│   └── ui/              # Generic widgets
└── lib/
    ├── collectors/      # 12 source collectors + shared helpers
    ├── analyzer.ts      # Dual-axis AI scoring
    ├── extract-content.ts  # Firecrawl + LLM body extraction
    ├── translator.ts    # Multi-language translation
    ├── mailer.ts        # Email digest template
    ├── wechat.ts        # WeChat Work markdown digest
    ├── notification-queue.ts  # 5-min window aggregator, multi-channel
    ├── scheduler.ts     # cron timer
    └── sse-manager.ts   # SSE singleton
```

## Key design

### Dual threshold + per-source quota

```
relevScore < 50                           → drop
!keywordMentioned && relevScore < 65      → drop (no literal hit + not relevant enough)
subscribed=true                           → skip both thresholds (subscribed accounts are inherently relevant)
```

Each source has an ingest quota (twitter=15 / weibo=10 / bing=5 / sogou=3 …) so no single source can flood the feed.

### Notification thresholds

- **Browser SSE**: relevScore ≥ 60 AND !isSpam
- **Email + WeChat**: only `importance ∈ {high, urgent}` triggers a push

### 5-minute aggregation window

Hit → enqueue → after 5 minutes (or when 20 items accumulate) flush once, producing:
- 1 email digest (sorted by importance, with foldable AI reason blocks)
- 1 WeChat Work markdown card (top 5 inline, overflow as a count summary)

So 5 hits in a minute = 1 email + 1 WeChat message, not 5 + 5.

### AI model strategy

DeepSeek direct API is preferred (`deepseek-chat`, ~10× cheaper). Falls back to OpenRouter when `DEEPSEEK_API_KEY` is unset. Switching logic lives in `src/lib/openrouter.ts`.

## Common commands

```bash
# Dev server
npm run dev

# Tests (vitest)
npm test
npm run test:watch

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Migrations
npx prisma migrate dev --name <migration_name>
npx prisma generate

# Clear topics + notifications (keep keyword config)
npx prisma db execute --stdin <<< 'DELETE FROM "Topic"; DELETE FROM "Notification";'

# Trigger one collection cycle
curl -X POST http://localhost:3000/api/collect
```

## Env reference

| Variable | Required | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | ⭐ | DeepSeek direct API, preferred over OpenRouter |
| `OPENROUTER_API_KEY` | ⭐ | Fallback when DeepSeek is unset |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (local Docker, Vercel Postgres, Neon, etc.) |
| `TWITTER_API_KEY` | | twitterapi.io; collector skipped without it |
| `FIRECRAWL_API_KEY` | | Deep article extraction; only RSS snippets without it |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | | Email channel |
| `NOTIFICATION_EMAIL` | | Recipient |
| `WECHAT_WEBHOOK_URL` | | WeChat Work channel (comma-separate for multiple) |
| `WECHAT_DIGEST_MAX_LINES` | | Max hits shown per digest card, default 5 |
| `EMAIL_DIGEST_WINDOW_MS` | | Aggregation window in ms, default 300000 (5 min) |
| `EMAIL_DIGEST_MAX_ITEMS` | | Max items per digest, default 20 |
| `COLLECTION_CRON` | | Cron expression, default `*/30 * * * *` |
| `CLEAN_RAW_WITH_LLM` | | LLM-clean article bodies, default `true` |

⭐ = at least one of `DEEPSEEK_API_KEY` or `OPENROUTER_API_KEY` must be configured

## Gotchas

- **Restart `dev` after schema changes** — the Prisma client is a per-process singleton; hot reload won't pick it up
- **Restart `dev` after `.env` changes** — Next.js does not auto-reload env vars
- **Local DB lives in Docker** — `docker compose up -d db` boots a Postgres on port 5432; migrations are checked in, so a fresh clone just needs `prisma migrate deploy`
- **Old rows don't auto-backfill new fields** — e.g. after adding `translations`, existing Topics stay empty until translated on demand

## License

Personal project; no license declared.
