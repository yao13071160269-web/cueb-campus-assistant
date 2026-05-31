import { getLibraryStatus } from "@/lib/seat-engine";
import { requireAuth } from "@/lib/session";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const blocked = rateLimitGuard(request);
  if (blocked) return blocked;

  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const statuses = getLibraryStatus();
  return Response.json({ statuses });
}
