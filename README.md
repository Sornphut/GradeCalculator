# Gradebook — ระบบจัดการคะแนน

เว็บแอปสำหรับผู้สอน บันทึกคะแนนนักศึกษา ประมวลผลเกรด และออกรายงาน CSV/พิมพ์ได้ สร้างด้วย Next.js, TypeScript และ MariaDB

## ความสามารถ

- สมัครสมาชิกและเข้าสู่ระบบ โดยเก็บรหัสผ่านแบบ bcrypt และใช้ session cookie แบบ HttpOnly
- แยกข้อมูลนักศึกษาตามบัญชีผู้สอน
- สมัครสมาชิกแล้วมีข้อมูลตัวอย่างนักศึกษา 5 คนให้ทันที
- เพิ่ม แก้ไข ลบ ค้นหา และกรองนักศึกษาตามเกรด
- คะแนนงาน 30 + แบบทดสอบ 10 + กลางภาค 30 + ปลายภาค 30 รวม 100 คะแนน
- สรุปคะแนนเฉลี่ย จำนวนผู้ผ่าน คะแนนสูงสุด และจำนวนตามเกรด
- ดาวน์โหลดรายงาน CSV หรือใช้ปุ่มพิมพ์รายงาน

เกณฑ์เกรด: A ≥ 80, B+ ≥ 75, B ≥ 70, C+ ≥ 65, C ≥ 60, D+ ≥ 55, D ≥ 50, F < 50

## เริ่มใช้งานในเครื่อง

1. ติดตั้ง Node.js 20.9 ขึ้นไป และสร้างฐานข้อมูล MariaDB ว่าง เช่น `gradebook`
2. สร้างไฟล์ `.env.local` ที่รากโปรเจกต์:

   ```env
   DATABASE_URL=mysql://db_user:db_password@localhost:3306/gradebook
   SESSION_SECRET=ใส่ค่าสุ่มที่ยาวอย่างน้อย-32-ตัวอักษร
   # ตั้งเป็น true เมื่อผู้ให้บริการฐานข้อมูลกำหนดให้เชื่อมต่อผ่าน TLS
   DATABASE_SSL=false
   ```

3. ติดตั้ง dependency และเริ่มเว็บ:

   ```bash
   npm install
   npm run dev
   ```

เปิด `http://localhost:3000` แล้วสมัครสมาชิก ตารางจะถูกสร้างให้อัตโนมัติเมื่อมีการเรียก API ครั้งแรก

## นำขึ้น Vercel

1. Push โปรเจกต์ขึ้น Git provider แล้ว Import repository ใน Vercel (Framework จะตรวจพบ Next.js อัตโนมัติ)
2. เตรียม MariaDB ที่รับการเชื่อมต่อจาก Vercel Functions ได้ เช่น managed MariaDB ที่มี public endpoint และอนุญาต network access ตามนโยบายผู้ให้บริการ
3. เพิ่ม Environment Variables ใน Vercel สำหรับทุก Environment ที่ต้องการ:
   - `DATABASE_URL` — connection URL ของ MariaDB รูปแบบ `mysql://user:password@host:3306/database`
   - `SESSION_SECRET` — ค่าสุ่มส่วนตัวอย่างน้อย 32 ตัวอักษร
   - `DATABASE_SSL` — ตั้ง `true` หากฐานข้อมูลกำหนด TLS
4. Deploy แล้วเปิดเว็บไซต์และสมัครสมาชิก ตารางฐานข้อมูลจะสร้างอัตโนมัติ และบัญชีใหม่จะได้รับข้อมูลตัวอย่าง 5 คน

อย่า commit `.env.local` หรือเปิดเผย `SESSION_SECRET` และรหัสผ่านฐานข้อมูล ควรตรวจสอบว่า MariaDB อนุญาตการเชื่อมต่อจากฟังก์ชันบน Vercel ก่อน Deploy
