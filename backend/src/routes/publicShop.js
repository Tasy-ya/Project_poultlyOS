const express = require('express')
const { Prisma } = require('@prisma/client')
const prisma = require('../db')
const { HttpError } = require('../lib/errors')
const { livePromotions, toPublicView, minQtyOf } = require('../lib/shopPromotions')
const payments = require('../lib/payments')
const { rateLimit } = require('../lib/rateLimit')
const slips = require('../lib/slips')
const slipAI = require('../lib/slipAI')
const {
  bangkokDateStr,
  closuresFor,
  closureOn,
  closedDatesAhead,
} = require('../lib/closures')
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
  assertStockEnough,
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
//   GET  /closures?branchId=     วันหยุดร้าน (วันนี้หยุดไหม + วันหยุดล่วงหน้า) — วันหยุดสั่งซื้อเลยไม่ได้ จองวันหยุดไม่ได้
//   GET  /receipt/:token         ใบเสร็จ/สถานะ (ออเดอร์ หรือ การจอง) ด้วยลิงก์ส่วนตัวของลูกค้า
// =====================================================

const router = express.Router()

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'ส่งคำสั่งซื้อบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
})

const num = v => Number(v || 0)

// อ่านค่าจาก .env (ตัดช่องว่าง/CR) — รองรับชื่อ VITE_* ที่เคยใส่ไว้ใน backend/.env
function envText(...names) {
  for (const name of names) {
    const v = String(process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

function settings() {
  return {
    paymentMode: payments.mode(),
    depositPercent: num(process.env.DEPOSIT_PERCENT || 30),
    minLeadHours: num(process.env.RESERVE_MIN_LEAD_HOURS || 3),
    maxDaysAhead: num(process.env.RESERVE_MAX_DAYS || 14),
    openHour: num(process.env.SHOP_OPEN_HOUR || 8),
    closeHour: num(process.env.SHOP_CLOSE_HOUR || 20),
    promptPayId: envText('PROMPTPAY_ID', 'VITE_PROMPTPAY_ID').replace(/\D/g, ''),
    promptPayName: envText('PROMPTPAY_NAME', 'VITE_PROMPTPAY_NAME'),
    deliveryMinItems: num(envText('DELIVERY_MIN_ITEMS', 'VITE_DELIVERY_MIN_ITEMS') || 5),
    deliveryFee: num(envText('DELIVERY_FEE', 'VITE_DELIVERY_FEE') || 30),
    shopPhone: envText('SHOP_PHONE', 'VITE_SHOP_PHONE') || '0649093663',
    shopAddress: envText('SHOP_ADDRESS', 'VITE_SHOP_ADDRESS'),
    facebookUrl: envText('SHOP_FACEBOOK_URL', 'VITE_SHOP_FACEBOOK_URL'),
    facebookLiveUrl: envText('SHOP_FACEBOOK_LIVE_URL', 'VITE_SHOP_FACEBOOK_LIVE_URL'),
    // กุญแจ Google Maps (ฝั่งเบราว์เซอร์) สำหรับแผนที่ปักหมุดจุดส่งของ — ไม่ตั้ง = ใช้แผนที่ OpenStreetMap แทน
    googleMapsKey: envText('GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY'),
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

// ---------- วันหยุดร้าน ----------
const thaiDate = dateStr =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// สั่งซื้อเลย: ร้านต้องเปิดวันนี้ และถ้าระบุวันรับ วันรับต้องไม่ใช่วันหยุด
async function assertOpenForOrder(tx, branchId, pickupAt) {
  const rows = await closuresFor(tx, branchId)
  const today = bangkokDateStr()
  const hit = closureOn(rows, today)

  if (hit) {
    throw new HttpError(
      409,
      `ร้านหยุดทำการวันนี้ (${hit.reason}) สั่งซื้อเลยไม่ได้ — จองล่วงหน้าในวันที่ร้านเปิดได้`
    )
  }

  if (pickupAt) {
    const day = bangkokDateStr(pickupAt)
    const closed = closureOn(rows, day)

    if (closed) {
      throw new HttpError(
        400,
        `ร้านหยุดทำการ${thaiDate(day)} (${closed.reason}) กรุณาเลือกวันรับสินค้าอื่น`
      )
    }
  }
}

// จองล่วงหน้า: จองได้เฉพาะวันที่ร้านเปิด (จองตอนวันนี้ร้านหยุดได้ แต่วันรับต้องเป็นวันที่เปิด)
async function assertOpenOnPickup(tx, branchId, pickup) {
  const rows = await closuresFor(tx, branchId)
  const day = bangkokDateStr(pickup)
  const closed = closureOn(rows, day)

  if (closed) {
    throw new HttpError(
      400,
      `ร้านหยุดทำการ${thaiDate(day)} (${closed.reason}) จองวันหยุดไม่ได้ กรุณาเลือกวันรับสินค้าอื่น`
    )
  }
}


// =====================================================
// GET /config
// =====================================================

router.get('/config', (req, res) => {
  res.json(settings())
})


// =====================================================
// GET /closures?branchId=
// วันหยุดร้านสำหรับหน้าลูกค้า: วันนี้หยุดไหม + วันหยุดล่วงหน้า + วันหยุดประจำสัปดาห์
// =====================================================

router.get('/closures', async (req, res) => {
  const id = Number(req.query.branchId)

  if (!Number.isInteger(id)) {
    throw new HttpError(400, 'กรุณาเลือกสาขา')
  }

  const rows = await closuresFor(prisma, id)
  const today = bangkokDateStr()
  const hit = closureOn(rows, today)
  const cfg = settings()

  res.json({
    today,
    closedToday: Boolean(hit),
    reason: hit ? hit.reason : null,
    weeklyDays: [...new Set(rows.filter(r => r.kind === 'weekly').map(r => r.weekday))].sort(),
    // วันหยุดตั้งแต่วันนี้ไปอีก (จองล่วงหน้าไกลสุด + 1 เดือน) ใช้ปิดวันบนหน้าจอ
    dates: closedDatesAhead(rows, today, cfg.maxDaysAhead + 31),
  })
})



// GET /promotions?branchId= — โปรโมชั่นที่แอดมินสร้างและเปิดให้ลูกค้าเห็น (ตาราง shop_promotions)
router.get('/promotions', async (req, res) => {
  const rows = await livePromotions(prisma, req.query.branchId, 'customer')
  res.json(rows.map(toPublicView))
})


// =====================================================
// GET /health  (เฉพาะตอนพัฒนา — ปิดเองเมื่อ NODE_ENV=production)
// ตรวจว่า "ระบบสั่งซื้อ/QR พร้อมใช้ไหม" แล้วบอกว่าขาดอะไรและต้องแก้อย่างไร
//   เปิดในเบราว์เซอร์:  http://localhost:3001/api/public/health
// =====================================================

// ฟิลด์ที่โค้ดฝั่งลูกค้าต้องใช้ (ถ้า Prisma client ไม่รู้จัก แปลว่ายังไม่ได้ generate ใหม่)
const REQUIRED_FIELDS = {
  Order: [
    'customerName', 'customerPhone', 'receiptToken', 'fulfillmentStatus',
    'deliveryMethod', 'deliveryAddress', 'deliveryLat', 'deliveryLng', 'deliveryFee',
    'slipUrl', 'slipUploadedAt', 'slipHash', 'slipAi', 'slipAiAt', 'review', 'pickupAt', 'cancelReason',
  ],
  Reservation: ['totalAmount', 'receiptToken', 'cancelReason', 'completedAt', 'slipUrl', 'slipUploadedAt', 'slipHash', 'slipAi', 'slipAiAt', 'deliveryMethod', 'deliveryAddress', 'deliveryLat', 'deliveryLng', 'deliveryFee'],
  OrderItem: ['note'],
  ReservationItem: ['note'],
  OrderReview: ['orderId', 'rating', 'comment'],
}

router.get('/health', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError(404, 'ไม่พบหน้านี้')
  }

  const problems = []
  const cfg = settings()

  // 1) PromptPay ID ของร้าน (ใช้สร้าง QR ตามยอด)
  const id = cfg.promptPayId
  const idOk = (id.length === 10 && id.startsWith('0')) || id.length === 13 || id.length === 15

  if (!id) {
    problems.push({
      area: 'PromptPay',
      problem: 'ยังไม่ได้ตั้งค่า PROMPTPAY_ID',
      fix: 'ใส่ PROMPTPAY_ID=เบอร์พร้อมเพย์ 10 หลัก (หรือเลข 13 หลัก) ในไฟล์ backend/.env แล้วรีสตาร์ต backend',
    })
  } else if (!idOk) {
    problems.push({
      area: 'PromptPay',
      problem: `PROMPTPAY_ID ต้องเป็นเบอร์มือถือ 10 หลักขึ้นต้น 0 หรือเลข 13/15 หลัก (ตอนนี้ ${id.length} หลัก)`,
      fix: 'แก้ค่าใน backend/.env ให้เป็นตัวเลขล้วน ไม่ใส่ขีด แล้วรีสตาร์ต backend',
    })
  }

  // 2) Prisma client ต้องรู้จักฟิลด์ใหม่ (รัน npx prisma generate หลังแก้ schema)
  let models = []

  try {
    models = Prisma.dmmf.datamodel.models
  } catch {
    problems.push({
      area: 'Prisma client',
      problem: 'อ่านโครงสร้างจาก Prisma client ไม่ได้',
      fix: 'รัน npx prisma generate ในโฟลเดอร์ backend แล้วรีสตาร์ต backend',
    })
  }

  for (const [modelName, fields] of Object.entries(REQUIRED_FIELDS)) {
    const model = models.find(m => m.name === modelName)
    const known = new Set((model ? model.fields : []).map(f => f.name))
    const missing = fields.filter(f => !known.has(f))

    if (models.length && missing.length) {
      problems.push({
        area: 'Prisma client',
        problem: `Prisma client ยังไม่รู้จัก ${modelName}.${missing.join(', ')}`,
        fix: 'ตรวจว่า backend/prisma/schema.prisma เป็นฉบับล่าสุด แล้วรัน npx prisma generate และรีสตาร์ต backend (ปิด backend ก่อน generate)',
      })
    }
  }

  // 3) ฐานข้อมูลต้องมีตารางและคอลัมน์ครบตาม schema.prisma
  try {
    const rows = await prisma.$queryRaw`
      SELECT table_name::text AS table_name, column_name::text AS column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `

    const tables = new Set(rows.map(r => r.table_name))
    const columns = new Set(rows.map(r => `${r.table_name}.${r.column_name}`))
    const missingByTable = {}

    for (const model of models) {
      const table = model.dbName || model.name

      if (!tables.has(table)) {
        missingByTable[table] = ['(ทั้งตาราง)']
        continue
      }

      for (const field of model.fields) {
        if (field.kind !== 'scalar' && field.kind !== 'enum') continue

        const column = field.dbName || field.name

        if (!columns.has(`${table}.${column}`)) {
          ;(missingByTable[table] ||= []).push(column)
        }
      }
    }

    for (const [table, cols] of Object.entries(missingByTable)) {
      problems.push({
        area: 'ฐานข้อมูล',
        problem: `ตาราง ${table} ขาด: ${cols.join(', ')}`,
        fix: 'รันไฟล์ backend/prisma/upgrade_round8_slip_notes_reviews.sql, upgrade_round9_order_pickup_time.sql และ upgrade_round10_slip_ai.sql ใน pgAdmin (ฐานข้อมูลเดียวกับที่ backend ใช้) แล้วรัน npx prisma generate และรีสตาร์ต backend',
      })
    }
  } catch (err) {
    problems.push({
      area: 'ฐานข้อมูล',
      problem: `เชื่อมต่อ/ตรวจฐานข้อมูลไม่ได้: ${String(err.message).slice(0, 200)}`,
      fix: 'ตรวจ DATABASE_URL ใน backend/.env และว่า PostgreSQL กำลังรันอยู่',
    })
  }

  res.json({
    ok: problems.length === 0,
    summary: problems.length === 0
      ? 'พร้อมใช้งาน: สั่งซื้อและสร้าง QR PromptPay ตามยอดได้'
      : `พบ ${problems.length} เรื่องที่ต้องแก้`,
    slipAi: { configured: slipAI.enabled(), auto: String(process.env.AI_SLIP_AUTO || '').toLowerCase() === 'true' },
    promptPay: id
      ? { configured: true, valid: idOk, masked: id.length === 10 ? `${id.slice(0, 3)}-XXX-${id.slice(6)}` : `${'X'.repeat(Math.max(id.length - 3, 0))}${id.slice(-3)}` }
      : { configured: false },
    problems,
  })
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

async function isNewCustomer(db, phone) {
  if (!phone) return true

  const prior = await db.order.findFirst({
    where: {
      customerPhone: phone,
      orderChannel: { in: ['online', 'reservation'] },
      status: 'completed',
    },
    select: { id: true },
  })

  return !prior
}

// GET /customer-status?phone=  ลูกค้าใหม่ไหม (ใช้คำนวณค่าส่งให้ตรงกับที่เซิร์ฟเวอร์คิดจริง)
const statusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: 'ตรวจสอบบ่อยเกินไป กรุณารอสักครู่',
})

router.get('/customer-status', statusLimiter, async (req, res) => {
  const digits = String(req.query.phone || '').replace(/\D/g, '')

  if (!/^0\d{8,9}$/.test(digits)) {
    return res.json({ isNew: true })
  }

  res.json({ isNew: await isNewCustomer(prisma, digits) })
})

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

  // เวลาที่ลูกค้าต้องการรับ/ให้ส่ง (ไม่บังคับ — ไม่ระบุ = ให้ร้านเตรียมให้เร็วที่สุด)
  let pickupAt = null

  if (req.body.pickupAt) {
    const when = new Date(req.body.pickupAt)
    const cfgTime = settings()

    if (Number.isNaN(when.getTime())) {
      throw new HttpError(400, 'เวลาที่ต้องการรับสินค้าไม่ถูกต้อง')
    }

    if (when.getTime() < Date.now() - 5 * 60 * 1000) {
      throw new HttpError(400, 'เวลาที่ต้องการรับสินค้าผ่านไปแล้ว กรุณาเลือกเวลาใหม่')
    }

    if (when.getTime() > Date.now() + cfgTime.maxDaysAhead * 24 * 3600 * 1000) {
      throw new HttpError(400, `เลือกเวลาล่วงหน้าได้ไม่เกิน ${cfgTime.maxDaysAhead} วัน`)
    }

    pickupAt = when
  }

  try {
    const order = await prisma.$transaction(async tx => {
      const branch = await requireOpenBranch(tx, req.body.branchId)

      // วันหยุดร้าน: สั่งซื้อเลยไม่ได้ (ต้องจองล่วงหน้าในวันที่ร้านเปิด)
      await assertOpenForOrder(tx, branch.id, pickupAt)

      await lockBranch(tx, branch.id)

      const lines = await buildLines(tx, req.body.items)

      // สั่งซื้อเลยต้องมีของพร้อม: สต็อกหมด/ไม่พอ = สั่งไม่ได้ (ตรวจที่เซิร์ฟเวอร์ ไม่เชื่อหน้าเว็บอย่างเดียว)
      await assertStockEnough(tx, branch.id, lines)

      const subtotal = sumLines(lines)

      // ใช้โปรโมชั่นที่แอดมินสร้างจริงกับออเดอร์ออนไลน์ด้วย
      // คำนวณจากราคาสินค้าในฐานข้อมูล ไม่เชื่อยอดส่วนลดจากฝั่งเว็บลูกค้า
      let discountAmount = 0
      const promotions = await livePromotions(tx, branch.id, 'customer')
      for (const promo of promotions) {
        if (!['discount', 'bulk', 'vip', 'festival', 'other'].includes(String(promo.type || '').toLowerCase())) continue
        const pricing = promo.pricing || {}
        const productName = String(promo.productName || '').trim().toLocaleLowerCase('th')
        const eligible = productName
          ? lines.filter(line => String(line.name || '').trim().toLocaleLowerCase('th') === productName)
          : lines
        if (!eligible.length) continue

        const eligibleQty = eligible.reduce((sum, line) => sum + Number(line.qty || 0), 0)
        const minQty = minQtyOf(promo)
        if (minQty > 0 && eligibleQty < minQty) continue

        const value = Number(pricing.discountValue || 0)
        const eligibleSubtotal = eligible.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0)
        if (value <= 0 || eligibleSubtotal <= 0) continue

        if (pricing.discountType === 'percent') {
          discountAmount = Math.round(eligibleSubtotal * Math.min(value, 100) / 100 * 100) / 100
        } else if (pricing.discountType === 'baht') {
          discountAmount = Math.min(value, eligibleSubtotal)
        } else if (pricing.discountType === 'special_price') {
          const specialPrice = value
          discountAmount = eligible.reduce((sum, line) =>
            sum + Math.max(Number(line.unitPrice || 0) - specialPrice, 0) * Number(line.qty || 0), 0)
        }
        if (discountAmount > 0) break
      }

      let deliveryFee = 0
      if (deliveryMethod === 'delivery') {
        // ส่งฟรีเมื่อสั่งครบจำนวนที่ร้านกำหนด หรือเป็นลูกค้าใหม่ — นอกนั้นคิดค่าส่ง
        const quantity = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
        const cfg = settings()
        const free = quantity >= cfg.deliveryMinItems || (await isNewCustomer(tx, customerPhone))
        deliveryFee = free ? 0 : cfg.deliveryFee
      }
      const total = Math.max(0, subtotal - discountAmount) + deliveryFee
      const receiptNo = await nextReceiptNo(tx, branch.id)

      const created = await tx.order.create({
        data: {
          branchId: branch.id,
          staffId: null,
          receiptNo,
          subtotalAmount: subtotal,
          discountAmount,
          totalAmount: total,
          deliveryMethod,
          deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
          deliveryLat: deliveryMethod === 'delivery' ? deliveryLat : null,
          deliveryLng: deliveryMethod === 'delivery' ? deliveryLng : null,
          deliveryFee,
          ...(pickupAt ? { pickupAt } : {}),
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
            note: l.note,
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

  // วิธีรับสินค้า: รับที่ร้าน / ให้ส่ง (ใช้กติกาเดียวกับสั่งซื้อเลย)
  const deliveryMethod = req.body.deliveryMethod === 'delivery' ? 'delivery' : 'pickup'
  const deliveryAddress = String(req.body.deliveryAddress || '').trim().slice(0, 500) || null
  const deliveryLat = Number.isFinite(Number(req.body.deliveryLat)) ? Number(req.body.deliveryLat) : null
  const deliveryLng = Number.isFinite(Number(req.body.deliveryLng)) ? Number(req.body.deliveryLng) : null

  if (deliveryMethod === 'delivery' && !deliveryAddress) {
    throw new HttpError(400, 'กรุณาระบุที่อยู่จัดส่ง')
  }

  try {
    const reservation = await prisma.$transaction(async tx => {
      const branch = await requireOpenBranch(tx, req.body.branchId)

      // วันหยุดร้าน: จองวันรับสินค้าที่ร้านหยุดไม่ได้
      await assertOpenOnPickup(tx, branch.id, pickup)

      const lines = await buildLines(tx, req.body.items)

      // ค่าส่ง: ส่งฟรีเมื่อสั่งครบจำนวนที่ร้านกำหนด หรือเป็นลูกค้าใหม่ — นอกนั้นคิดค่าส่ง (คำนวณที่เซิร์ฟเวอร์)
      let deliveryFee = 0
      if (deliveryMethod === 'delivery') {
        const quantity = lines.reduce((sum, line) => sum + Number(line.qty || 0), 0)
        const free = quantity >= cfg.deliveryMinItems || (await isNewCustomer(tx, customerPhone))
        deliveryFee = free ? 0 : cfg.deliveryFee
      }

      const total = sumLines(lines) + deliveryFee
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
          status: 'pending_payment',
          note,
          deliveryMethod,
          deliveryAddress: deliveryMethod === 'delivery' ? deliveryAddress : null,
          deliveryLat: deliveryMethod === 'delivery' ? deliveryLat : null,
          deliveryLng: deliveryMethod === 'delivery' ? deliveryLng : null,
          deliveryFee,
          receiptToken: newToken(),
          localId,
          items: {
            create: lines.map(l => ({
              menuId: l.menuId,
              size: l.size,
              qty: l.qty,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
              note: l.note,
            })),
          },
        },
      })

      // สำคัญ: ยังไม่บันทึกการรับมัดจำ — ลูกค้าสแกน QR โอนจริงก่อน
      // แล้วแอดมินตรวจเงินเข้าบัญชีและกดยืนยัน (สถานะจึงเปลี่ยนเป็น confirmed)
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
  note: i.note || null,
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
      review: true,
    },
  })

  if (order) {
    return res.json({
      type: 'order',
      slipUploaded: Boolean(order.slipUrl),
      slipUploadedAt: order.slipUploadedAt,
      review: order.review
        ? { rating: order.review.rating, comment: order.review.comment, createdAt: order.review.createdAt }
        : null,
      canReview:
        !order.review &&
        order.status === 'completed' &&
        ['ready', 'picked_up'].includes(order.fulfillmentStatus || ''),
      ...(await shopHeader(order.branchId)),
      receiptNo: order.receiptNo,
      createdAt: order.createdAt,
      channel: order.orderChannel,
      status: order.status,
      cancelReason: order.cancelReason || null,
      fulfillmentStatus: order.fulfillmentStatus,
      deliveryMethod: order.deliveryMethod || 'pickup',
      deliveryAddress: order.deliveryAddress || null,
      deliveryLat: order.deliveryLat,
      deliveryLng: order.deliveryLng,
      deliveryFee: num(order.deliveryFee),
      pickupAt: order.pickupAt || null,
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
    slipUploaded: Boolean(r.slipUrl),
    slipUploadedAt: r.slipUploadedAt,
    ...(await shopHeader(r.branchId)),
    reservationNo: `R${String(r.id).padStart(5, '0')}`,
    createdAt: r.createdAt,
    status: r.status,
    cancelReason: r.cancelReason,
    pickupAt: r.pickupDatetime,
    customerName: r.customerName,
    customerPhone: r.phone,
    note: r.note,
    deliveryMethod: r.deliveryMethod || 'pickup',
    deliveryAddress: r.deliveryAddress || null,
    deliveryLat: r.deliveryLat,
    deliveryLng: r.deliveryLng,
    deliveryFee: num(r.deliveryFee),
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
// POST /receipt/:token/slip — ลูกค้าแนบสลิปโอนเงิน
// ส่งเป็นไฟล์รูปดิบ (Content-Type: image/jpeg | image/png | image/webp)
// ใช้ได้ทั้งออเดอร์และการจอง (มัดจำ) ที่ยังอยู่ในสถานะรอชำระ
// พอแนบแล้ว รายการจะขึ้นที่หน้ารับออเดอร์ของพนักงานขาย (และแอดมิน) ให้ตรวจสลิปทันที
// =====================================================

const slipLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'ส่งสลิปบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
})

// AI_SLIP_AUTO=true: ให้ AI ตรวจเองทันทีที่ลูกค้าแนบสลิป (พนักงานเปิดมาเห็นผลเลย) — ทำเบื้องหลัง ไม่ทำให้ลูกค้ารอ
// ค่าเริ่มต้นปิดไว้ เพราะการเรียก AI มีค่าใช้จ่ายต่อสลิป และหน้านี้เป็นสาธารณะ
function autoCheck(kind, id) {
  if (String(process.env.AI_SLIP_AUTO || '').toLowerCase() !== 'true' || !slipAI.enabled()) return

  slipAI.runCheck(kind, id).catch(err => console.error('[slipAI auto]', err.message))
}

const slipBody = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'],
  limit: '7mb',
})

router.post('/receipt/:token/slip', slipLimiter, slipBody, async (req, res) => {
  const token = String(req.params.token || '')

  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new HttpError(404, 'ไม่พบคำสั่งซื้อ')
  }

  const order = await prisma.order.findUnique({ where: { receiptToken: token } })

  if (order) {
    if (order.status !== 'pending_payment') {
      throw new HttpError(409, 'คำสั่งซื้อนี้ไม่ได้รอการชำระเงินแล้ว')
    }

    const name = slips.saveSlip(req.body)
    const old = order.slipUrl

    await prisma.order.update({
      where: { id: order.id },
      // เปลี่ยนสลิปใหม่ = ล้างผล AI เดิม (ผลเก่าเป็นของรูปเก่า)
      data: {
        slipUrl: name,
        slipUploadedAt: new Date(),
        slipHash: slips.sha256(req.body),
        slipAi: Prisma.DbNull,
        slipAiAt: null,
      },
    })

    if (old) slips.removeSlip(old)

    autoCheck('order', order.id)

    return res.json({ ok: true, slipUploaded: true })
  }

  const reservation = await prisma.reservation.findUnique({ where: { receiptToken: token } })

  if (!reservation) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ')

  if (reservation.status !== 'pending_payment') {
    throw new HttpError(409, 'การจองนี้ไม่ได้รอการชำระมัดจำแล้ว')
  }

  const name = slips.saveSlip(req.body)
  const old = reservation.slipUrl

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      slipUrl: name,
      slipUploadedAt: new Date(),
      slipHash: slips.sha256(req.body),
      slipAi: Prisma.DbNull,
      slipAiAt: null,
    },
  })

  if (old) slips.removeSlip(old)

  autoCheck('reservation', reservation.id)

  res.json({ ok: true, slipUploaded: true })
})


