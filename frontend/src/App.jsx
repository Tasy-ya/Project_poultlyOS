import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import './theme.css'

// =====================================================
// FRONTEND - พนักงาน
// =====================================================

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import SellCategoryPage from './pages/SellCategoryPage'
import OrderConfirm from './pages/OrderConfirm'
import PaymentPage from './pages/PaymentPage'
import ReceiptPage from './pages/ReceiptPage'
import HistoryPage from './pages/HistoryPage'
import StockPage from './pages/StockPage'
import ReceiveOrdersPage from './pages/ReceiveOrdersPage'
import ShiftPage from './pages/ShiftPage'
import ExpensesPage from './pages/ExpensesPage'
import OfflineQueuePage from './pages/OfflineQueuePage'
import { getDept, clearSession } from './api'

// =====================================================
// ADMIN
// =====================================================

import AdminLoginPage from './pages/AdminLoginPage'
import AdminPage from './pages/AdminPage'
import AdminSalesPage from './pages/AdminSalesPage'
import AdminProductsPage from './pages/AdminProductsPage'
import AdminPromotionsPage from './pages/AdminPromotionsPage'
import AdminBranchesPage from './pages/Adminbranchespage'


// =====================================================
// ตรวจสอบว่า Login แล้วหรือยัง
// สำหรับระบบพนักงาน
// =====================================================

//
// dept (ไม่บังคับ) = ฝ่ายที่เข้าหน้านี้ได้
//   'sales' -> ฝ่ายขาย
//   'stock' -> ฝ่ายสต็อก
//
// ฝ่ายขายเข้าหน้าสต็อกไม่ได้ และฝ่ายสต็อกเข้าหน้าขายไม่ได้
// (ถ้าเข้า จะเด้งกลับหน้าแรก)
// =====================================================

function Guard({ children, dept }) {
  const location = useLocation()

  const token =
    localStorage.getItem('token')

  const current = getDept()

  // ยังไม่ได้เข้าสู่ระบบ / เซสชันเก่าที่ไม่มีข้อมูลฝ่าย
  if (!token || !current) {
    if (token) {
      clearSession()
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  // เข้าส่วนของอีกฝ่าย -> ต้องใส่รหัสของฝ่ายนั้น (เหมือนฝั่งแอดมิน)
  // แอดมิน (current = 'admin') เข้าได้ทุกส่วน
  if (
    dept &&
    current !== 'admin' &&
    current !== dept
  ) {
    return (
      <Navigate
        to={`/login?dept=${dept}&next=${encodeURIComponent(
          location.pathname
        )}`}
        replace
      />
    )
  }

  return children
}


// =====================================================
// ตรวจสอบ Admin
//
// ใช้ token + staff ที่เก็บตอน Admin Login
// =====================================================

function AdminGuard({ children }) {
  const token =
    localStorage.getItem('token')

  let staff = null

  try {
    staff = JSON.parse(
      localStorage.getItem(
        'staff'
      ) || 'null'
    )
  } catch {
    staff = null
  }

  // ---------------------------------------------------
  // ยังไม่ได้ Login
  // ---------------------------------------------------

  if (!token) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    )
  }

  // ---------------------------------------------------
  // ตรวจสอบ Role
  // ---------------------------------------------------

  const role = String(
    staff?.role ||
    staff?.userRole ||
    ''
  ).toLowerCase()

  const isAdmin =
    role === 'admin' ||
    role === 'owner' ||
    role === 'administrator'

  // ---------------------------------------------------
  // ถ้ามี role และไม่ใช่ Admin
  // ให้กลับไปหน้า Admin Login
  //
  // ถ้ายังไม่มี role
  // ไม่บล็อก เพื่อไม่กระทบระบบเดิม
  // ---------------------------------------------------

  if (
    staff &&
    staff.role &&
    !isAdmin
  ) {
    return (
      <Navigate
        to="/admin/login"
        replace
      />
    )
  }

  return children
}


// =====================================================
// APP
// =====================================================

