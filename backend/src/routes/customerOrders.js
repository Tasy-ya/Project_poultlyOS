const express = require('express')
const prisma = require('../db')
const { requireAuth, requireDept } = require('../middleware/auth')
const { HttpError } = require('../lib/errors')
const {
  buildLines,
  sumLines,
  lockBranch,
  nextReceiptNo,
  cutStock,
  confirmOnlineOrder,
} = require('../lib/orderCore')
const slips = require('../lib/slips')
const slipAI = require('../lib/slipAI')
const { rateLimit } = require('../lib/rateLimit')

// =====================================================
// ฝั่งพนักงาน (ฝ่ายขาย/แอดมิน) — mount ที่ /api/customer
//
//   GET   /inbox?branchId=                     ออเดอร์/การจองที่ลูกค้าแนบสลิปแล้ว รอพนักงานตรวจสลิป
//   GET   /orders/:id/slip                     ดูรูปสลิปของออเดอร์ (ต้องล็อกอิน)
//   GET   /reservations/:id/slip               ดูรูปสลิปมัดจำของการจอง
//   POST  /orders/:id/confirm-payment          พนักงานตรวจสลิปแล้ว ยืนยันรับเงิน -> เตรียมออเดอร์ได้เลย
//   POST  /orders/:id/reject                   ไม่รับออเดอร์ (สลิปไม่ถูกต้อง/ไม่พบการโอน) = ยกเลิก — ต้องมีเหตุผล หรือโทรแจ้งลูกค้าแล้ว
//   GET   /unpaid?branchId=                    ออเดอร์ที่ลูกค้ายังไม่โอน/ยังไม่แนบสลิป
//   POST  /orders/:id/cancel                   พนักงานยกเลิกออเดอร์ที่ลูกค้าไม่ชำระ — ต้องมีเหตุผล หรือโทรแจ้งลูกค้าแล้ว
//   GET   /cancelled?branchId=                 ออเดอร์ที่ยกเลิกแล้ว (ทั้งหมด ล่าสุด 200 รายการ) เพื่อลบออก
//   DELETE /orders/:id                         ลบออเดอร์ที่ยกเลิกแล้ว/ไม่เคยชำระ ออกจากระบบถาวร
//   POST  /reservations/:id/confirm-deposit    ยืนยันรับมัดจำ
//   POST  /reservations/:id/reject             ไม่รับการจอง (ยกเลิก) — ต้องมีเหตุผล หรือโทรแจ้งลูกค้าแล้ว
//   GET   /orders?branchId=                    ออเดอร์ออนไลน์ที่ต้องเตรียม/ส่งมอบ
//   PATCH /orders/:id/status                   new -> preparing -> ready -> picked_up
//   GET   /reservations?branchId=&scope=       การจอง (active = รอรับสินค้า)
//   POST  /reservations/:id/ready              ทำของเสร็จ พร้อมให้รับ
//   POST  /reservations/:id/collect            ลูกค้ามารับ: เก็บส่วนที่เหลือ + ตัดสต็อก + ออกใบเสร็จฉบับเต็ม
//   POST  /reservations/:id/cancel             ยกเลิกการจอง (เลือกคืน/ไม่คืนมัดจำ)
// =====================================================

const router = express.Router()

router.use(requireAuth, requireDept('sales'))

const num = v => Number(v || 0)

const itemView = i => ({
  id: i.id,
  menuId: i.menuId,
  name: i.menu ? i.menu.name : '-',
  size: i.size,
  qty: i.qty,
  lineTotal: num(i.lineTotal),
  note: i.note || null,
})

const PAY_METHODS = ['cash', 'qr', 'transfer', 'card']

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function branchFilter(req) {
  const id = Number(req.query.branchId)
  return Number.isInteger(id) ? { branchId: id } : {}
}

// พนักงานยกเลิก/ไม่รับออเดอร์ได้ก็ต่อเมื่อ "แจ้งเหตุผล" หรือ "โทรแจ้งลูกค้าแล้ว" อย่างใดอย่างหนึ่ง
// ข้อความนี้ลูกค้าจะเห็นในหน้าสถานะออเดอร์
function cancelReasonFrom(body) {
  const reason = String(body?.reason || '').trim().slice(0, 200)
  const called = body?.calledCustomer === true

  if (!reason && !called) {
    throw new HttpError(400, 'กรุณาระบุเหตุผลที่ยกเลิก หรือโทรแจ้งลูกค้าก่อน')
  }

  if (called) {
    return (reason ? `ร้านโทรแจ้งลูกค้าแล้ว: ${reason}` : 'ร้านโทรแจ้งลูกค้าแล้ว').slice(0, 255)
  }

  return reason
}