// =====================================================
// POST /receipt/:token/review — ลูกค้ารีวิวหลังได้รับสินค้า (1 ออเดอร์ รีวิวได้ 1 ครั้ง)
// body: { rating: 1-5, comment }
// =====================================================

router.post('/receipt/:token/review', writeLimiter, async (req, res) => {
  const token = String(req.params.token || '')

  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new HttpError(404, 'ไม่พบคำสั่งซื้อ')
  }

  const rating = Number(req.body.rating)

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'กรุณาให้คะแนน 1-5 ดาว')
  }

  const comment = String(req.body.comment || '').replace(/\s+/g, ' ').trim().slice(0, 500) || null

  const order = await prisma.order.findUnique({
    where: { receiptToken: token },
    include: { review: true },
  })

  if (!order) throw new HttpError(404, 'ไม่พบคำสั่งซื้อ')

  if (order.review) throw new HttpError(409, 'ออเดอร์นี้รีวิวไปแล้ว ขอบคุณค่ะ')

  if (order.status !== 'completed' || !['ready', 'picked_up'].includes(order.fulfillmentStatus || '')) {
    throw new HttpError(409, 'รีวิวได้หลังร้านเตรียมสินค้าเสร็จแล้ว')
  }

  try {
    const created = await prisma.orderReview.create({
      data: {
        orderId: order.id,
        branchId: order.branchId,
        rating,
        comment,
        customerName: order.customerName,
      },
    })

    res.status(201).json({ ok: true, rating: created.rating, comment: created.comment })
  } catch (err) {
    if (err.code === 'P2002') throw new HttpError(409, 'ออเดอร์นี้รีวิวไปแล้ว ขอบคุณค่ะ')

    throw err
  }
})


