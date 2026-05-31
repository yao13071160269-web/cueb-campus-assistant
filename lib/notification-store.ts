export interface Notification {
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

const URGENT_KEYWORDS = [
  "预约", "报名", "抢", "截止", "名额", "限额",
  "讲座", "宣讲", "选拔", "答辩", "面试",
  "通知", "紧急", "重要", "调整", "变更", "取消",
  "第二课堂", "学分",
];

const ALLOWED_SOURCES = ["首经贸EDA创展", "CUEBCDA", "首都经济贸易大学学生处"];

const notifications: Notification[] = [];
let lastPollTime = 0;

function matchKeywords(text: string): string[] {
  return URGENT_KEYWORDS.filter((kw) => text.includes(kw));
}

function isAllowedSource(source: string): boolean {
  return ALLOWED_SOURCES.some((s) => source.includes(s));
}

export function addNotification(article: {
  title: string;
  summary?: string;
  source: string;
  url?: string;
  publishTime?: string;
}): Notification | null {
  if (!isAllowedSource(article.source)) return null;
  if (notifications.some((n) => n.title === article.title)) return null;

  const text = article.title + (article.summary || "");
  const keywords = matchKeywords(text);

  const notification: Notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: article.title,
    summary: article.summary || "",
    source: article.source,
    url: article.url || "",
    publishTime: article.publishTime || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    read: false,
    priority: keywords.length > 0 ? "urgent" : "normal",
    keywords,
  };

  notifications.unshift(notification);

  if (notifications.length > 100) {
    notifications.splice(100);
  }

  return notification;
}

export function getNotifications(unreadOnly = false): Notification[] {
  if (unreadOnly) return notifications.filter((n) => !n.read);
  return [...notifications];
}

export function markAsRead(id: string): void {
  const n = notifications.find((n) => n.id === id);
  if (n) n.read = true;
}

export function markAllAsRead(): void {
  notifications.forEach((n) => (n.read = true));
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

const WERSS_API = process.env.WERSS_API_URL || "http://localhost:8001";
const WERSS_KEY = process.env.WERSS_API_KEY || "";
const POLL_INTERVAL = 5 * 60 * 1000;

export async function pollWeRSS(): Promise<number> {
  const now = Date.now();
  if (now - lastPollTime < POLL_INTERVAL) return 0;
  lastPollTime = now;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (WERSS_KEY) headers["Authorization"] = `Bearer ${WERSS_KEY}`;

    const res = await fetch(`${WERSS_API}/api/v1/wx/articles?page=1&page_size=20`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return 0;

    const data = await res.json();
    const items = data.data?.items || data.items || [];
    let added = 0;

    for (const item of items) {
      const result = addNotification({
        title: item.title || "",
        summary: item.summary || item.digest || "",
        source: item.mp_name || item.source || "",
        url: item.url || item.link || "",
        publishTime: item.publish_time || item.created_at || "",
      });
      if (result) added++;
    }

    return added;
  } catch {
    return 0;
  }
}
