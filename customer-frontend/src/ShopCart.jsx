import { useNavigate } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { useShop } from './ShopContext'
import { baht, sizeLabel, unitPrice } from './shopApi'

export default function ShopCart() {
  const navigate = useNavigate()
  const shop = useShop()

  return (
    <ShopLayout
      title="ตะกร้าสินค้า"
      back="/"
      footer={
        shop.cart.length > 0 && (
          <button className="btn-primary" onClick={() => navigate('/checkout')}>
            {shop.mode === 'order' ? 'ไปชำระเงิน' : 'ไปเลือกเวลารับสินค้า'} · {baht(shop.total)}
          </button>
        )
      }
    >
      {shop.cart.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          ยังไม่มีสินค้าในตะกร้า
          <div style={{ marginTop: 12 }}>
            <button className="btn-outline" onClick={() => navigate('/')}>
              เลือกสินค้า
            </button>
          </div>
        </div>
      )}

      {shop.cart.map((item, i) => (
        <div key={`${item.menuId}-${item.size}`} className="card">
          <div className="row">
            <div>
              <b>{item.name}</b>
              {item.hasHalfOption && <span className="muted"> · {sizeLabel(item.size)}</span>}
              <div className="muted">{baht(unitPrice(item))} ต่อหน่วย</div>
            </div>
            <b>{baht(unitPrice(item) * item.qty)}</b>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="qty-mini">
              <button onClick={() => shop.setQty(i, item.qty - 1)}>−</button>
              <b>{item.qty}</b>
              <button onClick={() => shop.setQty(i, item.qty + 1)}>+</button>
            </div>

            <button className="btn-outline" style={{ padding: '6px 12px' }} onClick={() => shop.remove(i)}>
              ลบ
            </button>
          </div>
        </div>
      ))}

      {shop.cart.length > 0 && (
        <>
          <div className="row" style={{ fontSize: 18, marginTop: 8 }}>
            <b>ยอดรวม</b>
            <b>{baht(shop.total)}</b>
          </div>

          <div className="seg" style={{ marginTop: 14 }}>
            <button className={shop.mode === 'order' ? 'on' : ''} onClick={() => shop.setMode('order')}>
              สั่งซื้อเลย
            </button>
            <button className={shop.mode === 'reserve' ? 'on' : ''} onClick={() => shop.setMode('reserve')}>
              จองล่วงหน้า
            </button>
          </div>
        </>
      )}
    </ShopLayout>
  )
}
