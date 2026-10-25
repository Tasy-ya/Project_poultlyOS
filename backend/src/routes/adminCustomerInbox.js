const express = require('express')
const prisma = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')
const slips = require('../lib/slips')

// =====================================================
// กล่องออเดอร์ / การจองจากลูกค้า สำหรับหน้า Admin Dashboard — mount ที่ /api/admin
//
//   GET  /customer-inbox?branchId=              รอยืนยันชำระ (ออเดอร์ + การจอง) + ที่ยืนยันแล้วล่าสุด
//   POST /customer-reservations/:id/confirm-deposit   ยืนยันรับมัดจำ (หลังตรวจเงินเข้าจริง)
//   GET  /customer-orders/:id/slip              ดูรูปสลิปของออเดอร์
//   GET  /customer-reservations/:id/slip        ดูรูปสลิปมัดจำของการจอง
//   GET  /customer-reviews?branchId=            รีวิวจากลูกค้า + คะแนนเฉลี่ย
//   POST /customer-orders/:id/reject            ปฏิเสธ/ยกเลิกออเดอร์ที่ไม่ได้โอน
//   POST /customer-reservations/:id/reject      ปฏิเสธ/ยกเลิกการจองที่ไม่ได้โอนมัดจำ
//
// ยืนยันออเดอร์ (ตัดสต็อก + บันทึกรับเงิน) ใช้ POST /customer-orders/:id/confirm-payment ใน adminSales.js
// =====================================================

const router = express.Router()

const num = v => Number(v || 0)

const itemView = i => ({
  name: i.menu ? i.menu.name : '-',
  size: i.size,
  qty: i.qty,
  lineTotal: num(i.lineTotal),
  note: i.note || null,
})

function fail(status, message) {
  return Object.assign(new Error(message), { status })
}

function branchWhere(req) {
  const id = Number(req.query.branchId)
  return Number.isInteger(id) && id > 0 ? { branchId: id } : {}
}

const orderView = o => ({
  id: o.id,
  receiptNo: o.receiptNo,
  branchId: o.branchId,
  branchName: o.branch?.name || `สาขา ${o.branchId}`,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  total: num(o.totalAmount),
  createdAt: o.createdAt,
  status: o.status,
  fulfillmentStatus: o.fulfillmentStatus,
  hasSlip: Boolean(o.slipUrl),
  slipUploadedAt: o.slipUploadedAt,
  deliveryMethod: o.deliveryMethod || 'pickup',
  deliveryAddress: o.deliveryAddress || null,
  deliveryLat: o.deliveryLat,
  deliveryLng: o.deliveryLng,
  deliveryFee: num(o.deliveryFee),
  items: o.items.map(itemView),
})

const reservationView = r => ({
  id: r.id,
  reservationNo: `R${String(r.id).padStart(5, '0')}`,
  branchId: r.branchId,
  branchName: r.branch?.name || `สาขา ${r.branchId}`,
  customerName: r.customerName,
  customerPhone: r.phone,
  total: num(r.totalAmount),
  deposit: num(r.depositAmount),
  pickupAt: r.pickupDatetime,
  note: r.note,
  deliveryMethod: r.deliveryMethod || 'pickup',
  deliveryAddress: r.deliveryAddress || null,
  deliveryLat: r.deliveryLat,
  deliveryLng: r.deliveryLng,
  deliveryFee: num(r.deliveryFee),
  createdAt: r.createdAt,
  status: r.status,
  hasSlip: Boolean(r.slipUrl),
  slipUploadedAt: r.slipUploadedAt,
  items: r.items.map(itemView),
})

