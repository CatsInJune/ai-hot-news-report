# Bug Report — E2E 验证（2026-05-28）

通过 chrome-devtools MCP 对 4 个页面（feed / keywords / alerts / config）+ 6 个 API 端点做端到端验证。
覆盖：导航、SSE 连接、关键词增删改、通知读写、设置展示、手动采集、数据完整性。

环境：Next.js 16.2.6 + Turbopack · Node 服务端 dev (PID 41681) · SQLite 466 topics / 4 keywords。

---

## 验证矩阵

| 模块 | 路径 | 方法 | 结果 |
|------|------|------|------|
| 首页 Feed | `/` | render + SSE | ✅ 渲染正常，SSE 连接建立，50 条 topic 加载 |
| 顶栏导航 | `TopBar` | 4 项 nav | ✅ 切换正常，active 下划线 motion 正确 |
| Topic stats | `GET /api/topics?stats=1` | json | ✅ `{ total: 466, today: 227 }` |
| Keywords 列表 | `/keywords` | render | ✅ 3 个已存在关键词正确渲染（ACTIVE/TOTAL/HITS = 1/3/369） |
| Keywords 新增 | `POST /api/keywords` | form | ✅ 创建 `e2e-test-keyword` 成功，列表立即出现，ACTIVE/TOTAL 自动 +1 |
| Keywords toggle | `PATCH /api/keywords/[id]` | active:false | ✅ active 正确切换 |
| Keywords 删除 | `DELETE /api/keywords/[id]` | — | ✅ 200，记录从 DB 移除 |
| Notifications | `GET /api/notifications` | json | ✅ 返回 100 条历史通知 |
| Mark all read | `PATCH /api/notifications` | markAllRead:true | ✅ |
| Unread count | `GET /api/notifications?unread=1` | json | ❌ **Bug #2**（已修复） |
| Settings | `GET /api/settings` | json | ✅ env 状态正确（openrouter/twitter/firecrawl 已配置，smtp 未配置） |
| 手动采集 | `POST /api/collect` | trigger | ✅ 12 条新内容入库，耗时 ~20s |
| AI 分析 | `lib/analyzer.ts` | per-topic | ❌ **Bug #1**（已修复，修复后 460/466 = 98.7% 成功率） |
| Console errors | DevTools | — | ✅ 0 errors / 0 warnings |
| Build (`next build`) | — | tsc | ✅ 编译 + 类型检查通过 |

---

## Bug #1 — analyzer `max_tokens` 超出 OpenRouter 免费账户配额 🔴 HIGH

**症状**：
dev log 中持续出现：
```
[Analyzer] AI 分析失败: 402 This request requires more credits, or fewer max_tokens.
You requested up to 32768 tokens, but can only afford 18494.
```
所有新采集 topic 的 `hotScore` / `realScore` / `summary` 字段保留默认值 `null` / `0`，
首页 Feed 卡片左侧热度数字大批量显示 `0`，AI 评分体系完全降级。

**根因**：
[src/lib/analyzer.ts](../src/lib/analyzer.ts) 调用 `openrouter.chat.completions.create()` 时
**未显式传 `max_tokens`**。OpenRouter / OpenAI SDK 在未设置时，会把模型默认输出预算（DeepSeek V3.1 = 32768，部分模型 65536）当作请求上限上报，OpenRouter 据此预扣信用，免费账户余额 ~$0.02 撑不住一次 32K token 的预付，直接 402 拒绝。

**实际响应**只是一个 6 字段的小 JSON（~150–300 token），分配 32K 是巨大浪费。

