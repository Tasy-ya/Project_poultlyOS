import { useCallback, useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import SlipViewer from '../components/SlipViewer'
import SlipAICheck from '../components/SlipAICheck'
import {
  customerApi,
  baht,
  getSelectedBranchId,
  onBranchChange,
} from '../api'

// =====================================================
// หน้ารับออเดอร์ (ฝ่ายขาย)
//
// - รอตรวจสลิป: ลูกค้าสั่งและแนบสลิปแล้ว -> พนักงานขายตรวจสลิป (ให้ AI ช่วยคัดกรองได้) กด "ยืนยัน" -> เตรียมของได้ทันที (ไม่ต้องรอแอดมิน)
//   ถ้าไม่รับออเดอร์ = ยกเลิก ต้องแจ้งเหตุผล หรือโทรแจ้งลูกค้าก่อน ลูกค้าจะเห็นเหตุผลในหน้าสถานะ
// - รอลูกค้าชำระเงิน: ลูกค้าสั่งแล้วแต่ยังไม่โอน/ยังไม่แนบสลิป -> โทรตามหรือยกเลิกออเดอร์ได้
// - ออเดอร์ที่ยกเลิกแล้ว: ลบออกจากระบบได้ทีละรายการหรือทั้งหมด (เฉพาะที่ไม่เคยรับเงิน)
// - คำสั่งซื้อออนไลน์: ลูกค้าชำระเต็มจำนวนแล้ว -> เตรียมของ -> พร้อมรับ -> ส่งมอบ
// - การจองล่วงหน้า: ลูกค้าชำระมัดจำแล้ว -> เตรียมของ -> ลูกค้ามารับ เก็บส่วนที่เหลือ
//   (ตอนกด "รับสินค้า" ระบบตัดสต็อกและออกออเดอร์เข้า POS ตามปกติ)
// =====================================================

const fmtTime = v =>
  new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

const sizeText = i => (i.size === 'half' ? ' (ครึ่งตัว)' : '')

// รายการสินค้า + หมายเหตุรายเมนูของลูกค้า (เช่น ฉ่ำ ๆ / แห้ง ๆ)
function ItemLines({ items }) {
  return (
    <div style={{ fontSize: 14 }}>
      {items.map((i, idx) => (
        <div key={idx} style={{ marginBottom: 2 }}>
          • {i.name}
          {sizeText(i)} × {i.qty}
          {i.note && (
            <div style={{ marginLeft: 14, color: '#b3261e', fontSize: 13, fontWeight: 700 }}>
              หมายเหตุ: {i.note}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const mapLink = o =>
  o.deliveryLat != null && o.deliveryLng != null
    ? `https://www.google.com/maps?q=${o.deliveryLat},${o.deliveryLng}`
    : o.deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.deliveryAddress)}`
      : null

function DeliveryInfo({ order }) {
  const when = order.pickupAt ? (
    <div style={{ margin: '4px 0', fontSize: 13 }}>
      ⏰ ลูกค้าต้องการ{order.deliveryMethod === 'delivery' ? 'ให้ส่ง' : 'รับ'} <b>{fmtTime(order.pickupAt)}</b>
    </div>
  ) : null

  if (order.deliveryMethod !== 'delivery') {
    return (
      <div style={{ margin: '4px 0' }}>
        <span style={pill('#eee')}>รับที่ร้าน</span>
        {when}
      </div>
    )
  }

  const link = mapLink(order)

  return (
    <div style={{ margin: '4px 0', fontSize: 13 }}>
      <span style={pill('#d9f2dc')}>ส่งถึงที่</span> {order.deliveryAddress || '-'}
      {link && (
        <>
          {' '}
          <a href={link} target="_blank" rel="noreferrer" style={{ color: '#1a5fd0', fontWeight: 700 }}>
            เปิดแผนที่
          </a>
        </>
      )}
      {when}
    </div>
  )
}

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

const CANCEL_REASONS = [
  'ลูกค้าไม่โอนเงินตามเวลาที่กำหนด',
  'ไม่พบการโอนเงินเข้าบัญชี',
  'สลิปไม่ถูกต้อง / ยอดไม่ตรง',
  'สินค้าหมด',
  'ลูกค้าขอยกเลิก',
]

// หน้าต่างยืนยันยกเลิก: ต้องแจ้งเหตุผล หรือโทรแจ้งลูกค้าแล้ว อย่างใดอย่างหนึ่งจึงกดยืนยันได้
// target = { title, name, phone }   onSubmit({ reason, calledCustomer }) ต้อง throw ถ้าไม่สำเร็จ
function CancelDialog({ target, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [called, setCalled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ready = reason.trim().length > 0 || called

  const submit = async () => {
    setBusy(true)
    setError('')

    try {
      await onSubmit({ reason: reason.trim(), calledCustomer: called })
      onClose()
    } catch (e) {
      setError(e.message || 'ยกเลิกไม่สำเร็จ')
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: 16,
          width: '100%',
          maxWidth: 440,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{target.title}</h3>

        <div style={{ fontSize: 13, color: '#555', marginBottom: 10 }}>
          {target.name || 'ลูกค้า'}
          {target.phone ? ` · ${target.phone}` : ''}
        </div>

        {target.phone && (
          <a
            href={`tel:${target.phone}`}
            className="btn-outline"
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginBottom: 12 }}
          >
            โทรหาลูกค้า {target.phone}
          </a>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>เหตุผลที่ยกเลิก</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {CANCEL_REASONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              style={{
                border: '1px solid #ccc',
                background: reason === r ? '#f4eeb3' : '#fff',
                borderRadius: 16,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <input
          placeholder="พิมพ์เหตุผลเอง (ลูกค้าจะเห็นข้อความนี้)"
          value={reason}
          maxLength={200}
          onChange={e => setReason(e.target.value)}
        />

        <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
          <input
            type="checkbox"
            checked={called}
            onChange={e => setCalled(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          โทรแจ้งลูกค้าแล้ว
        </label>

        {!ready && (
          <div style={{ fontSize: 12, color: '#b3261e', marginBottom: 8 }}>
            ต้องระบุเหตุผล หรือโทรแจ้งลูกค้าก่อน จึงจะยกเลิกได้
          </div>
        )}

        {error && <div style={{ color: '#a11', fontSize: 13, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <button className="btn-primary" disabled={!ready || busy} onClick={submit}>
            {busy ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
          </button>

          <button className="btn-outline" disabled={busy} onClick={onClose}>
            ย้อนกลับ
          </button>
        </div>
      </div>
    </div>
  )
}

function waitText(from) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 60000))

  if (m < 1) return 'เมื่อสักครู่'
  if (m < 60) return `${m} นาทีที่แล้ว`

  const h = Math.floor(m / 60)
  return `${h} ชม. ${m % 60} นาทีที่แล้ว`
}

function useBranch() {
  const [branchId, setBranchId] = useState(getSelectedBranchId() || '')

  useEffect(() => onBranchChange(id => setBranchId(id || '')), [])

  return branchId
}

// ---------- รอตรวจสลิป (ลูกค้าแนบสลิปแล้ว) ----------
function SlipInbox({ branchId, onConfirmed, onCancelled }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [flash, setFlash] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const prevCount = useRef(null)

  // เช็กครั้งเดียวว่าฝั่งเซิร์ฟเวอร์ตั้งค่า AI ตรวจสลิปไว้หรือยัง
  useEffect(() => {
    customerApi
      .aiStatus()
      .then(r => setAiEnabled(Boolean(r?.enabled)))
      .catch(() => setAiEnabled(null))
  }, [])

  const load = useCallback(() => {
    if (!branchId) return

    customerApi
      .inbox(branchId)
      .then(d => {
        setData(d)
        setError('')

        const count = d.orders.length + d.reservations.length

        // มีสลิปใหม่เข้ามา -> แจ้งให้เห็น
        if (prevCount.current !== null && count > prevCount.current) {
          setFlash(true)
          setTimeout(() => setFlash(false), 4000)
        }

        prevCount.current = count
      })
      .catch(e => setError(e.message))
  }, [branchId])

  useEffect(() => {
    prevCount.current = null
    setData(null)
    load()

    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const act = async (key, fn, after) => {
    setBusyKey(key)
    setError('')

    try {
      await fn()
      load()
      if (after) after()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyKey(null)
    }
  }

  // ไม่รับออเดอร์/การจอง = ยกเลิก — เปิดหน้าต่างให้ใส่เหตุผลหรือยืนยันว่าโทรแจ้งลูกค้าแล้ว
  const reject = (kind, row) =>
    setCancelTarget({
      kind,
      id: row.id,
      title: `ไม่รับ${kind === 'order' ? 'ออเดอร์' : 'การจอง'} ${kind === 'order' ? row.receiptNo : row.reservationNo}`,
      name: row.customerName,
      phone: row.customerPhone,
    })

  const submitCancel = async ({ reason, calledCustomer }) => {
    const t = cancelTarget

    if (t.kind === 'order') await customerApi.rejectOrder(t.id, reason, calledCustomer)
    else await customerApi.rejectReservation(t.id, reason, calledCustomer)

    load()
    if (onCancelled) onCancelled()
  }

  const orders = data?.orders || []
  const reservations = data?.reservations || []
  const count = orders.length + reservations.length

  return (
    <div className="card" style={{ ...box, background: count ? '#fff8f7' : '#f5f5f5', border: count ? '2px solid #ffb3ae' : box.border }}>
      <small>ลูกค้าแนบสลิปแล้ว — ตรวจสลิปให้ตรงยอดแล้วกดยืนยัน ถ้าไม่รับให้กด "ไม่รับ" (ออเดอร์จะถูกยกเลิก)</small>

      <h2 style={{ margin: '6px 0 10px', fontSize: 20 }}>
        {data ? `รอตรวจสลิป ${count} รายการ` : 'กำลังโหลด...'}
      </h2>

      {flash && (
        <div style={{ background: '#fff1d6', borderRadius: 9, padding: 9, fontWeight: 700, marginBottom: 10 }}>
          🔔 มีสลิปใหม่จากลูกค้า
        </div>
      )}

      {error && <div style={{ color: '#a11', marginBottom: 8 }}>{error}</div>}

      {orders.map(o => {
        const key = `o${o.id}`

        return (
          <div key={key} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{o.receiptNo}</b>
              <span style={pill('#e8f0ff')}>สั่งซื้อเลย</span>
            </div>

            <div style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>
              {o.customerName} ·{' '}
              <a href={`tel:${o.customerPhone}`} style={{ color: '#1a5fd0' }}>
                {o.customerPhone}
              </a>{' '}
              · แนบสลิป {fmtTime(o.slipUploadedAt || o.createdAt)}
            </div>

            <ItemLines items={o.items} />

            <DeliveryInfo order={o} />


            <SlipViewer path={customerApi.orderSlipPath(o.id)} />

            <SlipAICheck
              key={`${key}-${o.slipUploadedAt}`}
              initial={o.slipAi}
              enabled={aiEnabled}
              run={() => customerApi.aiCheckOrder(o.id)}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 8px' }}>
              <b>ยอดที่ต้องได้รับ</b>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#e8281f' }}>{baht(o.total)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <button
                className="btn-primary"
                disabled={busyKey === key}
                onClick={() => act(key, () => customerApi.confirmOrder(o.id), onConfirmed)}
              >
                {busyKey === key ? 'กำลังบันทึก...' : 'ตรวจสลิปแล้ว ยืนยันรับเงิน'}
              </button>

              <button
                className="btn-outline"
                disabled={busyKey === key}
                onClick={() => reject('order', o)}
              >
                ไม่รับออเดอร์
              </button>
            </div>
          </div>
        )
      })}

      {reservations.map(r => {
        const key = `r${r.id}`

        return (
          <div key={key} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>{r.reservationNo}</b>
              <span style={pill('#fff1d6')}>จองล่วงหน้า (มัดจำ)</span>
            </div>

            <div style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>
              {r.customerName} ·{' '}
              <a href={`tel:${r.customerPhone}`} style={{ color: '#1a5fd0' }}>
                {r.customerPhone}
              </a>{' '}
              · แนบสลิป {fmtTime(r.slipUploadedAt || r.createdAt)}
            </div>

            <DeliveryInfo order={{ ...r, pickupAt: null }} />
            <div style={{ fontSize: 14, margin: '4px 0' }}>
              {r.deliveryMethod === 'delivery' ? 'นัดส่ง' : 'นัดรับ'} <b>{fmtTime(r.pickupAt)}</b>
            </div>

            <ItemLines items={r.items} />

            {r.note && <div style={{ fontSize: 13, color: '#555' }}>หมายเหตุ: {r.note}</div>}

            <SlipViewer path={customerApi.reservationSlipPath(r.id)} />

            <SlipAICheck
              key={`${key}-${r.slipUploadedAt}`}
              initial={r.slipAi}
              enabled={aiEnabled}
              run={() => customerApi.aiCheckReservation(r.id)}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 8px' }}>
              <b>มัดจำที่ต้องได้รับ</b>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#e8281f' }}>{baht(r.deposit)}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
              <button
                className="btn-primary"
                disabled={busyKey === key}
                onClick={() => act(key, () => customerApi.confirmDeposit(r.id), onConfirmed)}
              >
                {busyKey === key ? 'กำลังบันทึก...' : 'ตรวจสลิปแล้ว ยืนยันรับมัดจำ'}
              </button>

              <button
                className="btn-outline"
                disabled={busyKey === key}
                onClick={() => reject('reservation', r)}
              >
                ไม่รับการจอง
              </button>
            </div>
          </div>
        )
      })}

      {data && count === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>
          ไม่มีสลิปรอตรวจ — เมื่อลูกค้าแนบสลิป รายการจะขึ้นที่นี่อัตโนมัติ
        </div>
      )}

      {cancelTarget && (
        <CancelDialog
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSubmit={submitCancel}
        />
      )}
    </div>
  )
}

// ---------- รอลูกค้าชำระเงิน (สั่งแล้วแต่ยังไม่โอน/ยังไม่แนบสลิป) ----------
function UnpaidOrders({ branchId, refreshKey, onCancelled }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)

  const load = useCallback(() => {
    if (!branchId) return

    customerApi
      .unpaid(branchId)
      .then(d => {
        setRows(d)
        setError('')
      })
      .catch(e => setError(e.message))
  }, [branchId])

  useEffect(() => {
    setRows(null)
    load()

    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (refreshKey) load()
  }, [refreshKey, load])

  const submitCancel = async ({ reason, calledCustomer }) => {
    await customerApi.cancelOrder(cancelTarget.id, reason, calledCustomer)
    load()
    if (onCancelled) onCancelled()
  }

  const count = rows ? rows.length : 0

  return (
    <div className="card" style={{ ...box, background: count ? '#fffaf0' : '#f5f5f5', border: count ? '2px solid #f0c24f' : box.border }}>
      <small>ลูกค้าสั่งแล้วแต่ยังไม่โอนเงิน/ยังไม่แนบสลิป — โทรตามหรือยกเลิกออเดอร์ได้</small>

      <h2 style={{ margin: '6px 0 10px', fontSize: 20 }}>
        {rows ? `รอลูกค้าชำระเงิน ${count} ออเดอร์` : 'กำลังโหลด...'}
      </h2>

      {error && <div style={{ color: '#a11', marginBottom: 8 }}>{error}</div>}

      {(rows || []).map(o => (
        <div key={o.id} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b>{o.receiptNo}</b>
            <span style={pill('#fff1d6')}>สั่งเมื่อ {waitText(o.createdAt)}</span>
          </div>

          <div style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>
            {o.customerName} ·{' '}
            <a href={`tel:${o.customerPhone}`} style={{ color: '#1a5fd0' }}>
              {o.customerPhone}
            </a>
          </div>

          <ItemLines items={o.items} />

          <DeliveryInfo order={o} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0 8px' }}>
            <b>ยอดที่ยังไม่ได้รับ</b>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#e8281f' }}>{baht(o.total)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <a
              href={`tel:${o.customerPhone}`}
              className="btn-outline"
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              โทรหาลูกค้า
            </a>

            <button
              className="btn-primary"
              onClick={() =>
                setCancelTarget({
                  id: o.id,
                  title: `ยกเลิกออเดอร์ ${o.receiptNo}`,
                  name: o.customerName,
                  phone: o.customerPhone,
                })
              }
            >
              ยกเลิกออเดอร์
            </button>
          </div>
        </div>
      ))}

      {rows && count === 0 && (
        <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>
          ไม่มีออเดอร์ที่รอลูกค้าชำระ
        </div>
      )}

      {cancelTarget && (
        <CancelDialog
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSubmit={submitCancel}
        />
      )}
    </div>
  )
}

// ---------- ออเดอร์ที่ยกเลิกแล้ว (ลบออกจากระบบได้) ----------
function CancelledOrders({ branchId, refreshKey }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [busyAll, setBusyAll] = useState(false)

  const load = useCallback(() => {
    if (!branchId) return

    customerApi
      .cancelledOrders(branchId)
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

  useEffect(() => {
    if (refreshKey) load()
  }, [refreshKey, load])

  const remove = async o => {
    if (!window.confirm(`ลบออเดอร์ ${o.receiptNo} ของ ${o.customerName || 'ลูกค้า'} ออกจากระบบถาวร?\nลูกค้าจะเปิดลิงก์ออเดอร์นี้ไม่ได้อีก`)) {
      return
    }

    setBusyId(o.id)
    setError('')

    try {
      await customerApi.deleteOrder(o.id)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
    }
  }

  const deletable = (rows || []).filter(o => o.deletable)

  // ลบทุกออเดอร์ที่ลบได้ในครั้งเดียว (เช่น ออเดอร์ที่เคยลองสั่งตอนทดสอบ)
  const removeAll = async () => {
    if (!window.confirm(`ลบออเดอร์ที่ยกเลิกแล้วทั้งหมด ${deletable.length} รายการ ออกจากระบบถาวร?\nลูกค้าจะเปิดลิงก์ออเดอร์เหล่านี้ไม่ได้อีก`)) {
      return
    }

    setBusyAll(true)
    setError('')

    let failed = 0

    for (const o of deletable) {
      try {
        await customerApi.deleteOrder(o.id)
      } catch {
        failed += 1
      }
    }

    if (failed) setError(`ลบไม่สำเร็จ ${failed} รายการ`)

    setBusyAll(false)
    load()
  }

  const count = rows ? rows.length : 0

  return (
    <div className="card" style={box}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: 'none',
          background: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        <b style={{ fontSize: 16 }}>{rows ? `ออเดอร์ที่ยกเลิกแล้ว ${count} รายการ` : 'กำลังโหลด...'}</b>
        <span>{open ? 'ซ่อน' : 'แสดง'}</span>
      </button>

      {error && <div style={{ color: '#a11', margin: '8px 0' }}>{error}</div>}

      {open && (
        <div style={{ marginTop: 10 }}>
          {deletable.length > 1 && (
            <button
              className="btn-outline"
              style={{ width: '100%', marginBottom: 10 }}
              disabled={busyAll}
              onClick={removeAll}
            >
              {busyAll ? 'กำลังลบ...' : `ลบทั้งหมดที่ลบได้ (${deletable.length} รายการ)`}
            </button>
          )}

          {(rows || []).map(o => (
            <div key={o.id} style={{ background: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{o.receiptNo}</b>
                <span style={pill('#fde8e8')}>ยกเลิกแล้ว</span>
              </div>

              <div style={{ fontSize: 13, color: '#555', margin: '4px 0' }}>
                {o.customerName} · {o.customerPhone} · {fmtTime(o.createdAt)}
              </div>

              <ItemLines items={o.items} />

              <div style={{ fontSize: 13, margin: '6px 0' }}>
                ยอด {baht(o.total)}
                {o.cancelReason && <div style={{ color: '#b3261e' }}>เหตุผลที่ยกเลิก: {o.cancelReason}</div>}
              </div>

              {o.deletable ? (
                <button className="btn-outline" disabled={busyId === o.id || busyAll} onClick={() => remove(o)}>
                  {busyId === o.id ? 'กำลังลบ...' : 'ลบออเดอร์นี้'}
                </button>
              ) : (
                <div style={{ fontSize: 12, color: '#888' }}>ออเดอร์นี้เคยรับเงินแล้ว ลบไม่ได้</div>
              )}
            </div>
          ))}

          {rows && count === 0 && (
            <div style={{ textAlign: 'center', color: '#888', padding: 12 }}>ไม่มีออเดอร์ที่ยกเลิก</div>
          )}
        </div>
      )}
    </div>
  )
}

function OnlineOrders({ branchId, refreshKey }) {
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

  // ยืนยันสลิปเสร็จ -> ออเดอร์เข้ารายการเตรียมของทันที
  useEffect(() => {
    if (refreshKey) load()
  }, [refreshKey, load])

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
      <small>คำสั่งซื้อออนไลน์ (ตรวจสลิปและยืนยันชำระแล้ว)</small>

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

            <ItemLines items={o.items} />

            <DeliveryInfo order={o} />

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

          <DeliveryInfo order={{ ...r, pickupAt: null }} />
          <div style={{ fontSize: 14, margin: '4px 0' }}>
            {r.deliveryMethod === 'delivery' ? 'นัดส่ง' : 'นัดรับ'} <b>{fmtTime(r.pickupAt)}</b>
          </div>

          <div style={{ fontSize: 13, color: '#555' }}>
            {r.customerName} · {r.customerPhone}
          </div>

          <div style={{ margin: '4px 0' }}>
            <ItemLines items={r.items} />
          </div>

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
  const [refreshKey, setRefreshKey] = useState(0)
  const [cancelKey, setCancelKey] = useState(0)


  return (
    <Layout title="รับออเดอร์" back={false} right={<BranchSelector compact />}>
      {!branchId ? (
        <div className="card" style={box}>กรุณาเลือกสาขา</div>
      ) : (
        <>
          <SlipInbox
            branchId={branchId}
            onConfirmed={() => setRefreshKey(k => k + 1)}
            onCancelled={() => setCancelKey(k => k + 1)}
          />
          <UnpaidOrders
            branchId={branchId}
            refreshKey={cancelKey}
            onCancelled={() => setCancelKey(k => k + 1)}
          />
          <OnlineOrders branchId={branchId} refreshKey={refreshKey} />
          <Reservations branchId={branchId} key={`res-${refreshKey}`} />
          <CancelledOrders branchId={branchId} refreshKey={cancelKey} />
        </>
      )}
    </Layout>
  )
}