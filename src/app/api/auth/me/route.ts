import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

    const pool = await ensureSchema();
    const [rows] = await pool.execute<Array<{ id: number; name: string; email: string }> & import("mysql2").RowDataPacket[]>(
      "SELECT id, name, email FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!rows[0]) return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้" }, { status: 401 });
    return NextResponse.json({ user: rows[0] });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ error: "ไม่สามารถตรวจสอบบัญชีได้" }, { status: 500 });
  }
}
