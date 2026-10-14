import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import {
  customerApi,
  baht,
  getSelectedBranchId,
  onBranchChange,
} from '../api'

// =====================================================
// หน้ารับออเดอร์ (ฝ่ายขาย)
//
// - คำสั่งซื้อออนไลน์: ลูกค้าชำระเต็มจำนวนแล้ว -> เตรียมของ -> พร้อมรับ -> ส่งมอบ
// - การจองล่วงหน้า: ลูกค้าชำระมัดจำแล้ว -> เตรียมของ -> ลูกค้ามารับ เก็บส่วนที่เหลือ
//   (ตอนกด "รับสินค้า" ระบบตัดสต็อกและออกออเดอร์เข้า POS ตามปกติ)
// =====================================================

const fmtTime = v =>
  new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

const sizeText = i => (i.size === 'half' ? ' (ครึ่งตัว)' : '')

const itemsText = items =>
  items.map(i => `${i.name}${sizeText(i)} × ${i.qty}`).join(', ')

const ORDER_NEXT = {
  new: ['preparing', 'เริ่มเตรียมสินค้า'],
  preparing: ['ready', 'เตรียมเสร็จ พร้อมรับ'],
  ready: ['picked_up', 'ลูกค้ารับสินค้าแล้ว'],
}

const ORDER_LABEL = {
  new: 'ใหม่',
  preparing: 'กำลังเตรียม',
  ready: 'พร้อมรับ',
  picked_up: 'ส่งมอบแล้ว',
}

const box = {
  background: '#f5f5f5',
  border: '1px solid #ddd',
  marginTop: 12,
}

const pill = (bg = '#f4eeb3') => ({
  display: 'inline-block',
  borderRadius: 12,
  padding: '2px 10px',
  fontSize: 12,
  fontWeight: 'bold',
  background: bg,
})

function useBranch() {
  const [branchId, setBranchId] = useState(getSelectedBranchId() || '')

  useEffect(() => onBranchChange(id => setBranchId(id || '')), [])

  return branchId
}

