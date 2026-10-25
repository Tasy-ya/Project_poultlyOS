const express = require('express')
const prisma = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { bangkokDateStr, dateColumnStr, isDateStr, addDays } = require('../lib/closures')

// =====================================================
// แอดมินตั้งวันหยุดร้าน — mount ที่ /api/admin
//
//   GET    /closures            รายการวันหยุด (ช่วงวันที่ยังไม่หมดอายุ + ประจำสัปดาห์)
//   POST   /closures            เพิ่มวันหยุด
//            { kind:'range',  branchId|null, startDate, endDate?, reason? }   หยุดเป็นช่วงวัน (วันเดียว = ไม่ต้องส่ง endDate)
//            { kind:'weekly', branchId|null, weekday(0-6), reason? }          หยุดประจำทุกสัปดาห์
//   DELETE /closures/:id        ลบวันหยุด (เปิดร้านวันนั้นตามปกติ)
//
// ลูกค้าเห็นวันหยุดผ่าน GET /api/public/closures และ "สั่งซื้อเลย" ไม่ได้ในวันหยุด
// (จองล่วงหน้าได้เฉพาะวันที่ร้านเปิด) — เซิร์ฟเวอร์ตรวจทุกครั้ง
// =====================================================

const router = express.Router()

const MAX_RANGE_DAYS = 366

function fail(status, message) {
  return Object.assign(new Error(message), { status })
}

const view = (c, branchNames) => ({
  id: c.id,
  kind: c.kind,
  branchId: c.branchId,
  branchName: c.branchId ? branchNames.get(c.branchId) || `สาขา ${c.branchId}` : 'ทุกสาขา',
  startDate: dateColumnStr(c.startDate),
  endDate: dateColumnStr(c.endDate) || dateColumnStr(c.startDate),
  weekday: c.weekday,
  reason: c.reason || null,
  createdAt: c.createdAt,
})

router.get('/closures', requireAuth, requireAdmin, async (req, res) => {
  const today = bangkokDateStr()

  const rows = await prisma.shopClosure.findMany({
    where: {
      OR: [
        { kind: 'weekly' },
        // ช่วงที่ยังไม่จบ (รวมที่เพิ่งจบไม่เกิน 30 วัน ให้แอดมินเห็นประวัติ)
        { endDate: { gte: new Date(`${addDays(today, -30)}T00:00:00Z`) } },
      ],
    },
    orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
  })

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } })
  const names = new Map(branches.map(b => [b.id, b.name]))

  res.json({ today, closures: rows.map(c => view(c, names)) })
})

router.post('/closures', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {}
  const kind = body.kind === 'weekly' ? 'weekly' : 'range'
  const reason = String(body.reason || '').trim().slice(0, 255) || null

  let branchId = null

  if (body.branchId !== null && body.branchId !== undefined && body.branchId !== '') {
    branchId = Number(body.branchId)

    if (!Number.isInteger(branchId)) throw fail(400, 'สาขาไม่ถูกต้อง')

    const branch = await prisma.branch.findUnique({ where: { id: branchId } })

    if (!branch) throw fail(404, 'ไม่พบสาขานี้')
  }

  if (kind === 'weekly') {
    const weekday = Number(body.weekday)

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw fail(400, 'วันในสัปดาห์ไม่ถูกต้อง')
    }

    const dup = await prisma.shopClosure.findFirst({ where: { kind: 'weekly', branchId, weekday } })

    if (dup) throw fail(409, 'ตั้งวันหยุดประจำสัปดาห์วันนี้ไว้แล้ว')

    const created = await prisma.shopClosure.create({
      data: { kind: 'weekly', branchId, weekday, reason },
    })

    return res.status(201).json({ ok: true, id: created.id })
  }

  const startDate = String(body.startDate || '')
  const endDate = String(body.endDate || body.startDate || '')

  if (!isDateStr(startDate) || !isDateStr(endDate)) throw fail(400, 'กรุณาเลือกวันที่หยุดให้ถูกต้อง')

  if (endDate < startDate) throw fail(400, 'วันสุดท้ายต้องไม่ก่อนวันเริ่มหยุด')

  const span = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1

  if (span > MAX_RANGE_DAYS) throw fail(400, `ตั้งวันหยุดต่อเนื่องได้ไม่เกิน ${MAX_RANGE_DAYS} วัน`)

  if (endDate < bangkokDateStr()) throw fail(400, 'ตั้งวันหยุดย้อนหลังไม่ได้')

  const created = await prisma.shopClosure.create({
    data: {
      kind: 'range',
      branchId,
      startDate: new Date(`${startDate}T00:00:00Z`),
      endDate: new Date(`${endDate}T00:00:00Z`),
      reason,
    },
  })

  res.status(201).json({ ok: true, id: created.id, days: span })
})

router.delete('/closures/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) throw fail(400, 'รหัสไม่ถูกต้อง')

  const r = await prisma.shopClosure.deleteMany({ where: { id } })

  if (r.count === 0) throw fail(404, 'ไม่พบวันหยุดนี้')

  res.json({ ok: true, id })
})

module.exports = router
