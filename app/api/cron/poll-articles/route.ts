import { pollArticles } from "@/lib/notification-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const added = await pollArticles(true);
    return Response.json({
      success: true,
      added,
      time: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
