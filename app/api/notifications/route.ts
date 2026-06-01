import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  pollArticles,
} from "@/lib/notification-store";
import { requireAuth } from "@/lib/session";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const blocked = rateLimitGuard(request);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  await pollArticles();

  const notifications = getNotifications(unreadOnly);
  const unreadCount = getUnreadCount();

  return Response.json({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { action, id } = await request.json();

  if (action === "mark_read" && typeof id === "string") {
    markAsRead(id);
  } else if (action === "mark_all_read") {
    markAllAsRead();
  }

  return Response.json({ success: true, unreadCount: getUnreadCount() });
}
