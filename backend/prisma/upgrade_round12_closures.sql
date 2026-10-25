-- PoultryOS รอบ 12: วันหยุดร้าน (แอดมินตั้งได้ ลูกค้าเห็น และสั่งซื้อ/จองในวันหยุดไม่ได้)
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS) เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับ DATABASE_URL ใน backend/.env
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่
--
-- kind = 'range'  : หยุดเป็นช่วงวันที่ (start_date ถึง end_date รวมวันสุดท้าย) เช่น หยุดปีใหม่ 3 วัน, ปิดวันนี้วันเดียว
-- kind = 'weekly' : หยุดประจำทุกสัปดาห์ (weekday 0 = อาทิตย์ ... 6 = เสาร์)
-- branch_id เป็น NULL = หยุดทุกสาขา

CREATE TABLE IF NOT EXISTS shop_closures (
  id         SERIAL PRIMARY KEY,
  branch_id  INTEGER REFERENCES branches(id) ON DELETE CASCADE,
  kind       VARCHAR(10) NOT NULL DEFAULT 'range',
  start_date DATE,
  end_date   DATE,
  weekday    SMALLINT,
  reason     VARCHAR(255),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS shop_closures_branch_idx ON shop_closures (branch_id);
CREATE INDEX IF NOT EXISTS shop_closures_dates_idx  ON shop_closures (start_date, end_date);
