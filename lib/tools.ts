import { querySchedule } from "@/lib/schedule-engine";
import { getLibraryStatus, bookSeat } from "@/lib/seat-engine";
import { getWechatArticles, getNoDataMessage } from "@/lib/wechat-monitor";
import { searchWechatHistory } from "@/lib/wechat-history";

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
      name: "search_wechat_history",
      description:
        "搜索微信公众号的历史文章。可以查询首经贸EDA创展、CUEBCDA、首都经济贸易大学学生处等公众号的历史课堂预约、活动报名、通知公告等信息。",
      parameters: {
        type: "object",
        properties: {
          account: {
            type: "string",
            description:
              "公众号名称，如：首经贸EDA创展、CUEBCDA、学生处",
          },
          keyword: {
            type: "string",
            description:
              "搜索关键词，如：课堂预约、活动报名、讲座、比赛、通知等。留空则查询全部历史文章。",
          },
        },
        required: ["account"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description:
        "联网搜索学术知识、技术文档、办事攻略等。用于代码Debug、学术概念解析、官方文档检索等。",
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
      return JSON.stringify(articles, null, 2);
    }

    case "search_wechat_history": {
      const result = await searchWechatHistory(args.account, args.keyword || "");
      return JSON.stringify(result, null, 2);
    }

    case "web_search": {
      return await webSearch(args.query);
    }

    default:
      return JSON.stringify({ error: "未知工具" });
  }
}

async function webSearch(query: string): Promise<string> {
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
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.stringify({
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

  try {
    const jinaRes = await fetch(
      `https://r.jina.ai/${encodeURIComponent(`https://www.google.com/search?q=${encodeURIComponent(query)}`)}`,
      { headers: { Accept: "application/json", "X-Return-Format": "text" } }
    );
    if (jinaRes.ok) {
      const text = await jinaRes.text();
      return text.slice(0, 2000);
    }
  } catch { /* fall through */ }

  return JSON.stringify({
    message: "搜索服务暂时不可用，请稍后再试。你也可以直接向我提问，我会尽力根据已有知识回答。",
  });
}
