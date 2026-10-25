import { useEffect, useMemo, useRef, useState } from 'react'

import {
  adminStockHistoryApi,
  getSelectedBranchId,
  onBranchChange,
} from '../api'

import BranchSelector from '../components/BranchSelector'
import AdminBottomNav from '../components/AdminBottomNav'

// =====================================================
// ประวัติสต็อก (Admin)
//
// - ปฏิทิน: กดวันไหนก็ดูรายการรับเข้า/นำออกของวันนั้นได้
// - วัตถุดิบ (ล็อต): เห็นเลขล็อต ราคาต่อหน่วย จำนวนรับเข้า วันเวลารับเข้า-นำออก
// - สินค้าพร้อมขาย: รับเข้า / ขายออก / โอน ตามวันเวลา
// - กดเลขล็อตเพื่อดูไทม์ไลน์ของล็อตนั้นทั้งหมด
// =====================================================

const TZ = 'Asia/Bangkok'

const TYPE_STYLE = {
  in: { label: 'รับเข้า', color: '#17803d', bg: '#e8f6ec' },
  out: { label: 'นำออก', color: '#d92d20', bg: '#fdecea' },
  waste: { label: 'ทิ้ง', color: '#b54708', bg: '#fff4e5' },
  adjust: { label: 'ปรับยอด', color: '#175cd3', bg: '#e8f0fe' },
}

const STORAGE_LABEL = {
  ambient: 'อุณหภูมิห้อง',
  chilled: 'แช่เย็น',
  frozen: 'แช่แข็ง',
  thawed: 'ละลายแล้ว',
}

const LOT_STATUS_LABEL = {
  active: 'ใช้งานอยู่',
  used_up: 'ใช้หมดแล้ว',
  discarded: 'ทิ้งแล้ว',
}

const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// =====================================================
// HELPERS
// =====================================================

const pad = n => String(n).padStart(2, '0')

// วันที่วันนี้ตามเวลาไทย (YYYY-MM-DD)
function todayYmd() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

function ymdToDate(ymd) {
  return new Date(`${ymd}T12:00:00+07:00`)
}

function fmtDateLong(ymd) {
  return ymdToDate(ymd).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  })
}

function fmtMonthTitle(ym) {
  return ymdToDate(`${ym}-01`).toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  })
}

function fmtDate(iso) {
  if (!iso) return '-'

  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

function fmtTime(iso) {
  if (!iso) return '-'

  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  })
}

function fmtDateTime(iso) {
  if (!iso) return '-'

  return `${fmtDate(iso)} ${fmtTime(iso)} น.`
}

const fmtQty = n =>
  Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 3 })

const fmtMoney = n =>
  Number(n || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))

  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

// =====================================================
// UI ชิ้นเล็ก
// =====================================================

const card = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
}

