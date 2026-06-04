---
name: hot-news-search
description: 围绕一个关键词从 11 个公开源（与 ai-hot-news-report 项目源一致）抓取最新动态，按项目同款 6 维 AI 评分过滤后，生成"卡片流"样式的 Markdown 速报 —— 输出排版尽量贴合项目 TopicCard。适用场景：用户想知道某对象"最近有什么动态/新闻/进展/热点"、要某个主题的"日报/周报/简报/速报"、要"盘一盘 X 最近在干嘛"、想看某关键词"在微博热搜上没/B 站有没新视频/官方博客发了啥"。即使用户没明说"速报"两字，只要意图是"围绕一个关键词把最近的相关信息汇总成一份可读报告"，都应触发本 skill。不要用于：开放式 web 搜索（用 WebSearch）、读取站内 RSS（用 WebFetch）、查询本地数据库。
---

# Hot News Search — 关键词速报生成器

把一个关键词在过去几天的**多源动态**拉过来，**6 维评分过滤 + 卡片样式浓缩**成一份给人看的 Markdown 速报。

不是开放式搜索，是一个**确定性 4 步流水线**：抓 → 评 → 选 → 写。

## 何时触发

典型说法：
- "帮我看看 **Sora 2** 最近有什么动态"
- "做一份 **DeepSeek V4** 的速报 / 简报 / 日报"
- "**Claude Code** 最近社区在讨论什么"
- "看下 **AGI** 微博热搜上有没"
- "盘下 **GPT-5** B 站新视频 + arxiv 论文"

不应触发：
- 单点事实核查（"Claude 4.7 何时发布"）→ WebSearch
- 用户给了 URL 让你读 → WebFetch
- 问本项目代码 → 直接读

## Step 1 — 拉候选

```bash
python3 ${SKILL_DIR}/scripts/fetch_news.py "<关键词>" --limit 15 --since-days 7
```

**纯 Python stdlib，零依赖**。

### 信源（与 `ai-hot-news-report` 项目 1:1 对齐）

| 源 | 接口 | 适合 | 跳过条件 | 数据质量 |
|---|---|---|---|---|
| `bing` | News RSS | 中英新闻 | — | 标题+summary |
| `google` | News RSS (zh-CN) | 中文媒体扩散 | — | 标题+summary，URL 是中转链 |
| `hackernews` | Algolia API | 英文技术圈 | 中文关键词 | 全字段 + points/comments |
| `reddit` | search RSS (Atom) | 英文社区 | — | 标题+内容；**score/comments 不可得**（Atom 不暴露） |
| `arxiv` | Atom API（限定 cs.AI/LG/CL/CV/MA/NE） | AI 论文 | 中文关键词 | 标题+abstract+authors |
| `weibo` | hotSearch JSON | 是否上热搜 | — | **只返回上热搜的话题**，没上就 0 条；views = 热度值 |
| `bilibili` | search API | B 站视频 | — | 标题+description+作者+播放/弹幕 |
| `sogou` | HTML 爬虫（stdlib HTMLParser） | 中文长尾 | 触发反爬 | **只有标题+URL**，summary 多为空 |
| `baidu` | HTML 爬虫（stdlib HTMLParser） | 中文新闻 | 触发反爬 | **只有标题+URL**，无 summary/作者 |
| `ai_blog` | OpenAI/Google AI/HF/DeepMind RSS 聚合 | AI 厂官方公告 | 全 feed 都挂 | 标题+description；按关键词字面过滤 |
| `ai_news_zh` | 量子位/36氪 RSS 聚合 | 中文 AI 媒体 | 全 feed 都挂 | 同上 |
| `twitter` | twitterapi.io | 实时声量 | 无 `TWITTER_API_KEY` | 全字段 + 互动 + 作者 verified/followers |

`twitter` 复用项目 `TWITTER_API_KEY` env，没配自动跳过（输出 `skipped` 字段说明）。

