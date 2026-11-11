"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { calculateGrade, SCORE_LIMITS } from "@/lib/grades";

type User = { id: number; name: string; email: string };
type Student = {
  id: number;
  studentCode: string;
  name: string;
  className: string;
  assignmentScore: number;
  quizScore: number;
  midtermScore: number;
  finalScore: number;
};
type StudentForm = Omit<Student, "id">;
type GradeFilter = "ทั้งหมด" | "A" | "B+" | "B" | "C+" | "C" | "D+" | "D" | "F";

const blankStudent: StudentForm = {
  studentCode: "",
  name: "",
  className: "",
  assignmentScore: 0,
  quizScore: 0,
  midtermScore: 0,
  finalScore: 0,
};

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

function studentTotal(student: Student): number {
  return (
    student.assignmentScore +
    student.quizScore +
    student.midtermScore +
    student.finalScore
  );
}

function csvCell(value: string | number): string {
  let safe = String(value);
  if (/^[\s]*[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export default function Gradebook() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("ทั้งหมด");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [studentForm, setStudentForm] = useState<StudentForm>(blankStudent);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/students");
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { students: Student[] };
      setStudents(data.students);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดรายชื่อนักศึกษาได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = (await response.json()) as { user: User };
          if (!active) return;
          setUser(data.user);
          await loadStudents();
        } else if (response.status !== 401) {
          if (active) setError(await readError(response));
        }
      } catch {
        if (active) setError("ไม่สามารถเชื่อมต่อระบบได้");
      } finally {
        if (active) setChecking(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.studentCode.toLocaleLowerCase().includes(query) ||
        student.name.toLocaleLowerCase().includes(query) ||
        student.className.toLocaleLowerCase().includes(query);
      const matchesGrade =
        gradeFilter === "ทั้งหมด" || calculateGrade(studentTotal(student)) === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [students, search, gradeFilter]);

  const totals = useMemo(() => {
    if (filteredStudents.length === 0) return { average: 0, pass: 0, highest: 0 };
    const scores = filteredStudents.map(studentTotal);
    return {
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      pass: scores.filter((score) => score >= 50).length,
      highest: Math.max(...scores),
    };
  }, [filteredStudents]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const isRegister = authMode === "register";
    try {
      const response = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isRegister ? { name: authName } : {}),
          email: authEmail,
          password: authPassword,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { user: User };
      setUser(data.user);
      setAuthPassword("");
      setNotice(isRegister ? "สมัครสมาชิกเรียบร้อย เพิ่มข้อมูลตัวอย่าง 5 คนแล้ว" : "");
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถเข้าสู่ระบบได้");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStudents([]);
    setNotice("");
    setError("");
  }

  function startCreate() {
    setEditingId(null);
    setStudentForm(blankStudent);
    setFormOpen(true);
    setError("");
  }

  function startEdit(student: Student) {
    setEditingId(student.id);
    setStudentForm({
      studentCode: student.studentCode,
      name: student.name,
      className: student.className,
      assignmentScore: student.assignmentScore,
      quizScore: student.quizScore,
      midtermScore: student.midtermScore,
      finalScore: student.finalScore,
    });
    setFormOpen(true);
    setError("");
  }

  async function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/students/${editingId}` : "/api/students",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(studentForm),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      setFormOpen(false);
      setNotice(editingId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มนักศึกษาแล้ว");
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถบันทึกข้อมูลได้");
    }
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`ยืนยันการลบข้อมูล ${student.name} (${student.studentCode}) หรือไม่?`)) {
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/students/${student.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      setNotice("ลบข้อมูลนักศึกษาแล้ว");
      await loadStudents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถลบข้อมูลได้");
    }
  }

  function exportCsv() {
    const headings = [
      "รหัสนักศึกษา",
      "ชื่อ-นามสกุล",
      "ห้อง",
      "คะแนนงาน (30)",
      "แบบทดสอบ (10)",
      "กลางภาค (30)",
      "ปลายภาค (30)",
      "รวม (100)",
      "เกรด",
    ];
    const rows = filteredStudents.map((student) => [
      student.studentCode,
      student.name,
      student.className,
      student.assignmentScore,
      student.quizScore,
      student.midtermScore,
      student.finalScore,
      studentTotal(student),
      calculateGrade(studentTotal(student)),
    ]);
    const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    link.download = "grade-report.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (checking) return <div className="loading">กำลังตรวจสอบบัญชีผู้ใช้…</div>;

  if (!user) {
    return (
      <div className="auth-wrap">
        <aside className="auth-aside">
          <div className="brand">
            <span className="brand-mark">G</span>
            <span>
              Gradebook
              <small>ระบบจัดการคะแนน</small>
            </span>
          </div>
          <div className="auth-copy">
            <span className="eyebrow">จัดการผลการเรียนอย่างเป็นระบบ</span>
            <h1>คะแนนชัดเจน<br />เกรดคำนวณง่าย</h1>
            <p>
              บันทึกคะแนนนักศึกษา ดูภาพรวมผลการเรียน และส่งออกรายงานได้ในที่เดียว
              สมัครสมาชิกเพื่อเริ่มต้นพร้อมข้อมูลตัวอย่าง 5 คน
            </p>
          </div>
          <div className="auth-foot">Gradebook · ระบบจัดการคะแนนสำหรับผู้สอน</div>
        </aside>
        <main className="auth-main">
          <form className="auth-card" onSubmit={submitAuth}>
            <span className="eyebrow">{authMode === "register" ? "สร้างบัญชีใหม่" : "ยินดีต้อนรับกลับ"}</span>
            <h2>{authMode === "register" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</h2>
            <p>
              {authMode === "register"
                ? "สมัครบัญชีผู้สอนเพื่อสร้างสมุดคะแนนส่วนตัว"
                : "ลงชื่อเข้าใช้เพื่อจัดการคะแนนและรายงาน"}
            </p>
            {error && <div className="notice" role="alert">{error}</div>}
            <div className="auth-fields">
              {authMode === "register" && (
                <div className="field">
                  <label htmlFor="auth-name">ชื่อผู้สอน</label>
                  <input
                    id="auth-name"
                    className="input"
                    autoComplete="name"
                    maxLength={120}
                    required
                    value={authName}
                    onChange={(event) => setAuthName(event.target.value)}
                    placeholder="ชื่อที่ใช้แสดงในระบบ"
                  />
                </div>
              )}
              <div className="field">
                <label htmlFor="auth-email">อีเมล</label>
                <input
                  id="auth-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  required
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="field">
                <label htmlFor="auth-password">รหัสผ่าน</label>
                <input
                  id="auth-password"
                  className="input"
                  type="password"
                  autoComplete={authMode === "register" ? "new-password" : "current-password"}
                  minLength={8}
                  maxLength={72}
                  required
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>
            </div>
            <button className="button button-primary auth-submit" type="submit">
              {authMode === "register" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
            </button>
            <div className="auth-switch">
              {authMode === "register" ? "มีบัญชีอยู่แล้ว? " : "ยังไม่มีบัญชี? "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setAuthMode(authMode === "register" ? "login" : "register");
                  setError("");
                }}
              >
                {authMode === "register" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
              </button>
            </div>
          </form>
        </main>
      </div>
    );
  }

  const gradeOrder = ["A", "B+", "B", "C+", "C", "D+", "D", "F"] as const;
  const gradeCounts = Object.fromEntries(gradeOrder.map((grade) => [grade, 0])) as Record<
    (typeof gradeOrder)[number],
    number
  >;
  for (const student of filteredStudents) {
    gradeCounts[calculateGrade(studentTotal(student)) as (typeof gradeOrder)[number]] += 1;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">G</span>
          <span>
            Gradebook
            <small>ระบบจัดการคะแนน</small>
          </span>
        </div>
        <div className="account">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <span>{user.name}</span>
          <button className="button button-small" type="button" onClick={logout}>ออกจากระบบ</button>
        </div>
      </header>

      <main className="main">
        <section className="welcome">
          <div>
            <div className="eyebrow">ภาพรวมผลการเรียน</div>
            <h1>สมุดบันทึกคะแนน</h1>
            <p className="subtitle">จัดการคะแนน ประมวลผลเกรด และออกรายงานของคุณ</p>
          </div>
          <div className="actions">
            <button className="button" type="button" onClick={() => window.print()}>พิมพ์รายงาน</button>
            <button className="button" type="button" onClick={exportCsv}>ดาวน์โหลด CSV</button>
            <button className="button button-primary" type="button" onClick={startCreate}>＋ เพิ่มนักศึกษา</button>
          </div>
        </section>

        {error && <div className="notice" role="alert">{error}</div>}
        {notice && <div className="notice success-notice" role="status">{notice}</div>}

        <section className="stats" aria-label="สรุปผล">
          <article className="stat-card">
            <div className="stat-label">นักศึกษาที่แสดง</div>
            <div className="stat-value">{filteredStudents.length}</div>
            <div className="stat-note">จากทั้งหมด {students.length} คน</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">คะแนนเฉลี่ย</div>
            <div className="stat-value">{totals.average.toFixed(1)}<small style={{ fontSize: 13 }}> / 100</small></div>
            <div className="stat-note">คำนวณจากรายชื่อที่แสดง</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">ผ่านเกณฑ์ (50 คะแนน)</div>
            <div className="stat-value">{totals.pass}<small style={{ fontSize: 13 }}> / {filteredStudents.length}</small></div>
            <div className="stat-note">คะแนนรวมตั้งแต่ 50 คะแนน</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">คะแนนสูงสุด</div>
            <div className="stat-value">{totals.highest}<small style={{ fontSize: 13 }}> / 100</small></div>
            <div className="stat-note">คะแนนรวมสูงสุดในรายการ</div>
          </article>
        </section>

        {formOpen && (
          <section className="panel" aria-label="แบบฟอร์มข้อมูลนักศึกษา">
            <div className="panel-heading">
              <div>
                <h2>{editingId ? "แก้ไขข้อมูลนักศึกษา" : "เพิ่มนักศึกษา"}</h2>
                <p>กรอกคะแนนแต่ละส่วนตามคะแนนเต็มที่กำหนด</p>
              </div>
            </div>
            <form className="form-panel" onSubmit={saveStudent}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="student-code">รหัสนักศึกษา</label>
                  <input id="student-code" className="input" maxLength={30} required value={studentForm.studentCode}
                    onChange={(event) => setStudentForm({ ...studentForm, studentCode: event.target.value })} />
                </div>
                <div className="field field-wide">
                  <label htmlFor="student-name">ชื่อ-นามสกุล</label>
                  <input id="student-name" className="input" maxLength={120} required value={studentForm.name}
                    onChange={(event) => setStudentForm({ ...studentForm, name: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="student-class">ห้องเรียน</label>
                  <input id="student-class" className="input" maxLength={80} required value={studentForm.className}
                    onChange={(event) => setStudentForm({ ...studentForm, className: event.target.value })} placeholder="เช่น ม.6/1" />
                </div>
                {([
                  ["assignmentScore", "คะแนนงาน", SCORE_LIMITS.assignment],
                  ["quizScore", "แบบทดสอบ", SCORE_LIMITS.quiz],
                  ["midtermScore", "กลางภาค", SCORE_LIMITS.midterm],
                  ["finalScore", "ปลายภาค", SCORE_LIMITS.final],
                ] as const).map(([field, label, maximum]) => (
                  <div className="field" key={field}>
                    <label htmlFor={field}>{label} (เต็ม {maximum})</label>
                    <input id={field} className="input" type="number" min={0} max={maximum} step="0.5" required
                      value={studentForm[field]}
                      onChange={(event) => setStudentForm({ ...studentForm, [field]: Number(event.target.value) })} />
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button className="button" type="button" onClick={() => setFormOpen(false)}>ยกเลิก</button>
                <button className="button button-primary" type="submit">{editingId ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}</button>
              </div>
            </form>
          </section>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>รายชื่อนักศึกษาและผลคะแนน</h2>
              <p>คะแนนรวมและเกรดคำนวณให้อัตโนมัติ</p>
            </div>
            {loading && <span className="stat-label">กำลังโหลด…</span>}
          </div>
          <div className="filters">
            <input className="input search-input" aria-label="ค้นหานักศึกษา" placeholder="ค้นหาชื่อ รหัส หรือห้องเรียน"
              value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="select grade-filter" aria-label="กรองตามเกรด" value={gradeFilter}
              onChange={(event) => setGradeFilter(event.target.value as GradeFilter)}>
              {(["ทั้งหมด", ...gradeOrder] as GradeFilter[]).map((grade) => (
                <option key={grade} value={grade}>{grade === "ทั้งหมด" ? "ทุกเกรด" : `เกรด ${grade}`}</option>
              ))}
            </select>
          </div>
          {filteredStudents.length === 0 ? (
            <div className="empty">
              {students.length === 0 ? "ยังไม่มีข้อมูลนักศึกษา กด “เพิ่มนักศึกษา” เพื่อเริ่มต้น" : "ไม่พบข้อมูลที่ตรงกับการค้นหา"}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>นักศึกษา</th>
                    <th>งาน<br />(30)</th>
                    <th>แบบทดสอบ<br />(10)</th>
                    <th>กลางภาค<br />(30)</th>
                    <th>ปลายภาค<br />(30)</th>
                    <th>รวม<br />(100)</th>
                    <th>เกรด</th>
                    <th className="no-print">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const total = studentTotal(student);
                    const grade = calculateGrade(total);
                    return (
                      <tr key={student.id}>
                        <td>
                          <span className="student-name">{student.name}</span>
                          <span className="student-sub">{student.studentCode} · {student.className}</span>
                        </td>
                        <td className="score-cell">{student.assignmentScore}</td>
                        <td className="score-cell">{student.quizScore}</td>
                        <td className="score-cell">{student.midtermScore}</td>
                        <td className="score-cell">{student.finalScore}</td>
                        <td className="total-cell">{total}</td>
                        <td><span className={`grade-pill ${grade === "F" ? "grade-f" : ""}`}>{grade}</span></td>
                        <td className="no-print">
                          <div className="row-actions">
                            <button className="button button-small" type="button" onClick={() => startEdit(student)}>แก้ไข</button>
                            <button className="button button-small button-danger" type="button" onClick={() => void deleteStudent(student)}>ลบ</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="score-guide">
            คะแนนเต็ม: งาน 30 + แบบทดสอบ 10 + กลางภาค 30 + ปลายภาค 30 = 100 คะแนน
            · เกณฑ์เกรด: A ≥ 80, B+ ≥ 75, B ≥ 70, C+ ≥ 65, C ≥ 60, D+ ≥ 55, D ≥ 50, F &lt; 50
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>สรุปจำนวนตามเกรด</h2>
              <p>แสดงผลตามตัวกรองปัจจุบัน</p>
            </div>
          </div>
          <div className="distribution">
            {gradeOrder.map((grade) => (
              <div className="grade-count" key={grade}>
                <span>เกรด {grade}</span><strong>{gradeCounts[grade]}</strong>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
