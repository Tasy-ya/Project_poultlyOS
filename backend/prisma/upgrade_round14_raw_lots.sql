-- =====================================================
-- รอบ 14: ล็อตวัตถุดิบ (Lot Tracking) + ตัดสต็อกแบบ FEFO/FIFO
--
-- รันใน pgAdmin / Supabase SQL Editor แล้วรัน  npx prisma generate
-- รันซ้ำได้ (idempotent)
--
-- หลักการ: branch_stock_raw.qty (ยอดรวม) = ผลรวม raw_material_lots.qty_remaining
--          ล็อตเก่าไม่ถูกลบ/เขียนทับ ประวัติทุกครั้งอยู่ใน raw_material_logs (อ้าง lot_id)
-- =====================================================

CREATE TABLE IF NOT EXISTS raw_material_lots (
    id            SERIAL PRIMARY KEY,
    branch_id     INTEGER NOT NULL REFERENCES branches(id),
    material_id   INTEGER NOT NULL REFERENCES raw_materials(id),
    lot_no        VARCHAR(50) NOT NULL,
    qty_received  NUMERIC(10,3) NOT NULL,
    qty_remaining NUMERIC(10,3) NOT NULL,
    unit_cost     NUMERIC(10,2),
    supplier      VARCHAR(100),
    received_at   TIMESTAMP NOT NULL DEFAULT now(),
    expires_at    TIMESTAMP,
    status        VARCHAR(10) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','used_up','discarded')),
    note          VARCHAR(255),
    staff_id      INTEGER REFERENCES staff(id),
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT raw_material_lots_qty_chk CHECK (qty_remaining >= 0),
    UNIQUE (branch_id, material_id, lot_no)
);

CREATE INDEX IF NOT EXISTS idx_raw_lots_pick
    ON raw_material_lots (branch_id, material_id, status, expires_at, received_at);

-- ประวัติเคลื่อนไหวอ้างอิงล็อตได้
ALTER TABLE raw_material_logs
    ADD COLUMN IF NOT EXISTS lot_id INTEGER REFERENCES raw_material_lots(id);

-- เพิ่มประเภท 'waste' (ทิ้งของเสีย/หมดอายุ)
ALTER TABLE raw_material_logs DROP CONSTRAINT IF EXISTS raw_material_logs_type_check;
ALTER TABLE raw_material_logs
    ADD CONSTRAINT raw_material_logs_type_check
    CHECK (type IN ('in','out','adjust','waste'));

-- ยกยอดเดิม: วัตถุดิบที่มีอยู่ก่อนเปิดระบบล็อต -> ล็อต OPENING (ไม่มีวันหมดอายุ)
INSERT INTO raw_material_lots
    (branch_id, material_id, lot_no, qty_received, qty_remaining, note)
SELECT s.branch_id, s.material_id,
       'OPENING-' || to_char(now(), 'YYYYMMDD'),
       s.qty, s.qty, 'ยอดยกมาก่อนเปิดระบบล็อต'
FROM branch_stock_raw s
WHERE s.qty > 0
  AND s.branch_id IS NOT NULL AND s.material_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM raw_material_lots l
      WHERE l.branch_id = s.branch_id AND l.material_id = s.material_id
  );
