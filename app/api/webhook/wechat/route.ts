import { addNotification } from "@/lib/notification-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const articles = Array.isArray(body) ? body : body.articles ? body.articles : [body];

    let added = 0;
    for (const article of articles) {
      const result = addNotification({
        title: article.title || article.msg_title || "",
        summary: article.summary || article.digest || article.description || "",
        source: article.mp_name || article.source || article.account_name || "",
        url: article.url || article.link || article.msg_link || "",
        publishTime: article.publish_time || article.created_at || article.msg_publish_time_str || "",
      });
      if (result) added++;
    }

    return Response.json({ success: true, added });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}
