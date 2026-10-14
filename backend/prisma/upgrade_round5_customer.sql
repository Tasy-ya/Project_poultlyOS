-- รอบ 5: ระบบสั่งซื้อ / สั่งจองฝั่งลูกค้า (เชื่อมกับ POS เดิม)
-- รันครั้งเดียวใน PostgreSQL แล้วสั่ง `npx prisma generate` ในโฟลเดอร์ backend

-- 1) ออเดอร์: ข้อมูลลูกค้า + โทเคนใบเสร็จอิเล็กทรอนิกส์ + สถานะการเตรียมของ
--    order_channel มีอยู่แล้ว: 'store' (หน้าร้าน) | 'online' (ลูกค้าสั่งเอง) | 'reservation' (มาจากการจอง)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name       VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone      VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_token       VARCHAR(64);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status  VARCHAR(20); -- new | preparing | ready | picked_up (NULL = ขายหน้าร้าน)
CREATE UNIQUE INDEX IF NOT EXISTS orders_receipt_token_key ON orders (receipt_token);
CREATE INDEX IF NOT EXISTS orders_channel_fulfillment_idx ON orders (branch_id, order_channel, fulfillment_status);

-- 2) การจองล่วงหน้า: ยอดรวม, โทเคนใบเสร็จ, เหตุผลยกเลิก, เวลารับสินค้าจริง
--    deposit_amount, status, note, pickup_datetime, order_id, local_id มีอยู่แล้ว
--    status: confirmed (มัดจำแล้ว) | ready (พร้อมรับ) | completed (รับสินค้า+ชำระครบ) | cancelled
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS receipt_token  VARCHAR(64);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancel_reason  VARCHAR(255);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS completed_at   TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS reservations_receipt_token_key ON reservations (receipt_token);
CREATE UNIQUE INDEX IF NOT EXISTS reservations_local_id_key ON reservations (local_id) WHERE local_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reservations_branch_status_pickup_idx ON reservations (branch_id, status, pickup_datetime);

-- 3) การรับเงินของการจอง: มัดจำ / ชำระส่วนที่เหลือ / คืนเงินมัดจำ
CREATE TABLE IF NOT EXISTS reservation_payments (
  id             SERIAL PRIMARY KEY,
  reservation_id INT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  kind           VARCHAR(10) NOT NULL,          -- deposit | balance | refund
  method         VARCHAR(20),
  amount         NUMERIC(10,2) NOT NULL,
  ref_no         VARCHAR(100),
  paid_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reservation_payments_res_idx ON reservation_payments (reservation_id);
