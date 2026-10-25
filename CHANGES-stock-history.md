# เพิ่มแถบ "ประวัติสต็อก" ในเมนูล่างของ Admin

## สิ่งที่เพิ่ม
- แถบเมนูล่างของ Admin เป็น 6 ช่อง: หน้าหลัก | ประวัติการขาย | **ประวัติสต็อก** | แก้ไขสินค้า | โปรโมชั่น | จัดการสาขา
- หน้าใหม่ `/admin/stock-history`
  - ปฏิทินรายเดือน ทุกวันแสดงจำนวนรายการรับเข้า (▲) / นำออก (▼) / ทิ้งหรือปรับยอด (●)
  - กดวันไหนก็ดูรายการของวันนั้นเรียงตามเวลา พร้อมกรอง (รับเข้า / นำออก / ทิ้ง / ปรับยอด) และค้นหา
  - แท็บ "วัตถุดิบ (ล็อต)": เลขล็อต ราคาต่อหน่วย จำนวนที่รับเข้า มูลค่า วันเวลารับเข้า-นำออก
  - แท็บ "สินค้าพร้อมขาย": รับเข้า / ขายออก / โอน ตามวันเวลา
  - "รายการล็อตทั้งหมด": ดูทุกล็อตพร้อมยอดรับเข้า นำออก คงเหลือ
  - กดเลขล็อตเพื่อดูรายละเอียดและไทม์ไลน์รับเข้า-นำออกของล็อตนั้นทั้งหมด
- วัน/เวลาทั้งหมดคิดตามเวลาไทย (UTC+7)

## ไฟล์ใหม่
- `backend/src/routes/adminStockHistory.js`
- `frontend/src/components/AdminBottomNav.jsx`  (แถบล่างกลาง ใช้ร่วมทุกหน้า Admin)
- `frontend/src/pages/AdminStockHistoryPage.jsx`

## ไฟล์ที่แก้
- `backend/src/server.js` (mount route ใหม่ที่ /api/admin)
- `frontend/src/api.js` (เพิ่ม adminStockHistoryApi)
- `frontend/src/App.jsx` (เพิ่ม route /admin/stock-history)
- `frontend/src/pages/AdminPage.jsx`, `AdminSalesPage.jsx`, `AdminProductsPage.jsx`,
  `AdminPromotionsPage.jsx`, `Adminbranchespage.jsx` (เปลี่ยนแถบล่างเดิมเป็น `<AdminBottomNav />`)

## วิธีใช้
1. วางทับไฟล์ตามโฟลเดอร์เดิม ไม่ต้องแก้ฐานข้อมูล (อ่านจากตารางล็อต/ประวัติที่มีอยู่แล้ว)
2. รีสตาร์ท backend และ build หน้าเว็บใหม่ (`npm run build` ในโฟลเดอร์ frontend)
3. ถ้าอยากสลับตำแหน่งปุ่ม ให้ย้ายลำดับในอาร์เรย์ `ITEMS` ใน `AdminBottomNav.jsx`
