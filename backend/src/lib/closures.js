// =====================================================
// วันหยุดร้าน (shop_closures)
//
// - ทุกการเทียบวันที่ใช้ "วันที่ตามเวลาไทย" รูปแบบ YYYY-MM-DD (สตริง) ไม่ใช้ Date ตรง ๆ
//   กันวันเพี้ยนข้ามเที่ยงคืน/ข้ามเขตเวลา
// - range  : หยุดเป็นช่วง start_date..end_date (รวมวันสุดท้าย)
// - weekly : หยุดประจำทุกสัปดาห์ (weekday 0 = อาทิตย์ ... 6 = เสาร์)
// - branch_id เป็น NULL = หยุดทุกสาขา
// =====================================================

const DAY_MS = 24 * 3600 * 1000

// วันที่ตามเวลาไทย เช่น 2026-10-19
function bangkokDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

// คอลัมน์ DATE จาก Prisma เป็น Date เที่ยงคืน UTC -> YYYY-MM-DD
function dateColumnStr(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : null
}

function isDateStr(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function addDays(dateStr, days) {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

function weekdayOf(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay()
}

// ดึงวันหยุดที่ใช้กับสาขานี้ (ของสาขา + ของทุกสาขา)
let warned = false

async function closuresFor(db, branchId) {
  // ยังไม่ได้รัน SQL รอบ 12 / ยังไม่ได้ prisma generate: ให้ร้านทำงานต่อได้ (ถือว่าไม่มีวันหยุด)
  // แต่เตือนใน console ให้รู้ว่าต้องรัน upgrade_round12_closures.sql
  if (!db.shopClosure) {
    if (!warned) console.warn('[closures] ยังไม่ได้ npx prisma generate — ยังไม่มีระบบวันหยุดร้าน')
    warned = true
    return []
  }

  try {
    return await db.shopClosure.findMany({
      where: { OR: [{ branchId: null }, { branchId: Number(branchId) }] },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    })
  } catch (err) {
    if (err && err.code === 'P2021') {
      if (!warned) console.warn('[closures] ยังไม่มีตาราง shop_closures — รัน backend/prisma/upgrade_round12_closures.sql ใน pgAdmin')
      warned = true
      return []
    }

    throw err
  }
}

// เหตุผล/ข้อความของวันหยุดที่ตรงกับวันนี้ — null = ร้านเปิด
function closureOn(rows, dateStr) {
  const wd = weekdayOf(dateStr)

  for (const r of rows) {
    if (r.kind === 'weekly') {
      if (r.weekday === wd) return { reason: r.reason || 'วันหยุดประจำสัปดาห์', kind: 'weekly' }
      continue
    }

    const from = dateColumnStr(r.startDate)
    const to = dateColumnStr(r.endDate) || from

    if (from && dateStr >= from && dateStr <= to) {
      return { reason: r.reason || 'ร้านหยุดทำการ', kind: 'range' }
    }
  }

  return null
}

// รายการวันหยุดล่วงหน้า (ให้หน้าลูกค้าแสดง/ปิดวัน) นับตั้งแต่วันนี้
function closedDatesAhead(rows, fromStr, days) {
  const out = []

  for (let i = 0; i < days; i += 1) {
    const d = addDays(fromStr, i)
    const hit = closureOn(rows, d)

    if (hit) out.push({ date: d, reason: hit.reason, kind: hit.kind })
  }

  return out
}

module.exports = {
  bangkokDateStr,
  dateColumnStr,
  isDateStr,
  addDays,
  weekdayOf,
  closuresFor,
  closureOn,
  closedDatesAhead,
}
