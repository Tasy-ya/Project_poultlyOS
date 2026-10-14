-- รันไฟล์นี้ครั้งเดียวกับฐานข้อมูลเดิม (เพิ่มคอลัมน์ใหม่ ไม่กระทบข้อมูลเดิม)
-- ใช้แยกหน้า "เป็ด" กับ "ไก่" ออกจากกันตามที่ต้องการ

ALTER TABLE menus ADD COLUMN IF NOT EXISTS category VARCHAR(20);
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS category VARCHAR(20);
ALTER TABLE prep_items ADD COLUMN IF NOT EXISTS category VARCHAR(20);

-- ตัวอย่างค่าที่ใช้: 'duck' (เป็ด), 'chicken' (ไก่), 'other' (ข้าว/เครื่องเคียง ฯลฯ)
-- อัปเดตข้อมูลเดิมให้มีหมวดหมู่ (แก้ตาม id จริงของคุณ) เช่น:
-- UPDATE menus SET category = 'duck' WHERE name LIKE '%เป็ด%';
-- UPDATE menus SET category = 'chicken' WHERE name LIKE '%ไก่%';
