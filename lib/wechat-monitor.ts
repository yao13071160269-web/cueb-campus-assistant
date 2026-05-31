export interface WechatArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishTime: string;
  url: string;
  coverImage?: string;
}

const WERSS_API = process.env.WERSS_API_URL || "http://localhost:8001";
const WERSS_KEY = process.env.WERSS_API_KEY || "";

const ALLOWED_SOURCES = ["首经贸EDA创展", "CUEBCDA", "首都经济贸易大学学生处"];

async function fetchFromWeRSS(): Promise<WechatArticle[]> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (WERSS_KEY) headers["Authorization"] = `Bearer ${WERSS_KEY}`;

    const res = await fetch(`${WERSS_API}/api/v1/wx/articles?page=1&page_size=20`, {
      headers,
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`WeRSS API error: ${res.status}`);

    const data = await res.json();
    const articles: WechatArticle[] = (data.data?.items || data.items || [])
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

    return articles;
  } catch {
    return [];
  }
}

export async function getWechatArticles(): Promise<WechatArticle[]> {
  return await fetchFromWeRSS();
}

export function getNoDataMessage(): string {
  return "当前未接入微信公众号实时数据源。活动通知仅从「首经贸EDA创展」「CUEBCDA」「首都经济贸易大学学生处」三个官方公众号获取，不提供任何虚构信息。请直接关注以上公众号查看最新活动。";
}
