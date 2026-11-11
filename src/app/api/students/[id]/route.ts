import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { validateStudent } from "@/lib/student-validation";

type RouteContext = { params: Promise<{ id: string }> };

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: Request, context: RouteContext) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "รหัสนักศึกษาไม่ถูกต้อง" }, { status: 400 });

  const body: unknown = await request.json().catch(() => null);
  const validation = validateStudent(body);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });

  try {
    const pool = await ensureSchema();
    const [existing] = await pool.execute<import("mysql2").RowDataPacket[]>(
      "SELECT id FROM students WHERE id = ? AND owner_id = ? LIMIT 1",
      [id, userId],
    );
    if (!existing[0]) return NextResponse.json({ error: "ไม่พบนักศึกษา" }, { status: 404 });

    const student = validation.value;
    await pool.execute(
      `UPDATE students SET student_code = ?, name = ?, class_name = ?, assignment_score = ?,
        quiz_score = ?, midterm_score = ?, final_score = ? WHERE id = ? AND owner_id = ?`,
      [
        student.studentCode,
        student.name,
        student.className,
        student.assignmentScore,
        student.quizScore,
        student.midtermScore,
        student.finalScore,
        id,
        userId,
      ],
    );
    return NextResponse.json({ student: { id, ...student } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "รหัสนักศึกษานี้มีอยู่แล้ว" }, { status: 409 });
    }
    console.error("Student update failed:", error);
    return NextResponse.json({ error: "ไม่สามารถบันทึกข้อมูลได้" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (!id) return NextResponse.json({ error: "รหัสนักศึกษาไม่ถูกต้อง" }, { status: 400 });

  try {
    const pool = await ensureSchema();
    const [result] = await pool.execute<import("mysql2").ResultSetHeader>(
      "DELETE FROM students WHERE id = ? AND owner_id = ?",
      [id, userId],
    );
    if (result.affectedRows === 0) return NextResponse.json({ error: "ไม่พบนักศึกษา" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student deletion failed:", error);
    return NextResponse.json({ error: "ไม่สามารถลบนักศึกษาได้" }, { status: 500 });
  }
}
