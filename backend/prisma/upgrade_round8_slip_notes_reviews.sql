-- PoultryOS รอบ 8: สลิปโอนเงิน + หมายเหตุรายเมนู + รีวิวหลังซื้อ
-- รันซ้ำได้ปลอดภัย (IF NOT EXISTS ทั้งหมด) เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับ DATABASE_URL ใน backend/.env
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่

-- 0) เผื่อยังไม่เคยรัน upgrade_customer_all.sql (คอลัมน์ที่ระบบลูกค้าใช้)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name       VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone      VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_token       VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status  VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method     VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address    VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat        DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng        DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_token_key ON orders (receipt_token);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount  NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS receipt_token VARCHAR(64);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_receipt_token_key ON reservations (receipt_token);

CREATE TABLE IF NOT EXISTS reservation_payments (
  id             SERIAL PRIMARY KEY,
  reservation_id INT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  kind           VARCHAR(10) NOT NULL,
  method         VARCHAR(20),
  amount         NUMERIC(10,2) NOT NULL,
  ref_no         VARCHAR(100),
  paid_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 1) สลิปโอนเงิน (ชื่อไฟล์ที่เก็บใน backend/uploads/slips)
ALTER TABLE orders       ADD COLUMN IF NOT EXISTS slip_url         VARCHAR(255);
ALTER TABLE orders       ADD COLUMN IF NOT EXISTS slip_uploaded_at TIMESTAMP;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS slip_url         VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS slip_uploaded_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS orders_pending_slip_idx
  ON orders (branch_id, status, slip_uploaded_at) WHERE slip_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservations_pending_slip_idx
  ON reservations (branch_id, status, slip_uploaded_at) WHERE slip_url IS NOT NULL;

-- 2) หมายเหตุรายเมนู เช่น "เป็ดฉ่ำ ๆ" "ไก่แห้ง ๆ"
ALTER TABLE order_items       ADD COLUMN IF NOT EXISTS note VARCHAR(200);
ALTER TABLE reservation_items ADD COLUMN IF NOT EXISTS note VARCHAR(200);

-- 3) รีวิวหลังรับสินค้า (1 ออเดอร์ รีวิวได้ 1 ครั้ง)
CREATE TABLE IF NOT EXISTS order_reviews (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  branch_id     INT,
  rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       VARCHAR(500),
  customer_name VARCHAR(100),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_reviews_branch_idx ON order_reviews (branch_id, created_at DESC);
