-- PoultryOS รอบ 9: เวลาที่ลูกค้าต้องการรับ/ให้ส่ง (ออเดอร์ "สั่งซื้อเลย")
-- รันซ้ำได้ปลอดภัย เพิ่มอย่างเดียว ไม่ลบข้อมูลเดิม
-- เสร็จแล้ว: ปิด backend -> `npx prisma generate` (โฟลเดอร์ backend) -> เปิด backend ใหม่
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMP;
