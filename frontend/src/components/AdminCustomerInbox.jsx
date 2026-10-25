import { useCallback, useEffect, useRef, useState } from 'react'
import { adminCustomerApi, baht } from '../api'
import SlipViewer from './SlipViewer'

// =====================================================
// กล่องออเดอร์ / การจองจากลูกค้า (หน้า Admin Dashboard)
// - ลูกค้าสั่งหรือจองจากหน้าเว็บลูกค้า -> ขึ้นที่นี่ทันที (ดึงข้อมูลใหม่ทุก 15 วินาที)
// - แอดมินเปิดดูรายการเดินบัญชี แล้วกด "ยืนยันได้รับเงินแล้ว" (ออเดอร์: ตัดสต็อก + บันทึกรับเงิน,
//   การจอง: บันทึกรับมัดจำ) หรือ "ปฏิเสธ" ถ้าไม่พบการโอน
// - พนักงานขายตรวจสลิปและยืนยันเองได้ที่หน้ารับออเดอร์ แอดมินไม่ต้องรอ (แอดมินยืนยันแทนได้เสมอ)
// - ถ้าลูกค้าแนบสลิปแล้ว จะเห็นรูปสลิปในการ์ด และไม่บังคับกรอกเลขอ้างอิง
// =====================================================

const POLL_MS = 15000

const card = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
}

const ghostBtn = {
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 9,
  padding: '9px 12px',
  cursor: 'pointer',
  fontWeight: 600,
}

const sizeText = size => (size === 'half' ? ' (ครึ่งตัว)' : '')

function timeAgo(value) {
  const sec = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))

  if (sec < 60) return 'เมื่อสักครู่'
  if (sec < 3600) return `${Math.floor(sec / 60)} นาทีที่แล้ว`
  if (sec < 86400) return `${Math.floor(sec / 3600)} ชั่วโมงที่แล้ว`

  return new Date(value).toLocaleDateString('th-TH')
}

const fmtDT = value =>
  new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

