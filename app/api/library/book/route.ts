import { bookSeat } from "@/lib/seat-engine";

export async function POST(request: Request) {
  const { zoneId, studentId } = await request.json();

  if (!zoneId || !studentId) {
    return Response.json(
      { success: false, message: "缺少必要参数" },
      { status: 400 }
    );
  }

  const result = bookSeat(zoneId, studentId);
  return Response.json(result);
}
