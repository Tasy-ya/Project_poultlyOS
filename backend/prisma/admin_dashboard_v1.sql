-- PoultryOS Admin Dashboard v1
-- รันกับ PostgreSQL ฐานข้อมูล PoultryOS

-- ช่องทางออเดอร์: store = หน้าร้าน, delivery = Delivery
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_channel VARCHAR(20) DEFAULT 'store';

UPDATE orders
SET order_channel = 'store'
WHERE order_channel IS NULL;

-- ถ้า Prisma schema ถูกแก้แล้ว ให้ generate client ใหม่
-- npx prisma generate
