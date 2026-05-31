import fs from "fs";
import path from "path";
import { decrypt } from "./crypto";

interface StudentRecord {
  studentId: string;
  name: string;
  major: string;
  college: string;
  grade: string;
  className: string;
}

interface StudentsData {
  students: StudentRecord[];
}

interface CourseInfo {
  period: string;
  time: string;
  course: string;
  teacher: string;
  location: string;
  weeks: number[];
  type: string;
}

interface SchedulesData {
  teachingWeekStart: string;
  semester: string;
  periods: Record<string, string>;
  [studentId: string]: string | Record<string, string> | {
    name: string;
    weeklySchedule: Record<string, CourseInfo[]>;
  };
}

let _students: StudentsData | undefined;
let _schedules: SchedulesData | undefined;

function loadEncrypted(filename: string): string {
  const filePath = path.join(process.cwd(), "data", filename);
  return fs.readFileSync(filePath, "utf8");
}

export function getStudents(): StudentsData {
  if (!_students) {
    const enc = loadEncrypted("students.enc");
    _students = JSON.parse(decrypt(enc)) as StudentsData;
  }
  return _students!;
}

export function getSchedules(): SchedulesData {
  if (!_schedules) {
    const enc = loadEncrypted("schedules.enc");
    _schedules = JSON.parse(decrypt(enc)) as SchedulesData;
  }
  return _schedules!;
}

export function findStudent(studentId: string): StudentRecord | undefined {
  return getStudents().students.find((s) => s.studentId === studentId);
}
