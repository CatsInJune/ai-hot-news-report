#!/usr/bin/env python3
"""
Fetch news candidates for a keyword from multiple public sources.

Mirrors the source list of the ai-hot-news-report project. Python stdlib only.

Sources (no key needed):
  - bing        : Bing News RSS                (phrase-matched)
  - google      : Google News RSS              (zh-CN, phrase-matched)
  - hackernews  : HN Algolia search            (skipped for pure-Chinese keywords)
  - reddit      : Reddit search RSS (Atom)
  - arxiv       : arXiv API (cs.AI/cs.LG/cs.CL/cs.CV/cs.MA/cs.NE)
  - weibo       : Weibo hot search             (上榜检测，不是搜索)
  - bilibili    : Bilibili search API
  - sogou       : Sogou web search (HTML)      (反爬容易触发，失败回空)
  - baidu       : Baidu News (HTML)            (反爬容易触发，失败回空)
  - ai_blog     : OpenAI / Google AI / HuggingFace / DeepMind 官方博客聚合
  - ai_news_zh  : 量子位 / 36氪 中文 AI 媒体聚合

Sources (optional, gracefully skipped if env not set):
  - twitter     : twitterapi.io ($TWITTER_API_KEY)

Output: JSON on stdout. See SKILL.md.

Usage:
  python fetch_news.py "Sora 2"
  python fetch_news.py "Sora 2" --sources bing,google,reddit
  python fetch_news.py "Sora 2" --since-days 7
"""
from __future__ import annotations

import argparse
import html as html_mod
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

UA_DEFAULT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
UA_BOT = "ai-hot-news-monitor:v1.0"
TIMEOUT = 12

NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "dc": "http://purl.org/dc/elements/1.1/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}


