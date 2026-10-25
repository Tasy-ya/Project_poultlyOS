const express = require('express')
const prisma = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

// =====================================================
// ประวัติสต็อก (Admin) — mount ที่ /api/admin
//
//   GET /stock-history/calendar?branchId=&month=YYYY-MM&kind=raw|menu
//       สรุปจำนวนรายการรับเข้า/นำออกของแต่ละวัน ใช้วาดปฏิทิน
//
//   GET /stock-history/day?branchId=&date=YYYY-MM-DD&kind=raw|menu
//       รายการเคลื่อนไหวทั้งหมดของวันนั้น (เรียงตามเวลา)
//       kind=raw  : วัตถุดิบแบบล็อต (มีราคาต่อหน่วย / จำนวนรับเข้า / เลขล็อต)
//       kind=menu : สินค้าพร้อมขาย (รับเข้า / ขายออก / โอน)
//
//   GET /stock-history/lots?branchId=&materialId=&status=&q=&limit=
//       รายการล็อตวัตถุดิบ พร้อมยอดรับเข้า / นำออก / เหลือ
//
//   GET /stock-history/lots/:id
//       ล็อตเดียว + ไทม์ไลน์การรับเข้า-นำออกทุกครั้ง
//
// วัน/เวลาทั้งหมดคิดตามเวลาประเทศไทย (UTC+7)
// =====================================================

const router = express.Router()

router.use('/stock-history', requireAuth, requireAdmin)

const wrap = fn => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('[adminStockHistory]', err)
    res.status(err.status || 400).json({ error: err.message || 'เกิดข้อผิดพลาด' })
  }
}

const TH_OFFSET_MS = 7 * 3600 * 1000
const pad = n => String(n).padStart(2, '0')

// วันที่ (YYYY-MM-DD) ตามเวลาไทยของ timestamp
const dayKey = d => new Date(new Date(d).getTime() + TH_OFFSET_MS).toISOString().slice(0, 10)

// 00:00 ของวันนั้นตามเวลาไทย
const dayStart = ymd => new Date(`${ymd}T00:00:00+07:00`)

const isYmd = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''))
const isYm = v => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || ''))