// =====================================================
// ออเดอร์ที่ลูกค้าสั่งเอง
// =====================================================

// ---------- สลิปโอนเงินที่รอพนักงานตรวจ ----------

const pendingOrderView = o => ({
  id: o.id,
  receiptNo: o.receiptNo,
  createdAt: o.createdAt,
  slipUploadedAt: o.slipUploadedAt,
  customerName: o.customerName,
  customerPhone: o.customerPhone,
  total: num(o.totalAmount),
  deliveryMethod: o.deliveryMethod || 'pickup',
  deliveryAddress: o.deliveryAddress || null,
  deliveryLat: o.deliveryLat,
  deliveryLng: o.deliveryLng,
  deliveryFee: num(o.deliveryFee),
  pickupAt: o.pickupAt || null,
  slipAi: o.slipAi || null,
  items: o.items.map(itemView),
})

const pendingReservationView = r => ({
  id: r.id,
  reservationNo: `R${String(r.id).padStart(5, '0')}`,
  createdAt: r.createdAt,
  slipUploadedAt: r.slipUploadedAt,
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
  slipAi: r.slipAi || null,
  items: r.items.map(itemView),
})

router.get('/inbox', async (req, res) => {
  const where = branchFilter(req)

  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...where,
        orderChannel: 'online',
        status: 'pending_payment',
        slipUrl: { not: null },
      },
      include: { items: { include: { menu: true } } },
      orderBy: { slipUploadedAt: 'asc' },
    }),
    prisma.reservation.findMany({
      where: { ...where, status: 'pending_payment', slipUrl: { not: null } },
      include: { items: { include: { menu: true } } },
      orderBy: { slipUploadedAt: 'asc' },
    }),
  ])

  res.json({
    orders: orders.map(pendingOrderView),
    reservations: reservations.map(pendingReservationView),
  })
})

function sendSlip(res, name) {
  const file = slips.slipFile(name)

  if (!file) throw new HttpError(404, 'ไม่พบรูปสลิป')

  res.setHeader('Cache-Control', 'private, no-store')
  res.sendFile(file)
}

router.get('/orders/:id/slip', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: Number(req.params.id) },
    select: { slipUrl: true },
  })

  if (!order || !order.slipUrl) throw new HttpError(404, 'ลูกค้ายังไม่ได้แนบสลิป')

  sendSlip(res, order.slipUrl)
})

router.get('/reservations/:id/slip', async (req, res) => {
  const r = await prisma.reservation.findUnique({
    where: { id: Number(req.params.id) },
    select: { slipUrl: true },
  })

  if (!r || !r.slipUrl) throw new HttpError(404, 'ลูกค้ายังไม่ได้แนบสลิป')

  sendSlip(res, r.slipUrl)
})

// ---------- AI ตรวจสลิป (ตัวช่วยคัดกรอง — พนักงานยังต้องกดยืนยันเอง) ----------
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: 'สั่ง AI ตรวจสลิปถี่เกินไป กรุณารอสักครู่',
})

router.get('/ai-status', (req, res) => {
  res.json({ enabled: slipAI.enabled() })
})

router.post('/orders/:id/ai-check-slip', aiLimiter, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสออเดอร์ไม่ถูกต้อง')

  res.json(await slipAI.runCheck('order', id))
})

router.post('/reservations/:id/ai-check-slip', aiLimiter, async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสการจองไม่ถูกต้อง')

  res.json(await slipAI.runCheck('reservation', id))
})

