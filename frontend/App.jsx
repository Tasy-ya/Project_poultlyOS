import { BrowserRouter, Routes, Route } from 'react-router-dom'

import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SellCategoryPage from './pages/SellCategoryPage'
import OrderConfirm from './pages/OrderConfirm'
import PaymentPage from './pages/PaymentPage'
import ReceiptPage from './pages/ReceiptPage'
import HistoryPage from './pages/HistoryPage'
import StockPage from './pages/StockPage'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* หน้าแรก */}
        <Route path="/" element={<HomePage />} />

        {/* หน้าขาย */}
        <Route path="/sell" element={<SellCategoryPage />} />

        {/* หน้ารอการยืนยันออเดอร์ */}
        <Route
          path="/order-confirm"
          element={<OrderConfirm />}
        />

        {/* หน้าชำระเงิน */}
        <Route
          path="/payment"
          element={<PaymentPage />}
        />

        {/* ใบเสร็จ */}
        <Route
          path="/receipt"
          element={<ReceiptPage />}
        />

        {/* ประวัติ */}
        <Route
          path="/history"
          element={<HistoryPage />}
        />

        {/* Stock */}
        <Route
          path="/stock"
          element={<StockPage />}
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={<AdminDashboard />}
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App