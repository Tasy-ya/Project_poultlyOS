const express = require('express')
const prisma = require('../db')
const { HttpError } = require('../lib/errors')
const payments = require('../lib/payments')
const { rateLimit } = require('../lib/rateLimit')
const {
  cleanPhone,
  cleanName,
  cleanLocalId,
  newToken,
  buildLines,
  sumLines,
  lockBranch,
  nextReceiptNo,
  cutStock,
  supportsHalf,
} = require('../lib/orderCore')

// =====================================================
// API สำหรับลูกค้า (ไม่ต้องล็อกอิน) — mount ที่ /api/public
//
//   GET  /config                 ค่าที่หน้าเว็บลูกค้าต้องใช้ (มัดจำกี่ %, เวลารับของ ฯลฯ)
//   GET  /branches               สาขาที่เปิดให้บริการ
//   GET  /menus?branchId=        สินค้า + จำนวนที่สั่งได้ของสาขา
//   POST /orders                 สั่งซื้อเลย: ชำระเต็มจำนวน -> ได้ใบเสร็จอิเล็กทรอนิกส์ทันที
//   POST /reservations           จองล่วงหน้า: ชำระมัดจำ -> ได้ใบรับเงินมัดจำ
//   GET  /receipt/:token         ใบเสร็จ/สถานะ (ออเดอร์ หรือ การจอง) ด้วยลิงก์ส่วนตัวของลูกค้า
// =====================================================

const router = express.Router()

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'ส่งคำสั่งซื้อบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
})

const num = v => Number(v || 0)

function settings() {
  return {
    paymentMode: payments.mode(),
    depositPercent: num(process.env.DEPOSIT_PERCENT || 30),
    minLeadHours: num(process.env.RESERVE_MIN_LEAD_HOURS || 3),
    maxDaysAhead: num(process.env.RESERVE_MAX_DAYS || 14),
    openHour: num(process.env.SHOP_OPEN_HOUR || 8),
    closeHour: num(process.env.SHOP_CLOSE_HOUR || 20),
    promptPayId: String(process.env.PROMPTPAY_ID || '').trim(),
    deliveryMinItems: num(process.env.DELIVERY_MIN_ITEMS || 5),
    deliveryFee: num(process.env.DELIVERY_FEE || 30),
  }
}

// มัดจำ = % ของยอดรวม ปัดขึ้นเป็นหลัก 10 บาท ไม่เกินยอดรวม
function depositFor(total, percent) {
  const raw = Math.ceil((total * percent) / 100 / 10) * 10
  return Math.min(total, Math.max(raw, 0))
}

function bangkokHour(date) {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: 'numeric',
      hour12: false,
    }).format(date)
  ) % 24
}

function validatePickup(raw, cfg) {
  const pickup = new Date(raw)

  if (Number.isNaN(pickup.getTime())) {
    throw new HttpError(400, 'วันและเวลารับสินค้าไม่ถูกต้อง')
  }

  const now = Date.now()

  if (pickup.getTime() < now + cfg.minLeadHours * 3600 * 1000) {
    throw new HttpError(
      400,
      `ต้องจองล่วงหน้าอย่างน้อย ${cfg.minLeadHours} ชั่วโมง`
    )
  }

  if (pickup.getTime() > now + cfg.maxDaysAhead * 24 * 3600 * 1000) {
    throw new HttpError(400, `จองล่วงหน้าได้ไม่เกิน ${cfg.maxDaysAhead} วัน`)
  }

  const hour = bangkokHour(pickup)

  if (hour < cfg.openHour || hour >= cfg.closeHour) {
    throw new HttpError(
      400,
      `รับสินค้าได้ระหว่างเวลา ${cfg.openHour}:00 - ${cfg.closeHour}:00 น.`
    )
  }

  return pickup
}

async function requireOpenBranch(tx, branchId) {
  const id = Number(branchId)

  if (!Number.isInteger(id)) {
    throw new HttpError(400, 'กรุณาเลือกสาขา')
  }

  const branch = await tx.branch.findUnique({ where: { id } })

  if (!branch || !branch.isActive) {
    throw new HttpError(400, 'สาขานี้ไม่เปิดให้บริการ')
  }

  return branch
}


// =====================================================
// GET /config
// =====================================================

router.get('/config', (req, res) => {
  res.json(settings())
})



