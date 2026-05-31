import { searchWechatHistory } from "@/lib/wechat-history";
import { requireAuth } from "@/lib/session";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const account = searchParams.get("account") || "首经贸EDA创展";
  const keyword = searchParams.get("keyword") || "";

  if (account.length > 50 || keyword.length > 50) {
    return Response.json({ error: "参数过长" }, { status: 400 });
  }

  const result = await searchWechatHistory(account, keyword);
  return Response.json(result);
}