function App() {
  return (
    <Routes>

      {/* =================================================
          LOGIN พนักงาน
      ================================================= */}

      <Route
        path="/login"
        element={
          <LoginPage />
        }
      />


      {/* =================================================
          LOGIN ADMIN
      ================================================= */}

      <Route
        path="/register"
        element={
          <RegisterPage />
        }
      />


      <Route
        path="/admin/login"
        element={
          <AdminLoginPage />
        }
      />


      {/* =================================================
          FRONTEND พนักงาน
      ================================================= */}

      {/* -------------------------------------------------
          หน้าแรกพนักงาน
      ------------------------------------------------- */}

      <Route
        path="/"
        element={
          <Guard>
            <HomePage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          กะการขาย / ค่าใช้จ่ายประจำวัน / คิวออฟไลน์
      ------------------------------------------------- */}

      <Route
        path="/shift"
        element={
          <Guard dept="sales">
            <ShiftPage />
          </Guard>
        }
      />

      <Route
        path="/expenses"
        element={
          <Guard dept="sales">
            <ExpensesPage />
          </Guard>
        }
      />

      <Route
        path="/offline-queue"
        element={
          <Guard>
            <OfflineQueuePage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          รับออเดอร์ (คำสั่งซื้อ + ออเดอร์ที่จองล่วงหน้า)
      ------------------------------------------------- */}

      <Route
        path="/orders"
        element={
          <Guard dept="sales">
            <ReceiveOrdersPage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          หน้าขาย
      ------------------------------------------------- */}

      <Route
        path="/sell"
        element={
          <Guard dept="sales">
            <SellCategoryPage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          รอยืนยันออเดอร์
      ------------------------------------------------- */}

      <Route
        path="/order-confirm"
        element={
          <Guard dept="sales">
            <OrderConfirm />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          ชำระเงิน
      ------------------------------------------------- */}

      <Route
        path="/payment"
        element={
          <Guard dept="sales">
            <PaymentPage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          ใบเสร็จ
      ------------------------------------------------- */}

      <Route
        path="/receipt"
        element={
          <Guard dept="sales">
            <ReceiptPage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          ประวัติการขายของพนักงาน

          URL:
          /history
      ------------------------------------------------- */}

      <Route
        path="/history"
        element={
          <Guard dept="sales">
            <HistoryPage />
          </Guard>
        }
      />


      {/* -------------------------------------------------
          Stock พนักงาน
      ------------------------------------------------- */}

      <Route
        path="/stock"
        element={
          <Guard dept="stock">
            <StockPage />
          </Guard>
        }
      />


      {/* =================================================
          ADMIN
      ================================================= */}

      {/* -------------------------------------------------
          Admin Dashboard

          URL:
          /admin
      ------------------------------------------------- */}

      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminPage />
          </AdminGuard>
        }
      />


      {/* -------------------------------------------------
          Admin - ประวัติการขาย

          แยกออกจาก /history ของพนักงาน

          URL:
          /admin/sales
      ------------------------------------------------- */}

      <Route
        path="/admin/sales"
        element={
          <AdminGuard>
            <AdminSalesPage />
          </AdminGuard>
        }
      />


      {/* -------------------------------------------------
          Admin - แก้ไขสินค้า

          หน้านี้แบ่งเป็น 2 ส่วน

          ส่วนที่ 1
          จัดการเมนูที่แสดงในหน้าขายของพนักงาน
          - เพิ่มสินค้า
          - แก้ชื่อสินค้า
          - แก้ราคาขาย
          - เปิด / ปิดการขาย

          ส่วนที่ 2
          จัดการต้นทุน
          - ต้นทุนสินค้า
          - วัตถุดิบ
          - ราคาวัตถุดิบ
          - สูตรการผลิต
          - การเตรียมสินค้า

          URL:
          /admin/products
      ------------------------------------------------- */}

      <Route
        path="/admin/products"
        element={
          <AdminGuard>
            <AdminProductsPage />
          </AdminGuard>
        }
      />


      {/* -------------------------------------------------
          Admin - โปรโมชั่น

          - แจกฟรี / กิจกรรม
          - ซื้อจำนวนมาก
          - ซื้อเป็นชุด / ลดราคา / ลูกค้าพิเศษ / เทศกาล

          URL:
          /admin/promotions
      ------------------------------------------------- */}

      <Route
        path="/admin/promotions"
        element={
          <AdminGuard>
            <AdminPromotionsPage />
          </AdminGuard>
        }
      />


      {/* -------------------------------------------------
          Admin - จัดการสาขา

          - เพิ่ม / แก้ไข / ลบสาขา
          - ข้อมูลแต่ละสาขาแยกกันด้วย branchId

          URL:
          /admin/branches
      ------------------------------------------------- */}

      <Route
        path="/admin/branches"
        element={
          <AdminGuard>
            <AdminBranchesPage />
          </AdminGuard>
        }
      />


      {/* =================================================
          URL ไม่พบ
      ================================================= */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  )
}

export default App