// พนักงานขายตรวจสลิปแล้วกดยืนยัน -> ตัดสต็อก + บันทึกรับเงิน + เริ่มเตรียมออเดอร์ได้ทันที (ไม่ต้องรอแอดมิน)
router.post('/orders/:id/confirm-payment', async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสออเดอร์ไม่ถูกต้อง')

  const reference =
    String(req.body?.bankReference || '').trim().slice(0, 100) ||
    `ตรวจสลิปโดย ${req.staff.name || `พนักงาน #${req.staff.id}`}`

  const out = await prisma.$transaction(tx =>
    confirmOnlineOrder(tx, id, {
      staffId: req.staff.id,
      reference,
      requireSlip: true,
      label: 'พนักงานตรวจสลิปและยืนยันออเดอร์ออนไลน์',
    })
  )

  res.json({ ok: true, id: out.id, status: out.status, fulfillmentStatus: out.fulfillmentStatus })
})

// ยกเลิกออเดอร์ที่ยังไม่ยืนยันชำระ (ไม่รับออเดอร์ / ลูกค้าไม่โอน)
// ออเดอร์ที่ยังไม่ยืนยันยังไม่ได้ตัดสต็อก จึงไม่ต้องคืนสต็อก
async function cancelUnpaidOrder(req, res) {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสออเดอร์ไม่ถูกต้อง')

  const reason = cancelReasonFrom(req.body)

  const r = await prisma.order.updateMany({
    where: { id, orderChannel: 'online', status: 'pending_payment' },
    data: { status: 'cancelled', cancelReason: reason },
  })

  if (r.count === 0) {
    throw new HttpError(409, 'ออเดอร์นี้ไม่ได้อยู่ในสถานะรอชำระเงินแล้ว (อาจถูกยืนยันหรือยกเลิกไปก่อนหน้า)')
  }

  res.json({ ok: true, id, status: 'cancelled', cancelReason: reason })
}

router.post('/orders/:id/reject', cancelUnpaidOrder)
router.post('/orders/:id/cancel', cancelUnpaidOrder)

// ---------- ออเดอร์ที่ลูกค้ายังไม่ชำระ (ยังไม่แนบสลิป) ----------
router.get('/unpaid', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      ...branchFilter(req),
      orderChannel: 'online',
      status: 'pending_payment',
      slipUrl: null,
    },
    include: { items: { include: { menu: true } } },
    orderBy: { createdAt: 'asc' },
  })

  res.json(
    orders.map(o => ({
      id: o.id,
      receiptNo: o.receiptNo,
      createdAt: o.createdAt,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      total: num(o.totalAmount),
      deliveryMethod: o.deliveryMethod || 'pickup',
      deliveryAddress: o.deliveryAddress || null,
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      pickupAt: o.pickupAt || null,
      items: o.items.map(itemView),
    }))
  )
})

// ---------- ออเดอร์ที่ยกเลิกแล้ว (ทั้งหมด ล่าสุด 200 รายการ) ----------
router.get('/cancelled', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      ...branchFilter(req),
      orderChannel: 'online',
      status: 'cancelled',
    },
    include: { items: { include: { menu: true } }, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  res.json(
    orders.map(o => ({
      id: o.id,
      receiptNo: o.receiptNo,
      createdAt: o.createdAt,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      total: num(o.totalAmount),
      cancelReason: o.cancelReason || null,
      hadSlip: Boolean(o.slipUrl),
      // ลบได้เฉพาะออเดอร์ที่ไม่เคยรับเงิน (กันลบประวัติการเงินจริง)
      deletable: o.payments.length === 0,
      items: o.items.map(itemView),
    }))
  )
})

// ---------- ลบออเดอร์ที่ลูกค้าไม่ชำระ ----------
// ลบได้เฉพาะออเดอร์ออนไลน์ที่ "ยกเลิกแล้ว" และไม่เคยรับเงิน/ตัดสต็อก — ออเดอร์ที่ขายจริงลบไม่ได้
router.delete('/orders/:id', async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสออเดอร์ไม่ถูกต้อง')

  const slipUrl = await prisma.$transaction(async tx => {
    const order = await tx.order.findFirst({
      where: { id, orderChannel: 'online' },
      include: { payments: true, stockLogs: true },
    })

    if (!order) throw new HttpError(404, 'ไม่พบออเดอร์')

    if (order.status !== 'cancelled') {
      throw new HttpError(409, 'ลบได้เฉพาะออเดอร์ที่ยกเลิกแล้ว กรุณายกเลิกออเดอร์ก่อน')
    }

    if (order.payments.length > 0 || order.stockLogs.length > 0) {
      throw new HttpError(409, 'ออเดอร์นี้เคยรับเงิน/ตัดสต็อกแล้ว ลบไม่ได้')
    }

    await tx.orderItem.deleteMany({ where: { orderId: id } })
    await tx.order.delete({ where: { id } })

    return order.slipUrl
  })

  if (slipUrl) slips.removeSlip(slipUrl)

  res.json({ ok: true, id })
})

