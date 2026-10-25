import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { shopApi, baht, fmtDateTime } from './shopApi'
import { getMyTokens, forgetOrder } from './myOrders'

function label(o) {
  if (o.status === 'cancelled') return { text: 'ยกเลิกแล้ว', cls: 'bad' }

  if (o.type === 'reservation') {
    return {
      text:
        { pending_payment: o.slipUploaded ? 'รอร้านตรวจสลิปมัดจำ' : 'รอแนบสลิปมัดจำ', confirmed: 'จองสำเร็จ', ready: 'พร้อมให้รับ', completed: 'รับสินค้าแล้ว' }[o.status] || o.status,
      cls: o.status === 'pending_payment' ? '' : 'ok',
    }
  }

  if (o.status === 'pending_payment') {
    return { text: o.slipUploaded ? 'แนบสลิปแล้ว รอพนักงานรับออเดอร์' : 'รอแนบสลิป', cls: '' }
  }

  const text =
    {
      new: 'รับออเดอร์แล้ว',
      preparing: 'กำลังเตรียม',
      ready: o.deliveryMethod === 'delivery' ? 'พร้อมจัดส่ง' : 'พร้อมรับออเดอร์',
      picked_up: 'รับสินค้าแล้ว',
    }[o.fulfillmentStatus || 'new'] || 'รับออเดอร์แล้ว'

  return { text, cls: 'ok' }
}

export default function ShopOrders() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    const tokens = getMyTokens()

    if (!tokens.length) {
      setRows([])
      return
    }

    shopApi
      .track(tokens)
      .then(r => {
        setRows(r)
        setError('')
      })
      .catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  return (
    <ShopLayout title="ออเดอร์ของฉัน" back="/">
      {error && <div className="err">{error}</div>}
      {!rows && !error && <p className="muted">กำลังโหลด...</p>}

      {rows?.length === 0 && (
        <div className="card" style={{ textAlign: 'center' }}>
          ยังไม่มีออเดอร์จากเครื่องนี้
          <div style={{ marginTop: 12 }}>
            <Link to="/" className="btn-outline" style={{ display: 'inline-block' }}>เลือกสินค้า</Link>
          </div>
        </div>
      )}

      {rows?.map(o => {
        const st = label(o)
        const pending = o.status === 'pending_payment'

        return (
          <div className="card" key={o.token}>
            <div className="row">
              <b>{o.no}</b>
              <span className={`pill ${st.cls}`}>{st.text}</span>
            </div>
            <div className="muted">{fmtDateTime(o.createdAt)} · {o.deliveryMethod === 'delivery' ? 'ส่งถึงที่' : 'รับที่ร้าน'}</div>
            <div style={{ margin: '6px 0' }}>{o.itemsText}</div>
            <div className="row">
              <b>{baht(o.total)}</b>
              <span style={{ display: 'flex', gap: 10 }}>
                {/* ยังไม่รับออเดอร์: ไปหน้าชำระเงิน/แนบสลิป — ดูสถานะได้หลังพนักงานรับออเดอร์แล้วเท่านั้น */}
                {pending ? (
                  <Link to={`/pay/${o.token}`} style={{ color: 'var(--red)', fontWeight: 'bold' }}>
                    {o.slipUploaded ? 'ดูการตรวจสลิป' : 'แนบสลิป'}
                  </Link>
                ) : (
                  <Link to={`/receipt/${o.token}`} style={{ color: 'var(--red)', fontWeight: 'bold' }}>
                    {o.status === 'cancelled'
                      ? 'ดูเหตุผล'
                      : o.status === 'completed' && o.fulfillmentStatus === 'ready' && !o.reviewed
                        ? 'ดูสถานะ / รีวิว'
                        : 'ดูสถานะ'}
                  </Link>
                )}
                {(o.status === 'cancelled' || o.fulfillmentStatus === 'picked_up') && (
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: '2px 8px' }}
                    onClick={() => { forgetOrder(o.token); load() }}
                  >
                    ลบ
                  </button>
                )}
              </span>
            </div>
          </div>
        )
      })}
    </ShopLayout>
  )
}