**修复**：[src/lib/analyzer.ts:55-58](../src/lib/analyzer.ts#L55-L58)
```ts
temperature: 0.1,
// 输出仅一个小 JSON（6 个字段），1024 token 足够。
// 不显式设置时，部分模型默认 32768/65536，会导致免费账户额度不足 (402)。
max_tokens: 1024,
```

**验证**：修复后再次手动触发 `POST /api/collect`，新写入的 5 条 topic 全部带有
非零 `hotScore` / `realScore` 与中文 `summary`，AI 分析链路完全恢复。

**影响范围**：
- 严重：导致命中关键词的 `relevScore >= 60` 判定失效，应推送的通知未被触发
- 中等：首页 hot 评分排序结果错乱
- 长期：浪费 OpenRouter 额度配额（402 失败前的预扣）

**预防**：
建议为所有未来新增的 AI 调用强制传 `max_tokens` 上限，作为团队代码规范。
可在 `lib/openrouter.ts` 增加一个 `chat({ ... })` 薄包装强制传 `max_tokens` 默认值。

---

## Bug #2 — `/api/notifications?unread=1` 未识别查询参数 🟡 MEDIUM

**症状**：
[src/components/layout/TopBar.tsx](../src/components/layout/TopBar.tsx) 通过 `GET /api/notifications?unread=1`
轮询未读数量、给"alerts"导航项加 badge。但实际 API 永远返回完整通知数组，
前端 `b.unread` 永远是 `undefined`，badge 永远不显示。

**根因**：
[src/app/api/notifications/route.ts](../src/app/api/notifications/route.ts) 的 `GET` 处理函数
没有解析 query string，统一返回 `findMany({ take: 100 })`。

**修复**：[src/app/api/notifications/route.ts:4-18](../src/app/api/notifications/route.ts#L4-L18)
```ts
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("unread") === "1") {
    const unread = await prisma.notification.count({ where: { read: false } });
    return NextResponse.json({ unread });
  }
  // ... 原 findMany 逻辑
}
```

**验证**：
```bash
$ curl -s "http://localhost:3000/api/notifications?unread=1"
{"unread":4}
```

修复后 TopBar 的"alerts"导航项在有未读时正确显示红色徽章。

**影响范围**：
- 中等：用户感知不到新命中（必须主动打开 alerts 页面才能看到）
- 性能：原本只该返回一个数字，却返回 100 条完整记录（含长文本 content/url），浪费带宽

---

## Bug #3 — Lucide `<Bell title="..." />` TypeScript 报错（已修复） ⚪ LOW

**症状**：第二轮 UI 重构期间 `npm run build` 失败：
```
Type error: Property 'title' does not exist on type
'IntrinsicAttributes & Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>'.
```

**根因**：lucide-react@1.16.0 的 SVG 组件 props 不接受原生 `title` 属性。

**修复**：[src/components/keywords/KeywordCard.tsx:131-141](../src/components/keywords/KeywordCard.tsx#L131-L141)
用包裹 `<span title="...">` 实现 tooltip，避免给 Lucide 图标直接传 `title`。

---

## 观察项（非 bug，建议跟进）

### Obs-1 · SourceTabs 0 数量来源不显示数字
**位置**：[src/components/feed/SourceTabs.tsx:32-45](../src/components/feed/SourceTabs.tsx#L32-L45)
**现象**：当 `counts[src]` 为 0 时不渲染计数，tab 看起来空（如 `duckduckgo` / `b站`）。
**建议**：保留显示 `0`，让"该源未抓到任何内容"成为一个清晰信号。改动量小、可读性更高。

### Obs-2 · 设置页 Firecrawl 状态显示 ok 但项目未实际启用
**位置**：[src/app/settings/page.tsx](../src/app/settings/page.tsx) + [src/lib/collectors/](../src/lib/collectors/)
**现象**：`FIRECRAWL_API_KEY` 已配置（settings 显示 ok），但 `src/lib/collectors/` 下没有
任何 collector 调用 Firecrawl。
**建议**：要么实现 firecrawl 接管 duckduckgo / 微博关键词搜索（参考 [project memory](../../.claude/projects/.../memory/project_ai_hot_news.md) 提到的不稳定源），要么从 settings UI 隐藏 firecrawl 状态以免误导。

### Obs-3 · AI 模型超时 / 失败时没有重试
**位置**：[src/lib/analyzer.ts:62-65](../src/lib/analyzer.ts#L62-L65)
**现象**：单条分析失败直接 `catch + return null`，无重试。修复 Bug #1 后仍有 ~1.3%（6/466）topic 没有 AI 评分，可能是瞬时网络错误。
**建议**：加一次 retry（最多 1 次，指数退避 500ms）。代价低，能把成功率拉到 ~100%。

### Obs-4 · `/api/collect` 同步等待 ~20s 才返回
**位置**：[src/app/api/collect/route.ts](../src/app/api/collect/route.ts)
**现象**：用户点"fetch"后浏览器等 ~20s（采集 + 全部 AI 分析串行）才看到响应；
TopBar 按钮虽然 800ms 后已恢复，但实际数据可能还在写入。
**建议**：route handler 立刻返回 202 + 通过 SSE 推送进度，或者直接 fire-and-forget。
当前 SSE 已经在推 `new-topic` 事件，所以前端其实可以乐观更新。

### Obs-5 · 浏览器原生 `confirm()` 用于删除关键词
**位置**：[src/components/keywords/KeywordCard.tsx:49](../src/components/keywords/KeywordCard.tsx#L49)
**现象**：原生 `confirm()` 弹窗样式与暗黑终端风格强烈冲突。
**建议**：替换为自建模态对话框（沿用 `KeywordForm` 的弹层样式即可）。

---

## 验证方法学

- **MCP 工具**：`chrome-devtools` MCP（list_pages / navigate / wait_for / click / fill / evaluate_script / list_console_messages / list_network_requests / take_screenshot）
- **API 直测**：`curl` + `evaluate_script` 内 fetch
- **数据层**：`sqlite3 dev.db` 直接验证 Prisma schema 字段写入完整性
- **服务端日志**：`.next/dev/logs/next-development.log` JSON Lines 格式
- **类型检查**：`npm run build` (Turbopack + tsc)

## 后续待办

- [x] Bug #1 修复 + 验证
- [x] Bug #2 修复 + 验证
- [x] Bug #3 修复（前一轮 UI 改造时已处理）
- [ ] Obs-1 SourceTabs 0-count 显示
- [ ] Obs-2 决定 Firecrawl 启用 vs 隐藏
- [ ] Obs-3 analyzer 重试一次
- [ ] Obs-4 collect 异步化
- [ ] Obs-5 自建删除确认弹窗

---

## 附录：截图

| 页面 | 路径 |
|------|------|
| 首页 Feed | `docs/screenshots/01-home.png` · `docs/screenshots/01-home-full.png` |