### 参数

- `keyword`：中英文都可。脚本自动加双引号做短语精确匹配。
- `--sources`：默认全开。可指定子集，如 `--sources bing,google,weibo,bilibili`。
- `--limit`：每源条数上限，默认 15。
- `--since-days N`：丢弃 N 天以前的条目（按 `publishedAt`，未知时间保留让你判断）。默认 0 不过滤。**日报用 3，周报用 7-14**。

### 输出 schema

```json
{
  "keyword": "...",
  "fetched_at": "ISO8601",
  "sources_used": [...],
  "skipped": [{"source": "twitter", "reason": "..."}],
  "count": 47,
  "by_source": {"bing": 8, ...},
  "errors": [{"source": "ai_news_zh", "error": "..."}],
  "items": [
    { "title": "...", "summary": "...", "url": "...",
      "source": "<one of 11>",
      "author": null,
      "publishedAt": "ISO8601",
      "likes": 0, "reposts": 0, "comments": 0, "views": 0,
      "extra": {
        "subreddit": "...",   // reddit
        "verified": true,     // twitter
        "followers": 12000,   // twitter
        "handle": "..."       // twitter
      }
    }
  ]
}
```

互动字段 `likes / reposts / comments / views` 在不同源含义不同：
- `bing` / `google` / `sogou` / `baidu` / `arxiv` / `ai_blog` / `ai_news_zh` / `reddit` → 全 0（数据源不提供，**别编造**）
- `hackernews` → likes=points, comments=#comments
- `bilibili` → views=播放, comments=弹幕评论
- `weibo` → views=热度数值
- `twitter` → 完整 4 项

## Step 2 — 你来评分（6 维，对齐项目 analyzer.ts）

由你（当前对话的 Claude）按这 6 个维度逐条评。不要再调脚本、不要再发 HTTP。

### 维度

1. **realScore (0-100)** — 内容真实可信度。标题党 / 营销软文 / 内容农场水文 / 无信源的传言打低分。
2. **keywordMentioned (bool)** — 标题或 summary 里**字面**出现了关键词或其等价表达（昵称 / 英文名 / @账号）。仅看字面，不做语义推断。
3. **relevScore (0-100)** — 内容是不是真的在讲【K】？
   - 90-100 核心主题就是 K
   - 60-89 强相关
   - 30-59 顺带提及
   - 0-29 无实质关联
   - **硬约束**：!keywordMentioned → 上限 25；字面巧合（"鱼皮"→食材鱼皮 / "Sora"→Kingdom Hearts 角色 / 同名代币）→ 上限 10；同名不同人 → 上限 20
4. **hotScore (0-100)** — 内容客观传播潜力。有互动数据的源（hackernews/bilibili/twitter/weibo）参考实际数字；没互动数据的源（bing/google/sogou/baidu/arxiv/ai_blog/ai_news_zh/reddit）按"内容本身的话题性 + 标题信息密度"主观估。
5. **importance (low / medium / high / urgent)** — 对**关心 K 的人**值不值得看：
   - urgent 突发必看（发布、出事、安全漏洞、收购）
   - high 重要更新（新功能、关键观点、产品发布）
   - medium 日常动态
   - low 边缘 / 旧闻新炒
6. **isSpam (bool)** — 广告 / 营销软文 / 低质灌水。**"和 K 不相关" ≠ isSpam**，那是 relevScore 的事。

### 额外写出两个字段

- **summary** ≤ 50 字中文。AI 摘要，浓缩"这条说了什么 / 它和 K 啥关系"。**不要照抄 RSS summary**。
- **reason** ≤ 20 字。说明 relevScore 的关键依据。卡片里渲染为 `✦ {reason}` chip。

## Step 3 — 过滤（项目同款双门槛 + 配额）

按顺序应用：