function OnlineOrders({ branchId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    if (!branchId) return

    customerApi
      .orders(branchId)
      .then(d => {
        setRows(d)
        setError('')
      })
      .catch(e => setError(e.message))
  }, [branchId])

  useEffect(() => {
    setRows(null)
    load()

    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const advance = async (id, status) => {
    setBusyId(id)

    try {
      await customerApi.setOrderStatus(id, status)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const open = (rows || []).filter(r => r.fulfillmentStatus !== 'picked_up')

  return (
    <div className="card" style={box}>
      <small>คำสั่งซื้อออนไลน์ (ชำระเต็มจำนวนแล้ว)</small>

      <h2 style={{ margin: '6px 0 10px', fontSize: 20 }}>
        {rows ? `รอดำเนินการ ${open.length} ออเดอร์` : 'กำลังโหลด...'}
      </h2>

      {error && <div style={{ color: '#a11', marginBottom: 8 }}>{error}</div>}

      {open.map(o => {
        const next = ORDER_NEXT[o.fulfillmentStatus]

        return (
          <div key={o.id} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{o.receiptNo}</b>
              <span style={pill()}>{ORDER_LABEL[o.fulfillmentStatus] || o.fulfillmentStatus}</span>
            </div>

            <div style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>
              {o.customerName} · {o.customerPhone} · {fmtTime(o.createdAt)}
            </div>

            <div style={{ fontSize: 14 }}>{itemsText(o.items)}</div>

            <div style={{ fontSize: 13, margin: '4px 0 8px' }}>
              ชำระแล้ว {baht(o.paid)} จาก {baht(o.total)}
            </div>

            {next && (
              <button
                className="btn-primary"
                disabled={busyId === o.id}
                onClick={() => advance(o.id, next[0])}
              >
                {next[1]}
              </button>
            )}
          </div>
        )
      })}

      {rows && open.length === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>ไม่มีออเดอร์ค้าง</div>
      )}
    </div>
  )
}

function Reservations({ branchId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [payFor, setPayFor] = useState(null) // การจองที่กำลังเก็บเงินส่วนที่เหลือ
  const [method, setMethod] = useState('cash')
  const [cancelFor, setCancelFor] = useState(null)
  const [reason, setReason] = useState('')
  const [refund, setRefund] = useState(false)
  const [done, setDone] = useState(null)

  const load = useCallback(() => {
    if (!branchId) return

    customerApi
      .reservations(branchId, 'active')
      .then(d => {
        setRows(d)
        setError('')
      })
      .catch(e => setError(e.message))
  }, [branchId])

  useEffect(() => {
    setRows(null)
    load()

    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const run = async fn => {
    setError('')

    try {
      return await fn()
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  const markReady = async r => {
    setBusyId(r.id)
    await run(() => customerApi.reservationReady(r.id))
    setBusyId(null)
    load()
  }

  const collect = async r => {
    setBusyId(r.id)

    const out = await run(() =>
      customerApi.reservationCollect(r.id, { method })
    )

    setBusyId(null)

    if (out) {
      setPayFor(null)
      setMethod('cash')
      setDone({ ...out, name: r.customerName })
      load()
    }
  }

  const cancel = async r => {
    setBusyId(r.id)

    const out = await run(() =>
      customerApi.reservationCancel(r.id, { reason, refundDeposit: refund })
    )

    setBusyId(null)

    if (out) {
      setCancelFor(null)
      setReason('')
      setRefund(false)
      load()
    }
  }

  return (
    <div className="card" style={box}>
      <small>ออเดอร์ที่จองล่วงหน้า (ชำระมัดจำแล้ว)</small>

      <h2 style={{ margin: '6px 0 10px', fontSize: 20 }}>
        {rows ? `รอรับสินค้า ${rows.length} รายการ` : 'กำลังโหลด...'}
      </h2>

      {error && <div style={{ color: '#a11', marginBottom: 8 }}>{error}</div>}

      {done && (
        <div className="card yellow" style={{ marginBottom: 8 }}>
          รับสินค้าเรียบร้อย: {done.name} · ใบเสร็จ {done.receiptNo}
          <br />
          เก็บส่วนที่เหลือ {baht(done.balance)} (มัดจำเดิม {baht(done.deposit)})
        </div>
      )}

      {(rows || []).map(r => (
        <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b>{r.reservationNo}</b>
            <span style={pill(r.status === 'ready' ? '#d9f2dc' : '#f4eeb3')}>
              {r.status === 'ready' ? 'พร้อมรับ' : 'รอเตรียม'}
            </span>
          </div>

          <div style={{ fontSize: 14, margin: '4px 0' }}>
            นัดรับ <b>{fmtTime(r.pickupAt)}</b>
          </div>

          <div style={{ fontSize: 13, color: '#555' }}>
            {r.customerName} · {r.customerPhone}
          </div>

          <div style={{ fontSize: 14, margin: '4px 0' }}>{itemsText(r.items)}</div>

          {r.note && <div style={{ fontSize: 13, color: '#555' }}>หมายเหตุ: {r.note}</div>}

          <div style={{ fontSize: 13, margin: '4px 0 8px' }}>
            ยอดรวม {baht(r.total)} · ชำระแล้ว {baht(r.paid)} ·{' '}
            <b>ต้องเก็บเพิ่ม {baht(r.balanceDue)}</b>
          </div>

          {payFor === r.id ? (
            <div>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="cash">เงินสด</option>
                <option value="qr">QR Code</option>
                <option value="transfer">โอนเงิน</option>
                <option value="card">บัตร</option>
              </select>

              <button className="btn-primary" disabled={busyId === r.id} onClick={() => collect(r)}>
                ยืนยันรับเงิน {baht(r.balanceDue)} และส่งมอบ
              </button>

              <button className="btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={() => setPayFor(null)}>
                ยกเลิก
              </button>
            </div>
          ) : cancelFor === r.id ? (
            <div>
              <input
                placeholder="เหตุผลที่ยกเลิก"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />

              <label style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={refund}
                  onChange={e => setRefund(e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                คืนเงินมัดจำ {baht(r.paid)} (ต้องโอนคืนลูกค้าเอง ระบบบันทึกรายการให้)
              </label>

              <button className="btn-primary" disabled={busyId === r.id || !reason.trim()} onClick={() => cancel(r)}>
                ยืนยันยกเลิกการจอง
              </button>

              <button className="btn-outline" style={{ width: '100%', marginTop: 8 }} onClick={() => setCancelFor(null)}>
                ย้อนกลับ
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {r.status === 'confirmed' && (
                <button className="btn-outline" disabled={busyId === r.id} onClick={() => markReady(r)}>
                  เตรียมเสร็จ พร้อมให้รับ
                </button>
              )}

              <button
                className="btn-primary"
                onClick={() => {
                  setDone(null)
                  setPayFor(r.id)
                }}
              >
                ลูกค้ามารับสินค้า
              </button>

              <button className="btn-outline" onClick={() => setCancelFor(r.id)}>
                ยกเลิกการจอง
              </button>
            </div>
          )}
        </div>
      ))}

      {rows && rows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>ไม่มีการจองที่รอรับสินค้า</div>
      )}
    </div>
  )
}

export default function ReceiveOrdersPage() {
  const branchId = useBranch()


  return (
    <Layout title="รับออเดอร์" back={false} right={<BranchSelector compact />}>
      {!branchId ? (
        <div className="card" style={box}>กรุณาเลือกสาขา</div>
      ) : (
        <>
          <OnlineOrders branchId={branchId} />
          <Reservations branchId={branchId} />
        </>
      )}
    </Layout>
  )
}
