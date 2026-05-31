import studentsData from "@/data/students.json";

export async function POST(request: Request) {
  const { studentId } = await request.json();

  const student = studentsData.students.find(
    (s) => s.studentId === studentId
  );

  if (!student) {
    return Response.json(
      { success: false, message: "学号不存在，请使用预设测试学号登录" },
      { status: 401 }
    );
  }

  return Response.json({
    success: true,
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
