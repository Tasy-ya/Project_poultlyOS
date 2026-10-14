const express = require('express')
const prisma = require('../db')
const {
  requireAuth,
  requireDept,
} = require('../middleware/auth')

const router = express.Router()

// ค่าใช้จ่ายประจำวันของหน้าร้าน: ฝ่ายขาย (และแอดมิน)
router.use(requireAuth, requireDept('sales'))

// วันที่ (เวลาเครื่อง) -> Date แบบ UTC เที่ยงคืน สำหรับคอลัมน์ DATE
function dayValue(dateStr) {
  const base = dateStr
    ? new Date(`${dateStr}T00:00:00`)
    : new Date()

  if (Number.isNaN(base.getTime())) return null

  return new Date(
    Date.UTC(
      base.getFullYear(),
      base.getMonth(),
      base.getDate()
    )
  )
}

// =====================================================
// GET /api/expenses?branchId=1&date=YYYY-MM-DD (ไม่ส่ง date = วันนี้)
// =====================================================
router.get('/', async (req, res) => {
  const branchId = Number(req.query.branchId)
  const day = dayValue(req.query.date)

  if (!branchId || !day) {
    return res.status(400).json({ error: 'ต้องระบุ branchId และวันที่ให้ถูกต้อง' })
  }

  const rows = await prisma.otherExpense.findMany({
    where: { branchId, expenseDate: day },
    orderBy: { id: 'desc' },
  })

  res.json(rows)
})

// =====================================================
// POST /api/expenses  body: { branchId, label, amount, paidFromDrawer }
// บันทึกค่าใช้จ่ายของ "วันนี้"
// =====================================================
router.post('/', async (req, res) => {
  const branchId = Number(req.body.branchId)
  const label = String(req.body.label || '').trim()
  const amount = Number(req.body.amount)

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุสาขา' })
  }

  if (!label) {
    return res.status(400).json({ error: 'กรุณากรอกรายการค่าใช้จ่าย' })
  }

  if (!(amount > 0)) {
    return res.status(400).json({ error: 'จำนวนเงินต้องมากกว่า 0' })
  }

  const row = await prisma.otherExpense.create({
    data: {
      branchId,
      label: label.slice(0, 100),
      amount,
      expenseDate: dayValue(),
      staffId: req.staff.id,
      paidFromDrawer: req.body.paidFromDrawer !== false,
    },
  })

  res.status(201).json(row)
})

// =====================================================
// DELETE /api/expenses/:id
// ฝ่ายขายลบได้เฉพาะรายการของวันนี้ แอดมินลบได้ทุกวัน
// =====================================================
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)

  const row = await prisma.otherExpense.findUnique({ where: { id } })

  if (!row) {
    return res.status(404).json({ error: 'ไม่พบรายการ' })
  }

  const isAdmin =
    req.staff.loginType === 'admin' || req.staff.dept === 'admin'

  const today = dayValue()

  const isToday =
    row.expenseDate &&
    today &&
    row.expenseDate.getTime() === today.getTime()

  if (!isAdmin && !isToday) {
    return res.status(403).json({
      error: 'ลบได้เฉพาะรายการของวันนี้ (รายการเก่าให้แอดมินลบ)',
    })
  }

  await prisma.otherExpense.delete({ where: { id } })

  res.json({ ok: true })
})

module.exports = router