// =====================================================
// GET /track?tokens=a,b,c — สถานะย่อของหลายออเดอร์ (หน้า "ออเดอร์ของฉัน")
// ลูกค้าเก็บลิงก์ส่วนตัว (token) ไว้ในเครื่องตัวเอง ส่งมาได้ไม่เกิน 10 รายการ
// =====================================================

router.get('/track', statusLimiter, async (req, res) => {
  const tokens = [...new Set(String(req.query.tokens || '').split(',').map(t => t.trim()))]
    .filter(t => /^[0-9a-f]{32}$/.test(t))
    .slice(0, 10)

  if (!tokens.length) return res.json([])

  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: { receiptToken: { in: tokens } },
      include: { items: { include: { menu: true } }, review: true },
    }),
    prisma.reservation.findMany({
      where: { receiptToken: { in: tokens } },
      include: { items: { include: { menu: true } } },
    }),
  ])

  const orderTokens = new Set(orders.map(o => o.receiptToken))

  const rows = [
    ...orders.map(o => ({
      token: o.receiptToken,
      type: 'order',
      no: o.receiptNo,
      createdAt: o.createdAt,
      status: o.status,
      fulfillmentStatus: o.fulfillmentStatus,
      slipUploaded: Boolean(o.slipUrl),
      deliveryMethod: o.deliveryMethod || 'pickup',
      total: num(o.totalAmount),
      itemsText: o.items.map(i => `${i.menu ? i.menu.name : '-'} × ${i.qty}`).join(', '),
      reviewed: Boolean(o.review),
    })),
    ...reservations
      .filter(r => !orderTokens.has(r.receiptToken))
      .map(r => ({
        token: r.receiptToken,
        type: 'reservation',
        no: `R${String(r.id).padStart(5, '0')}`,
        createdAt: r.createdAt,
        status: r.status,
        fulfillmentStatus: null,
        slipUploaded: Boolean(r.slipUrl),
        deliveryMethod: r.deliveryMethod || 'pickup',
        total: num(r.totalAmount),
        itemsText: r.items.map(i => `${i.menu ? i.menu.name : '-'} × ${i.qty}`).join(', '),
        reviewed: false,
      })),
  ]

  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  res.json(rows)
})