router.post('/reservations/:id/confirm-deposit', async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) throw new HttpError(400, 'รหัสการจองไม่ถูกต้อง')

  const reference =
    String(req.body?.bankReference || '').trim().slice(0, 100) ||
    `ตรวจสลิปโดย ${req.staff.name || `พนักงาน #${req.staff.id}`}`

  const out = await prisma.$transaction(async tx => {
    const r = await tx.reservation.findUnique({ where: { id } })

    if (!r) throw new HttpError(404, 'ไม่พบการจอง')

    if (r.status !== 'pending_payment') {
      throw new HttpError(409, 'การจองนี้ไม่ได้อยู่ในสถานะรอตรวจสอบมัดจำ')
    }

    if (!r.slipUrl) throw new HttpError(409, 'ลูกค้ายังไม่ได้แนบสลิปโอนเงิน')

    await tx.reservationPayment.create({
      data: {
        reservationId: r.id,
        kind: 'deposit',
        method: 'qr',
        amount: r.depositAmount,
        refNo: reference,
      },
    })

    return tx.reservation.update({ where: { id: r.id }, data: { status: 'confirmed' } })
  })

  res.json({ ok: true, id: out.id, status: out.status })
})

router.post('/reservations/:id/reject', async (req, res) => {
  const id = Number(req.params.id)
  const reason = cancelReasonFrom(req.body)

  const r = await prisma.reservation.updateMany({
    where: { id, status: 'pending_payment' },
    data: { status: 'cancelled', cancelReason: reason },
  })

  if (r.count === 0) {
    throw new HttpError(409, 'การจองนี้ไม่ได้อยู่ในสถานะรอตรวจสอบมัดจำ')
  }

  res.json({ ok: true, id, status: 'cancelled', cancelReason: reason })
})


router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      ...branchFilter(req),
      orderChannel: 'online',
      // ออเดอร์ที่ยกเลิกแล้วไม่ต้องขึ้นในรายการเตรียมของ (ไปอยู่ในส่วน "ออเดอร์ที่ยกเลิกแล้ว")
      status: { notIn: ['pending_payment', 'cancelled'] },
      OR: [
        { fulfillmentStatus: { in: ['new', 'preparing', 'ready'] } },
        { createdAt: { gte: startOfToday() } },
      ],
    },
    include: { items: { include: { menu: true } }, payments: true },
    orderBy: { createdAt: 'asc' },
  })

  res.json(
    orders.map(o => ({
      id: o.id,
      receiptNo: o.receiptNo,
      createdAt: o.createdAt,
      status: o.status,
      fulfillmentStatus: o.fulfillmentStatus,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      deliveryMethod: o.deliveryMethod || 'pickup',
      deliveryAddress: o.deliveryAddress || null,
      deliveryLat: o.deliveryLat,
      deliveryLng: o.deliveryLng,
      pickupAt: o.pickupAt || null,
      total: num(o.totalAmount),
      paid: o.payments.reduce((s, p) => s + num(p.amount), 0),
      items: o.items.map(itemView),
    }))
  )
})

router.patch('/orders/:id/status', async (req, res) => {
  const id = Number(req.params.id)
  const next = String(req.body.status || '')

  if (!['preparing', 'ready', 'picked_up'].includes(next)) {
    throw new HttpError(400, 'สถานะไม่ถูกต้อง')
  }

  const order = await prisma.order.findFirst({
    where: { id, orderChannel: 'online' },
  })

  if (!order) throw new HttpError(404, 'ไม่พบออเดอร์')

  if (order.status === 'cancelled') {
    throw new HttpError(409, 'ออเดอร์นี้ถูกยกเลิกแล้ว')
  }

  if (order.status === 'pending_payment') {
    throw new HttpError(409, 'ออเดอร์นี้ยังไม่ได้ยืนยันการชำระเงิน กรุณาตรวจสลิปและกดยืนยันก่อน')
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { fulfillmentStatus: next },
  })

  res.json({ id: updated.id, fulfillmentStatus: updated.fulfillmentStatus })
})


