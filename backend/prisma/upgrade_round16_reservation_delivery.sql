-- PoultryOS รอบ 16: จองล่วงหน้าเลือก "รับที่ร้าน / ให้ส่ง" ได้เหมือนสั่งซื้อเลย
-- สำรองฐานข้อมูลก่อนรัน และรันในฐานข้อมูล poultryos ที่ backend ใช้งานจริง แล้วสั่ง npx prisma generate
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
