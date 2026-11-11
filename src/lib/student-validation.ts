import { SCORE_LIMITS } from "@/lib/grades";

export type StudentInput = {
  studentCode: string;
  name: string;
  className: string;
  assignmentScore: number;
  quizScore: number;
  midtermScore: number;
  finalScore: number;
};

type ValidationResult =
  | { value: StudentInput; error?: never }
  | { value?: never; error: string };

export function validateStudent(input: unknown): ValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { error: "ข้อมูลนักศึกษาไม่ถูกต้อง" };
  }

  const body = input as Record<string, unknown>;
  const studentCode = typeof body.studentCode === "string" ? body.studentCode.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const className = typeof body.className === "string" ? body.className.trim() : "";

  if (!studentCode || studentCode.length > 30) {
    return { error: "กรุณาระบุรหัสนักศึกษาไม่เกิน 30 ตัวอักษร" };
  }
  if (!name || name.length > 120) {
    return { error: "กรุณาระบุชื่อนักศึกษาไม่เกิน 120 ตัวอักษร" };
  }
  if (!className || className.length > 80) {
    return { error: "กรุณาระบุห้องเรียนไม่เกิน 80 ตัวอักษร" };
  }

  const scoreFields = [
    ["assignmentScore", SCORE_LIMITS.assignment, "คะแนนงาน"],
    ["quizScore", SCORE_LIMITS.quiz, "คะแนนแบบทดสอบ"],
    ["midtermScore", SCORE_LIMITS.midterm, "คะแนนกลางภาค"],
    ["finalScore", SCORE_LIMITS.final, "คะแนนปลายภาค"],
  ] as const;
  const scores: Record<string, number> = {};

  for (const [field, maximum, label] of scoreFields) {
    const score = body[field];
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > maximum) {
      return { error: `${label}ต้องอยู่ระหว่าง 0 ถึง ${maximum} คะแนน` };
    }
    if (Math.round(score * 100) !== score * 100) {
      return { error: `${label}ระบุทศนิยมได้ไม่เกิน 2 ตำแหน่ง` };
    }
    scores[field] = score;
  }

  return {
    value: {
      studentCode,
      name,
      className,
      assignmentScore: scores.assignmentScore,
      quizScore: scores.quizScore,
      midtermScore: scores.midtermScore,
      finalScore: scores.finalScore,
    },
  };
}
