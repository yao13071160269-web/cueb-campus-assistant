"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import CamelLoading from "./CamelLoading";
import BookingCard from "./BookingCard";
import NotificationCenter from "./NotificationCenter";

interface Student {
  studentId: string;
  name: string;
  major: string;
  college: string;
  grade: string;
  className: string;
}

interface ToolCallInfo {
  name: string;
  args: Record<string, string>;
  result?: {
    success: boolean;
    seatNumber: string;
    zone: string;
    floor: number;
    time: string;
    validUntil: string;
    bookingId: string;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
}

interface ChatInterfaceProps {
  student: Student;
  token: string;
  onLogout: () => void;
}

const QUICK_ACTIONS = [
  { label: "下一节课", query: "我下一节是什么课？" },
  { label: "今日课表", query: "帮我看看今天有什么课" },
  { label: "图书馆选座", query: "图书馆现在还有空位吗？" },
  { label: "最新活动", query: "最近有什么活动通知？" },
  { label: "办事流程", query: "怎么补办学生证？" },
  { label: "解压一下", query: "学长，我期末压力好大啊..." },
];

function renderContent(text: string) {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, "<br/>");
  return <span className="chat-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function ChatInterface({ student, token, onLogout }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `嘿！${student.name}学弟/学妹你好呀！学长我是CUEB校园助手，首经贸的万事通老学长 🐪\n\n有什么需要帮忙的尽管问，不管是查课表、图书馆抢座、还是找活动信息，学长都罩着你！\n\n你现在是 **${student.college} ${student.major}** 的学生，学号 **${student.studentId}**`,
      },
    ]);
  }, [student]);

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const chatHistory = [...messages, userMessage]
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: chatHistory }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        toolCalls: data.toolCalls,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "抱歉，学长这边网络好像有点问题，稍等一下再试试？",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-100 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cueb-red flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 56 40" fill="none">
                  <ellipse cx="28" cy="16" rx="16" ry="10" fill="white" fillOpacity="0.9" />
                  <ellipse cx="24" cy="8" rx="6" ry="5" fill="white" fillOpacity="0.7" />
                  <ellipse cx="32" cy="9" rx="5" ry="4" fill="white" fillOpacity="0.7" />
                  <ellipse cx="46" cy="10" rx="5" ry="4" fill="white" fillOpacity="0.9" />
                  <path d="M38 14 Q42 8 46 10" stroke="white" strokeOpacity="0.9" strokeWidth="4" fill="none" />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-gray-900 text-sm truncate">CUEB 校园助手</h2>
                <p className="text-xs text-gray-400">AI 老学长</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">当前用户</p>
              <p className="font-medium text-sm text-gray-900">{student.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {student.college} · {student.className}
              </p>
              <p className="text-xs text-gray-400 font-mono mt-1">{student.studentId}</p>
            </div>
          </div>

          <div className="p-4 flex-1">
            <p className="text-xs text-gray-400 mb-2 font-medium">快捷功能</p>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => { sendMessage(action.query); setShowSidebar(false); }}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600
                             hover:bg-cueb-red/5 hover:text-cueb-red transition-colors disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded-lg text-sm text-gray-400
                         hover:bg-gray-50 hover:text-gray-600 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-gray-100 bg-white/80 backdrop-blur-sm flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-gray-500">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm text-gray-500">在线</span>
          </div>
          <div className="flex-1" />
          <NotificationCenter token={token} />
          <span className="text-xs text-gray-300 ml-2">Powered by DeepSeek</span>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-fade-up`}>
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-cueb-red flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                    <svg width="16" height="16" viewBox="0 0 56 40" fill="none">
                      <ellipse cx="28" cy="16" rx="16" ry="10" fill="white" fillOpacity="0.9" />
                      <ellipse cx="24" cy="8" rx="6" ry="5" fill="white" fillOpacity="0.7" />
                      <ellipse cx="46" cy="10" rx="5" ry="4" fill="white" fillOpacity="0.9" />
                      <path d="M38 14 Q42 8 46 10" stroke="white" strokeOpacity="0.9" strokeWidth="4" fill="none" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-cueb-red text-white rounded-br-md"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  <div className="text-sm leading-relaxed">
                    {renderContent(message.content)}
                  </div>

                  {/* Booking Cards */}
                  {message.toolCalls?.map((tc, idx) =>
                    tc.name === "book_library_seat" && tc.result?.success ? (
                      <BookingCard key={idx} booking={tc.result} />
                    ) : null
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start animate-fade-up">
                <div className="w-8 h-8 rounded-lg bg-cueb-red flex items-center justify-center flex-shrink-0 mr-3 mt-1">
                  <svg width="16" height="16" viewBox="0 0 56 40" fill="none">
                    <ellipse cx="28" cy="16" rx="16" ry="10" fill="white" fillOpacity="0.9" />
                    <ellipse cx="24" cy="8" rx="6" ry="5" fill="white" fillOpacity="0.7" />
                    <ellipse cx="46" cy="10" rx="5" ry="4" fill="white" fillOpacity="0.9" />
                    <path d="M38 14 Q42 8 46 10" stroke="white" strokeOpacity="0.9" strokeWidth="4" fill="none" />
                  </svg>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm">
                  <CamelLoading size="sm" />
                  <p className="text-xs text-gray-400 mt-2">学长正在思考中...</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick actions for empty state */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.query)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-full border border-gray-200 text-sm text-gray-500
                               hover:border-cueb-red/30 hover:text-cueb-red hover:bg-red-50/50
                               transition-all disabled:opacity-50"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-100 bg-white px-4 py-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="问问老学长吧..."
                  rows={1}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-cueb-red/20 focus:border-cueb-red/50
                             focus:bg-white transition-all placeholder:text-gray-400 disabled:opacity-50"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                />
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-cueb-red text-white flex items-center justify-center
                           hover:bg-cueb-red-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs text-gray-300 mt-2">
              CUEB 校园助手 · 沙箱环境 · AI 生成内容仅供参考
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