// =====================================================
// การจอง
// =====================================================

function reservationView(r) {
  const paid = r.payments
    .filter(p => p.kind !== 'refund')
    .reduce((s, p) => s + num(p.amount), 0)

  const refunded = r.payments
    .filter(p => p.kind === 'refund')
    .reduce((s, p) => s + num(p.amount), 0)

  const net = paid - refunded

  return {
    id: r.id,
    reservationNo: `R${String(r.id).padStart(5, '0')}`,
    status: r.status,
    pickupAt: r.pickupDatetime,
    customerName: r.customerName,
    customerPhone: r.phone,
    note: r.note,
    cancelReason: r.cancelReason,
  deliveryMethod: r.deliveryMethod || 'pickup',
    deliveryAddress: r.deliveryAddress || null,
    deliveryLat: r.deliveryLat,
    deliveryLng: r.deliveryLng,
    deliveryFee: num(r.deliveryFee),
    total: num(r.totalAmount),
    deposit: num(r.depositAmount),
    paid: net,
    balanceDue: r.status === 'cancelled' ? 0 : Math.max(num(r.totalAmount) - net, 0),
    items: r.items.map(itemView),
  }
}

router.get('/reservations', async (req, res) => {
  // active (ค่าเริ่มต้น) = ยังไม่รับสินค้า | today = ทุกสถานะที่นัดรับวันนี้ | all = ทั้งหมด 30 วันล่าสุด
  const scope = String(req.query.scope || 'active')

  const dayStart = startOfToday()
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000)

  const where =
    scope === 'today'
      ? { pickupDatetime: { gte: dayStart, lt: dayEnd } }
      : scope === 'all'
        ? { createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } }
        : { status: { in: ['confirmed', 'ready'] } }

  const rows = await prisma.reservation.findMany({
    where: { ...branchFilter(req), ...where },
    include: {
      items: { include: { menu: true } },
      payments: true,
    },
    orderBy: { pickupDatetime: 'asc' },
  })

  res.json(rows.map(reservationView))
})

async function loadActiveReservation(tx, id) {
  const r = await tx.reservation.findUnique({
    where: { id },
    include: { items: { include: { menu: true } }, payments: true },
  })

  if (!r) throw new HttpError(404, 'ไม่พบการจอง')

  if (!['confirmed', 'ready'].includes(r.status)) {
    throw new HttpError(409, 'การจองนี้ปิดไปแล้ว (รับสินค้าแล้วหรือถูกยกเลิก)')
  }

  return r
}

router.post('/reservations/:id/ready', async (req, res) => {
  const id = Number(req.params.id)

  const r = await prisma.$transaction(async tx => {
    const found = await loadActiveReservation(tx, id)

    return tx.reservation.update({
      where: { id: found.id },
      data: { status: 'ready' },
    })
  })

  res.json({ id: r.id, status: r.status })
})

