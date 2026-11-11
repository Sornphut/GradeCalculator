import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { currentUserId } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { validateStudent } from "@/lib/student-validation";

export const dynamic = "force-dynamic";

type StudentRecord = {
  id: number;
  student_code: string;
  name: string;
  class_name: string;
  assignment_score: string | number;
  quiz_score: string | number;
  midterm_score: string | number;
  final_score: string | number;
};

function toStudent(row: StudentRecord) {
  return {
    id: row.id,
    studentCode: row.student_code,
    name: row.name,
    className: row.class_name,
    assignmentScore: Number(row.assignment_score),
    quizScore: Number(row.quiz_score),
    midtermScore: Number(row.midterm_score),
    finalScore: Number(row.final_score),
  };
}

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const pool = await ensureSchema();
    const [rows] = await pool.execute<(StudentRecord & RowDataPacket)[]>(
      `SELECT id, student_code, name, class_name, assignment_score, quiz_score, midterm_score, final_score
       FROM students WHERE owner_id = ? ORDER BY student_code`,
      [userId],
    );
    return NextResponse.json({ students: rows.map(toStudent) });
  } catch (error) {
    console.error("Student list failed:", error);
    return NextResponse.json({ error: "ไม่สามารถโหลดรายชื่อนักศึกษาได้" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const validation = validateStudent(body);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    const pool = await ensureSchema();
    const student = validation.value;
    const [result] = await pool.execute<import("mysql2").ResultSetHeader>(
      `INSERT INTO students
        (owner_id, student_code, name, class_name, assignment_score, quiz_score, midterm_score, final_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        student.studentCode,
        student.name,
        student.className,
        student.assignmentScore,
        student.quizScore,
        student.midtermScore,
        student.finalScore,
      ],
    );
    return NextResponse.json({ student: { id: result.insertId, ...student } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "รหัสนักศึกษานี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Student creation failed:", error);
    return NextResponse.json({ error: "ไม่สามารถเพิ่มนักศึกษาได้" }, { status: 500 });
  }
}
