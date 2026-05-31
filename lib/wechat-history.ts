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
  "CUEBCDA": "CUEBCDA",
  "CDA": "CUEBCDA",
  "学生处": "首都经济贸易大学学生处",
};

function resolveAccount(input: string): string {
  for (const [key, value] of Object.entries(ACCOUNT_MAP)) {
    if (input.includes(key)) return value;
  }
  return input;
}

async function searchViaSogou(account: string, keyword: string): Promise<HistoryArticle[]> {
  const query = keyword ? `${account} ${keyword}` : account;
  const sogouUrl = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}`;

  try {
    const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(sogouUrl)}`, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!jinaRes.ok) throw new Error(`Jina error: ${jinaRes.status}`);
    const text = await jinaRes.text();
    return parseSogouResults(text, account);
  } catch {
    return [];
  }
}

function parseSogouResults(text: string, account: string): HistoryArticle[] {
  const articles: HistoryArticle[] = [];
  const lines = text.split("\n");

  let currentTitle = "";
  let currentUrl = "";
  let currentSnippet = "";
  let currentSource = account;
  let currentTime = "";

  for (const line of lines) {
    const trimmed = line.trim();

    const titleMatch = trimmed.match(/^\[(.+?)\]\((https?:\/\/.+?)\)$/);
    if (titleMatch) {
      if (currentTitle) {
        articles.push({
          title: currentTitle,
          source: currentSource,
          url: currentUrl,
          snippet: currentSnippet.slice(0, 200),
          publishTime: currentTime,
        });
      }
      currentTitle = titleMatch[1];
      currentUrl = titleMatch[2];
      currentSnippet = "";
      currentTime = "";
      continue;
    }

    const linkMatch = trimmed.match(/^\[(.+?)\]\((https?:\/\/mp\.weixin\.qq\.com.+?)\)/);
    if (linkMatch) {
      if (currentTitle) {
        articles.push({
          title: currentTitle,
          source: currentSource,
          url: currentUrl,
          snippet: currentSnippet.slice(0, 200),
          publishTime: currentTime,
        });
      }
      currentTitle = linkMatch[1];
      currentUrl = linkMatch[2];
      currentSnippet = "";
      currentTime = "";
      continue;
    }

    const dateMatch = trimmed.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})/);
    if (dateMatch && currentTitle) {
      currentTime = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
    }

    if (currentTitle && trimmed.length > 10 && !trimmed.startsWith("[") && !trimmed.startsWith("http")) {
      if (!currentSnippet) currentSnippet = trimmed;
    }
  }

  if (currentTitle) {
    articles.push({
      title: currentTitle,
      source: currentSource,
      url: currentUrl,
      snippet: currentSnippet.slice(0, 200),
      publishTime: currentTime,
    });
  }

  return articles.slice(0, 10);
}

async function searchViaTavily(account: string, keyword: string): Promise<HistoryArticle[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return [];

  const query = keyword
    ? `site:mp.weixin.qq.com ${account} ${keyword}`
    : `site:mp.weixin.qq.com ${account}`;

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
        title: r.title || "",
        source: account,
        url: r.url || "",
        snippet: (r.content || "").slice(0, 200),
        publishTime: r.published_date || "",
      })
    );
  } catch {
    return [];
  }
}

export async function searchWechatHistory(
  account: string,
  keyword: string
): Promise<{ articles: HistoryArticle[]; message: string }> {
  const resolvedAccount = resolveAccount(account);
  const now = getBeijingNow();
  const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  let articles = await searchViaSogou(resolvedAccount, keyword);

  if (articles.length === 0) {
    articles = await searchViaTavily(resolvedAccount, keyword);
  }

  if (articles.length === 0) {
    return {
      articles: [],
      message: `未搜索到「${resolvedAccount}」${keyword ? `中关于「${keyword}」` : ""}的历史文章。建议直接在微信中搜索该公众号查看历史消息。\n\n也可以尝试访问搜狗微信搜索：https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(resolvedAccount + (keyword ? " " + keyword : ""))}`,
    };
  }

  return {
    articles,
    message: `查询时间：${timeStr}（北京时间），共找到 ${articles.length} 条「${resolvedAccount}」${keyword ? `关于「${keyword}」` : ""}的历史文章。以下为搜索结果，数据来自公开搜索引擎。`,
  };
}
