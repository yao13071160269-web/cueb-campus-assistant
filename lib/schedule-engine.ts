import schedulesData from "@/data/schedules.json";

const DAY_MAP: Record<number, string> = {
  0: "周日", 1: "周一", 2: "周二", 3: "周三",
  4: "周四", 5: "周五", 6: "周六",
};

interface CourseInfo {
  period: string;
  time: string;
  course: string;
  teacher: string;
  location: string;
  weeks: number[];
  type: string;
}

interface ScheduleQueryResult {
  found: boolean;
  studentName?: string;
  dayOfWeek?: string;
  currentTime?: string;
  currentWeek?: number;
  courses?: CourseInfo[];
  nextCourse?: CourseInfo & { isNow?: boolean };
  todayCourses?: CourseInfo[];
  message?: string;
}

function getTeachingWeek(date: Date): number {
  const weekStart = new Date((schedulesData as Record<string, unknown>).teachingWeekStart as string);
  weekStart.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - weekStart.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

function filterByWeek(courses: CourseInfo[], week: number): CourseInfo[] {
  return courses.filter((c) => c.weeks.includes(week));
}

function parseTimeRange(timeStr: string): { start: number; end: number } {
  const [startStr, endStr] = timeStr.split("-");
  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  return { start: startH * 60 + startM, end: endH * 60 + endM };
}

export function querySchedule(
  studentId: string,
  queryType: "today" | "tomorrow" | "next" | "week" | "specific_day",
  specificDay?: string
): ScheduleQueryResult {
  const data = schedulesData as unknown as Record<string, { name: string; weeklySchedule: Record<string, CourseInfo[]> }>;
  const student = data[studentId];

  if (!student) {
    return { found: false, message: "未找到该学号对应的课表信息。可用学号：32025120067（程心阳）、32025040112（周思安）、32025270095（姚上）、32025270008（起飞翔）、32025040107（刘紫函）" };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIndex = now.getDay();
  const currentWeek = getTeachingWeek(now);

  if (currentWeek < 1 || currentWeek > 16) {
    return {
      found: true,
      studentName: student.name,
      currentWeek,
      message: `当前不在教学周内（第${currentWeek}周），课表为第1-16教学周有效。第一教学周从2026年3月9日开始。`,
    };
  }

  if (queryType === "today" || queryType === "next") {
    const dayName = DAY_MAP[todayIndex];
    const allTodayCourses = student.weeklySchedule[dayName] || [];
    const todayCourses = filterByWeek(allTodayCourses, currentWeek);

    if (queryType === "next") {
      let nextCourse: (CourseInfo & { isNow?: boolean }) | undefined;
      for (const course of todayCourses) {
        const { start, end } = parseTimeRange(course.time);
        if (currentMinutes >= start && currentMinutes < end) {
          nextCourse = { ...course, isNow: true };
          break;
        }
        if (start > currentMinutes) {
          nextCourse = course;
          break;
        }
      }

      if (!nextCourse && todayCourses.length > 0 &&
          currentMinutes >= parseTimeRange(todayCourses[todayCourses.length - 1].time).end) {
        const tomorrowDate = new Date(now.getTime() + 86400000);
        const tomorrowWeek = getTeachingWeek(tomorrowDate);
        const tomorrowIndex = (todayIndex + 1) % 7;
        const tomorrowName = DAY_MAP[tomorrowIndex];
        const tomorrowAll = student.weeklySchedule[tomorrowName] || [];
        const tomorrowCourses = tomorrowWeek >= 1 && tomorrowWeek <= 16
          ? filterByWeek(tomorrowAll, tomorrowWeek) : [];

        if (tomorrowCourses.length > 0) {
          return {
            found: true, studentName: student.name, dayOfWeek: tomorrowName,
            currentTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
            currentWeek, nextCourse: tomorrowCourses[0], todayCourses,
            message: `今天（第${currentWeek}教学周 ${dayName}）的课已经全部结束了，明天（${tomorrowName}）第一节课信息如下`,
          };
        }
        return {
          found: true, studentName: student.name, dayOfWeek: dayName,
          currentTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
          currentWeek, todayCourses,
          message: `今天（第${currentWeek}教学周 ${dayName}）的课已经全部结束了，明天没有课，好好休息！`,
        };
      }

      if (!nextCourse && todayCourses.length === 0) {
        for (let offset = 1; offset <= 7; offset++) {
          const futureDate = new Date(now.getTime() + offset * 86400000);
          const futureWeek = getTeachingWeek(futureDate);
          const futureIndex = (todayIndex + offset) % 7;
          const futureName = DAY_MAP[futureIndex];
          const futureCourses = futureWeek >= 1 && futureWeek <= 16
            ? filterByWeek(student.weeklySchedule[futureName] || [], futureWeek) : [];
          if (futureCourses.length > 0) {
            return {
              found: true, studentName: student.name, dayOfWeek: futureName,
              currentTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
              currentWeek, nextCourse: futureCourses[0],
              message: `今天（第${currentWeek}教学周 ${dayName}）没有课。最近的一节课在${futureName}`,
            };
          }
        }
      }

      return {
        found: true, studentName: student.name, dayOfWeek: dayName,
        currentTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        currentWeek, nextCourse, todayCourses,
        message: nextCourse ? undefined : `今天（第${currentWeek}教学周 ${dayName}）没有课哦，放松一下吧！`,
      };
    }

    return {
      found: true, studentName: student.name, dayOfWeek: dayName,
      currentTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
      currentWeek, todayCourses, courses: todayCourses,
    };
  }

  if (queryType === "tomorrow") {
    const tomorrowDate = new Date(now.getTime() + 86400000);
    const tomorrowWeek = getTeachingWeek(tomorrowDate);
    const tomorrowIndex = (todayIndex + 1) % 7;
    const dayName = DAY_MAP[tomorrowIndex];
    const allCourses = student.weeklySchedule[dayName] || [];
    const courses = tomorrowWeek >= 1 && tomorrowWeek <= 16
      ? filterByWeek(allCourses, tomorrowWeek) : [];
    return { found: true, studentName: student.name, dayOfWeek: dayName, currentWeek: tomorrowWeek, courses };
  }

  if (queryType === "week") {
    const weekCourses: Record<string, CourseInfo[]> = {};
    for (const [day, courses] of Object.entries(student.weeklySchedule)) {
      const filtered = filterByWeek(courses, currentWeek);
      if (filtered.length > 0) {
        weekCourses[day] = filtered;
      }
    }
    return {
      found: true, studentName: student.name, currentWeek,
      message: `第${currentWeek}教学周课表：\n${JSON.stringify(weekCourses, null, 2)}`,
    };
  }

  if (queryType === "specific_day" && specificDay) {
    const allCourses = student.weeklySchedule[specificDay] || [];
    const courses = filterByWeek(allCourses, currentWeek);
    return {
      found: true, studentName: student.name, dayOfWeek: specificDay,
      currentWeek, courses,
    };
  }

  return { found: false, message: "查询类型不支持" };
}