1. `isSpam == true` → drop
2. `relevScore < 50` → drop
3. `!keywordMentioned && relevScore < 65` → drop（二级门槛）
4. `--since-days` 未生效时，>14 天 + importance < high → drop
5. URL 已自动去重；同源同标题已自动去重；标题语义重复（同事件不同源转发）由你合并

如果过滤后 < 3 条，放宽到 `relevScore >= 35` 再试。还不够就坦白告诉用户。

### 每源配额（与项目 `SOURCE_QUOTA` 一致）

| source | quota | source | quota |
|---|---:|---|---:|
| twitter | 15 | reddit | 10 |
| weibo | 10 | hackernews | 8 |
| bilibili | 8 | baidu | 8 |
| arxiv | 6 | ai_blog | 6 |
| ai_news_zh | 6 | bing | 5 |
| google | 5 | sogou | 3 |

入选后按 **importance desc → relevScore desc → hotScore desc** 排序（项目同款）。

## Step 4 — 写 Markdown 速报（卡片流，贴合项目 TopicCard）

每条入选条目渲染为一张**卡片**。卡片样式严格按下面的模板，**和项目 feed 视觉一一对应**：

````markdown
# {关键词} 速报 · {YYYY-MM-DD}

`{N} 候选 → {M} 入选` · 时间窗 `{since_days}d` · 源命中 `{逐源 count，"·" 连接}`

## TL;DR
- {3-5 条 bullet，每条 ≤ 35 字，动词开头，"发生了什么"}

---

{每张卡片，按 importance desc → relevScore desc 排序}
{紧急 / 重要的（urgent / high）卡片之间用 `---` 分隔；
medium 的卡片在标题"## 一般动态"下顺序排列；
low 的全部塞进"## 边缘提及"，每条一行}

---

## 顶部紧急区（importance = urgent / high）

`{SOURCE_LABEL}` · @{author}{✓ 若 verified} · `{followers 缩写, 仅 twitter}` · `{时间相对值, 如 2h ago}` · 🔥 `{hotScore}` · 🚨 **URGENT** 或 ⚠ **HIGH**

### [{标题}]({url})

{你写的 summary（≤ 50 字），重述不照抄}

{互动行：0 值的字段完全省略；rel + reason 必带}
♥ `{likes}` · 🔁 `{reposts}` · 💬 `{comments}` · 👁 `{views_缩写}` · `rel {relevScore}` · ✦ {reason}

{若有"其他来源转发同事件"，下面接一行}
其他来源：[{src2}]({url2}) · [{src3}]({url3})

---

## 一般动态（importance = medium）

{重复上面同款卡片样式，只是省去 🚨/⚠ 那一格}

---

## 边缘提及（importance = low 或 relevScore 50-60）

- `{SOURCE_LABEL}` [{标题}]({url}) — {一句话，≤ 20 字}
- ...

---

`数据源：{sources_used 逗号分隔}` · `抓取：{fetched_at 转用户本地时区}` · `评分：6 维（real/relev/hot/importance/isSpam/keywordMentioned），由 Claude 在生成时评估，对齐 ai-hot-news-report analyzer.ts`
````

### 视觉细节（严格遵守 — 这是和项目卡片对齐的关键）

1. **SOURCE_LABEL 用以下大写映射**（与项目 `SOURCE_LABELS` 一致）：
   `BING` `GOOGLE` `HN` `REDDIT` `ARXIV` `WEIBO` `BILIBILI` `SOGOU` `BAIDU` `AI BLOG` `AI 中文` `TWITTER`
