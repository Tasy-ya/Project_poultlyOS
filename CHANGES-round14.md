# รอบ 14: ล็อตวัตถุดิบ + ตัดสต็อกแบบ FEFO/FIFO (ฝั่งสต็อก)

## ติดตั้ง (ทำตามลำดับ)
1. คัดลอกไฟล์ในโฟลเดอร์นี้ทับ/เพิ่มลงในโปรเจกต์ (โครงสร้างโฟลเดอร์เหมือนกัน)
2. รัน `backend/prisma/upgrade_round14_raw_lots.sql` ใน pgAdmin / Supabase SQL Editor (รันซ้ำได้)
   - สร้างตาราง `raw_material_lots`, เพิ่ม `raw_material_logs.lot_id`, เพิ่มประเภท log `waste`
   - ยกยอดวัตถุดิบเดิมเป็นล็อต `OPENING-yyyymmdd` (ไม่มีวันหมดอายุ) ยอดรวมจึงไม่เปลี่ยน
3. `cd backend && npx prisma generate`
4. `node backend/test/rawLots.test.js` (ทดสอบตรรกะ ไม่ต้องต่อ DB)
5. `build-all.bat` หรือ build frontend ใหม่

## ไฟล์ใหม่
- `backend/prisma/upgrade_round14_raw_lots.sql`
- `backend/src/lib/rawLots.js`        รับเข้าเป็นล็อต / เบิกแบบ FEFO→FIFO / sync ยอดรวม
- `backend/src/routes/stockLots.js`   รายการล็อต, สรุป, ทิ้งของ, ตรวจนับ
- `backend/test/rawLots.test.js`
- `frontend/src/components/StockLots.jsx`   แท็บ "5 ล็อต"

## ไฟล์ที่แก้ (แก้เฉพาะจุด)
- `backend/prisma/schema.prisma`      เพิ่ม model RawMaterialLot + lotId ใน RawMaterialLog
- `backend/src/routes/stock.js`       receive สร้างล็อต, prep/start และ transfer(raw) เบิกแบบ FEFO
- `backend/src/routes/branches.js`    ลบสาขาให้ลบล็อตด้วย
- `frontend/src/api.js`               เพิ่ม getRawLotSummary / getRawLots / wasteRawLot / stocktakeRaw
- `frontend/src/pages/StockPage.jsx`  ฟอร์มรับเข้าเพิ่มเลขล็อต/ซัพพลายเออร์/วันหมดอายุ + แท็บ 5

## กติกา
- รับเข้า = สร้างล็อตใหม่เสมอ ไม่เขียนทับล็อตเดิม (เลขล็อตซ้ำในสาขาเดียวกันไม่ได้)
- เบิก = หมดอายุก่อนใช้ก่อน (FEFO) ถ้าเท่ากัน/ไม่มี ใช้รับเข้าก่อน (FIFO) ล็อตไม่มีวันหมดอายุไว้ท้ายสุด
- ล็อตที่หมดอายุแล้วจะถูกข้าม ต้องบันทึก "ทิ้ง" ก่อน
- โอนวัตถุดิบข้ามสาขา: ตัดตาม FEFO แล้วส่ง "ล็อตเดิม" ไป (คงเลขล็อต/วันหมดอายุ/วันรับเข้า)
- ตรวจนับ: นับน้อยกว่า → ตัดตาม FEFO / นับมากกว่า → สร้างล็อต ADJ-… ทุกครั้งลง raw_material_logs (type adjust)
- ยอดรวม branch_stock_raw.qty = ผลรวมล็อต active เสมอ (ปรับใน transaction เดียวกัน)

## ที่ยังไม่ได้ทำ (ตั้งใจ)
- ล็อตของ "ของหมัก" (prep_batches) ใช้ expires_at อยู่แล้ว ไม่แตะ
- สินค้าพร้อมขาย (branch_stock) ยังเป็นยอดรวม ไม่แยกล็อต
