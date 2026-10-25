-- =====================================================
-- รอบ 15: อายุเก็บมาตรฐาน + สถานะการเก็บ (แช่แข็ง / แช่เย็น / ละลาย)
--
-- รันใน pgAdmin / Supabase SQL Editor แล้วรัน  npx prisma generate
-- รันซ้ำได้ (idempotent) — ต้องรัน upgrade_round14_raw_lots.sql มาก่อน
--
-- หลักการ:
--   * วัตถุดิบแต่ละชนิดตั้ง "อายุเก็บมาตรฐาน" (วัน) แยกตามสถานะ: แช่เย็น / แช่แข็ง / หลังละลาย
--   * ตอนรับเข้า ถ้าไม่กรอกวันหมดอายุ ระบบคำนวณให้ = วันรับเข้า + อายุมาตรฐานของสถานะนั้น
--   * ล็อตเก็บ "สถานะการเก็บ" (storage) และที่มาของวันหมดอายุ (expiry_source)
--   * ละลาย/แช่แข็ง = แยกล็อตเดิมเป็นล็อตใหม่ ยอดรวมไม่เปลี่ยน วันหมดอายุคำนวณใหม่
--   * ไม่มีการกำหนดตัวเลขอายุให้เองในไฟล์นี้ — ตั้งค่าที่หน้า Stock > แท็บ 5 ล็อต
-- =====================================================

-- ---------- วัตถุดิบ: อายุเก็บมาตรฐาน ----------
ALTER TABLE raw_materials
    ADD COLUMN IF NOT EXISTS default_storage        VARCHAR(10) NOT NULL DEFAULT 'ambient',
    ADD COLUMN IF NOT EXISTS shelf_life_chilled_days INTEGER,
    ADD COLUMN IF NOT EXISTS shelf_life_frozen_days  INTEGER,
    ADD COLUMN IF NOT EXISTS shelf_life_thawed_days  INTEGER;

ALTER TABLE raw_materials DROP CONSTRAINT IF EXISTS raw_materials_default_storage_check;
ALTER TABLE raw_materials
    ADD CONSTRAINT raw_materials_default_storage_check
    CHECK (default_storage IN ('ambient','chilled','frozen'));

ALTER TABLE raw_materials DROP CONSTRAINT IF EXISTS raw_materials_shelf_life_check;
ALTER TABLE raw_materials
    ADD CONSTRAINT raw_materials_shelf_life_check
    CHECK (
        (shelf_life_chilled_days IS NULL OR shelf_life_chilled_days BETWEEN 1 AND 3650) AND
        (shelf_life_frozen_days  IS NULL OR shelf_life_frozen_days  BETWEEN 1 AND 3650) AND
        (shelf_life_thawed_days  IS NULL OR shelf_life_thawed_days  BETWEEN 1 AND 3650)
    );

-- ---------- ล็อต: สถานะการเก็บ + ที่มาวันหมดอายุ ----------
ALTER TABLE raw_material_lots
    ADD COLUMN IF NOT EXISTS storage       VARCHAR(10) NOT NULL DEFAULT 'ambient',
    ADD COLUMN IF NOT EXISTS frozen_at     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS thawed_at     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS expiry_source VARCHAR(10) NOT NULL DEFAULT 'none';

ALTER TABLE raw_material_lots DROP CONSTRAINT IF EXISTS raw_material_lots_storage_check;
ALTER TABLE raw_material_lots
    ADD CONSTRAINT raw_material_lots_storage_check
    CHECK (storage IN ('ambient','chilled','frozen','thawed'));

ALTER TABLE raw_material_lots DROP CONSTRAINT IF EXISTS raw_material_lots_expiry_source_check;
ALTER TABLE raw_material_lots
    ADD CONSTRAINT raw_material_lots_expiry_source_check
    CHECK (expiry_source IN ('none','entered','auto'));

-- ล็อตเดิมที่มีวันหมดอายุอยู่แล้ว = พนักงานกรอกเอง
UPDATE raw_material_lots
   SET expiry_source = 'entered'
 WHERE expires_at IS NOT NULL
   AND expiry_source = 'none';

-- ---------- ประวัติ: เพิ่มประเภท freeze / thaw ----------
ALTER TABLE raw_material_logs DROP CONSTRAINT IF EXISTS raw_material_logs_type_check;
ALTER TABLE raw_material_logs
    ADD CONSTRAINT raw_material_logs_type_check
    CHECK (type IN ('in','out','adjust','waste','freeze','thaw'));