function Badge({ type }) {
  const s = TYPE_STYLE[type] || { label: type, color: '#555', bg: '#eee' }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 9px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div
      style={{
        display: 'flex',
        background: '#f0f0f0',
        borderRadius: 12,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map(o => {
        const on = o.value === value

        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              cursor: 'pointer',
              padding: '9px 6px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: on ? 700 : 500,
              color: on ? '#fff' : '#444',
              background: on ? '#ff1111' : 'transparent',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ active, onClick, children, color = '#ff1111' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? color : '#ddd'}`,
        background: active ? color : '#fff',
        color: active ? '#fff' : '#444',
        borderRadius: 999,
        padding: '6px 13px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div
      style={{
        flex: '1 1 130px',
        background: '#fafafa',
        border: '1px solid #eee',
        borderRadius: 12,
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: '#777' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: '#777' }}>{sub}</div> : null}
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '7px 0',
        borderBottom: '1px solid #f1f1f1',
        fontSize: 14,
      }}
    >
      <span style={{ color: '#777' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', minWidth: 0 }}>
        {children}
      </span>
    </div>
  )
}

// =====================================================
// ปฏิทิน
// =====================================================

function Calendar({ month, onMonth, selected, onSelect, days, loading }) {
  const today = todayYmd()
  const [y, m] = month.split('-').map(Number)
  const startWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const cells = []

  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d)

  const navBtn = {
    width: 38,
    height: 38,
    border: '1px solid #ddd',
    background: '#fff',
    borderRadius: 10,
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
  }

  return (
    <div style={card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <button type="button" style={navBtn} onClick={() => onMonth(shiftMonth(month, -1))} aria-label="เดือนก่อนหน้า">
          ‹
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtMonthTitle(month)}</div>
          <button
            type="button"
            onClick={() => {
              onMonth(todayYmd().slice(0, 7))
              onSelect(todayYmd())
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#ff1111',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ไปวันนี้
          </button>
        </div>

        <button type="button" style={navBtn} onClick={() => onMonth(shiftMonth(month, 1))} aria-label="เดือนถัดไป">
          ›
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: 4,
          opacity: loading ? 0.55 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            style={{
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: i === 0 ? '#d92d20' : '#777',
              padding: '2px 0 6px',
            }}
          >
            {w}
          </div>
        ))}

        {cells.map((d, idx) => {
          if (d === null) return <div key={`e${idx}`} />

          const ymd = `${month}-${pad(d)}`
          const info = days[ymd]
          const isSel = ymd === selected
          const isToday = ymd === today
          const isFuture = ymd > today

          return (
            <button
              key={ymd}
              type="button"
              onClick={() => onSelect(ymd)}
              style={{
                minWidth: 0,
                minHeight: 58,
                borderRadius: 10,
                border: isSel
                  ? '2px solid #ff1111'
                  : isToday
                    ? '2px solid #ffb4b0'
                    : '1px solid #eee',
                background: isSel ? '#fff1f0' : '#fff',
                cursor: 'pointer',
                padding: '5px 2px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                color: isFuture ? '#bbb' : '#222',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: isSel || isToday ? 800 : 600 }}>{d}</span>

              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                {info?.inCount ? (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#17803d', lineHeight: 1.1 }}>
                    ▲{info.inCount}
                  </span>
                ) : null}

                {info?.outCount ? (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#d92d20', lineHeight: 1.1 }}>
                    ▼{info.outCount}
                  </span>
                ) : null}

                {info?.otherCount ? (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b54708', lineHeight: 1.1 }}>
                    ●{info.otherCount}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 14px',
          marginTop: 12,
          fontSize: 12,
          color: '#666',
        }}
      >
        <span><b style={{ color: '#17803d' }}>▲</b> รับเข้า</span>
        <span><b style={{ color: '#d92d20' }}>▼</b> นำออก</span>
        <span><b style={{ color: '#b54708' }}>●</b> ทิ้ง / ปรับยอด</span>
        <span>ตัวเลข = จำนวนรายการ</span>
      </div>
    </div>
  )
}

// =====================================================
// รายการของวัน
// =====================================================

function EntryCard({ e, kind, onOpenLot }) {
  const isRaw = kind === 'raw'

  return (
    <div
      style={{
        border: '1px solid #ececec',
        borderLeft: `4px solid ${(TYPE_STYLE[e.type] || TYPE_STYLE.adjust).color}`,
        borderRadius: 12,
        padding: '10px 12px',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#666', fontWeight: 700 }}>{fmtTime(e.at)} น.</span>
            <Badge type={e.type} />
          </div>

          <div style={{ marginTop: 5, fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>
            {e.item?.name || 'ไม่ทราบรายการ'}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: (TYPE_STYLE[e.type] || TYPE_STYLE.adjust).color,
            }}
          >
            {e.type === 'in' ? '+' : e.type === 'adjust' ? '' : '−'}
            {fmtQty(e.qty)}{' '}
            <span style={{ fontSize: 13, fontWeight: 600 }}>{e.item?.unit || ''}</span>
          </div>
        </div>
      </div>

      {isRaw && e.lot ? (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 14px',
            fontSize: 13,
            color: '#555',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => onOpenLot(e.lot.id)}
            style={{
              border: '1px solid #ff1111',
              color: '#ff1111',
              background: '#fff',
              borderRadius: 8,
              padding: '3px 9px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ล็อต {e.lot.lotNo} ›
          </button>

          {e.unitCost !== null ? (
            <span>ราคา {fmtMoney(e.unitCost)} บาท/{e.item?.unit}</span>
          ) : (
            <span style={{ color: '#aaa' }}>ไม่ได้บันทึกราคา</span>
          )}

          {e.value !== null ? <span>รวม {fmtMoney(e.value)} บาท</span> : null}

          {e.type === 'in' ? (
            <span>รับเข้าล็อตนี้ทั้งหมด {fmtQty(e.lot.qtyReceived)} {e.item?.unit}</span>
          ) : (
            <span>ล็อตนี้เหลือ {fmtQty(e.lot.qtyRemaining)} {e.item?.unit}</span>
          )}
        </div>
      ) : null}

      <div style={{ marginTop: 6, fontSize: 12.5, color: '#888', wordBreak: 'break-word' }}>
        {e.note ? <div>{e.note}</div> : null}
        {e.staff ? <div>โดย {e.staff}</div> : null}
      </div>
    </div>
  )
}

function DayPanel({ date, kind, data, loading, error, onOpenLot }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  // เปลี่ยนวัน/ประเภท -> ล้างตัวกรอง
  useEffect(() => {
    setFilter('all')
    setQ('')
  }, [date, kind])

  const entries = useMemo(() => {
    const list = data?.entries || []
    const kw = q.trim().toLowerCase()

    return list.filter(e => {
      if (filter !== 'all' && e.type !== filter) return false

      if (!kw) return true

      return (
        (e.item?.name || '').toLowerCase().includes(kw) ||
        (e.lot?.lotNo || '').toLowerCase().includes(kw) ||
        (e.note || '').toLowerCase().includes(kw)
      )
    })
  }, [data, filter, q])

  const s = data?.summary

  return (
    <div style={card}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{fmtDateLong(date)}</div>

      {error ? (
        <div style={{ color: '#b00020', fontSize: 14, padding: '8px 0' }}>{error}</div>
      ) : null}

      {s ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <Stat
            label="รับเข้า"
            value={`${s.inCount} รายการ`}
            sub={kind === 'raw' && s.inValue ? `มูลค่า ${fmtMoney(s.inValue)} บาท` : null}
            color="#17803d"
          />
          <Stat label="นำออก" value={`${s.outCount} รายการ`} color="#d92d20" />
          {kind === 'raw' ? (
            <Stat label="ทิ้ง / ปรับยอด" value={`${s.wasteCount + s.adjustCount} รายการ`} color="#b54708" />
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>ทั้งหมด</Chip>
        <Chip active={filter === 'in'} onClick={() => setFilter('in')} color="#17803d">รับเข้า</Chip>
        <Chip active={filter === 'out'} onClick={() => setFilter('out')} color="#d92d20">นำออก</Chip>
        {kind === 'raw' ? (
          <>
            <Chip active={filter === 'waste'} onClick={() => setFilter('waste')} color="#b54708">ทิ้ง</Chip>
            <Chip active={filter === 'adjust'} onClick={() => setFilter('adjust')} color="#175cd3">ปรับยอด</Chip>
          </>
        ) : null}
      </div>

      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={kind === 'raw' ? 'ค้นหาชื่อวัตถุดิบ / เลขล็อต' : 'ค้นหาชื่อสินค้า / หมายเหตุ'}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          border: '1px solid #ddd',
          borderRadius: 10,
          fontSize: 14,
          marginBottom: 12,
        }}
      />

      {loading && !data ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>กำลังโหลด...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 24, fontSize: 14 }}>
          {data?.entries?.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'วันนี้ไม่มีการเคลื่อนไหวสต็อก'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: loading ? 0.6 : 1 }}>
          {entries.map(e => (
            <EntryCard key={e.id} e={e} kind={kind} onOpenLot={onOpenLot} />
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// รายการล็อตทั้งหมด
// =====================================================

function LotsPanel({ branchId, onOpenLot }) {
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    const timer = setTimeout(async () => {
      setLoading(true)
      setError('')

      try {
        const data = await adminStockHistoryApi.lots({ branchId, status, q: q.trim() })

        if (id === reqId.current) setRows(Array.isArray(data) ? data : [])
      } catch (err) {
        if (id === reqId.current) {
          setRows([])
          setError(err.message || 'โหลดรายการล็อตไม่สำเร็จ')
        }
      } finally {
        if (id === reqId.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [branchId, status, q])

  return (
    <div style={card}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <Chip active={status === ''} onClick={() => setStatus('')}>ทั้งหมด</Chip>
        <Chip active={status === 'active'} onClick={() => setStatus('active')}>ใช้งานอยู่</Chip>
        <Chip active={status === 'used_up'} onClick={() => setStatus('used_up')}>ใช้หมดแล้ว</Chip>
        <Chip active={status === 'discarded'} onClick={() => setStatus('discarded')}>ทิ้งแล้ว</Chip>
      </div>

      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="ค้นหาชื่อวัตถุดิบ / เลขล็อต / ผู้จำหน่าย"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          border: '1px solid #ddd',
          borderRadius: 10,
          fontSize: 14,
          marginBottom: 12,
        }}
      />

      {error ? <div style={{ color: '#b00020', fontSize: 14, marginBottom: 8 }}>{error}</div> : null}

      {loading && rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 24 }}>กำลังโหลด...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 24, fontSize: 14 }}>ไม่พบล็อต</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: loading ? 0.6 : 1 }}>
          {rows.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => onOpenLot(l.id)}
              style={{
                textAlign: 'left',
                border: '1px solid #ececec',
                borderRadius: 12,
                padding: '10px 12px',
                background: '#fff',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>
                    {l.material?.name || '-'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#666' }}>ล็อต {l.lotNo}</div>
                </div>

                <span
                  style={{
                    alignSelf: 'flex-start',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '2px 9px',
                    borderRadius: 999,
                    background: l.status === 'active' ? '#e8f6ec' : '#eee',
                    color: l.status === 'active' ? '#17803d' : '#666',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {LOT_STATUS_LABEL[l.status] || l.status}
                </span>
              </div>

              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '3px 14px',
                  fontSize: 13,
                  color: '#555',
                }}
              >
                <span>รับเข้า {fmtDateTime(l.receivedAt)}</span>
                <span>จำนวน {fmtQty(l.qtyReceived)} {l.material?.unit}</span>
                <span>
                  ราคา {l.unitCost !== null ? `${fmtMoney(l.unitCost)} บาท/${l.material?.unit}` : '-'}
                </span>
                <span>นำออก {fmtQty(l.qtyOut)}</span>
                <span style={{ fontWeight: 700 }}>เหลือ {fmtQty(l.qtyRemaining)} {l.material?.unit}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================
// รายละเอียดล็อต (แผ่นเลื่อนขึ้น)
// =====================================================

function LotModal({ lotId, onClose }) {
  const [lot, setLot] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true

    setLot(null)
    setError('')

    adminStockHistoryApi
      .lot(lotId)
      .then(d => {
        if (alive) setLot(d)
      })
      .catch(err => {
        if (alive) setError(err.message || 'โหลดข้อมูลล็อตไม่สำเร็จ')
      })

    return () => {
      alive = false
    }
  }, [lotId])

  const unit = lot?.material?.unit || ''

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: '18px 18px 0 0',
          padding: '16px 16px calc(24px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>รายละเอียดล็อต</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            style={{
              border: 'none',
              background: '#f0f0f0',
              borderRadius: 10,
              width: 36,
              height: 36,
              fontSize: 18,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {error ? <div style={{ color: '#b00020', padding: 12 }}>{error}</div> : null}

        {!lot && !error ? (
          <div style={{ textAlign: 'center', color: '#888', padding: 28 }}>กำลังโหลด...</div>
        ) : null}

        {lot ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{lot.material?.name}</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
              ล็อต {lot.lotNo}
              {lot.branch?.name ? ` · ${lot.branch.name}` : ''}
            </div>

            <InfoRow label="วันเวลารับเข้า">{fmtDateTime(lot.receivedAt)}</InfoRow>
            <InfoRow label="จำนวนที่รับเข้า">{fmtQty(lot.qtyReceived)} {unit}</InfoRow>
            <InfoRow label="ราคาต่อหน่วย">
              {lot.unitCost !== null ? `${fmtMoney(lot.unitCost)} บาท/${unit}` : 'ไม่ได้บันทึก'}
            </InfoRow>
            <InfoRow label="ต้นทุนรวมล็อตนี้">
              {lot.totalCost !== null ? `${fmtMoney(lot.totalCost)} บาท` : '-'}
            </InfoRow>
            <InfoRow label="นำออกแล้ว">{fmtQty(lot.totals?.out)} {unit}</InfoRow>
            {lot.totals?.waste ? <InfoRow label="ทิ้ง">{fmtQty(lot.totals.waste)} {unit}</InfoRow> : null}
            <InfoRow label="คงเหลือ">{fmtQty(lot.qtyRemaining)} {unit}</InfoRow>
            <InfoRow label="สถานะล็อต">{LOT_STATUS_LABEL[lot.status] || lot.status}</InfoRow>
            <InfoRow label="การเก็บ">{STORAGE_LABEL[lot.storage] || lot.storage}</InfoRow>
            <InfoRow label="วันหมดอายุ">{lot.expiresAt ? fmtDate(lot.expiresAt) : 'ไม่มี'}</InfoRow>
            {lot.supplier ? <InfoRow label="ผู้จำหน่าย">{lot.supplier}</InfoRow> : null}
            {lot.note ? <InfoRow label="หมายเหตุ">{lot.note}</InfoRow> : null}

            <div style={{ fontSize: 16, fontWeight: 800, margin: '18px 0 8px' }}>
              ประวัติรับเข้า-นำออกของล็อตนี้
            </div>

            {lot.timeline.length === 0 ? (
              <div style={{ color: '#999', fontSize: 14 }}>ยังไม่มีบันทึกการเคลื่อนไหว</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lot.timeline.map(t => (
                  <div
                    key={t.id}
                    style={{
                      border: '1px solid #ececec',
                      borderLeft: `4px solid ${(TYPE_STYLE[t.type] || TYPE_STYLE.adjust).color}`,
                      borderRadius: 10,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Badge type={t.type} />
                        <span style={{ fontSize: 13, color: '#555' }}>{fmtDateTime(t.at)}</span>
                      </div>

                      <span
                        style={{
                          fontWeight: 800,
                          color: (TYPE_STYLE[t.type] || TYPE_STYLE.adjust).color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.type === 'in' ? '+' : t.type === 'adjust' ? '' : '−'}
                        {fmtQty(t.qty)} {unit}
                      </span>
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12.5, color: '#888', wordBreak: 'break-word' }}>
                      {t.value !== null ? <span>มูลค่า {fmtMoney(t.value)} บาท · </span> : null}
                      {t.note ? <span>{t.note}</span> : null}
                      {t.staff ? <span> · โดย {t.staff}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// =====================================================
// PAGE
// =====================================================

export default function AdminStockHistoryPage() {
  const [branchId, setBranchId] = useState(getSelectedBranchId() || '')
  const [kind, setKind] = useState('raw') // raw | menu
  const [view, setView] = useState('calendar') // calendar | lots

  const [month, setMonth] = useState(todayYmd().slice(0, 7))
  const [date, setDate] = useState(todayYmd())

  const [calendar, setCalendar] = useState({})
  const [calLoading, setCalLoading] = useState(false)

  const [day, setDay] = useState(null)
  const [dayLoading, setDayLoading] = useState(false)
  const [dayError, setDayError] = useState('')

  const [lotId, setLotId] = useState(null)

  const calReq = useRef(0)
  const dayReq = useRef(0)

  useEffect(() => {
    return onBranchChange(id => setBranchId(id || ''))
  }, [])

  // ปฏิทิน (รายเดือน)
  useEffect(() => {
    const id = ++calReq.current

    setCalLoading(true)

    adminStockHistoryApi
      .calendar({ branchId, month, kind })
      .then(d => {
        if (id === calReq.current) setCalendar(d?.days || {})
      })
      .catch(() => {
        if (id === calReq.current) setCalendar({})
      })
      .finally(() => {
        if (id === calReq.current) setCalLoading(false)
      })
  }, [branchId, month, kind])

  // รายการของวันที่เลือก
  useEffect(() => {
    const id = ++dayReq.current

    setDayLoading(true)
    setDayError('')

    adminStockHistoryApi
      .day({ branchId, date, kind })
      .then(d => {
        if (id === dayReq.current) setDay(d)
      })
      .catch(err => {
        if (id === dayReq.current) {
          setDay(null)
          setDayError(err.message || 'โหลดรายการไม่สำเร็จ')
        }
      })
      .finally(() => {
        if (id === dayReq.current) setDayLoading(false)
      })
  }, [branchId, date, kind])

  function pickDate(ymd) {
    setDate(ymd)

    // กดวันของเดือนอื่น (เช่น จากปุ่ม "ไปวันนี้") -> ปฏิทินตามไปด้วย
    if (ymd.slice(0, 7) !== month) setMonth(ymd.slice(0, 7))
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f7f7',
        padding: '20px 20px 110px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#777', marginBottom: 4 }}>PoultryOS</div>

          <h1 style={{ margin: 0, fontSize: 28 }}>ประวัติสต็อก</h1>

          <div style={{ marginTop: 5, color: '#666', fontSize: 14 }}>
            ตรวจสอบการรับเข้า-นำออกของแต่ละล็อต ราคา จำนวน วันและเวลา ย้อนหลังได้ทุกวันตามปฏิทิน
          </div>

          <div style={{ marginTop: 14 }}>
            <BranchSelector />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <Segmented
            value={kind}
            onChange={k => {
              setKind(k)

              if (k === 'menu') setView('calendar')
            }}
            options={[
              { value: 'raw', label: 'วัตถุดิบ (ล็อต)' },
              { value: 'menu', label: 'สินค้าพร้อมขาย' },
            ]}
          />
        </div>

        {kind === 'raw' ? (
          <div style={{ marginBottom: 16 }}>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'calendar', label: 'ปฏิทินรายวัน' },
                { value: 'lots', label: 'รายการล็อตทั้งหมด' },
              ]}
            />
          </div>
        ) : null}

        {view === 'calendar' || kind === 'menu' ? (
          <>
            <Calendar
              month={month}
              onMonth={setMonth}
              selected={date}
              onSelect={pickDate}
              days={calendar}
              loading={calLoading}
            />

            <DayPanel
              date={date}
              kind={kind}
              data={day}
              loading={dayLoading}
              error={dayError}
              onOpenLot={setLotId}
            />
          </>
        ) : (
          <LotsPanel branchId={branchId} onOpenLot={setLotId} />
        )}
      </div>

      {lotId ? <LotModal lotId={lotId} onClose={() => setLotId(null)} /> : null}

      <AdminBottomNav />
    </div>
  )
}
