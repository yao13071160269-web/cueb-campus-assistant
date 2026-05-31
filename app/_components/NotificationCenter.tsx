"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Notification {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishTime: string;
  receivedAt: string;
  read: boolean;
  priority: "urgent" | "normal";
  keywords: string[];
}

interface NotificationCenterProps {
  token: string;
}

export default function NotificationCenter({ token }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef(0);
  const [newAlert, setNewAlert] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);

      if (data.unreadCount > prevUnreadRef.current && prevUnreadRef.current >= 0) {
        setNewAlert(true);
        setTimeout(() => setNewAlert(false), 3000);
      }
      prevUnreadRef.current = data.unreadCount;
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleMarkRead(id: string) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "mark_read", id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function handleMarkAllRead() {
    setLoading(true);
    await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    setLoading(false);
  }

  const urgentNotifs = notifications.filter((n) => n.priority === "urgent" && !n.read);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isOpen ? "bg-red-50 text-cueb-red" : "hover:bg-gray-100 text-gray-500"
        } ${newAlert ? "animate-bounce" : ""}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-cueb-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-h-[480px] bg-white rounded-xl shadow-xl border border-gray-100 z-50 flex flex-col animate-fade-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-gray-900">通知中心</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-cueb-red/10 text-cueb-red px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} 条未读
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-xs text-gray-400 hover:text-cueb-red transition-colors"
              >
                全部已读
              </button>
            )}
          </div>

          {/* Urgent Alert Bar */}
          {urgentNotifs.length > 0 && (
            <div className="px-4 py-2 bg-red-50 border-b border-red-100">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-cueb-red rounded-full animate-pulse" />
                <span className="text-xs font-medium text-cueb-red">
                  {urgentNotifs.length} 条重要通知（含预约/报名信息）
                </span>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <svg className="mx-auto mb-3 text-gray-300" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <p className="text-sm text-gray-400">暂无通知</p>
                <p className="text-xs text-gray-300 mt-1">
                  监控中：首经贸EDA创展 / CUEBCDA / 学生处
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${
                    !notif.read ? "bg-blue-50/30" : ""
                  }`}
                  onClick={() => {
                    if (!notif.read) handleMarkRead(notif.id);
                    if (notif.url && notif.url !== "#") window.open(notif.url, "_blank");
                  }}
                >
                  <div className="flex items-start gap-2">
                    {/* Priority Indicator */}
                    <div className="flex-shrink-0 mt-1">
                      {notif.priority === "urgent" ? (
                        <span className="w-2 h-2 bg-cueb-red rounded-full block" />
                      ) : (
                        <span className={`w-2 h-2 rounded-full block ${notif.read ? "bg-gray-200" : "bg-blue-400"}`} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${notif.read ? "text-gray-500" : "text-gray-900 font-medium"}`}>
                        {notif.title}
                      </p>

                      {notif.summary && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notif.summary}</p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                          {notif.source}
                        </span>
                        {notif.keywords.length > 0 && (
                          <div className="flex gap-1">
                            {notif.keywords.slice(0, 2).map((kw) => (
                              <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-cueb-red/10 text-cueb-red">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="text-[10px] text-gray-300 ml-auto">
                          {formatTime(notif.publishTime || notif.receivedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[10px] text-gray-300 text-center">
              数据来源：首经贸EDA创展 · CUEBCDA · 首都经济贸易大学学生处
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  try {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}小时前`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  } catch {
    return timeStr;
  }
}
