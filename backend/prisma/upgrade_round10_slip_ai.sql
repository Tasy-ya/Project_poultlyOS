-- PoultryOS รอบ 10: AI ตรวจสลิป (ฝั่งพนักงานขาย)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS) เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับ DATABASE_URL ใน backend/.env
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่

ALTER TABLE orders       ADD COLUMN IF NOT EXISTS slip_hash  VARCHAR(64);
ALTER TABLE orders       ADD COLUMN IF NOT EXISTS slip_ai    JSONB;
ALTER TABLE orders       ADD COLUMN IF NOT EXISTS slip_ai_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS slip_hash  VARCHAR(64);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS slip_ai    JSONB;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS slip_ai_at TIMESTAMP;

-- ใช้หาสลิปซ้ำ (ไฟล์เดียวกันถูกใช้กับหลายออเดอร์)
CREATE INDEX IF NOT EXISTS orders_slip_hash_idx       ON orders (slip_hash)       WHERE slip_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservations_slip_hash_idx ON reservations (slip_hash) WHERE slip_hash IS NOT NULL;
