import { querySchedule } from "@/lib/schedule-engine";
import { getLibraryStatus, bookSeat } from "@/lib/seat-engine";
import { getWechatArticles, getNoDataMessage } from "@/lib/wechat-monitor";

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "query_schedule",
      description:
        "查询学生的课表信息。可以查询今天、明天、下一节课、整周或特定星期几的课表。",
      parameters: {
        type: "object",
        properties: {
          student_id: {
            type: "string",
            description: "学生学号",
          },
          query_type: {
            type: "string",
            enum: ["today", "tomorrow", "next", "week", "specific_day"],
            description:
              "查询类型：today-今天课表，tomorrow-明天课表，next-下一节课，week-整周课表，specific_day-特定星期几",
          },
          specific_day: {
            type: "string",
            enum: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
            description: "当query_type为specific_day时，指定星期几",
          },
        },
        required: ["student_id", "query_type"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_library_seats",
      description:
        "查询图书馆各区域的实时座位情况，包括各楼层、IC空间的座位占用率。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "book_library_seat",
      description: "在图书馆指定区域预约一个座位。",
      parameters: {
        type: "object",
        properties: {
          zone_id: {
            type: "string",
            description:
              "座位区域ID，如2A, 2B, 3A, 3B, IC1, IC2, IC3",
          },
          student_id: {
            type: "string",
            description: "学生学号",
          },
        },
        required: ["zone_id", "student_id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_wechat_articles",
      description:
        "获取微信公众号（首经贸EDA创展、CUEBCDA等）的最新活动通知和文章信息。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "联网搜索任何信息。必须在以下场景使用：1.任何事实性问题（新闻真假、人物近况、事件核实）2.用户问'XX是真的吗''XX最新消息'等 3.学术知识、技术文档 4.不确定的信息。遇到事实性问题时必须先搜索再回答，不能仅凭记忆。",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索查询内容",
          },
        },
        required: ["query"],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, string>
): Promise<string> {
  switch (name) {
    case "query_schedule": {
      const result = querySchedule(
        args.student_id,
        args.query_type as "today" | "tomorrow" | "next" | "week" | "specific_day",
        args.specific_day
      );
      return JSON.stringify(result, null, 2);
    }

    case "query_library_seats": {
      const statuses = getLibraryStatus();
      return JSON.stringify(statuses, null, 2);
    }

    case "book_library_seat": {
      const result = bookSeat(args.zone_id, args.student_id);
      return JSON.stringify(result, null, 2);
    }

    case "get_wechat_articles": {
      const articles = await getWechatArticles();
      if (articles.length === 0) {
        return JSON.stringify({ articles: [], message: getNoDataMessage() });
      }
      const enriched = articles.map((a) => {
        let bjTime = "";
        if (a.publishTime) {
          try {
            const d = new Date(a.publishTime);
            bjTime = d.toLocaleString("zh-CN", {
              timeZone: "Asia/Shanghai",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
          } catch { /* ignore */ }
        }
        return { ...a, publishTimeBeijing: bjTime || a.publishTime };
      });
      return JSON.stringify(enriched, null, 2);
    }

    case "web_search": {
      return await webSearch(args.query);
    }

    default:
      return JSON.stringify({ error: "未知工具" });
  }
}

async function webSearch(query: string): Promise<string> {
  // 1. Tavily (best quality, needs API key)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.stringify({
          source: "tavily",
          answer: data.answer,
          results: (data.results || []).slice(0, 5).map(
            (r: { title: string; url: string; content: string }) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.slice(0, 300),
            })
          ),
        });
      }
    } catch { /* fall through */ }
  }

  // 2. Bing China direct (works in mainland China)
  try {
    const bingResult = await searchBingChina(query);
    if (bingResult) return bingResult;
  } catch { /* fall through */ }

  // 3. Baidu direct (definitely works in China)
  try {
    const baiduResult = await searchBaidu(query);
    if (baiduResult) return baiduResult;
  } catch { /* fall through */ }

  // 4. Jina Search API (overseas, may be slow in China)
  try {
    const jinaRes = await fetch(
      `https://s.jina.ai/${encodeURIComponent(query)}`,
      {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      if (text.length > 100) return text.slice(0, 3000);
    }
  } catch { /* fall through */ }

  return JSON.stringify({
    message: "搜索服务暂时不可用，请稍后再试。你也可以直接向我提问，我会尽力根据已有知识回答。",
  });
}

async function searchBingChina(query: string): Promise<string | null> {
  const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&cc=cn&setlang=zh-Hans`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const html = await res.text();
  const results = parseBingHTML(html);
  if (results.length === 0) return null;

  return JSON.stringify({ source: "bing", results });
}

function parseBingHTML(html: string): { title: string; snippet: string; url: string }[] {
  const results: { title: string; snippet: string; url: string }[] = [];
  // Match Bing result blocks: <li class="b_algo">
  const blocks = html.split(/<li class="b_algo"/);
  for (let i = 1; i < blocks.length && results.length < 6; i++) {
    const block = blocks[i];
    const titleMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/a>/);
    const snippetMatch = block.match(/<p[^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*)<\/p>/);

    if (titleMatch) {
      const url = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]+>/g, "").trim();
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";
      if (title) results.push({ title, snippet: snippet.slice(0, 300), url });
    }
  }
  return results;
}

async function searchBaidu(query: string): Promise<string | null> {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const html = await res.text();
  const results = parseBaiduHTML(html);
  if (results.length === 0) return null;

  return JSON.stringify({ source: "baidu", results });
}

function parseBaiduHTML(html: string): { title: string; snippet: string }[] {
  const results: { title: string; snippet: string }[] = [];
  // Match Baidu result containers
  const blocks = html.split(/class="result c-container/);
  for (let i = 1; i < blocks.length && results.length < 6; i++) {
    const block = blocks[i];
    const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(
      /class="c-abstract[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div|p)>|class="content-right_[^"]*"[^>]*>([\s\S]*?)<\/div>/
    );

    if (titleMatch) {
      const title = titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const rawSnippet = snippetMatch
        ? (snippetMatch[1] || snippetMatch[2] || "")
        : "";
      const snippet = rawSnippet.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (title) results.push({ title, snippet: snippet.slice(0, 300) });
    }
  }
  return results;
}
