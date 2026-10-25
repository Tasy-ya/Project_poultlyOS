-- PoultryOS รอบ 14: เพิ่มช่อง "ต้นทุนสินค้า" ให้เมนู (หน้าแอดมิน > แก้ไขสินค้า > จัดการต้นทุน)
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับ DATABASE_URL ใน backend/.env รันซ้ำได้ปลอดภัย
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่
--
-- cost = ต้นทุนต่อ 1 หน่วยเต็ม (เช่น เป็ดเต็มตัว) ครึ่งตัวระบบคิด 50% ให้เอง
-- ถ้า cost = 0 ระบบจะใช้ต้นทุนจากสูตรวัตถุดิบเหมือนเดิม

ALTER TABLE menus ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2) NOT NULL DEFAULT 0;
