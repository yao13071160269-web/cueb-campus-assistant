import { rateLimitGuard } from "@/lib/rate-limit";
import {
  getStatus,
  requestQrCode,
  logout,
  verifySession,
  searchAccount,
  fetchAllTargetArticles,
} from "@/lib/wechat-mp-auth";

export async function GET(request: Request) {
  const blocked = rateLimitGuard(request, 20);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "status";

  switch (action) {
    case "status":
      return Response.json(getStatus());

    case "verify": {
      const valid = await verifySession();
      return Response.json({ valid });
    }

    case "search": {
      const query = searchParams.get("q") || "";
      if (!query || query.length > 50)
        return Response.json({ error: "参数无效" }, { status: 400 });
      const accounts = await searchAccount(query);
      return Response.json({ accounts });
    }

    case "articles": {
      const articles = await fetchAllTargetArticles();
      return Response.json({ articles });
    }

    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "";

  switch (action) {
    case "qrcode": {
      const result = await requestQrCode();
      return Response.json(result);
    }

    case "logout": {
      logout();
      return Response.json({ success: true });
    }

    default:
      return Response.json({ error: "Unknown action" }, { status: 400 });
  }
}