router.get(
  '/customer-inbox',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const where = branchWhere(req)

      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)

      const [pendingOrders, pendingReservations, paidOrders, upcoming] =
        await Promise.all([
          prisma.order.findMany({
            where: { ...where, orderChannel: 'online', status: 'pending_payment' },
            include: { branch: true, items: { include: { menu: true } } },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.reservation.findMany({
            where: { ...where, status: 'pending_payment' },
            include: { branch: true, items: { include: { menu: true } } },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.order.findMany({
            where: {
              ...where,
              orderChannel: 'online',
              status: 'completed',
              createdAt: { gte: startOfToday },
            },
            include: { branch: true, items: { include: { menu: true } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          prisma.reservation.findMany({
            where: { ...where, status: { in: ['confirmed', 'ready'] } },
            include: { branch: true, items: { include: { menu: true } } },
            orderBy: { pickupDatetime: 'asc' },
            take: 20,
          }),
        ])

      res.json({
        pendingOrders: pendingOrders.map(orderView),
        pendingReservations: pendingReservations.map(reservationView),
        paidOrdersToday: paidOrders.map(orderView),
        upcomingReservations: upcoming.map(reservationView),
      })
    } catch (error) {
      console.error('GET /admin/customer-inbox error:', error)
      res.status(500).json({ error: 'ไม่สามารถโหลดออเดอร์/การจองของลูกค้าได้' })
    }
  }
)

router.post(
  '/customer-reservations/:id/confirm-deposit',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id)
    const bankReference = String(req.body?.bankReference || '').trim().slice(0, 100)

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'รหัสการจองไม่ถูกต้อง' })
    }

    try {
      const out = await prisma.$transaction(async tx => {
        const r = await tx.reservation.findUnique({ where: { id } })

        if (!r) throw fail(404, 'ไม่พบการจอง')

        if (r.status !== 'pending_payment') {
          throw fail(409, 'การจองนี้ไม่ได้อยู่ในสถานะรอตรวจสอบมัดจำ')
        }

        // มีสลิปแนบแล้ว = ไม่บังคับกรอกเลขอ้างอิง / ไม่มีสลิป = ต้องระบุเลขอ้างอิงจากรายการเดินบัญชี
        if (!r.slipUrl && bankReference.length < 3) {
          throw fail(400, 'กรุณาระบุเลขอ้างอิง/หมายเหตุหลังตรวจสอบเงินเข้าจริงแล้ว')
        }

        await tx.reservationPayment.create({
          data: {
            reservationId: r.id,
            kind: 'deposit',
            method: 'qr',
            amount: r.depositAmount,
            refNo: bankReference || 'ตรวจสลิปโดยแอดมิน',
          },
        })

        return tx.reservation.update({
          where: { id: r.id },
          data: { status: 'confirmed' },
        })
      })

      res.json({ ok: true, id: out.id, status: out.status })
    } catch (error) {
      const status = error.status || 500
      if (status === 500) console.error('confirm-deposit error:', error)

      res.status(status).json({
        error: status === 500 ? 'ยืนยันมัดจำไม่สำเร็จ' : error.message,
      })
    }
  }
)

function sendSlip(res, name) {
  const file = slips.slipFile(name)

  if (!file) return res.status(404).json({ error: 'ไม่พบรูปสลิป' })

  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(file)
}

router.get('/customer-orders/:id/slip', requireAuth, requireAdmin, async (req, res) => {
  const row = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    select: { slipUrl: true },
  })

  if (!row || !row.slipUrl) return res.status(404).json({ error: 'ลูกค้ายังไม่ได้แนบสลิป' })

  sendSlip(res, row.slipUrl)
})

router.get('/customer-reservations/:id/slip', requireAuth, requireAdmin, async (req, res) => {
  const row = await prisma.reservation.findUnique({
    where: { id: Number(req.params.id) },
    select: { slipUrl: true },
  })

  if (!row || !row.slipUrl) return res.status(404).json({ error: 'ลูกค้ายังไม่ได้แนบสลิป' })

  sendSlip(res, row.slipUrl)
})

router.get('/customer-reviews', requireAuth, requireAdmin, async (req, res) => {
  try {
    const where = branchWhere(req)

    const [rows, agg] = await Promise.all([
      prisma.orderReview.findMany({
        where,
        include: { order: { select: { receiptNo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.orderReview.aggregate({
        where,
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ])

    res.json({
      average: agg._avg.rating == null ? null : Math.round(agg._avg.rating * 10) / 10,
      count: agg._count._all,
      reviews: rows.map(r => ({
        id: r.id,
        receiptNo: r.order?.receiptNo || null,
        customerName: r.customerName,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /admin/customer-reviews error:', error)
    res.status(500).json({ error: 'โหลดรีวิวไม่สำเร็จ' })
  }
})

router.post(
  '/customer-orders/:id/reject',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id)
    const reason = String(req.body?.reason || 'ไม่พบการโอนเงิน').trim().slice(0, 255)

    try {
      // ออเดอร์ที่ยังไม่ยืนยันยังไม่ได้ตัดสต็อก จึงไม่ต้องคืนสต็อก
      const r = await prisma.order.updateMany({
        where: { id, orderChannel: 'online', status: 'pending_payment' },
        data: { status: 'cancelled', cancelReason: reason },
      })

      if (r.count === 0) {
        return res.status(409).json({ error: 'ออเดอร์นี้ไม่ได้อยู่ในสถานะรอตรวจสอบการชำระ' })
      }

      res.json({ ok: true, id, status: 'cancelled' })
    } catch (error) {
      console.error('reject order error:', error)
      res.status(500).json({ error: 'ยกเลิกออเดอร์ไม่สำเร็จ' })
    }
  }
)

router.post(
  '/customer-reservations/:id/reject',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = Number(req.params.id)
    const reason = String(req.body?.reason || 'ไม่พบการโอนมัดจำ').trim().slice(0, 255)

    try {
      const r = await prisma.reservation.updateMany({
        where: { id, status: 'pending_payment' },
        data: { status: 'cancelled', cancelReason: reason },
      })

      if (r.count === 0) {
        return res.status(409).json({ error: 'การจองนี้ไม่ได้อยู่ในสถานะรอตรวจสอบมัดจำ' })
      }

      res.json({ ok: true, id, status: 'cancelled' })
    } catch (error) {
      console.error('reject reservation error:', error)
      res.status(500).json({ error: 'ยกเลิกการจองไม่สำเร็จ' })
    }
  }
)

module.exports = router
