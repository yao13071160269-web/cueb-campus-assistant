import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  pollWeRSS,
} from "@/lib/notification-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  await pollWeRSS();

  const notifications = getNotifications(unreadOnly);
  const unreadCount = getUnreadCount();

  return Response.json({ notifications, unreadCount });
}

export async function POST(request: Request) {
  const { action, id } = await request.json();

  if (action === "mark_read" && id) {
    markAsRead(id);
  } else if (action === "mark_all_read") {
    markAllAsRead();
  }

  return Response.json({ success: true, unreadCount: getUnreadCount() });
}
