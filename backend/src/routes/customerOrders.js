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
} = require('../lib/orderCore')

// =====================================================
// ฝั่งพนักงาน (ฝ่ายขาย/แอดมิน) — mount ที่ /api/customer
//
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


// =====================================================
// ออเดอร์ที่ลูกค้าสั่งเอง
// =====================================================

router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      ...branchFilter(req),
      orderChannel: 'online',
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
        r.items.map(i => ({ menuId: i.menuId, size: i.size, qty: i.qty }))
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
