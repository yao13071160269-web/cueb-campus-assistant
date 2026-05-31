import { findStudent } from "@/lib/secure-data";
import { createSessionToken } from "@/lib/session";
import { rateLimitGuard } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const blocked = rateLimitGuard(request, 10);
  if (blocked) return blocked;

  const { studentId } = await request.json();

  if (!studentId || typeof studentId !== "string" || studentId.length > 20) {
    return Response.json(
      { success: false, message: "无效的学号格式" },
      { status: 400 }
    );
  }

  const sanitizedId = studentId.replace(/[^a-zA-Z0-9]/g, "");
  const student = findStudent(sanitizedId);

  if (!student) {
    return Response.json(
      { success: false, message: "学号不存在，请使用预设测试学号登录" },
      { status: 401 }
    );
  }

  const token = createSessionToken(student.studentId);

  return Response.json({
    success: true,
    token,
    student: {
      studentId: student.studentId,
      name: student.name,
      major: student.major,
      college: student.college,
      grade: student.grade,
      className: student.className,
    },
  });
}