const mapLink = o =>
  o.deliveryLat != null && o.deliveryLng != null
    ? `https://www.google.com/maps?q=${o.deliveryLat},${o.deliveryLng}`
    : o.deliveryAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.deliveryAddress)}`
      : null

function Chip({ children, bg, color }) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

function Items({ items }) {
  return (
    <div style={{ fontSize: 14, color: '#444', margin: '8px 0' }}>
      {items.map((i, idx) => (
        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span>
            {i.name}
            {sizeText(i.size)} × {i.qty}
            {i.note && (
              <span style={{ display: 'block', color: '#b3261e', fontWeight: 700, fontSize: 13 }}>
                หมายเหตุ: {i.note}
              </span>
            )}
          </span>
          <span>{baht(i.lineTotal)}</span>
        </div>
      ))}
    </div>
  )
}

// ---------- รายการที่รอยืนยันเงิน ----------
function PendingCard({ kind, row, onDone }) {
  const isOrder = kind === 'order'

  const [ref, setRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const amount = isOrder ? row.total : row.deposit
  const link = row.deliveryMethod === 'delivery' ? mapLink(row) : null

  async function confirm() {
    if (!row.hasSlip && ref.trim().length < 3) {
      setError('ลูกค้ายังไม่แนบสลิป — กรุณาใส่เลขอ้างอิงจากรายการเดินบัญชี (อย่างน้อย 3 ตัวอักษร)')
      return
    }

    setBusy(true)
    setError('')

    try {
      if (isOrder) await adminCustomerApi.confirmOrder(row.id, ref.trim())
      else await adminCustomerApi.confirmDeposit(row.id, ref.trim())

      await onDone()
    } catch (e) {
      setError(e?.message || 'ยืนยันไม่สำเร็จ')
      setBusy(false)
    }
  }

  async function reject() {
    const reason = window.prompt(
      'เหตุผลที่ปฏิเสธ (เช่น ไม่พบยอดโอนเข้าบัญชี)',
      'ไม่พบการโอนเงิน'
    )

    if (reason === null) return

    setBusy(true)
    setError('')

    try {
      if (isOrder) await adminCustomerApi.rejectOrder(row.id, reason)
      else await adminCustomerApi.rejectReservation(row.id, reason)

      await onDone()
    } catch (e) {
      setError(e?.message || 'ปฏิเสธไม่สำเร็จ')
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        border: '2px solid #ffb3ae',
        background: '#fff8f7',
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Chip bg={isOrder ? '#e8f0ff' : '#fff1d6'} color={isOrder ? '#1b4fb3' : '#9a6200'}>
            {isOrder ? 'สั่งซื้อเลย' : 'จองล่วงหน้า'}
          </Chip>
          <b>{isOrder ? row.receiptNo : row.reservationNo}</b>
          <span style={{ color: '#888', fontSize: 12 }}>{row.branchName}</span>
        </div>

        <span style={{ color: '#888', fontSize: 12 }}>{timeAgo(row.createdAt)}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 14 }}>
        <b>{row.customerName}</b> ·{' '}
        <a href={`tel:${row.customerPhone}`} style={{ color: '#1a5fd0' }}>
          {row.customerPhone}
        </a>
      </div>

      <Items items={row.items} />

      {row.hasSlip ? (
        <>
          <div style={{ marginTop: 6 }}>
            <Chip bg="#e6f6ea" color="#1b6b2a">ลูกค้าแนบสลิปแล้ว</Chip>{' '}
            <span style={{ color: '#888', fontSize: 12 }}>{timeAgo(row.slipUploadedAt)}</span>
          </div>

          <SlipViewer
            path={isOrder ? adminCustomerApi.orderSlipPath(row.id) : adminCustomerApi.reservationSlipPath(row.id)}
          />
        </>
      ) : (
        <div style={{ marginTop: 6 }}>
          <Chip bg="#fff1d6" color="#9a6200">ยังไม่แนบสลิป</Chip>
        </div>
      )}

      {isOrder && row.pickupAt && (
        <div style={{ fontSize: 13, marginBottom: 6 }}>
          ⏰ ลูกค้าต้องการ{row.deliveryMethod === 'delivery' ? 'ให้ส่ง' : 'รับ'}{' '}
          <b>{new Date(row.pickupAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</b>
        </div>
      )}

      <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
        {isOrder ? (
          row.deliveryMethod === 'delivery' ? (
            <>
              <Chip bg="#e6f6ea" color="#1b6b2a">ส่งถึงที่</Chip>{' '}
              {row.deliveryAddress || '-'}
              {row.deliveryFee > 0 ? ` · ค่าส่ง ${baht(row.deliveryFee)}` : ' · ส่งฟรี'}
              {link && (
                <>
                  {' '}
                  <a href={link} target="_blank" rel="noreferrer" style={{ color: '#1a5fd0', fontWeight: 700 }}>
                    เปิดแผนที่
                  </a>
                </>
              )}
            </>
          ) : (
            <>
              <Chip bg="#eee" color="#555">รับที่ร้าน</Chip>
            </>
          )
        ) : (
          <>
            {row.deliveryMethod === 'delivery' ? (
              <div style={{ marginBottom: 4 }}>
                <Chip bg="#e6f6ea" color="#1b6b2a">ส่งถึงที่</Chip>{' '}
                {row.deliveryAddress || '-'}
                {row.deliveryFee > 0 ? ` · ค่าส่ง ${baht(row.deliveryFee)}` : ' · ส่งฟรี'}
                {link && (
                  <>
                    {' '}
                    <a href={link} target="_blank" rel="noreferrer" style={{ color: '#1a5fd0', fontWeight: 700 }}>
                      เปิดแผนที่
                    </a>
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 4 }}>
                <Chip bg="#eee" color="#555">รับที่ร้าน</Chip>
              </div>
            )}
            {row.deliveryMethod === 'delivery' ? 'นัดส่ง' : 'นัดรับ'} <b>{fmtDT(row.pickupAt)}</b> · ยอดรวม {baht(row.total)} · คงเหลือจ่ายตอนรับ{' '}
            {baht(row.total - row.deposit)}
            {row.note ? ` · หมายเหตุ: ${row.note}` : ''}
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderTop: '1px dashed #e0b4b0',
          paddingTop: 8,
        }}
      >
        <span style={{ fontWeight: 700 }}>{isOrder ? 'ยอดที่ต้องได้รับ' : 'มัดจำที่ต้องได้รับ'}</span>
        <span style={{ fontSize: 28, fontWeight: 900, color: '#e8281f' }}>{baht(amount)}</span>
      </div>

      <input
        value={ref}
        onChange={e => setRef(e.target.value)}
        placeholder={
          row.hasSlip
            ? 'เลขอ้างอิง/หมายเหตุจากรายการเดินบัญชี (ไม่บังคับ เพราะมีสลิปแล้ว)'
            : 'เลขอ้างอิง/หมายเหตุจากรายการเดินบัญชี (จำเป็น)'
        }
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          border: '1px solid #ddd',
          borderRadius: 9,
          margin: '10px 0 8px',
          fontSize: 14,
        }}
      />

      {error && (
        <div style={{ background: '#ffe8e8', color: '#b00000', borderRadius: 9, padding: 9, marginBottom: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          style={{
            border: 'none',
            background: '#1f9d4d',
            color: '#fff',
            borderRadius: 9,
            padding: '11px',
            cursor: busy ? 'wait' : 'pointer',
            fontWeight: 800,
          }}
        >
          {busy ? 'กำลังบันทึก...' : 'ยืนยันได้รับเงินแล้ว'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={reject}
          style={{ ...ghostBtn, color: '#c62828', background: '#fff0f0', border: 'none' }}
        >
          ปฏิเสธ
        </button>
      </div>
    </div>
  )
}

// ---------- รายการที่ยืนยันแล้ว (แสดงย่อ) ----------
function DoneList({ title, rows, render }) {
  if (!rows.length) return null

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
        {title} <span style={{ color: '#888' }}>({rows.length})</span>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {rows.map(r => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              padding: '8px 10px',
              background: '#f7f9f7',
              border: '1px solid #e3ebe3',
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {render(r)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- รีวิวจากลูกค้า ----------
const Stars = ({ n }) => (
  <span style={{ color: '#f5a100', letterSpacing: 1 }} aria-label={`${n} ดาว`}>
    {'★'.repeat(n)}
    <span style={{ color: '#ddd' }}>{'★'.repeat(5 - n)}</span>
  </span>
)

function ReviewsPanel({ branchId }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true

    const run = () =>
      adminCustomerApi
        .reviews(branchId)
        .then(d => alive && setData(d))
        .catch(() => alive && setData(null))

    run()
    const t = setInterval(run, 60000)

    return () => {
      alive = false
      clearInterval(t)
    }
  }, [branchId])

  if (!data) return null

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #eee', paddingTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 800 }}>
          รีวิวจากลูกค้า{' '}
          {data.count > 0 ? (
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              <span style={{ color: '#f5a100' }}>★</span> {data.average} ({data.count} รีวิว)
            </span>
          ) : (
            <span style={{ fontWeight: 400, color: '#888', fontSize: 14 }}>ยังไม่มีรีวิว</span>
          )}
        </div>

        {data.count > 0 && (
          <button type="button" onClick={() => setOpen(o => !o)} style={ghostBtn}>
            {open ? 'ซ่อน' : 'ดูรีวิว'}
          </button>
        )}
      </div>

      {open && (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {data.reviews.map(r => (
            <div key={r.id} style={{ background: '#fffaf0', border: '1px solid #f3e3b8', borderRadius: 10, padding: 10, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>
                  <Stars n={r.rating} /> <b>{r.customerName || 'ลูกค้า'}</b>
                </span>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {r.receiptNo ? `${r.receiptNo} · ` : ''}
                  {timeAgo(r.createdAt)}
                </span>
              </div>

              {r.comment && <div style={{ marginTop: 4 }}>{r.comment}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const FULFILL = {
  new: 'รอเตรียม',
  preparing: 'กำลังเตรียม',
  ready: 'พร้อมรับ',
  picked_up: 'ส่งมอบแล้ว',
}

export default function AdminCustomerInbox({ branchId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const prevCount = useRef(null)
  const [flash, setFlash] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await adminCustomerApi.inbox(branchId)
      setData(d)
      setError('')

      const count = d.pendingOrders.length + d.pendingReservations.length

      // มีรายการใหม่เข้ามา -> กะพริบหัวกล่องให้เห็น
      if (prevCount.current !== null && count > prevCount.current) {
        setFlash(true)
        setTimeout(() => setFlash(false), 4000)
      }

      prevCount.current = count
    } catch (e) {
      setError(e?.message || 'โหลดออเดอร์ของลูกค้าไม่สำเร็จ')
    }
  }, [branchId])

  useEffect(() => {
    prevCount.current = null
    load()

    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const pendingOrders = data?.pendingOrders || []
  const pendingReservations = data?.pendingReservations || []
  const pendingCount = pendingOrders.length + pendingReservations.length

  return (
    <div style={{ ...card, borderColor: pendingCount ? '#ffb3ae' : '#e5e5e5' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 18 }}>ออเดอร์และการจองจากลูกค้า</span>

          <span
            style={{
              background: pendingCount ? '#e8281f' : '#bbb',
              color: '#fff',
              borderRadius: 20,
              padding: '2px 11px',
              fontWeight: 800,
              fontSize: 14,
              transition: 'transform .3s',
              transform: flash ? 'scale(1.35)' : 'scale(1)',
            }}
          >
            {pendingCount}
          </span>
        </div>

        <button type="button" onClick={load} style={ghostBtn}>
          ↻ ตรวจรายการใหม่
        </button>
      </div>

      {flash && (
        <div style={{ background: '#fff1d6', borderRadius: 9, padding: 9, fontWeight: 700, marginBottom: 10 }}>
          🔔 มีออเดอร์/การจองใหม่จากลูกค้า
        </div>
      )}

      {error && (
        <div style={{ background: '#ffe8e8', color: '#b00000', borderRadius: 9, padding: 10, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {!data && !error && <div style={{ color: '#888' }}>กำลังโหลด...</div>}

      {data && pendingCount === 0 && (
        <div style={{ color: '#777', fontSize: 14, padding: '6px 0' }}>
          ไม่มีรายการรอตรวจสอบการชำระเงิน — ออเดอร์/การจองใหม่จากลูกค้าจะขึ้นที่นี่อัตโนมัติ
        </div>
      )}

      {pendingCount > 0 && (
        <>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 8 }}>
            รอตรวจสอบเงินเข้าบัญชี — ตรวจรายการเดินบัญชีให้ตรงยอด แล้วกดยืนยัน
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {pendingOrders.map(o => (
              <PendingCard key={`o${o.id}`} kind="order" row={o} onDone={load} />
            ))}

            {pendingReservations.map(r => (
              <PendingCard key={`r${r.id}`} kind="reservation" row={r} onDone={load} />
            ))}
          </div>
        </>
      )}

      {data && (
        <>
          <DoneList
            title="ออเดอร์ออนไลน์ที่ชำระแล้ววันนี้"
            rows={data.paidOrdersToday}
            render={o => (
              <>
                <span>
                  <b>{o.receiptNo}</b> · {o.customerName} ·{' '}
                  {o.deliveryMethod === 'delivery' ? 'ส่งถึงที่' : 'รับที่ร้าน'}
                </span>
                <span>
                  {FULFILL[o.fulfillmentStatus] || '-'} · <b>{baht(o.total)}</b>
                </span>
              </>
            )}
          />

          <DoneList
            title="การจองที่ชำระมัดจำแล้ว (รอรับสินค้า)"
            rows={data.upcomingReservations}
            render={r => (
              <>
                <span>
                  <b>{r.reservationNo}</b> · {r.customerName}
                </span>
                <span>
                  รับ {fmtDT(r.pickupAt)} · <b>{baht(r.total)}</b>
                </span>
              </>
            )}
          />
        </>
      )}

      <ReviewsPanel branchId={branchId} />
    </div>
  )
}