def _http_get(url: str, headers: dict | None = None) -> bytes:
    h = {"User-Agent": UA_DEFAULT, "Accept": "*/*"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def _strip_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", "", s)
    s = html_mod.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def _parse_rfc2822(s: str | None) -> str | None:
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _parse_iso(s: str | None) -> str | None:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def _phrase(keyword: str) -> str:
    return keyword if '"' in keyword else f'"{keyword}"'


def _has_chinese(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", s))


def _normalize_kw(s: str) -> str:
    return re.sub(r'[\s#【】「」『』""''""]', "", s).lower()


def _kw_tokens(s: str) -> list[str]:
    norm = _normalize_kw(s)
    return [t for t in re.split(r"[^a-z0-9\u4e00-\u9fa5]+", norm) if len(t) >= 2]


def _matches_keyword(text: str, keyword: str) -> bool:
    """Loose字面命中：full keyword 出现 OR 任一长度≥2 token 出现。"""
    if not text:
        return False
    t_norm = _normalize_kw(text)
    k_norm = _normalize_kw(keyword)
    if k_norm and k_norm in t_norm:
        return True
    return any(tok in t_norm for tok in _kw_tokens(keyword))


def _item(**kw) -> dict:
    return {
        "title": (kw.get("title") or "").strip(),
        "summary": (kw.get("summary") or "").strip(),
        "url": (kw.get("url") or "").strip(),
        "source": kw["source"],
        "author": kw.get("author"),
        "publishedAt": kw.get("publishedAt"),
        "likes": kw.get("likes") or 0,
        "reposts": kw.get("reposts") or 0,
        "comments": kw.get("comments") or 0,
        "views": kw.get("views") or 0,
        "extra": kw.get("extra"),
    }


# ============================================================
# RSS helpers
# ============================================================
def _parse_rss_items(xml_bytes: bytes) -> list[ET.Element]:
    root = ET.fromstring(xml_bytes)
    return root.findall(".//item")


# ============================================================
# 1. Bing News RSS
# ============================================================
def fetch_bing(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(_phrase(keyword))
    url = f"https://www.bing.com/news/search?q={q}&format=RSS"
    out = []
    for item in _parse_rss_items(_http_get(url))[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        out.append(_item(
            source="bing",
            title=title,
            summary=_strip_html(item.findtext("description") or ""),
            url=link,
            author=item.findtext("dc:creator", namespaces={"dc": NS["dc"]}) or item.findtext("author"),
            publishedAt=_parse_rfc2822(item.findtext("pubDate")),
        ))
    return out


# ============================================================
# 2. Google News RSS
# ============================================================
def fetch_google(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(_phrase(keyword))
    url = f"https://news.google.com/rss/search?q={q}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
    out = []
    for item in _parse_rss_items(_http_get(url))[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        out.append(_item(
            source="google",
            title=title,
            summary=_strip_html(item.findtext("description") or ""),
            url=link,
            author=item.findtext("source"),
            publishedAt=_parse_rfc2822(item.findtext("pubDate")),
        ))
    return out


# ============================================================
# 3. HackerNews Algolia
# ============================================================
def fetch_hackernews(keyword: str, limit: int) -> list[dict]:
    if _has_chinese(keyword):
        return []
    q = urllib.parse.quote(keyword)
    url = f"https://hn.algolia.com/api/v1/search?query={q}&tags=story&hitsPerPage={limit}"
    data = json.loads(_http_get(url).decode("utf-8"))
    out = []
    for h in data.get("hits", []):
        link = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}"
        title = h.get("title")
        if not title:
            continue
        out.append(_item(
            source="hackernews",
            title=title,
            summary=(h.get("story_text") or "")[:400],
            url=link,
            author=h.get("author"),
            publishedAt=h.get("created_at"),
            likes=h.get("points") or 0,
            comments=h.get("num_comments") or 0,
        ))
    return out


# ============================================================
# 4. Reddit search RSS (Atom)
# ============================================================
def fetch_reddit(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(keyword)
    url = f"https://www.reddit.com/search.rss?q={q}&sort=new&limit={limit}"
    root = ET.fromstring(_http_get(url))
    out = []
    for entry in root.findall("atom:entry", NS)[:limit]:
        title = (entry.findtext("atom:title", default="", namespaces=NS) or "").strip()
        link_el = entry.find("atom:link", NS)
        link = link_el.get("href") if link_el is not None else ""
        if not title or not link:
            continue
        author = entry.findtext("atom:author/atom:name", default="", namespaces=NS) or None
        content = _strip_html(entry.findtext("atom:content", default="", namespaces=NS))
        # Reddit Atom 描述模板尾巴：`submitted by /u/xxx [link] [comments]` —— 砍掉
        content = re.sub(r"\s*\[link\]\s*\[comments\]\s*$", "", content, flags=re.I).strip()
        cat = entry.find("atom:category", NS)
        subreddit = (cat.get("label") or cat.get("term")) if cat is not None else None
        out.append(_item(
            source="reddit",
            title=title,
            summary=content[:400],
            url=link,
            author=author,
            publishedAt=_parse_iso(entry.findtext("atom:updated", namespaces=NS)
                                  or entry.findtext("atom:published", namespaces=NS)),
            extra={"subreddit": subreddit} if subreddit else None,
        ))
    return out


# ============================================================
# 5. arXiv (限定 cs.* 分类，对齐项目)
# ============================================================
AI_CATS = ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.MA", "cs.NE"]

def fetch_arxiv(keyword: str, limit: int) -> list[dict]:
    if _has_chinese(keyword):
        return []
    phrase = urllib.parse.quote(_phrase(keyword))
    cat_filter = "+OR+".join(f"cat:{c}" for c in AI_CATS)
    q = f"all:{phrase}+AND+({cat_filter})"
    url = (
        f"https://export.arxiv.org/api/query?search_query={q}"
        f"&sortBy=submittedDate&sortOrder=descending&max_results={limit}"
    )
    root = ET.fromstring(_http_get(url, headers={"User-Agent": UA_BOT}))
    out = []
    for entry in root.findall("atom:entry", NS):
        title = re.sub(r"\s+", " ", entry.findtext("atom:title", default="", namespaces=NS)).strip()
        link = (entry.findtext("atom:id", default="", namespaces=NS) or "").strip()
        if not title or not link:
            continue
        authors = [a.findtext("atom:name", default="", namespaces=NS) for a in entry.findall("atom:author", NS)]
        out.append(_item(
            source="arxiv",
            title=title,
            summary=re.sub(r"\s+", " ", entry.findtext("atom:summary", default="", namespaces=NS))[:500],
            url=link,
            author=", ".join(authors[:3]) + (" et al." if len(authors) > 3 else ""),
            publishedAt=_parse_iso(entry.findtext("atom:published", namespaces=NS)),
        ))
    return out


# ============================================================
# 6. Weibo hot search (上榜检测)
# ============================================================
def fetch_weibo(keyword: str, limit: int) -> list[dict]:
    url = "https://weibo.com/ajax/side/hotSearch"
    data = json.loads(_http_get(url, headers={"Referer": "https://weibo.com/", "Accept": "application/json"}).decode("utf-8"))
    if data.get("ok") != 1:
        return []
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for it in (data.get("data", {}).get("realtime") or [])[: limit * 4]:
        topic = (it.get("note") or it.get("word") or "").strip()
        if not topic:
            continue
        if not _matches_keyword(topic, keyword):
            continue
        url_topic = f"https://s.weibo.com/weibo?q={urllib.parse.quote(f'#{topic}#')}"
        out.append(_item(
            source="weibo",
            title=f"微博热搜：{topic}",
            summary=f"微博热搜话题「{topic}」，热度 {it.get('num', 0):,}",
            url=url_topic,
            publishedAt=now,
            views=it.get("num") or 0,
        ))
        if len(out) >= limit:
            break
    return out


# ============================================================
# 7. Bilibili search API
# ============================================================
def fetch_bilibili(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(keyword)
    url = (
        f"https://api.bilibili.com/x/web-interface/search/type"
        f"?search_type=video&keyword={q}&order=pubdate&page=1"
    )
    data = json.loads(_http_get(url, headers={
        "Referer": "https://www.bilibili.com/",
        "Cookie": "buvid3=; b_nut=; _uuid=;",
    }).decode("utf-8"))
    if data.get("code") != 0:
        return []
    out = []
    for v in (data.get("data", {}).get("result") or [])[:limit]:
        title = re.sub(r"<[^>]+>", "", v.get("title") or "")
        bvid = v.get("bvid")
        if not title or not bvid:
            continue
        pub = v.get("pubdate")
        out.append(_item(
            source="bilibili",
            title=title,
            summary=v.get("description") or "",
            url=f"https://www.bilibili.com/video/{bvid}",
            author=v.get("author"),
            publishedAt=datetime.fromtimestamp(pub, tz=timezone.utc).isoformat() if pub else None,
            views=v.get("play") or 0,
            comments=v.get("video_review") or 0,
        ))
    return out


# ============================================================
# 8. Sogou web search (HTML 爬，反爬触发就回空)
# ============================================================
class _SogouParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items: list[dict] = []
        self._in_h3a = False
        self._href = None
        self._title_buf: list[str] = []
        self._post_h3 = False
        self._snippet_buf: list[str] = []
        self._cap_snippet = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a" and "href" in a:
            # detect h3 > a pattern by checking parent: we approximate by class hints
            if any(c in (a.get("class") or "") for c in ("vr-title", "vrTitle")):
                self._start_title(a["href"])
        # h3 anchor: most sogou results use <h3><a href=...>
        if tag == "h3":
            self._post_h3 = True
        if self._post_h3 and tag == "a" and not self._in_h3a:
            self._start_title(a.get("href", ""))

    def _start_title(self, href: str):
        self._in_h3a = True
        self._href = href
        self._title_buf = []

    def handle_endtag(self, tag):
        if tag == "h3":
            self._post_h3 = False
        if tag == "a" and self._in_h3a:
            title = re.sub(r"\s+", " ", "".join(self._title_buf)).strip()
            href = (self._href or "").strip()
            if title and href and "大家还在搜" not in title and "sogou-ad" not in href:
                if href.startswith("/"):
                    href = f"https://www.sogou.com{href}"
                self.items.append({"title": title, "url": href})
                self._cap_snippet = 1  # start capturing trailing text as snippet
                self._snippet_buf = []
            self._in_h3a = False
            self._href = None

    def handle_data(self, data):
        if self._in_h3a:
            self._title_buf.append(data)
        elif self._cap_snippet and self.items:
            self._snippet_buf.append(data)
            joined = "".join(self._snippet_buf)
            if len(joined) > 400:
                self.items[-1]["summary"] = re.sub(r"\s+", " ", joined).strip()[:400]
                self._cap_snippet = 0


def fetch_sogou(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(keyword)
    url = f"https://www.sogou.com/web?query={q}&ie=utf8"
    body = _http_get(url, headers={
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }).decode("utf-8", errors="replace")
    if any(x in body for x in ("antispider", "VerifyCode", "验证码")):
        raise RuntimeError("anti-spider triggered")
    p = _SogouParser()
    p.feed(body)
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for it in p.items[:limit]:
        out.append(_item(
            source="sogou",
            title=it["title"],
            summary=it.get("summary", ""),
            url=it["url"],
            publishedAt=now,
        ))
    return out


# ============================================================
# 9. Baidu News (HTML 爬，反爬触发就回空)
# ============================================================
class _BaiduParser(HTMLParser):
    """Extract <h3><a href=...>title</a></h3> from .result-op / .c-container blocks.

    We don't strictly track container — just collect every h3>a anchor with http URL.
    """
    def __init__(self):
        super().__init__()
        self.items: list[dict] = []
        self._in_h3 = False
        self._in_a = False
        self._href = None
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "h3":
            self._in_h3 = True
        elif tag == "a" and self._in_h3:
            d = dict(attrs)
            self._in_a = True
            self._href = d.get("href")
            self._buf = []

    def handle_endtag(self, tag):
        if tag == "a" and self._in_a:
            title = re.sub(r"\s+", " ", "".join(self._buf)).strip()
            href = (self._href or "").strip()
            if title and href.startswith("http"):
                self.items.append({"title": title, "url": href})
            self._in_a = False
            self._href = None
            self._buf = []
        if tag == "h3":
            self._in_h3 = False

    def handle_data(self, data):
        if self._in_a:
            self._buf.append(data)


def fetch_baidu(keyword: str, limit: int) -> list[dict]:
    q = urllib.parse.quote(keyword)
    url = f"https://www.baidu.com/s?wd={q}&tn=news&rtt=4&ie=utf-8"
    body = _http_get(url, headers={
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }).decode("utf-8", errors="replace")
    if any(x in body for x in ("百度安全验证", "wappass", "aladdin verify")):
        raise RuntimeError("baidu security verify triggered")
    p = _BaiduParser()
    p.feed(body)
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for it in p.items[:limit]:
        out.append(_item(
            source="baidu",
            title=it["title"],
            url=it["url"],
            publishedAt=now,
        ))
    return out


# ============================================================
# 10. AI Blog aggregator (OpenAI / Google AI / HuggingFace / DeepMind)
# 11. Chinese AI media aggregator (量子位 / 36氪)
# ============================================================
AI_BLOG_FEEDS = [
    ("OpenAI", "https://openai.com/news/rss.xml"),
    ("Google AI", "https://blog.google/technology/ai/rss/"),
    ("HuggingFace", "https://huggingface.co/blog/feed.xml"),
    ("DeepMind", "https://deepmind.google/blog/rss.xml"),
]
AI_NEWS_ZH_FEEDS = [
    ("量子位", "https://www.qbitai.com/feed"),
    ("36氪", "https://www.36kr.com/feed"),
]


def _fetch_aggregated_rss(keyword: str, feeds: list[tuple[str, str]], source_label: str,
                          per_feed: int, total_limit: int) -> list[dict]:
    out: list[dict] = []
    errors: list[str] = []
    for name, url in feeds:
        try:
            for item in _parse_rss_items(_http_get(url))[:per_feed]:
                title = (item.findtext("title") or "").strip()
                link = (item.findtext("link") or "").strip()
                if not title or not link:
                    continue
                desc = _strip_html(item.findtext("description") or "")
                full = f"{title} {desc}"
                if not _matches_keyword(full, keyword):
                    continue
                out.append(_item(
                    source=source_label,
                    title=title,
                    summary=desc[:400],
                    url=link,
                    author=name,
                    publishedAt=_parse_rfc2822(item.findtext("pubDate"))
                               or _parse_iso(item.findtext("dc:date", namespaces={"dc": NS["dc"]})),
                ))
        except Exception as e:
            errors.append(f"{name}: {type(e).__name__}: {e}")
    if errors and not out:
        raise RuntimeError(f"All sub-feeds failed: {'; '.join(errors)}")
    return out[:total_limit]


def fetch_ai_blog(keyword: str, limit: int) -> list[dict]:
    return _fetch_aggregated_rss(keyword, AI_BLOG_FEEDS, "ai_blog", per_feed=30, total_limit=limit)


def fetch_ai_news_zh(keyword: str, limit: int) -> list[dict]:
    return _fetch_aggregated_rss(keyword, AI_NEWS_ZH_FEEDS, "ai_news_zh", per_feed=40, total_limit=limit)


# ============================================================
# 12. Twitter via twitterapi.io (optional)
# ============================================================
def fetch_twitter(keyword: str, limit: int) -> list[dict]:
    api_key = os.environ.get("TWITTER_API_KEY") or os.environ.get("TWITTERAPI_IO_KEY")
    if not api_key:
        return []
    phrase = keyword if '"' in keyword else f'"{keyword}"'
    query = f"{phrase} -filter:replies -filter:retweets"
    seen: set[str] = set()
    out: list[dict] = []
    for qt in ("Top", "Latest"):
        params = urllib.parse.urlencode({"query": query, "queryType": qt})
        url = f"https://api.twitterapi.io/twitter/tweet/advanced_search?{params}"
        data = json.loads(_http_get(url, headers={"X-API-Key": api_key}).decode("utf-8"))
        for t in (data.get("tweets") or []):
            tid = t.get("id")
            if not tid or tid in seen:
                continue
            seen.add(tid)
            author = t.get("author") or {}
            likes = t.get("likeCount") or 0
            rts = t.get("retweetCount") or 0
            views = t.get("viewCount") or 0
            followers = author.get("followers") or 0
            verified = author.get("isBlueVerified") or False
            passes = (
                likes >= 20 or rts >= 5 or views >= 5000
                or ((followers >= 500 or verified) and (likes >= 3 or views >= 500))
            )
            if not passes:
                continue
            text = (t.get("text") or "").strip()
            url_tw = t.get("url") or f"https://twitter.com/{author.get('userName', 'i')}/status/{tid}"
            out.append(_item(
                source="twitter",
                title=text[:140],
                summary=text,
                url=url_tw,
                author=author.get("name") or author.get("userName"),
                publishedAt=_parse_rfc2822(t.get("createdAt")) or t.get("createdAt"),
                likes=likes,
                reposts=rts,
                comments=t.get("replyCount") or 0,
                views=views,
                extra={
                    "verified": verified,
                    "followers": followers,
                    "handle": author.get("userName"),
                },
            ))
            if len(out) >= limit:
                break
        if len(out) >= limit:
            break
    return out


FETCHERS = {
    "bing": fetch_bing,
    "google": fetch_google,
    "hackernews": fetch_hackernews,
    "reddit": fetch_reddit,
    "arxiv": fetch_arxiv,
    "weibo": fetch_weibo,
    "bilibili": fetch_bilibili,
    "sogou": fetch_sogou,
    "baidu": fetch_baidu,
    "ai_blog": fetch_ai_blog,
    "ai_news_zh": fetch_ai_news_zh,
    "twitter": fetch_twitter,
}

DEFAULT_SOURCES = list(FETCHERS.keys())


def main() -> int:
    p = argparse.ArgumentParser(description="Fetch news candidates for a keyword.")
    p.add_argument("keyword")
    p.add_argument("--sources", default=",".join(DEFAULT_SOURCES),
                   help=f"Comma-separated. Valid: {','.join(FETCHERS)}")
    p.add_argument("--limit", type=int, default=15, help="Max per source (default 15)")
    p.add_argument("--since-days", type=int, default=0,
                   help="Drop items older than N days (0=off, default)")
    args = p.parse_args()

    requested = [s.strip() for s in args.sources.split(",") if s.strip()]
    unknown = [s for s in requested if s not in FETCHERS]
    if unknown:
        print(f"Unknown source(s): {unknown}. Valid: {list(FETCHERS)}", file=sys.stderr)
        return 2

    # 区分"显式跳过"和"实际跑"
    skipped: list[dict] = []
    sources: list[str] = []
    for s in requested:
        if s == "twitter" and not (os.environ.get("TWITTER_API_KEY") or os.environ.get("TWITTERAPI_IO_KEY")):
            skipped.append({"source": s, "reason": "TWITTER_API_KEY not set"})
            continue
        sources.append(s)

    results: list[dict] = []
    errors: list[dict] = []
    with ThreadPoolExecutor(max_workers=min(len(sources) or 1, 8)) as ex:
        future_map = {ex.submit(FETCHERS[s], args.keyword, args.limit): s for s in sources}
        for fut in as_completed(future_map):
            src = future_map[fut]
            try:
                results.extend(fut.result())
            except Exception as e:
                errors.append({"source": src, "error": f"{type(e).__name__}: {e}"})

    # 去重（URL）
    seen: set[str] = set()
    deduped: list[dict] = []
    for it in results:
        key = it.get("url") or ""
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        deduped.append(it)
    results = deduped

    # 同源同标题去重（sogou 多公众号转载等）
    norm_seen: set[str] = set()
    title_deduped: list[dict] = []
    for it in results:
        norm_title = re.sub(r"\s+", "", it["title"].lower())
        key = f"{it['source']}::{norm_title}"
        if key in norm_seen:
            continue
        norm_seen.add(key)
        title_deduped.append(it)
    results = title_deduped

    # 时间窗口
    if args.since_days > 0:
        cutoff = datetime.now(timezone.utc) - timedelta(days=args.since_days)
        kept = []
        for it in results:
            ts = it.get("publishedAt")
            if not ts:
                kept.append(it)
                continue
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if dt >= cutoff:
                    kept.append(it)
            except Exception:
                kept.append(it)
        results = kept

    # 排序
    def sort_key(it: dict):
        ts = it.get("publishedAt")
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() if ts else 0
        except Exception:
            t = 0
        return (0 if ts else 1, -t)

    results.sort(key=sort_key)

    by_source: dict[str, int] = {}
    for it in results:
        by_source[it["source"]] = by_source.get(it["source"], 0) + 1

    print(json.dumps({
        "keyword": args.keyword,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "sources_used": sources,
        "skipped": skipped,
        "count": len(results),
        "by_source": by_source,
        "errors": errors,
        "items": results,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
