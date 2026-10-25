import { useEffect, useMemo, useState } from 'react'
import { shopApi } from './shopApi'

// =====================================================
// วันหยุดร้าน (ฝั่งลูกค้า)
// - วันหยุด: "สั่งซื้อเลย" ไม่ได้ / จองล่วงหน้าได้เฉพาะวันรับสินค้าที่ร้านเปิด
// - ข้อมูลมาจาก GET /api/public/closures (แอดมินตั้งในหน้า /admin/closures)
//   เซิร์ฟเวอร์ตรวจซ้ำทุกครั้ง ฝั่งนี้แค่แสดงผลให้ลูกค้าเข้าใจก่อนกดสั่ง
// =====================================================

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

export const thaiDay = (dateStr, long = false) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
  })

const nextDay = dateStr =>
  new Date(Date.parse(`${dateStr}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

// รวมวันที่ติดกัน (และเหตุผลเดียวกัน) เป็นช่วงเดียว: [{ from, to, reason }]
function groupRanges(dates) {
  const out = []

  for (const d of dates) {
    const last = out[out.length - 1]

    if (last && last.reason === d.reason && nextDay(last.to) === d.date) last.to = d.date
    else out.push({ from: d.date, to: d.date, reason: d.reason })
  }

  return out
}

export function useClosures(branchId) {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    if (!branchId) {
      setInfo(null)
      return undefined
    }

    let alive = true

    const load = () =>
      shopApi
        .closures(branchId)
        .then(d => alive && setInfo(d))
        .catch(() => {})

    load()

    // เผื่อแอดมินเพิ่งตั้งวันหยุด / ข้ามเที่ยงคืนตอนเปิดหน้าค้างไว้
    const timer = setInterval(load, 60000)

    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [branchId])

  return useMemo(() => {
    const byDate = new Map((info?.dates || []).map(d => [d.date, d.reason]))

    return {
      loaded: Boolean(info),
      closedToday: Boolean(info?.closedToday),
      todayReason: info?.reason || '',
      weeklyDays: info?.weeklyDays || [],
      // เหตุผลที่ร้านหยุดวันนั้น (สตริง) หรือ null ถ้าร้านเปิด
      reasonOn: dateStr => (dateStr && byDate.has(dateStr) ? byDate.get(dateStr) || 'ร้านหยุดทำการ' : null),
      // วันหยุดแบบช่วงวันที่กำลังจะถึง (ไม่รวมวันหยุดประจำสัปดาห์)
      upcoming: groupRanges((info?.dates || []).filter(d => d.kind === 'range')),
    }
  }, [info])
}

// รายการวันหยุดร้าน (วันหยุดล่วงหน้า + วันหยุดประจำสัปดาห์) — ไม่มีวันหยุดเลยจะไม่แสดงอะไร
export function ClosuresNote({ closures, title = 'วันหยุดร้าน' }) {
  const weekly = closures.weeklyDays
  const upcoming = closures.upcoming.slice(0, 8)

  if (weekly.length === 0 && upcoming.length === 0) return null

  return (
    <div className="closed-list">
      <b>{title}</b>

      {weekly.length > 0 && (
        <div>หยุดประจำทุกวัน{weekly.map(d => WEEKDAYS[d]).join(', ')}</div>
      )}

      {upcoming.map(r => (
        <div key={`${r.from}-${r.to}`}>
          {r.from === r.to ? thaiDay(r.from) : `${thaiDay(r.from)} – ${thaiDay(r.to)}`}
          {r.reason && r.reason !== 'ร้านหยุดทำการ' ? ` · ${r.reason}` : ''}
        </div>
      ))}
    </div>
  )
}
