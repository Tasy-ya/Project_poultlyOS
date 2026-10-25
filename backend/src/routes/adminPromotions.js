const express = require('express')
const prisma = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const { toAdminView, cleanPayload, tableMissing, warnOnce } = require('../lib/shopPromotions')

// =====================================================
// แอดมินจัดการโปรโมชั่น — mount ที่ /api/admin
//   GET    /promotions        รายการทั้งหมด (ทุกสถานะ)
//   POST   /promotions        สร้าง
//   PUT    /promotions/:id    แก้ไข / ยกเลิก (isActive=false) / เปิดใหม่
//   DELETE /promotions/:id    ลบ
// โปรโมชั่นที่แอดมินสร้างใช้กับ "ทุกสาขา" (branch_id = NULL)
// =====================================================

const router = express.Router()

function fail(status, message) {
  return Object.assign(new Error(message), { status })
}

function ensureModel() {
  if (!prisma.shopPromotion) {
    warnOnce()
    throw fail(503, 'ยังไม่ได้ติดตั้งระบบโปรโมชั่น — รัน upgrade_round13_promotions.sql แล้ว npx prisma generate')
  }
}

function wrap(handler) {
  return async (req, res) => {
    try {
      ensureModel()
      await handler(req, res)
    } catch (err) {
      if (tableMissing(err)) {
        warnOnce()
        return res.status(503).json({ error: 'ยังไม่มีตาราง shop_promotions — รัน upgrade_round13_promotions.sql ใน pgAdmin' })
      }
      if (err.status) return res.status(err.status).json({ error: err.message })
      console.error('[adminPromotions]', err)
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการจัดการโปรโมชั่น' })
    }
  }
}

function validate(data) {
  if (!String(data.title || '').trim()) throw fail(400, 'กรุณาระบุชื่อโปรโมชั่น')
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw fail(400, 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม')
  }
}

router.get('/promotions', requireAuth, requireAdmin, wrap(async (req, res) => {
  const rows = await prisma.shopPromotion.findMany({ orderBy: { id: 'desc' } })
  res.json(rows.map(toAdminView))
}))

router.post('/promotions', requireAuth, requireAdmin, wrap(async (req, res) => {
  const data = cleanPayload(req.body)
  validate(data)

  const row = await prisma.shopPromotion.create({ data: { branchId: null, data } })
  res.status(201).json(toAdminView(row))
}))

router.put('/promotions/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw fail(400, 'รหัสโปรโมชั่นไม่ถูกต้อง')

  const exists = await prisma.shopPromotion.findUnique({ where: { id } })
  if (!exists) throw fail(404, 'ไม่พบโปรโมชั่นนี้')

  const data = cleanPayload(req.body)
  validate(data)

  const row = await prisma.shopPromotion.update({ where: { id }, data: { data } })
  res.json(toAdminView(row))
}))

router.delete('/promotions/:id', requireAuth, requireAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw fail(400, 'รหัสโปรโมชั่นไม่ถูกต้อง')

  await prisma.shopPromotion.deleteMany({ where: { id } })
  res.json({ ok: true })
}))

module.exports = router
