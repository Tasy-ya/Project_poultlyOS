-- =====================================================================
-- อัปเกรดฐานข้อมูลเดิม (13 ตาราง) -> v2  (รันซ้ำได้ ไม่ทำข้อมูลเดิมหาย)
-- รันใน pgAdmin > Query Tool บนฐานข้อมูล poultlyos ทั้งไฟล์ในครั้งเดียว
-- =====================================================================

-- ---------- 1) ตารางใหม่ (ลำดับสำคัญ: ตัวที่ถูกอ้างอิงต้องมาก่อน) ----------
CREATE TABLE IF NOT EXISTS prep_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    shelf_life_hours INTEGER,
    category VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS prep_recipe (
    prep_item_id INTEGER REFERENCES prep_items(id),
    material_id INTEGER REFERENCES raw_materials(id),
    qty_per_unit NUMERIC(10,3) NOT NULL,
    PRIMARY KEY (prep_item_id, material_id)
);

CREATE TABLE IF NOT EXISTS branch_stock_raw (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    material_id INTEGER REFERENCES raw_materials(id),
    qty NUMERIC(10,3) NOT NULL DEFAULT 0,
    reorder_point NUMERIC(10,3) DEFAULT 0,
    UNIQUE (branch_id, material_id)
);

CREATE TABLE IF NOT EXISTS raw_material_logs (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    material_id INTEGER REFERENCES raw_materials(id),
    type VARCHAR(10) CHECK (type IN ('in','out','adjust')),
    qty NUMERIC(10,3) NOT NULL,
    note VARCHAR(255),
    staff_id INTEGER REFERENCES staff(id),
    local_id UUID,
    synced BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prep_batches (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    prep_item_id INTEGER REFERENCES prep_items(id),
    batch_no VARCHAR(50),
    qty_produced NUMERIC(10,3) NOT NULL,
    qty_remaining NUMERIC(10,3) NOT NULL,
    prepared_by INTEGER REFERENCES staff(id),
    prepared_at TIMESTAMP DEFAULT now(),
    expires_at TIMESTAMP,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active','used_up','expired','wasted')),
    local_id UUID,
    synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS ready_production_logs (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    menu_id INTEGER REFERENCES menus(id),
    prep_batch_id INTEGER REFERENCES prep_batches(id),
    qty_produced INTEGER NOT NULL,
    staff_id INTEGER REFERENCES staff(id),
    produced_at TIMESTAMP DEFAULT now(),
    local_id UUID,
    synced BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('percent','fixed_amount','buy_x_get_y')),
    value NUMERIC(10,2),
    buy_qty INTEGER,
    get_qty INTEGER,
    branch_id INTEGER REFERENCES branches(id),
    min_order_amount NUMERIC(10,2) DEFAULT 0,
    start_date DATE,
    end_date DATE,
    active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS promotion_menus (
    promotion_id INTEGER REFERENCES promotions(id),
    menu_id INTEGER REFERENCES menus(id),
    PRIMARY KEY (promotion_id, menu_id)
);

-- ---------- 2) เพิ่มคอลัมน์ในตารางเดิม ----------
ALTER TABLE menus ADD COLUMN IF NOT EXISTS category VARCHAR(20);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS category VARCHAR(20);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS local_id UUID;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;

ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS local_id UUID;
ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;
ALTER TABLE stock_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();

ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_no VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_id INTEGER REFERENCES promotions(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS local_id UUID;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS synced BOOLEAN DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();
-- ช่อง channel เดิมไม่ใช้แล้ว (ย้ายไปตาราง payments) ให้ว่างได้ จะได้ไม่ขวางการสร้างออเดอร์
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'orders' AND column_name = 'channel') THEN
    ALTER TABLE orders ALTER COLUMN channel DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- notifications: เปลี่ยน read -> is_read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'notifications' AND column_name = 'read') THEN
    ALTER TABLE notifications RENAME COLUMN "read" TO is_read;
  END IF;
END $$;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();

-- staff: อนุญาตตำแหน่ง manager ด้วย
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_position_check;
ALTER TABLE staff ADD CONSTRAINT staff_position_check CHECK (position IN ('sales','prep','manager'));

-- ---------- 3) menu_recipe: เพิ่ม id + รองรับอ้างอิง "ของหมัก" ----------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'menu_recipe' AND column_name = 'id') THEN
    ALTER TABLE menu_recipe DROP CONSTRAINT IF EXISTS menu_recipe_pkey;
    ALTER TABLE menu_recipe ADD COLUMN id SERIAL PRIMARY KEY;
  END IF;
END $$;
ALTER TABLE menu_recipe ALTER COLUMN material_id DROP NOT NULL;
ALTER TABLE menu_recipe ADD COLUMN IF NOT EXISTS prep_item_id INTEGER REFERENCES prep_items(id);

-- ---------- 4) unique index ที่ระบบต้องใช้ (upsert สต็อก) ----------
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_stock ON branch_stock (branch_id, menu_id);

-- ---------- 5) ตารางจองล่วงหน้า ----------
CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    customer_name VARCHAR(100),
    phone VARCHAR(20),
    pickup_datetime TIMESTAMP NOT NULL,
    deposit_amount NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled')),
    note VARCHAR(255),
    created_by INTEGER REFERENCES staff(id),
    order_id INTEGER REFERENCES orders(id),
    local_id UUID,
    synced BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_items (
    id SERIAL PRIMARY KEY,
    reservation_id INTEGER REFERENCES reservations(id),
    menu_id INTEGER REFERENCES menus(id),
    size VARCHAR(10) CHECK (size IN ('full','half')),
    qty INTEGER NOT NULL,
    unit_price NUMERIC(10,2),
    line_total NUMERIC(10,2)
);

-- ---------- 6) payments (แยกช่องทางชำระเงิน) ----------
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    method VARCHAR(20) CHECK (method IN ('cash','qr','transfer','card','other')),
    amount NUMERIC(10,2) NOT NULL,
    ref_no VARCHAR(100),
    paid_at TIMESTAMP DEFAULT now()
);