function addOneDay(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number)
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`

  return { from: dayStart(`${ym}-01`), to: dayStart(next) }
}

const num = v => (v === null || v === undefined ? null : Number(v))

const kindOf = req => (req.query.kind === 'menu' ? 'menu' : 'raw')

const branchWhere = req => {
  const id = Number(req.query.branchId)

  return id ? { branchId: id } : {}
}

const lotBrief = lot =>
  lot
    ? {
        id: lot.id,
        lotNo: lot.lotNo,
        qtyReceived: num(lot.qtyReceived),
        qtyRemaining: num(lot.qtyRemaining),
        unitCost: num(lot.unitCost),
        supplier: lot.supplier,
        receivedAt: lot.receivedAt,
        expiresAt: lot.expiresAt,
        storage: lot.storage || 'ambient',
        status: lot.status,
      }
    : null

// -----------------------------------------------------
// ปฏิทิน
// -----------------------------------------------------
router.get('/stock-history/calendar', wrap(async (req, res) => {
  const month = req.query.month || dayKey(new Date()).slice(0, 7)

  if (!isYm(month)) throw new Error('เดือนไม่ถูกต้อง (ใช้รูปแบบ YYYY-MM)')

  const { from, to } = monthRange(month)
  const kind = kindOf(req)
  const where = { ...branchWhere(req), createdAt: { gte: from, lt: to } }

  const logs =
    kind === 'menu'
      ? await prisma.stockLog.findMany({ where, select: { type: true, createdAt: true } })
      : await prisma.rawMaterialLog.findMany({ where, select: { type: true, createdAt: true } })

  const days = {}

  for (const l of logs) {
    const k = dayKey(l.createdAt)
    const d = days[k] || (days[k] = { inCount: 0, outCount: 0, otherCount: 0 })

    if (l.type === 'in') d.inCount += 1
    else if (l.type === 'out') d.outCount += 1
    else d.otherCount += 1
  }

  res.json({ month, kind, days })
}))

// -----------------------------------------------------
// รายการของวันหนึ่ง
// -----------------------------------------------------
router.get('/stock-history/day', wrap(async (req, res) => {
  const date = req.query.date || dayKey(new Date())

  if (!isYmd(date)) throw new Error('วันที่ไม่ถูกต้อง (ใช้รูปแบบ YYYY-MM-DD)')

  const kind = kindOf(req)
  const from = dayStart(date)
  const to = dayStart(addOneDay(date))
  const where = { ...branchWhere(req), createdAt: { gte: from, lt: to } }

  let entries

  if (kind === 'menu') {
    const rows = await prisma.stockLog.findMany({
      where,
      include: {
        menu: { select: { id: true, name: true, unit: true } },
        staff: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    entries = rows.map(r => ({
      id: `m${r.id}`,
      at: r.createdAt,
      type: r.type,
      qty: Number(r.qty),
      item: r.menu ? { id: r.menu.id, name: r.menu.name, unit: r.menu.unit } : null,
      note: r.note,
      staff: r.staff?.name || null,
      branch: r.branch?.name || null,
      orderId: r.orderId || null,
      lot: null,
      unitCost: null,
      value: null,
    }))
  } else {
    const rows = await prisma.rawMaterialLog.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, category: true } },
        staff: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        lot: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })

    entries = rows.map(r => {
      const unitCost = r.lot ? num(r.lot.unitCost) : null

      return {
        id: `r${r.id}`,
        at: r.createdAt,
        type: r.type,
        qty: Number(r.qty),
        item: r.material
          ? { id: r.material.id, name: r.material.name, unit: r.material.unit, category: r.material.category }
          : null,
        note: r.note,
        staff: r.staff?.name || null,
        branch: r.branch?.name || null,
        orderId: null,
        lot: lotBrief(r.lot),
        unitCost,
        value: unitCost === null ? null : Math.round(Number(r.qty) * unitCost * 100) / 100,
      }
    })
  }

  const summary = { inCount: 0, outCount: 0, wasteCount: 0, adjustCount: 0, inValue: 0, outValue: 0 }

  for (const e of entries) {
    if (e.type === 'in') {
      summary.inCount += 1
      summary.inValue += e.value || 0
    } else if (e.type === 'out') {
      summary.outCount += 1
      summary.outValue += e.value || 0
    } else if (e.type === 'waste') {
      summary.wasteCount += 1
    } else {
      summary.adjustCount += 1
    }
  }

  summary.inValue = Math.round(summary.inValue * 100) / 100
  summary.outValue = Math.round(summary.outValue * 100) / 100

  res.json({ date, kind, summary, entries })
}))

// -----------------------------------------------------
// รายการล็อต (พร้อมยอดรับเข้า / นำออก / ทิ้ง / เหลือ)
// -----------------------------------------------------
async function sumsByLot(ids) {
  const map = new Map()

  if (!ids.length) return map

  const groups = await prisma.rawMaterialLog.groupBy({
    by: ['lotId', 'type'],
    where: { lotId: { in: ids } },
    _sum: { qty: true },
    _count: { _all: true },
  })

  for (const g of groups) {
    const cur = map.get(g.lotId) || { out: 0, waste: 0, adjust: 0, in: 0, outCount: 0 }

    cur[g.type] = (cur[g.type] || 0) + Number(g._sum.qty || 0)

    if (g.type === 'out') cur.outCount += g._count._all

    map.set(g.lotId, cur)
  }

  return map
}

router.get('/stock-history/lots', wrap(async (req, res) => {
  const materialId = req.query.materialId ? Number(req.query.materialId) : null
  const status = ['active', 'used_up', 'discarded'].includes(req.query.status) ? req.query.status : null
  const q = String(req.query.q || '').trim()
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200))

  const lots = await prisma.rawMaterialLot.findMany({
    where: {
      ...branchWhere(req),
      ...(materialId ? { materialId } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { lotNo: { contains: q, mode: 'insensitive' } },
              { material: { name: { contains: q, mode: 'insensitive' } } },
              { supplier: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: { material: { select: { id: true, name: true, unit: true, category: true } } },
    orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  })

  const sums = await sumsByLot(lots.map(l => l.id))

  res.json(
    lots.map(l => {
      const s = sums.get(l.id) || {}
      const unitCost = num(l.unitCost)
      const received = Number(l.qtyReceived)

      return {
        ...lotBrief(l),
        material: l.material,
        qtyOut: Math.round((s.out || 0) * 1000) / 1000,
        qtyWaste: Math.round((s.waste || 0) * 1000) / 1000,
        totalCost: unitCost === null ? null : Math.round(received * unitCost * 100) / 100,
      }
    })
  )
}))

// -----------------------------------------------------
// ล็อตเดียว + ไทม์ไลน์
// -----------------------------------------------------
router.get('/stock-history/lots/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)

  if (!id) throw new Error('ต้องระบุล็อต')

  const lot = await prisma.rawMaterialLot.findUnique({
    where: { id },
    include: {
      material: { select: { id: true, name: true, unit: true, category: true } },
      branch: { select: { id: true, name: true } },
      logs: {
        include: { staff: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  })

  if (!lot) {
    const err = new Error('ไม่พบล็อตนี้')

    err.status = 404

    throw err
  }

  const unitCost = num(lot.unitCost)

  const totals = { in: 0, out: 0, waste: 0, adjust: 0 }

  const timeline = lot.logs.map(l => {
    const qty = Number(l.qty)

    totals[l.type] = (totals[l.type] || 0) + qty

    return {
      id: l.id,
      at: l.createdAt,
      type: l.type,
      qty,
      note: l.note,
      staff: l.staff?.name || null,
      value: unitCost === null ? null : Math.round(qty * unitCost * 100) / 100,
    }
  })

  res.json({
    ...lotBrief(lot),
    material: lot.material,
    branch: lot.branch,
    note: lot.note,
    totalCost: unitCost === null ? null : Math.round(Number(lot.qtyReceived) * unitCost * 100) / 100,
    totals: {
      out: Math.round(totals.out * 1000) / 1000,
      waste: Math.round(totals.waste * 1000) / 1000,
      adjust: Math.round(totals.adjust * 1000) / 1000,
    },
    timeline,
  })
}))

module.exports = router
