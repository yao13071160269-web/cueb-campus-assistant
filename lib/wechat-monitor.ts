export interface WechatArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishTime: string;
  url: string;
  coverImage?: string;
}

import {
  getStatus,
  fetchAllTargetArticles,
} from "@/lib/wechat-mp-auth";

const ALLOWED_SOURCES = ["首经贸EDA创展", "CUEBCDA", "首都经济贸易大学学生处"];

async function fetchFromBuiltinScraper(): Promise<WechatArticle[]> {
  try {
    const { loggedIn } = await getStatus();
    if (!loggedIn) return [];

    const articles = await fetchAllTargetArticles();
    return articles
      .filter((a) => ALLOWED_SOURCES.some((s) => a.source.includes(s)))
      .map((a, idx) => ({
        id: a.aid || String(idx),
        title: a.title,
        summary: a.digest,
        source: a.source,
        publishTime: a.createTime
          ? new Date(a.createTime * 1000).toISOString()
          : "",
        url: a.link,
        coverImage: a.cover,
      }));
  } catch {
    return [];
  }
}

async function fetchFromWeRSS(): Promise<WechatArticle[]> {
  const WERSS_API = process.env.WERSS_API_URL || "http://localhost:8001";
  try {
    const res = await fetch(
      `${WERSS_API}/api/v1/wx/articles?page=1&page_size=20`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return [];

    const data = await res.json();
    return (data.data?.items || data.items || [])
      .map((item: Record<string, string>, idx: number) => ({
        id: item.id || String(idx),
        title: item.title || "",
        summary: item.summary || item.digest || "",
        source: item.mp_name || item.source || "",
        publishTime: item.publish_time || item.created_at || "",
        url: item.url || item.link || "",
        coverImage: item.cover || item.pic_url || "",
      }))
      .filter((a: WechatArticle) =>
        ALLOWED_SOURCES.some((s) => a.source.includes(s))
      );
  } catch {
    return [];
  }
}

export async function getWechatArticles(): Promise<WechatArticle[]> {
  // Priority: built-in scraper → we-mp-rss Docker (if running)
  const builtinArticles = await fetchFromBuiltinScraper();
  if (builtinArticles.length > 0) return builtinArticles;

  return await fetchFromWeRSS();
}

export function getNoDataMessage(): string {
  return "当前未接入微信公众号实时数据源。请前往「监控管理」页面扫码登录微信公众号平台。活动通知仅从「首经贸EDA创展」「CUEBCDA」「首都经济贸易大学学生处」三个官方公众号获取，不提供任何虚构信息。";
}
