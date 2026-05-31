import { bookSeat } from "@/lib/seat-engine";
import { requireAuth } from "@/lib/session";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const { zoneId } = await request.json();

  if (!zoneId || typeof zoneId !== "string" || zoneId.length > 10) {
    return Response.json(
      { success: false, message: "无效的区域参数" },
      { status: 400 }
    );
  }

  const result = bookSeat(zoneId, auth.studentId);
  return Response.json(result);
}
