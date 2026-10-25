import { Navigate, Route, Routes } from 'react-router-dom'
import { ShopProvider } from './ShopContext'
import ShopHome from './ShopHome'
import ShopCart from './ShopCart'
import ShopCheckout from './ShopCheckout'
import ShopReceipt from './ShopReceipt'
import ShopPay from './ShopPay'
import ShopOrders from './ShopOrders'

export default function ShopApp() {
  return (
    <ShopProvider>
      <Routes>
        <Route path="/" element={<ShopHome />} />
        <Route path="/cart" element={<ShopCart />} />
        <Route path="/checkout" element={<ShopCheckout />} />
        <Route path="/pay/:token" element={<ShopPay />} />
        <Route path="/orders" element={<ShopOrders />} />
        <Route path="/receipt/:token" element={<ShopReceipt />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShopProvider>
  )
}
