require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const compression = require('./lib/safeCompression');
const { customerAppRouter, hasCustomerApp, startStaffAppServer } = require('./staticApps');

// ดึง router ออกมาให้ได้ ไม่ว่าไฟล์ route จะ export แบบไหน
// (export default / module.exports = router / module.exports = { router })
function loadRouter(path) {
  const mod = require(path);
  const router = mod.default || mod.router || mod;

  if (typeof router !== 'function') {
    throw new Error(
      `ไฟล์ ${path} ไม่ได้ export router ที่ใช้งานได้ (ได้ ${typeof router}) ` +
        `ตรวจท้ายไฟล์ว่ามี module.exports = router; หรือ export default router;`
    );
  }

  return router;
}

const authRoutes = loadRouter('./routes/auth');
const menuRoutes = loadRouter('./routes/menus');
const branchRoutes = loadRouter('./routes/branches');
const orderRoutes = loadRouter('./routes/orders');
const promotionRoutes = loadRouter('./routes/promotions');
const adminPromotionRoutes = loadRouter('./routes/adminPromotions');
const dashboardRoutes = loadRouter('./routes/dashboard');
const stockRoutes = loadRouter('./routes/stock');
const stickyRiceRoutes = loadRouter('./routes/stickyRice');

const adminDashboardRoutes = loadRouter('./routes/adminDashboard');
const adminSalesRoutes = loadRouter('./routes/adminSales');
const adminStaffRoutes = loadRouter('./routes/adminStaff');
const adminCustomerInboxRoutes = loadRouter('./routes/adminCustomerInbox');
const adminClosuresRoutes = loadRouter('./routes/adminClosures');
const adminStockHistoryRoutes = loadRouter('./routes/adminStockHistory');
const shiftRoutes = loadRouter('./routes/shifts');
const expenseRoutes = loadRouter('./routes/expenses');
const publicShopRoutes = loadRouter('./routes/publicShop');
const customerOrderRoutes = loadRouter('./routes/customerOrders');

const app = express();

// อยู่หลัง Cloudflare Tunnel/พร็อกซีบนเครื่องเดียวกัน -> อ่าน IP ลูกค้าจริงจาก X-Forwarded-For
// (rate limit จะได้ไม่นับลูกค้าทุกคนเป็น IP เดียว) เครื่องอื่นในวงแลนยังถูกนับ IP ตามจริง
app.set('trust proxy', 'loopback');

// บีบอัดข้อมูล (gzip) ลดเวลาโหลดบนมือถือ/ไวไฟร้าน
app.use(compression());

// CORS_ORIGIN (ไม่บังคับ) เช่น http://192.168.1.10:5173 (คั่นหลายค่าด้วยเครื่องหมายจุลภาค)
// ไม่ตั้ง = อนุญาตทุกที่ (เหมาะกับช่วงพัฒนา)
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

app.use(
  cors(
    corsOrigins.length
      ? { origin: corsOrigins }
      : {}
  )
);
app.use(express.json());

// =====================================================
// API Routes
// =====================================================

app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/sticky-rice', stickyRiceRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/expenses', expenseRoutes);

// ลูกค้า (ไม่ต้องล็อกอิน) และพนักงานจัดการออเดอร์/การจองของลูกค้า
app.use('/api/public', publicShopRoutes);
app.use('/api/customer', customerOrderRoutes);

// =====================================================
// ADMIN
// =====================================================

app.use('/api/admin', adminDashboardRoutes);
app.use('/api/admin', adminSalesRoutes);
app.use('/api/admin', adminStaffRoutes);
app.use('/api/admin', adminCustomerInboxRoutes);
app.use('/api/admin', adminClosuresRoutes);
app.use('/api/admin', adminStockHistoryRoutes);
app.use('/api/admin', adminPromotionRoutes);

// =====================================================
// Backend Status
// =====================================================

// ถ้า build หน้าลูกค้าไว้แล้ว หน้าแรก (/) คือหน้าสั่งซื้อ — ใช้ /api/status ตรวจว่า backend ทำงานอยู่
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'poultryos-backend',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

if (hasCustomerApp()) {
  app.use(customerAppRouter());
} else {
  app.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'poultryos-backend',
    });
  });
}

// =====================================================
// Error Handler
// =====================================================

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: err.message,
  });
});

// =====================================================
// Start Server
// =====================================================

const PORT = process.env.PORT || 3001;

// 0.0.0.0 = เครื่องอื่นในร้าน (มือถือ/แท็บเล็ต) เรียกใช้ได้
app.listen(PORT, '0.0.0.0', () => {
  console.log(`PoultryOS backend running on port ${PORT}`);
  if (hasCustomerApp()) console.log(`หน้าลูกค้า: http://localhost:${PORT}/`);
});

// หน้าพนักงาน/แอดมินที่ build แล้ว เปิดที่พอร์ต 5173 เหมือนเดิม (ไม่ต้องรัน npm run dev)
startStaffAppServer();

// กันโปรเซสล้มเพราะ error ที่หลุดมา — บันทึกลง log แล้วทำงานต่อ
process.on('unhandledRejection', err => {
  console.error('unhandledRejection:', err);
});