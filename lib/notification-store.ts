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
  "课堂", "创享课堂", "职点课堂", "成长课堂",
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
  if (!source) return true;
  return ALLOWED_SOURCES.some((s) => source.includes(s) || s.includes(source));
}

export function addNotification(article: {
  title: string;
  summary?: string;
  source: string;
  url?: string;
  publishTime?: string;
}): Notification | null {
  if (article.source && !isAllowedSource(article.source)) return null;
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

// ── Poll from built-in scraper or we-mp-rss ──

const POLL_INTERVAL = 5 * 60 * 1000;

export async function pollArticles(): Promise<number> {
  const now = Date.now();
  if (now - lastPollTime < POLL_INTERVAL) return 0;
  lastPollTime = now;

  let added = 0;

  // 1. Try built-in scraper
  try {
    const { getStatus, fetchAllTargetArticles } = await import(
      "@/lib/wechat-mp-auth"
    );
    const { loggedIn } = await getStatus();
    if (loggedIn) {
      const articles = await fetchAllTargetArticles();
      for (const a of articles) {
        const result = addNotification({
          title: a.title,
          summary: a.digest,
          source: a.source,
          url: a.link,
          publishTime: a.createTime
            ? new Date(a.createTime * 1000).toISOString()
            : "",
        });
        if (result) added++;
      }
      if (added > 0) return added;
    }
  } catch { /* built-in scraper not available */ }

  // 2. Fallback: we-mp-rss Docker API (if running)
  const WERSS_API = process.env.WERSS_API_URL || "http://localhost:8001";
  try {
    const res = await fetch(
      `${WERSS_API}/api/v1/wx/articles?page=1&page_size=30`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return 0;

    const data = await res.json();
    const items =
      data.data?.items || data.data?.list || data.items || data.list || [];

    for (const item of items) {
      const title = item.title || item.msg_title || "";
      if (!title) continue;

      const result = addNotification({
        title,
        summary:
          item.summary ||
          item.digest ||
          item.description ||
          item.msg_desc ||
          "",
        source:
          item.mp_name ||
          item.source ||
          item.account_name ||
          item.nickname ||
          "",
        url:
          item.url || item.link || item.content_url || item.msg_link || "",
        publishTime:
          item.publish_time ||
          item.pub_time ||
          item.created_at ||
          item.update_time ||
          "",
      });
      if (result) added++;
    }
  } catch { /* we-mp-rss not running */ }

  return added;
}
