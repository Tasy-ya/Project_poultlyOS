require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');

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
const dashboardRoutes = loadRouter('./routes/dashboard');
const stockRoutes = loadRouter('./routes/stock');

const adminDashboardRoutes = loadRouter('./routes/adminDashboard');
const adminSalesRoutes = loadRouter('./routes/adminSales');
const adminStaffRoutes = loadRouter('./routes/adminStaff');
const shiftRoutes = loadRouter('./routes/shifts');
const expenseRoutes = loadRouter('./routes/expenses');
const publicShopRoutes = loadRouter('./routes/publicShop');
const customerOrderRoutes = loadRouter('./routes/customerOrders');

const app = express();

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

// =====================================================
// Backend Status
// =====================================================

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'poultryos-backend',
  });
});

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
});