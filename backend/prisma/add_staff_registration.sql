-- เพิ่มข้อมูลลงทะเบียนพนักงาน: ชื่อ นามสกุล เบอร์โทร ไอดีไลน์
-- รันครั้งเดียวใน PostgreSQL แล้วสั่ง `npx prisma generate` ในโฟลเดอร์ backend
-- (หรือใช้ `npx prisma db push` แทนไฟล์นี้ก็ได้)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS last_name  VARCHAR(100);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS phone      VARCHAR(20);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS line_id    VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS staff_phone_key ON staff (phone);
