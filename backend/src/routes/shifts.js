const express = require('express')
const prisma = require('../db')
const {
  requireAuth,
  requireDept,
} = require('../middleware/auth')

const router = express.Router()

// ทุกเส้นทางสำหรับฝ่ายขาย (และแอดมิน)
const salesOnly = [requireAuth, requireDept('sales')]

const num = v => Number(v || 0)

// =====================================================
// สรุปยอดของกะ (ตั้งแต่เปิดกะ จนถึงปิดกะ / ตอนนี้)
// =====================================================
async function summarize(shift, until) {
  const end = until || new Date()

  const orders = await prisma.order.findMany({
    where: {
      branchId: shift.branchId,
      createdAt: { gte: shift.openedAt, lte: end },
    },
    include: { payments: true },
  })

  const completed = orders.filter(o => o.status === 'completed')
  const cancelled = orders.filter(o => o.status === 'cancelled')

  const byMethod = {}

  for (const order of completed) {
    for (const p of order.payments) {
      const key = p.method || 'other'

      byMethod[key] = num(byMethod[key]) + num(p.amount)
    }
  }

  const totalSales = completed.reduce(
    (sum, o) => sum + num(o.totalAmount),
    0
  )

  // ค่าใช้จ่ายที่จ่ายจากเงินในลิ้นชักระหว่างกะ
  const expenses = await prisma.otherExpense.findMany({
    where: {
      branchId: shift.branchId,
      paidFromDrawer: true,
      createdAt: { gte: shift.openedAt, lte: end },
    },
  })

  const drawerExpenses = expenses.reduce(
    (sum, e) => sum + num(e.amount),
    0
  )

  const cashSales = num(byMethod.cash)

  const expectedCash =
    num(shift.openingCash) + cashSales - drawerExpenses

  return {
    orderCount: completed.length,
    cancelledCount: cancelled.length,
    totalSales,
    byMethod,
    cashSales,
    drawerExpenses,
    expectedCash,
  }
}

function shiftPayload(shift, summary) {
  return {
    id: shift.id,
    branchId: shift.branchId,
    staffId: shift.staffId,
    openedAt: shift.openedAt,
    openingCash: num(shift.openingCash),
    closedAt: shift.closedAt,
    countedCash:
      shift.countedCash === null || shift.countedCash === undefined
        ? null
        : num(shift.countedCash),
    expectedCash:
      shift.expectedCash === null || shift.expectedCash === undefined
        ? null
        : num(shift.expectedCash),
    difference:
      shift.difference === null || shift.difference === undefined
        ? null
        : num(shift.difference),
    note: shift.note || '',
    summary: summary || null,
  }
}

// =====================================================
// GET /api/shifts/current?branchId=1
// กะที่เปิดอยู่ของสาขา (พร้อมยอดสะสมตอนนี้)
// =====================================================
router.get('/current', salesOnly, async (req, res) => {
  const branchId = Number(req.query.branchId)

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' })
  }

  const shift = await prisma.shift.findFirst({
    where: { branchId, closedAt: null },
    orderBy: { openedAt: 'desc' },
  })

  if (!shift) {
    return res.json({ shift: null })
  }

  res.json({
    shift: shiftPayload(shift, await summarize(shift)),
  })
})

// =====================================================
// GET /api/shifts/recent?branchId=1
// กะที่ปิดแล้วล่าสุด 10 กะ
// =====================================================
router.get('/recent', salesOnly, async (req, res) => {
  const branchId = Number(req.query.branchId)

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' })
  }

  const rows = await prisma.shift.findMany({
    where: { branchId, closedAt: { not: null } },
    orderBy: { closedAt: 'desc' },
    take: 10,
  })

  res.json(rows.map(r => shiftPayload(r)))
})

// =====================================================
// POST /api/shifts/open  body: { branchId, openingCash }
// =====================================================
router.post('/open', salesOnly, async (req, res) => {
  const branchId = Number(req.body.branchId)
  const openingCash = Number(req.body.openingCash)

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' })
  }

  if (!(openingCash >= 0)) {
    return res.status(400).json({ error: 'เงินทอนตั้งต้นไม่ถูกต้อง' })
  }

  const existing = await prisma.shift.findFirst({
    where: { branchId, closedAt: null },
  })

  if (existing) {
    return res.status(409).json({
      error: 'สาขานี้มีกะที่เปิดอยู่แล้ว กรุณาปิดกะเดิมก่อน',
    })
  }

  const shift = await prisma.shift.create({
    data: {
      branchId,
      staffId: req.staff.id,
      openingCash,
    },
  })

  res.status(201).json({
    shift: shiftPayload(shift, await summarize(shift)),
  })
})

// =====================================================
// POST /api/shifts/close  body: { shiftId, countedCash, note }
// ปิดกะ: เทียบเงินสดที่นับได้ กับยอดที่ควรมี
// =====================================================
router.post('/close', salesOnly, async (req, res) => {
  const shiftId = Number(req.body.shiftId)
  const countedCash = Number(req.body.countedCash)

  if (!shiftId) {
    return res.status(400).json({ error: 'ต้องระบุ shiftId' })
  }

  if (!(countedCash >= 0)) {
    return res.status(400).json({ error: 'จำนวนเงินที่นับได้ไม่ถูกต้อง' })
  }

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
  })

  if (!shift) {
    return res.status(404).json({ error: 'ไม่พบกะนี้' })
  }

  if (shift.closedAt) {
    return res.status(409).json({ error: 'กะนี้ปิดไปแล้ว' })
  }

  const closedAt = new Date()

  const summary = await summarize(shift, closedAt)

  const difference = countedCash - summary.expectedCash

  const closed = await prisma.shift.update({
    where: { id: shiftId },
    data: {
      closedAt,
      countedCash,
      expectedCash: summary.expectedCash,
      difference,
      note: req.body.note
        ? String(req.body.note).slice(0, 255)
        : null,
    },
  })

  res.json({
    shift: shiftPayload(closed, summary),
  })
})

module.exports = router
