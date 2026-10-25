import { useNavigate } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { useShop } from './ShopContext'
import { baht, sizeLabel, unitPrice } from './shopApi'
import NoteBox from './NoteBox'
import DeliveryBox from './DeliveryBox'
import { cartUnitsByMenu, problemText, stockProblems, stockText, useMenus } from './stock'

export default function ShopCart() {
  const navigate = useNavigate()
  const shop = useShop()
  const isOrder = shop.mode === 'order'

  // สต็อกล่าสุดของสาขา (สั่งซื้อเลยต้องไม่เกินสต็อก / จองล่วงหน้าไม่จำกัดตามสต็อกวันนี้)
  const { menus } = useMenus(shop.branchId)
  const stockById = new Map((menus || []).map(m => [m.menuId, m.stockUnits]))
  const usedUnits = cartUnitsByMenu(shop.cart)
  const problems = isOrder ? stockProblems(shop.cart, menus) : []
  const blocked = problems.length > 0

  // กด + ได้อีกหรือไม่ (เหลือสต็อกพอสำหรับอีก 1 หน่วยของบรรทัดนี้)
  const canIncrease = item => {
    if (!isOrder || !menus) return true
    const have = stockById.get(item.menuId) ?? 0
    const step = item.hasHalfOption && item.size === 'full' ? 2 : 1
    return (usedUnits.get(item.menuId) || 0) + step <= have && item.qty < 50
  }

  return (
    <ShopLayout
      title="ตะกร้าสินค้า"
      back="/"
      footer={
        shop.cart.length > 0 && (
          <button
            className="btn-primary"
            disabled={blocked}
            onClick={() => navigate('/checkout')}
          >
            {blocked
              ? 'สต็อกไม่พอ กรุณาแก้จำนวนก่อน'
              : `${shop.mode === 'order' ? 'ไปชำระเงิน' : 'ไปเลือกเวลารับสินค้า'} · ${baht(shop.total)}`}
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

      {blocked && (
        <div className="stock-warn" role="alert">
          สต็อกไม่พอสำหรับบางรายการ — กรุณาลดจำนวนหรือลบรายการที่หมด
          {problems.map(p => (
            <small key={p.menuId}>• {problemText(p)}</small>
          ))}
        </div>
      )}

      {shop.cart.map((item, i) => (
        <div key={`${item.menuId}-${item.size}-${i}`} className="card">
          <div className="row">
            <div>
              <b>{item.name}</b>
              {item.hasHalfOption && <span className="muted"> · {sizeLabel(item.size)}</span>}
              <div className="muted">{baht(unitPrice(item))} ต่อหน่วย</div>
              {isOrder && menus && (
                <div className={`cart-stock ${problems.some(p => p.menuId === item.menuId) ? '' : 'ok'}`}
                  style={problems.some(p => p.menuId === item.menuId) ? undefined : { color: '#1b6b2a' }}>
                  {(stockById.get(item.menuId) ?? 0) <= 0
                    ? 'สินค้าหมดแล้ว'
                    : `สต็อกเหลือ ${stockText(item.hasHalfOption, stockById.get(item.menuId) ?? 0)}`}
                </div>
              )}
            </div>
            <b>{baht(unitPrice(item) * item.qty)}</b>
          </div>

          <NoteBox value={item.note} onChange={v => shop.setNote(i, v)} category={item.category} compact />

          <div className="row" style={{ marginTop: 8 }}>
            <div className="qty-mini">
              <button onClick={() => shop.setQty(i, item.qty - 1)}>−</button>
              <b>{item.qty}</b>
              <button disabled={!canIncrease(item)} onClick={() => shop.setQty(i, item.qty + 1)}>+</button>
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

          {/* รับที่ร้าน / ให้ส่ง: ใช้ได้ทั้งสั่งซื้อเลยและจองล่วงหน้า */}
          <DeliveryBox />
        </>
      )}
    </ShopLayout>
  )
}
