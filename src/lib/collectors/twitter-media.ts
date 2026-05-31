/**
 * 把 twitterapi.io 返回的 extendedEntities.media 拼成 Markdown 块。
 *
 * 视觉策略：
 * - 图片 / 动图 → ![](media_url_https)
 * - 视频 → ![](静帧) + [▶ 视频](最高码率 mp4 URL)
 *
 * 同时把文本里指向同一份媒体的 t.co 链接剔掉，避免"裸链+图片"重复。
 */

export interface TwitterMedia {
  type?: string; // "photo" | "video" | "animated_gif"
  media_url_https?: string;
  url?: string; // 对应文本中的 t.co 短链
  video_info?: {
    variants?: Array<{
      bitrate?: number;
      content_type?: string;
      url?: string;
    }>;
  };
}

export interface TweetWithMedia {
  text: string;
  extendedEntities?: { media?: TwitterMedia[] };
}

function pickBestMp4(media: TwitterMedia): string | undefined {
  const variants = media.video_info?.variants ?? [];
  return variants
    .filter((v) => v.content_type === "video/mp4" && !!v.url)
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url;
}

/** 从推文文本里剔除所有指向 media 的 t.co 短链 */
export function cleanTweetText(t: TweetWithMedia): string {
  let text = t.text ?? "";
  const media = t.extendedEntities?.media ?? [];
  for (const m of media) {
    if (m.url) text = text.split(m.url).join("");
  }
  return text.replace(/[ \t]+\n/g, "\n").trim();
}

/** 拼出媒体 markdown 块，无媒体返回空字符串 */
export function buildMediaMarkdown(t: TweetWithMedia): string {
  const media = t.extendedEntities?.media ?? [];
  if (media.length === 0) return "";

  const lines: string[] = [];
  for (const m of media) {
    const kind = m.type;
    if (kind === "photo" || kind === "animated_gif") {
      if (m.media_url_https) lines.push(`![](${m.media_url_https})`);
    } else if (kind === "video") {
      const thumb = m.media_url_https;
      const mp4 = pickBestMp4(m);
      if (thumb) lines.push(`![](${thumb})`);
      if (mp4) lines.push(`[▶ 视频](${mp4})`);
    }
  }
  return lines.join("\n\n");
}

/** 文本 + 媒体 markdown 一站式拼装，用作 rawContent */
export function buildTweetRawContent(t: TweetWithMedia): string {
  const text = cleanTweetText(t);
  const media = buildMediaMarkdown(t);
  if (text && media) return `${text}\n\n${media}`;
  return text || media;
}