2. **`✓` blue tick** 只在 `extra.verified == true` 时写（仅 twitter）。
3. **followers 缩写**：≥10000 写 `12.3w`；≥1000 写 `1.2k`；其他写原数。**仅 twitter 卡片显示**。
4. **互动数缩写同上**（项目 `formatCount`）。
5. **0 值的互动数据完全隐藏**（不是写 `0` 或 `—`，是**整段省略**）。这是项目卡片关键设计。
6. **时间用相对值**：`2h ago` / `3d ago` / `1w ago`。算不出来就回退到 `YYYY-MM-DD HH:MM`。
7. **🔥 hotScore 一律带**，无论数值多少。
8. **importance 标识**只在 urgent / high 时显示。medium / low 不写。
9. **`rel` 标签必带**，对齐卡片 metric 行的 `rel 92`。
10. **`✦ {reason}`** 是 AI 相关性判断的 chip，一定要写，不要省。
11. **标题用 `###` 三级**，与项目 `text-[15.5px] font-medium` 视觉接近。
12. **summary 一段，≤ 50 字**（对齐项目 `summary` 字段长度，"line-clamp-2" 大约 2 行）。
13. **"其他来源"行**仅在同事件多源转发时出现；用 `·` 连接。
14. **不要给 url 加额外的 emoji 或 ↗**（项目卡片是 hover 才出 Open ↗；速报里链接化标题即可）。

### 写作守则（容易踩的坑）

1. **TL;DR 必须是"事件式"陈述**：✗ "Sora 2 引发讨论" ✓ "OpenAI 发布 Sora 2 商用 API，定价 $0.10/秒，限 720p"
2. **剥源尾巴**：标题里 "- 搜狐网" / "| 雪球" / " | Hacker News" / "_哔哩哔哩_bilibili" 一律删
3. **保留具体性**：数字、版本号、人名、引用 — 全留
4. **Google News URL** 是 `news.google.com/rss/articles/CBM...?oc=5` 中转链 — 那**就是**正确链接，不要"还原"
5. **同事件合并**：bing 一条 + 3 条 google 转发 = 1 张主卡 + "其他来源"列 3 个链接
6. **空 summary 源（sogou/baidu）** 一律由你重写 summary（基于标题推测，写"标题暗示…"或者直接写"暂无 summary，详情见原文"）
7. **weibo 卡片 summary** 写"上微博热搜，热度 XXX"即可，不要硬塞分析
8. **bilibili 卡片** 把"播放 N · 弹幕评论 M"用 `👁 N · 💬 M` 表示（项目卡片把 play 算 views）
9. **arxiv 卡片**：作者放 `@author` 那一格；summary 用 abstract 的核心句，**用中文转述**
10. **空区段保留 + 写明原因**："本窗口无紧急更新。" 比直接删了更好

## 可选：补抓正文

用户明确要"详细一点 / 把正文也读一下"，且环境里有 `FIRECRAWL_API_KEY`，可以用 WebFetch 拉关键的 1-3 条原文做更深入摘要。没 key 就基于 title + summary 写。**不要**自动给每条都补抓。

## 边界与诚实声明

- **本地优先**：本 skill 是脱离 `ai-hot-news-report` 项目独立运行的轻量版，逻辑对齐但不连项目数据库 / SSE / 通知队列。
- **私域账号订阅未接**：项目支持 `twitter:@handle` / `bilibili:uid` 账号 timeline，skill 暂未实现。要订阅账号，用主项目。
- **HTML 爬虫不稳定**：sogou / baidu 反爬触发就在 `errors` 里报错，不重试也不上 Firecrawl（避免引入依赖）。如果用户问"为什么 sogou 没数据"，看 errors。
- **时效**：默认抓近 1-7 天。问"上个月"的事，能拉到的不多，直说。
- **字面命中**：脚本不做语义扩展，泛词建议用户给具体名字。

## 调试 tips

- 只测单源：`--sources weibo`
- 看一周内：`--since-days 7`
- weibo 没数据是正常 —— 只返回**上了热搜**的话题
- sogou/baidu 偶发返回 0 是反爬，重跑一次或换关键词
- `fetched_at` 是 UTC ISO 8601，写速报转本地时区
- Twitter：`export TWITTER_API_KEY=...`（用 twitterapi.io 的 key，不是 X 官方 API；同项目 env）
