import { getBeijingNow } from "@/lib/beijing-time";

export interface HistoryArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
  publishTime: string;
}

const ACCOUNT_MAP: Record<string, string> = {
  "首经贸EDA创展": "首经贸EDA创展",
  "EDA创展": "首经贸EDA创展",
  "EDA": "首经贸EDA创展",
  "eda": "首经贸EDA创展",
  "CUEBCDA": "CUEBCDA",
  "CDA": "CUEBCDA",
  "cda": "CUEBCDA",
  "学生处": "首都经济贸易大学学生处",
  "首经贸学生处": "首都经济贸易大学学生处",
};

function resolveAccount(input: string): string {
  for (const [key, value] of Object.entries(ACCOUNT_MAP)) {
    if (input.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return input;
}

async function searchViaJinaSearch(query: string): Promise<HistoryArticle[]> {
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: {
        "Accept": "application/json",
        "X-Return-Format": "json",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];

    const contentType = res.headers.get("content-type") || "";
    let results: Array<{ title?: string; url?: string; description?: string; content?: string; published?: string }> = [];

    if (contentType.includes("application/json")) {
      const data = await res.json();
      results = data.data || data.results || data || [];
    } else {
      const text = await res.text();
      return parseMarkdownResults(text);
    }

    if (!Array.isArray(results)) return [];

    return results
      .filter((r) => r.url && (r.url.includes("mp.weixin.qq.com") || r.url.includes("weixin")))
      .map((r) => ({
        title: (r.title || "").replace(/<[^>]*>/g, "").trim(),
        source: extractSource(r.title || "", r.description || r.content || ""),
        url: r.url || "",
        snippet: ((r.description || r.content || "").replace(/<[^>]*>/g, "")).slice(0, 200).trim(),
        publishTime: r.published || extractDate(r.description || r.content || ""),
      }))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function parseMarkdownResults(text: string): HistoryArticle[] {
  const articles: HistoryArticle[] = [];
  const blocks = text.split(/\n(?=\[|\#{1,3}\s)/);

  for (const block of blocks) {
    const linkMatch = block.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+mp\.weixin\.qq\.com[^\s)]*)\)/);
    if (!linkMatch) continue;

    const title = linkMatch[1].replace(/<[^>]*>/g, "").trim();
    const url = linkMatch[2];
    if (!title || title.length < 4) continue;

    const snippet = block
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/#{1,3}\s/g, "")
      .trim()
      .slice(0, 200);

    articles.push({
      title,
      source: extractSource(title, snippet),
      url,
      snippet,
      publishTime: extractDate(block),
    });
  }

  return articles.slice(0, 10);
}

async function searchViaBing(query: string): Promise<HistoryArticle[]> {
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=15`;
  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(bingUrl)}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
        "X-Timeout": "15",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseMarkdownResults(text);
  } catch {
    return [];
  }
}

async function searchViaGoogle(query: string): Promise<HistoryArticle[]> {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=15`;
  try {
    const res = await fetch(`https://r.jina.ai/${encodeURIComponent(googleUrl)}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
        "X-Timeout": "15",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseMarkdownResults(text);
  } catch {
    return [];
  }
}

async function searchViaTavily(query: string): Promise<HistoryArticle[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "advanced",
        max_results: 10,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || []).map(
      (r: { title: string; url: string; content: string; published_date?: string }) => ({
        title: (r.title || "").trim(),
        source: extractSource(r.title || "", r.content || ""),
        url: r.url || "",
        snippet: (r.content || "").slice(0, 200).trim(),
        publishTime: r.published_date || "",
      })
    );
  } catch {
    return [];
  }
}

function extractSource(title: string, text: string): string {
  const combined = title + " " + text;
  if (combined.includes("EDA创展") || combined.includes("EDA")) return "首经贸EDA创展";
  if (combined.includes("CUEBCDA") || combined.includes("CDA")) return "CUEBCDA";
  if (combined.includes("学生处")) return "首都经济贸易大学学生处";
  if (combined.includes("首经贸") || combined.includes("首都经济贸易")) return "首都经济贸易大学";
  return "";
}

function extractDate(text: string): string {
  const m = text.match(/(\d{4})[年\-\/.](\d{1,2})[月\-\/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return "";
}

function dedup(articles: HistoryArticle[]): HistoryArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const key = a.title.slice(0, 20);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function searchWechatHistory(
  account: string,
  keyword: string
): Promise<{ articles: HistoryArticle[]; message: string }> {
  const resolvedAccount = resolveAccount(account);
  const now = getBeijingNow();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const siteQuery = keyword
    ? `site:mp.weixin.qq.com "${resolvedAccount}" ${keyword}`
    : `site:mp.weixin.qq.com "${resolvedAccount}"`;

  const weixinQuery = keyword
    ? `微信公众号 ${resolvedAccount} ${keyword}`
    : `微信公众号 ${resolvedAccount}`;

  const [jinaResults, bingResults, googleResults, tavilyResults] = await Promise.allSettled([
    searchViaJinaSearch(siteQuery),
    searchViaBing(siteQuery),
    searchViaGoogle(siteQuery),
    searchViaTavily(weixinQuery),
  ]);

  let allArticles: HistoryArticle[] = [];
  if (jinaResults.status === "fulfilled") allArticles.push(...jinaResults.value);
  if (bingResults.status === "fulfilled") allArticles.push(...bingResults.value);
  if (googleResults.status === "fulfilled") allArticles.push(...googleResults.value);
  if (tavilyResults.status === "fulfilled") allArticles.push(...tavilyResults.value);

  allArticles = dedup(allArticles).slice(0, 15);

  if (allArticles.length === 0) {
    const fallbackQuery = keyword
      ? `${resolvedAccount} ${keyword} 微信公众号`
      : `${resolvedAccount} 微信公众号 活动 预约`;

    const [fallbackJina, fallbackBing] = await Promise.allSettled([
      searchViaJinaSearch(fallbackQuery),
      searchViaBing(fallbackQuery),
    ]);

    if (fallbackJina.status === "fulfilled") allArticles.push(...fallbackJina.value);
    if (fallbackBing.status === "fulfilled") allArticles.push(...fallbackBing.value);
    allArticles = dedup(allArticles).slice(0, 15);
  }

  if (allArticles.length === 0) {
    return {
      articles: [],
      message: `查询时间：${timeStr}（北京时间）\n\n未能从搜索引擎中找到「${resolvedAccount}」${keyword ? `关于「${keyword}」` : ""}的历史文章。\n\n可能原因：搜索引擎尚未收录、文章标题不完全匹配、或网络访问受限。\n\n建议：\n1. 在微信中搜索公众号「${resolvedAccount}」→ 查看历史消息\n2. 访问搜狗微信搜索：https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(resolvedAccount + (keyword ? " " + keyword : ""))}\n3. 尝试换个关键词，如"预约""报名""讲座""活动"`,
    };
  }

  return {
    articles: allArticles,
    message: `查询时间：${timeStr}（北京时间），共找到 ${allArticles.length} 条「${resolvedAccount}」${keyword ? `关于「${keyword}」` : ""}的历史文章。数据来自公开搜索引擎索引。`,
  };
}
