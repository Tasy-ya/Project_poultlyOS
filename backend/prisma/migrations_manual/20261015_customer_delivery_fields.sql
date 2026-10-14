-- PoultryOS: เพิ่มคอลัมน์จัดส่งที่โค้ด publicShop.js ใช้งานจริง
-- ตรวจจาก Order model และคำสั่ง create ใน backend/src/routes/publicShop.js
-- รันหลังสำรองฐานข้อมูลแล้ว และก่อนเปิดใช้งานโค้ดที่บันทึกการจัดส่ง
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