// =====================================================
// Error handler ของ router นี้ — ไม่ส่งรายละเอียดภายในให้ลูกค้าเมื่อเปิดใช้งานจริง
// ตอนพัฒนา (ไม่ได้ตั้ง NODE_ENV=production) จะแนบ detail บอกสาเหตุ/วิธีแก้ด้วย
// =====================================================

function explainError(err) {
  const msg = String((err && err.message) || '')

  if (err && (err.code === 'P2022' || /does not exist in the current database/i.test(msg))) {
    return 'ฐานข้อมูลยังไม่มีคอลัมน์ที่โค้ดใช้ → รัน backend/prisma/upgrade_round8_slip_notes_reviews.sql และ upgrade_round9_order_pickup_time.sql แล้วรัน npx prisma generate และรีสตาร์ต backend (เปิด /api/public/health เพื่อดูว่าขาดอะไร)'
  }

  if (err && err.code === 'P2021') {
    return 'ฐานข้อมูลยังไม่มีตารางที่โค้ดใช้ → รัน backend/prisma/upgrade_round8_slip_notes_reviews.sql และ upgrade_round9_order_pickup_time.sql แล้วรีสตาร์ต backend'
  }

  if (/Unknown (argument|field|arg)|Unknown_arg/i.test(msg)) {
    return 'Prisma client เก่ากว่า schema.prisma → ปิด backend แล้วรัน npx prisma generate จากนั้นเปิดใหม่'
  }

  return msg.split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300)
}

router.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message })
  }

  console.error('PUBLIC API error:', err)

  const dev = process.env.NODE_ENV !== 'production'

  res.status(500).json({
    error: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง',
    ...(dev ? { detail: explainError(err) } : {}),
  })
})

module.exports = router