// GET /promotions?branchId= — โปรโมชั่นที่เปิดใช้งานจากระบบแอดมิน
router.get('/promotions', async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null
  const today = new Date()
  const rows = await prisma.promotion.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: today } }] },
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        ...(branchId ? [{ OR: [{ branchId: null }, { branchId }] }] : []),
      ],
    },
    orderBy: { id: 'desc' },
  })
  res.json(rows.map(p => ({ id: p.id, name: p.name, type: p.type, value: p.value == null ? null : num(p.value), minOrderAmount: num(p.minOrderAmount), startDate: p.startDate, endDate: p.endDate })))
})

// =====================================================
// GET /branches
// =====================================================

router.get('/branches', async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      address: true,
      province: true,
      phone: true,
    },
  })

  res.json(branches)
})


// =====================================================
// GET /menus?branchId=
// stockUnits = จำนวน "ครึ่งตัว" ที่เหลือ (สินค้าอื่น = จำนวนชิ้น)
// =====================================================

router.get('/menus', async (req, res) => {
  const branchId = Number(req.query.branchId)

  if (!Number.isInteger(branchId)) {
    throw new HttpError(400, 'กรุณาเลือกสาขา')
  }

  const rows = await prisma.branchStock.findMany({
    where: { branchId },
    include: { menu: true },
    orderBy: { menu: { name: 'asc' } },
  })

  res.json(
    rows
      .filter(r => r.menu)
      .map(r => ({
        menuId: r.menu.id,
        name: r.menu.name,
        category: r.menu.category,
        price: num(r.menu.price),
        hasHalfOption:
          Boolean(r.menu.hasHalfOption) || supportsHalf(r.menu.category),
        stockUnits: Math.max(num(r.qty), 0),
      }))
  )
})


// =====================================================
// POST /orders  — สั่งซื้อเลย (ชำระเต็มจำนวน)
// body: { branchId, items:[{menuId,size,qty}], customerName, customerPhone, localId }
// =====================================================

function orderResponse(order) {
  return {
    receiptToken: order.receiptToken,
    receiptNo: order.receiptNo,
    total: num(order.totalAmount),
    deliveryMethod: order.deliveryMethod || 'pickup',
    deliveryFee: num(order.deliveryFee),
    status: order.status,
  }
}

router.post('/orders', writeLimiter, async (req, res) => {
  const localId = cleanLocalId(req.body.localId)

  // ส่งซ้ำ (กดซ้ำ/เน็ตหลุด) -> ตอบออเดอร์เดิม ไม่ตัดเงิน/สต็อกซ้ำ
  if (localId) {
    const existing = await prisma.order.findFirst({ where: { localId } })

    if (existing) {
      return res.json({ ...orderResponse(existing), duplicate: true })
    }
  }

  const customerName = cleanName(req.body.customerName)
  const customerPhone = cleanPhone(req.body.customerPhone)
  const deliveryMethod = req.body.deliveryMethod === 'delivery' ? 'delivery' : 'pickup'
  const deliveryAddress = String(req.body.deliveryAddress || '').trim().slice(0, 500) || null
  const deliveryLat = Number.isFinite(Number(req.body.deliveryLat)) ? Number(req.body.deliveryLat) : null
  const deliveryLng = Number.isFinite(Number(req.body.deliveryLng)) ? Number(req.body.deliveryLng) : null

  if (deliveryMethod === 'delivery' && !deliveryAddress) {
    throw new HttpError(400, 'กรุณาระบุที่อยู่จัดส่ง')
  }

  try {
    const order = await prisma.$transaction(async tx => {
      const branch = await requireOpenBranch(tx, req.body.branchId)

      await lockBranch(tx, branch.id)

      const lines = await buildLines(tx, req.body.items)
      const subtotal = sumLines(lines)
      let deliveryFee = 0
      if (deliveryMethod === 'delivery') {
        const quantity = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
        const minItems = settings().deliveryMinItems
        if (quantity < minItems) throw new HttpError(400, `การจัดส่งต้องสั่งอย่างน้อย ${minItems} ชิ้น`)
        const priorOrder = customerPhone ? await tx.order.findFirst({ where: { customerPhone, orderChannel: { in: ['online', 'reservation'] } }, select: { id: true } }) : null
        deliveryFee = priorOrder ? settings().deliveryFee : 0
      }
      const total = subtotal + deliveryFee
      const receiptNo = await nextReceiptNo(tx, branch.id)

      const created = await tx.order.create({
        data: {
          branchId: branch.id,
          staffId: null,
          receiptNo,
          subtotalAmount: subtotal,
          discountAmount: 0,
          totalAmount: total,
          deliveryMethod,
          deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
          deliveryLat: deliveryMethod === 'delivery' ? deliveryLat : null,
          deliveryLng: deliveryMethod === 'delivery' ? deliveryLng : null,
          deliveryFee,
          status: 'pending_payment',
          orderChannel: 'online',
          fulfillmentStatus: 'new',
          customerName,
          customerPhone,
          receiptToken: newToken(),
          localId,
        },
      })

      for (const l of lines) {
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            menuId: l.menuId,
            size: l.size,
            qty: l.qty,
            unitPrice: l.unitPrice,
            lineTotal: l.lineTotal,
          },
        })
      }

      // สำคัญ: ยังไม่บันทึก Payment และยังไม่ตัดสต็อก
      // ลูกค้าต้องโอนจริงก่อน แล้วแอดมินตรวจรายการเดินบัญชีและกดยืนยันในระบบ
      return created
    })

    res.status(201).json(orderResponse(order))
  } catch (err) {
    if (err.code === 'P2002' && localId) {
      const existing = await prisma.order.findFirst({ where: { localId } })

      if (existing) {
        return res.json({ ...orderResponse(existing), duplicate: true })
      }
    }

    throw err
  }
})


