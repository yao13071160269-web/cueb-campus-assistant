import OpenAI from "openai";
import { SYSTEM_PROMPT } from "@/data/knowledge";
import { TOOL_DEFINITIONS, executeTool } from "@/lib/tools";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }
  return _client;
}

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
}

export async function POST(request: Request) {
  const { messages, studentId } = (await request.json()) as {
    messages: ChatMessage[];
    studentId: string;
  };

  const now = new Date();
  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const timeContext = `\n\n[当前时间信息] ${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${dayNames[now.getDay()]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}\n[当前登录学号] ${studentId}`;

  const systemMessage = SYSTEM_PROMPT + timeContext;

  const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
    ...messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool" as const,
          content: m.content,
          tool_call_id: m.tool_call_id || "",
        };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    }),
  ];

  try {
    const client = getClient();
    let response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: apiMessages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      stream: false,
      temperature: 0.8,
      max_tokens: 2048,
    });

    let assistantMessage = response.choices[0]?.message;

    let iterations = 0;
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < 5) {
      iterations++;

      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      apiMessages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const fn = toolCall.function;
        const args = JSON.parse(fn.arguments);
        if (
          (fn.name === "query_schedule" || fn.name === "book_library_seat") &&
          !args.student_id
        ) {
          args.student_id = studentId;
        }
        const result = await executeTool(fn.name, args);
        toolMessages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
        });
      }

      apiMessages.push(...toolMessages);

      response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: apiMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
        stream: false,
        temperature: 0.8,
        max_tokens: 2048,
      });

      assistantMessage = response.choices[0]?.message;
    }

    const toolCallsUsed: { name: string; args: Record<string, string>; result?: Record<string, unknown> }[] = [];
    for (const m of apiMessages) {
      if (m.role === "assistant" && "tool_calls" in m && m.tool_calls) {
        for (const tc of m.tool_calls as Array<{ id: string; type: string; function: { name: string; arguments: string } }>) {
          if (tc.type !== "function") continue;
          const args = JSON.parse(tc.function.arguments);
          if (tc.function.name === "book_library_seat") {
            const toolResult = apiMessages.find(
              (tm) => tm.role === "tool" && "tool_call_id" in tm && (tm as { tool_call_id: string }).tool_call_id === tc.id
            );
            const bookingData = toolResult ? JSON.parse(String(toolResult.content)) : null;
            toolCallsUsed.push({ name: tc.function.name, args, result: bookingData });
          } else {
            toolCallsUsed.push({ name: tc.function.name, args });
          }
        }
      }
    }

    return Response.json({
      content: assistantMessage?.content || "抱歉，学长暂时想不到该说什么了...",
      toolCalls: toolCallsUsed,
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    if (errMsg.includes("API key") || errMsg.includes("Unauthorized") || errMsg.includes("authentication")) {
      return Response.json(
        { content: "DeepSeek API Key 未配置或无效，请在 .env.local 中设置 DEEPSEEK_API_KEY。", toolCalls: [] },
        { status: 500 }
      );
    }
    return Response.json(
      { content: `抱歉，学长这边出了点问题：${errMsg}`, toolCalls: [] },
      { status: 500 }
    );
  }
}