// ลูกค้ามารับสินค้า:
//   1) เก็บส่วนที่เหลือ (ยอดรวม - มัดจำที่ชำระแล้ว)
//   2) ตัดสต็อกตามจำนวนจริง
//   3) สร้างออเดอร์ (channel = reservation) เข้า POS: ยอดขาย/ใบเสร็จ/กะ/รายงาน
//      ทำงานเหมือนออเดอร์ปกติ โดยบันทึกการชำระเป็น 2 แถว คือ "มัดจำ" และ "ส่วนที่เหลือ"
//   4) ลูกค้าใช้ลิงก์เดิมดูใบเสร็จฉบับเต็มได้ทันที
router.post('/reservations/:id/collect', async (req, res) => {
  const id = Number(req.params.id)
  const method = String(req.body.method || 'cash')
  const refNo = req.body.refNo ? String(req.body.refNo).slice(0, 100) : null

  if (!PAY_METHODS.includes(method)) {
    throw new HttpError(400, 'วิธีชำระเงินไม่ถูกต้อง')
  }

  const result = await prisma.$transaction(async tx => {
    const r = await loadActiveReservation(tx, id)

    await lockBranch(tx, r.branchId)

    // คำนวณราคาใหม่จากเมนูปัจจุบันไม่ได้ (ราคาอาจเปลี่ยน) — ใช้ราคา ณ วันที่จองตามที่ลูกค้าเห็นและจ่ายมัดจำไว้
    const lines = (
      await buildLines(
        tx,
        r.items.map(i => ({ menuId: i.menuId, size: i.size, qty: i.qty, note: i.note }))
      )
    ).map((l, idx) => ({
      ...l,
      unitPrice: num(r.items[idx].unitPrice),
      lineTotal: num(r.items[idx].lineTotal),
    }))

    const total = num(r.totalAmount) || sumLines(lines)

    const paidDeposit = r.payments
      .filter(p => p.kind === 'deposit')
      .reduce((s, p) => s + num(p.amount), 0)

    const balance = Math.max(total - paidDeposit, 0)
    const receiptNo = await nextReceiptNo(tx, r.branchId)

    const order = await tx.order.create({
      data: {
        branchId: r.branchId,
        staffId: req.staff.id,
        receiptNo,
        subtotalAmount: total,
        discountAmount: 0,
        totalAmount: total,
        status: 'completed',
        orderChannel: 'reservation',
        fulfillmentStatus: 'picked_up',
        customerName: r.customerName,
        customerPhone: r.phone,
        receiptToken: r.receiptToken,
      },
    })

    for (const l of lines) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          menuId: l.menuId,
          size: l.size,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          note: l.note,
        },
      })
    }

    await cutStock(tx, {
      branchId: r.branchId,
      lines,
      orderId: order.id,
      receiptNo,
      staffId: req.staff.id,
      label: `ส่งมอบการจอง R${String(r.id).padStart(5, '0')}`,
    })

    // มัดจำ: บันทึกด้วยวันเวลาและวิธีชำระเดิม (ไม่นับเป็นเงินสดในลิ้นชักของกะนี้ เพราะชำระออนไลน์ไว้แล้ว)
    for (const p of r.payments.filter(p => p.kind === 'deposit')) {
      await tx.payment.create({
        data: {
          orderId: order.id,
          method: p.method || 'qr',
          amount: p.amount,
          refNo: p.refNo,
          paidAt: p.paidAt,
        },
      })
    }

    if (balance > 0) {
      await tx.payment.create({
        data: { orderId: order.id, method, amount: balance, refNo },
      })

      await tx.reservationPayment.create({
        data: {
          reservationId: r.id,
          kind: 'balance',
          method,
          amount: balance,
          refNo,
        },
      })
    }

    // ออเดอร์ใช้โทเคนเดียวกับการจอง: /receipt/:token ค้นออเดอร์ก่อนเสมอ ลูกค้าจึงเห็นใบเสร็จฉบับเต็มจากลิงก์เดิม
    await tx.reservation.update({
      where: { id: r.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        orderId: order.id,
      },
    })

    return { orderId: order.id, receiptNo, total, deposit: paidDeposit, balance }
  })

  res.json(result)
})

router.post('/reservations/:id/cancel', async (req, res) => {
  const id = Number(req.params.id)
  const reason = String(req.body.reason || '').trim().slice(0, 255)
  const refundDeposit = Boolean(req.body.refundDeposit)

  if (!reason) {
    throw new HttpError(400, 'กรุณาระบุเหตุผลที่ยกเลิก')
  }

  const out = await prisma.$transaction(async tx => {
    const r = await loadActiveReservation(tx, id)

    const deposit = r.payments
      .filter(p => p.kind === 'deposit')
      .reduce((s, p) => s + num(p.amount), 0)

    // การคืนเงินจริงต้องทำนอกระบบ (โอนคืน) — ระบบบันทึกรายการไว้เพื่อให้บัญชีตรงกัน
    if (refundDeposit && deposit > 0) {
      await tx.reservationPayment.create({
        data: {
          reservationId: r.id,
          kind: 'refund',
          method: 'transfer',
          amount: deposit,
          refNo: req.body.refNo ? String(req.body.refNo).slice(0, 100) : null,
        },
      })
    }

    await tx.reservation.update({
      where: { id: r.id },
      data: { status: 'cancelled', cancelReason: reason },
    })

    return { id: r.id, status: 'cancelled', deposit, refunded: refundDeposit ? deposit : 0 }
  })

  res.json(out)
})


router.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }

  console.error('CUSTOMER ORDERS API error:', err)

  res.status(500).json({ error: err.message || 'ระบบขัดข้อง' })
})

module.exports = router
