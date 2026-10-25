PoultryOS Customer PWA update (overlay patch)

วิธีติดตั้ง:
1) แตก ZIP นี้
2) คัดลอกโฟลเดอร์/ไฟล์ภายในไปทับตำแหน่งเดียวกันในโปรเจกต์เดิม: poultlyos-project/customer-frontend/
3) เปิด PowerShell ในโฟลเดอร์ customer-frontend แล้วรัน npm ci จากนั้น npm run build
4) เผยแพร่หน้าเว็บบน HTTPS เพื่อให้ Service Worker ทำงานได้ (localhost ใช้ทดสอบได้)
5) ทดสอบ URL จริงบน Safari/Chrome ก่อนพิมพ์ QR Code

หมายเหตุ:
- นี่เป็น PWA shell เบื้องต้น: เพิ่ม manifest, ไอคอน, เมทาดาทาสำหรับ iOS และ service worker
- Service worker ไม่ cache /api/ เพื่อไม่ให้ข้อมูลออเดอร์หรือการชำระเงินเก่าถูกนำมาใช้
- PWA ไม่ทำให้ระบบสั่งอาหารทำงานออฟไลน์เต็มรูปแบบ; การดูเมนูสด/ส่งออเดอร์ยังต้องเชื่อม Backend
- Build ในสภาพแวดล้อมตรวจไฟล์นี้ไม่สำเร็จ เพราะ node_modules ใน ZIP มี optional dependency ของ Rollup ไม่ครบสำหรับ Linux. ให้รัน npm ci บนเครื่องพัฒนา Windows ก่อน build
- ไอคอนเป็นไอคอนเริ่มต้น PoultryOS; เปลี่ยนเป็นโลโก้ร้านจริงได้ภายหลัง
