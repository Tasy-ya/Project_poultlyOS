import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { api, getStaff, loadCart, saveCart, linePrice, baht, PAY_LABEL } from '../api'

export default function CartPage() {
  const staff = getStaff()
  const nav = useNavigate()
  const [cart, setCart] = useState(loadCart())
  const [promos, setPromos] = useState([])
  const [promoId, setPromoId] = useState('')
  const [method, setMethod] = useState('cash')
  const [err, setErr] = useState('')

  useEffect(() => { api.getPromotions(staff.branchId).then(setPromos) }, [])

  const update = (next) => { setCart(next); saveCart(next) }
  const change = (i, d) => {
    const next = cart.map((c, k) => (k === i ? { ...c, qty: c.qty + d } : c)).filter(c => c.qty > 0)
    update(next)
  }

  const sub = cart.reduce((s, c) => s + linePrice(c), 0)
  const promo = promos.find(p => p.id === Number(promoId))
  let disc = 0
  if (promo && sub >= Number(promo.minOrderAmount || 0)) {
    if (promo.type === 'percent') disc = (sub * Number(promo.value)) / 100
    if (promo.type === 'fixed_amount') disc = Number(promo.value)
  }
  const total = Math.max(sub - disc, 0)

  async function confirm() {
    try {
      const r = await api.createOrder({
        branchId: staff.branchId,
        items: cart.map(c => ({ menuId: c.menuId, size: c.size, qty: c.qty })),
        promotionId: promo ? promo.id : undefined,
        payments: [{ method, amount: total }],
      })
      sessionStorage.setItem('lastReceipt', JSON.stringify({
        receiptNo: r.receiptNo, items: cart, subtotal: r.subtotal, discount: r.discount, total: r.total,
        method, time: new Date().toISOString(),
      }))
      update([])
      nav('/receipt')
    } catch (e) { setErr(e.message) }
  }

  return (
    <Layout title="ตะกร้า / ชำระเงิน" back>
      {cart.map((c, i) => (
        <div className="card" key={i}>
          <b>{c.name}</b> {c.size === 'half' && '(ครึ่งตัว)'} · {baht(linePrice(c))}
          <div className="qty-control" style={{ margin: '6px 0 0' }}>
            <button onClick={() => change(i, -1)}>−</button><b>{c.qty}</b><button onClick={() => change(i, 1)}>+</button>
          </div>
        </div>
      ))}
      <select value={promoId} onChange={e => setPromoId(e.target.value)}>
        <option value="">— ไม่ใช้โปรโมชั่น —</option>
        {promos.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select value={method} onChange={e => setMethod(e.target.value)}>
        {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="card gray">
        <div>ยอดรวม {baht(sub)}</div>
        {disc > 0 && <div style={{ color: 'green' }}>ส่วนลด −{baht(disc)}</div>}
        <b style={{ fontSize: 22 }}>ทั้งหมด {baht(total)}</b>
      </div>
      {err && <p style={{ color: 'red' }}>{err}</p>}
      <button className="btn-primary" disabled={!cart.length} onClick={confirm}>ยืนยันชำระเงิน</button>
    </Layout>
  )
}
