-- PoultryOS รอบ 6: ข้อมูลการจัดส่งลูกค้าออนไลน์
-- สำรองฐานข้อมูลก่อนรัน และรันในฐานข้อมูล poultryos ที่ backend ใช้งานจริง
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup',
  ADD COLUMN IF NOT EXISTS delivery_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS delivery_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
