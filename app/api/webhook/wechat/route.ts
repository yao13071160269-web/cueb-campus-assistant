import crypto from "crypto";
import { addNotification } from "@/lib/notification-store";
import { rateLimitGuard } from "@/lib/rate-limit";

function verifyWebhookSignature(request: Request, body: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured = allow (dev mode)

  const signature = request.headers.get("x-webhook-signature");
  if (!signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 5);
  if (blocked) return blocked;

  const rawBody = await request.text();

  if (!verifyWebhookSignature(request, rawBody)) {
    return Response.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);
    const articles = Array.isArray(body) ? body : body.articles ? body.articles : [body];

    let added = 0;
    for (const article of articles) {
      if (!article.title && !article.msg_title) continue;
      const result = addNotification({
        title: String(article.title || article.msg_title || "").slice(0, 200),
        summary: String(article.summary || article.digest || article.description || "").slice(0, 500),
        source: String(article.mp_name || article.source || article.account_name || "").slice(0, 50),
        url: String(article.url || article.link || article.msg_link || "").slice(0, 500),
        publishTime: String(article.publish_time || article.created_at || article.msg_publish_time_str || "").slice(0, 30),
      });
      if (result) added++;
    }

    return Response.json({ success: true, added });
  } catch {
    return Response.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
}
