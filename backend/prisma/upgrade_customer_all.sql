-- PoultryOS: ไฟล์เดียวจบ สำหรับระบบสั่งซื้อ/จองฝั่งลูกค้า (รอบ 5 + 6 + 7 รวมกัน)
-- รันซ้ำได้ปลอดภัย (ใช้ IF NOT EXISTS ทั้งหมด) เพิ่มอย่างเดียว ไม่ลบหรือเปลี่ยนชื่อข้อมูลเดิม
-- รันใน pgAdmin ที่ฐานข้อมูลเดียวกับที่ backend ใช้ (ค่า DATABASE_URL ใน backend/.env)
-- เสร็จแล้วปิด backend -> รัน `npx prisma generate` ในโฟลเดอร์ backend -> เปิด backend ใหม่

-- 1) ออเดอร์: ข้อมูลลูกค้า + โทเคนใบเสร็จ + สถานะเตรียมของ
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name       VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone      VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_token       VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status  VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_token_key ON orders (receipt_token);
CREATE INDEX IF NOT EXISTS orders_channel_fulfillment_idx ON orders (branch_id, order_channel, fulfillment_status);

-- 2) ออเดอร์: การจัดส่ง
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method  VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat     DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng     DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_delivery_method_created_at_idx ON orders (delivery_method, created_at);

-- 3) การจอง: ยอดรวม, โทเคนใบเสร็จ, เหตุผลยกเลิก, เวลารับสินค้าจริง
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS receipt_token  VARCHAR(64);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason  VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_receipt_token_key ON reservations (receipt_token);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_local_id_key ON reservations (local_id) WHERE local_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservations_branch_status_pickup_idx ON reservations (branch_id, status, pickup_datetime);

-- 4) การรับเงินของการจอง: มัดจำ / ชำระส่วนที่เหลือ / คืนเงินมัดจำ
CREATE TABLE IF NOT EXISTS reservation_payments (
  id             SERIAL PRIMARY KEY,
  reservation_id INT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  kind           VARCHAR(10) NOT NULL,
  method         VARCHAR(20),
  amount         NUMERIC(10,2) NOT NULL,
  ref_no         VARCHAR(100),
  paid_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reservation_payments_res_idx ON reservation_payments (reservation_id);
