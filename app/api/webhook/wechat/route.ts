import crypto from "crypto";
import { addNotification } from "@/lib/notification-store";
import { rateLimitGuard } from "@/lib/rate-limit";

function verifyWebhookSignature(request: Request, body: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = request.headers.get("x-webhook-signature");
  if (!signature) {
    // Allow unsigned requests from localhost/Docker (we-mp-rss doesn't sign)
    const origin = request.headers.get("origin") || "";
    const host = request.headers.get("host") || "";
    if (origin.includes("localhost") || origin.includes("127.0.0.1") || host.includes("localhost")) {
      return true;
    }
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const rawBody = await request.text();

  if (!verifyWebhookSignature(request, rawBody)) {
    return Response.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);

    // we-mp-rss sends articles in various formats
    let articles: Record<string, unknown>[];
    if (Array.isArray(body)) {
      articles = body;
    } else if (body.articles) {
      articles = Array.isArray(body.articles) ? body.articles : [body.articles];
    } else if (body.data && Array.isArray(body.data)) {
      articles = body.data;
    } else if (body.title || body.msg_title || body.content) {
      articles = [body];
    } else {
      articles = [body];
    }

    let added = 0;
    for (const article of articles) {
      const title = String(
        article.title || article.msg_title || article.name || ""
      ).slice(0, 200);
      if (!title || title.length < 3) continue;

      const result = addNotification({
        title,
        summary: String(
          article.summary || article.digest || article.description ||
          article.content || article.msg_desc || ""
        ).slice(0, 500),
        source: String(
          article.mp_name || article.source || article.account_name ||
          article.author || article.nickname || ""
        ).slice(0, 50),
        url: String(
          article.url || article.link || article.msg_link ||
          article.content_url || ""
        ).slice(0, 500),
        publishTime: String(
          article.publish_time || article.created_at ||
          article.msg_publish_time_str || article.pub_time ||
          article.update_time || ""
        ).slice(0, 30),
      });
      if (result) added++;
    }

    return Response.json({ success: true, added });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}
