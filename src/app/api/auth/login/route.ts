import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "กรุณากรอกอีเมลและรหัสผ่าน" }, { status: 400 });
  }

  try {
    const pool = await ensureSchema();
    const [rows] = await pool.execute<Array<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
    }> & import("mysql2").RowDataPacket[]>(
      "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
      [body.email.trim().toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    const token = await createSessionToken(user.id);
    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json({ error: "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่" }, { status: 500 });
  }
}
