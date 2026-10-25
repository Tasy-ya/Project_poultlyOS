-- PoultryOS รอบ 13: เก็บโปรโมชั่นที่แอดมินสร้างลงฐานข้อมูล (ให้หน้าลูกค้า/หน้าพนักงานทุกสาขาเห็นตรงกัน)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS) เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับ DATABASE_URL ใน backend/.env
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่
--
-- data = ข้อมูลโปรโมชั่นทั้งก้อนจากหน้าแอดมิน (JSON) / branch_id เป็น NULL = ใช้กับทุกสาขา

CREATE TABLE IF NOT EXISTS shop_promotions (
  id          SERIAL PRIMARY KEY,
  branch_id   INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS shop_promotions_branch_idx ON shop_promotions (branch_id);
