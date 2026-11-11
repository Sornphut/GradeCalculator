import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";

const sampleStudents = [
  ["65001", "กานต์ธีรา ใจดี", "ม.6/1", 27, 9, 27, 29],
  ["65002", "ธนกร วัฒนชัย", "ม.6/1", 25, 8, 24, 24],
  ["65003", "พิมพ์ชนก แสงทอง", "ม.6/1", 22, 7, 21, 20],
  ["65004", "ณัฐวุฒิ พูนผล", "ม.6/2", 20, 6, 18, 17],
  ["65005", "สุภาวดี คำสุข", "ม.6/2", 15, 5, 14, 13],
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 190) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและอีเมลให้ถูกต้อง" }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ error: "รหัสผ่านต้องมีความยาว 8–72 ตัวอักษร" }, { status: 400 });
  }

  let connection;
  let transactionStarted = false;
  try {
    const pool = await ensureSchema();
    const passwordHash = await bcrypt.hash(password, 12);
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [result] = await connection.execute<import("mysql2").ResultSetHeader>(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash],
    );
    const userId = result.insertId;
    for (const student of sampleStudents) {
      await connection.execute(
        `INSERT INTO students
          (owner_id, student_code, name, class_name, assignment_score, quiz_score, midterm_score, final_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, ...student],
      );
    }
    const token = await createSessionToken(userId);
    await connection.commit();
    transactionStarted = false;

    const response = NextResponse.json({ user: { id: userId, name, email } }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Registration rollback failed:", rollbackError);
      }
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "อีเมลนี้ถูกใช้งานแล้ว" }, { status: 409 });
    }
    console.error("Registration failed:", error);
    return NextResponse.json({ error: "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่" }, { status: 500 });
  } finally {
    connection?.release();
  }
}