// =====================================================
// POST /reservations  — จองล่วงหน้า (ชำระมัดจำ)
// body: { branchId, items, customerName, customerPhone, pickupAt, note, localId }
//
// - ยังไม่ตัดสต็อกตอนจอง (ตัดตอนลูกค้ามารับของและชำระส่วนที่เหลือ ที่ POS)
// - ยอดมัดจำคำนวณที่เซิร์ฟเวอร์เสมอ
// =====================================================

function reservationResponse(r) {
  return {
    receiptToken: r.receiptToken,
    status: r.status,
    total: num(r.totalAmount),
    deposit: num(r.depositAmount),
    balance: Math.max(num(r.totalAmount) - num(r.depositAmount), 0),
    pickupAt: r.pickupDatetime,
  }
}

router.post('/reservations', writeLimiter, async (req, res) => {
  const cfg = settings()
  const localId = cleanLocalId(req.body.localId)

  if (localId) {
    const existing = await prisma.reservation.findFirst({ where: { localId } })

    if (existing) {
      return res.json({ ...reservationResponse(existing), duplicate: true })
    }
  }

  const customerName = cleanName(req.body.customerName)
  const customerPhone = cleanPhone(req.body.customerPhone)
  const pickup = validatePickup(req.body.pickupAt, cfg)
  const note = String(req.body.note || '').trim().slice(0, 255) || null

  try {
    const reservation = await prisma.$transaction(async tx => {
      const branch = await requireOpenBranch(tx, req.body.branchId)
      const lines = await buildLines(tx, req.body.items)
      const total = sumLines(lines)
      const deposit = depositFor(total, cfg.depositPercent)

      if (!(deposit > 0)) {
        throw new HttpError(400, 'ยอดสั่งจองไม่ถูกต้อง')
      }

      const created = await tx.reservation.create({
        data: {
          branchId: branch.id,
          customerName,
          phone: customerPhone,
          pickupDatetime: pickup,
          depositAmount: deposit,
          totalAmount: total,
          status: 'confirmed',
          note,
          receiptToken: newToken(),
          localId,
          items: {
            create: lines.map(l => ({
              menuId: l.menuId,
              size: l.size,
              qty: l.qty,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
      })

      // ชำระมัดจำ — ไม่สำเร็จจะ throw แล้วไม่สร้างการจอง
      const paid = await payments.charge({
        amount: deposit,
        method: 'qr',
        description: `มัดจำการจอง #${created.id}`,
      })

      await tx.reservationPayment.create({
        data: {
          reservationId: created.id,
          kind: 'deposit',
          method: 'qr',
          amount: deposit,
          refNo: paid.ref,
        },
      })

      return created
    })

    res.status(201).json(reservationResponse(reservation))
  } catch (err) {
    if (err.code === 'P2002' && localId) {
      const existing = await prisma.reservation.findFirst({ where: { localId } })

      if (existing) {
        return res.json({ ...reservationResponse(existing), duplicate: true })
      }
    }

    throw err
  }
})


// =====================================================
// GET /receipt/:token
// ใบเสร็จอิเล็กทรอนิกส์ + สถานะ ด้วยลิงก์ส่วนตัว (โทเคนสุ่ม 128 บิต เดาไม่ได้)
// =====================================================

const itemView = i => ({
  name: i.menu ? i.menu.name : '-',
  size: i.size,
  qty: i.qty,
  unitPrice: num(i.unitPrice),
  lineTotal: num(i.lineTotal),
})

async function shopHeader(branchId) {
  const [shop, branch] = await Promise.all([
    prisma.shopSetting.findFirst(),
    prisma.branch.findUnique({ where: { id: Number(branchId) } }),
  ])

  return {
    shop: shop
      ? { name: shop.shopName, address: shop.address, taxId: shop.taxId }
      : { name: 'PoultryOS' },
    branch: branch
      ? { name: branch.name, address: branch.address, phone: branch.phone }
      : null,
  }
}

router.get('/receipt/:token', async (req, res) => {
  const token = String(req.params.token || '')

  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new HttpError(404, 'ไม่พบใบเสร็จ')
  }

  // 1) ออเดอร์ (สั่งซื้อเลย หรือการจองที่รับสินค้าแล้ว — ใช้โทเคนเดียวกัน)
  const order = await prisma.order.findUnique({
    where: { receiptToken: token },
    include: {
      items: { include: { menu: true } },
      payments: { orderBy: { paidAt: 'asc' } },
    },
  })

  if (order) {
    return res.json({
      type: 'order',
      ...(await shopHeader(order.branchId)),
      receiptNo: order.receiptNo,
      createdAt: order.createdAt,
      channel: order.orderChannel,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      deliveryMethod: order.deliveryMethod || 'pickup',
      deliveryAddress: order.deliveryAddress || null,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryFee: num(order.deliveryFee),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: order.items.map(itemView),
      subtotal: num(order.subtotalAmount),
      discount: num(order.discountAmount),
      total: num(order.totalAmount),
      payments: order.payments.map(p => ({
        method: p.method,
        amount: num(p.amount),
        refNo: p.refNo,
        paidAt: p.paidAt,
      })),
    })
  }

  // 2) การจองที่ยังไม่รับสินค้า / ยกเลิก
  const r = await prisma.reservation.findUnique({
    where: { receiptToken: token },
    include: {
      items: { include: { menu: true } },
      payments: { orderBy: { paidAt: 'asc' } },
    },
  })

  if (!r) {
    throw new HttpError(404, 'ไม่พบใบเสร็จ')
  }

  const paidTotal = r.payments
    .filter(p => p.kind !== 'refund')
    .reduce((s, p) => s + num(p.amount), 0)

  const refunded = r.payments
    .filter(p => p.kind === 'refund')
    .reduce((s, p) => s + num(p.amount), 0)

  res.json({
    type: 'reservation',
    ...(await shopHeader(r.branchId)),
    reservationNo: `R${String(r.id).padStart(5, '0')}`,
    createdAt: r.createdAt,
    status: r.status,
    cancelReason: r.cancelReason,
    pickupAt: r.pickupDatetime,
    customerName: r.customerName,
    customerPhone: r.phone,
    note: r.note,
    items: r.items.map(itemView),
    total: num(r.totalAmount),
    deposit: num(r.depositAmount),
    paid: paidTotal - refunded,
    balanceDue:
      r.status === 'cancelled'
        ? 0
        : Math.max(num(r.totalAmount) - (paidTotal - refunded), 0),
    refunded,
    payments: r.payments.map(p => ({
      kind: p.kind,
      method: p.method,
      amount: num(p.amount),
      refNo: p.refNo,
      paidAt: p.paidAt,
    })),
  })
})


// =====================================================
// Error handler ของ router นี้ — ไม่ส่งรายละเอียดภายในให้ลูกค้า
// =====================================================

router.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }

  console.error('PUBLIC API error:', err)

  res.status(500).json({
    error: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
  })
})

module.exports = router
