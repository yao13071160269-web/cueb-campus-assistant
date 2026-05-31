import { getWechatArticles } from "@/lib/wechat-monitor";

export async function GET() {
  const articles = await getWechatArticles();
  return Response.json({ articles });
}
