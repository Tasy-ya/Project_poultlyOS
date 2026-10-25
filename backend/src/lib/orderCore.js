const crypto = require('crypto')
const { HttpError } = require('./errors')

// =====================================================
// ตรรกะร่วมของ "ลูกค้าสั่งเอง" และ "จองล่วงหน้า"
// ใช้กฎเดียวกับ POS เดิม (routes/orders.js):
//   - เป็ด/ไก่ ขายครึ่งตัวได้ ครึ่งตัว = ราคา 1/2 ของเต็มตัว
//   - สต็อกนับเป็น "ครึ่งตัว": เต็มตัวตัด 2 หน่วย, ครึ่งตัวตัด 1 หน่วย, สินค้าอื่นตัด 1 หน่วย
// =====================================================

const supportsHalf = category => category === 'duck' || category === 'chicken'

const PHONE_RE = /^0\d{8,9}$/

function cleanPhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!PHONE_RE.test(digits)) {
    throw new HttpError(400, 'เบอร์โทรศัพท์ไม่ถูกต้อง')
  }
  return digits
}

function cleanName(raw) {
  const name = String(raw || '').trim().slice(0, 100)
  if (name.length < 2) {
    throw new HttpError(400, 'กรุณากรอกชื่อลูกค้า')
  }
  return name
}

// หมายเหตุรายเมนู เช่น "เป็ดฉ่ำ ๆ" "ไก่แห้ง ๆ" (ไม่บังคับ ไม่เกิน 200 ตัวอักษร)
function cleanNote(raw) {
  const note = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)

  return note || null
}

function newToken() {
  return crypto.randomBytes(16).toString('hex')
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function cleanLocalId(raw) {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw.toLowerCase() : null
}

// คำนวณรายการสินค้า "จากราคาในฐานข้อมูล" เสมอ (ไม่เชื่อราคาที่ลูกค้าส่งมา)
async function buildLines(tx, items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    throw new HttpError(400, 'กรุณาเลือกสินค้าอย่างน้อย 1 รายการ')
  }

  const ids = [...new Set(items.map(i => Number(i && i.menuId)))]

  if (ids.some(id => !Number.isInteger(id))) {
    throw new HttpError(400, 'รายการสินค้าไม่ถูกต้อง')
  }

  const menus = await tx.menu.findMany({ where: { id: { in: ids } } })
  const byId = new Map(menus.map(m => [m.id, m]))

  return items.map(raw => {
    const menu = byId.get(Number(raw.menuId))

    if (!menu) {
      throw new HttpError(400, 'ไม่พบสินค้าที่เลือก')
    }

    const qty = Number(raw.qty)

    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new HttpError(400, `จำนวนของ "${menu.name}" ไม่ถูกต้อง`)
    }

    const hasHalf = Boolean(menu.hasHalfOption) || supportsHalf(menu.category)
    const size = raw.size === 'half' && hasHalf ? 'half' : 'full'
    const price = Number(menu.price)
    const unitPrice = size === 'half' ? price / 2 : price

    return {
      menuId: menu.id,
      name: menu.name,
      size,
      qty,
      unitPrice,
      lineTotal: unitPrice * qty,
      note: cleanNote(raw.note),
      stockUnits: size === 'half' ? qty : qty * (hasHalf ? 2 : 1),
    }
  })
}

const sumLines = lines => lines.reduce((s, l) => s + l.lineTotal, 0)

// ล็อกต่อสาขา กันเลขที่ใบเสร็จซ้ำเมื่อมีหลายออเดอร์พร้อมกัน (หน้าร้าน + ออนไลน์)
async function lockBranch(tx, branchId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${Number(branchId)})`
}

// เลขที่ใบเสร็จรูปแบบเดียวกับ POS: B{สาขา}-{YYYYMMDD}-{ลำดับ}
async function nextReceiptNo(tx, branchId) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const count = await tx.order.count({
    where: { branchId: Number(branchId), createdAt: { gte: start } },
  })

  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}${String(now.getDate()).padStart(2, '0')}`

  return `B${branchId}-${datePart}-${String(count + 1).padStart(4, '0')}`
}

// ตัดสต็อกแบบป้องกันติดลบ (เงื่อนไข qty >= ที่ต้องใช้ ในคำสั่งเดียว)
async function cutStock(tx, { branchId, lines, orderId, receiptNo, staffId, label }) {
  for (const l of lines) {
    const r = await tx.branchStock.updateMany({
      where: {
        branchId: Number(branchId),
        menuId: l.menuId,
        qty: { gte: l.stockUnits },
      },
      data: { qty: { decrement: l.stockUnits } },
    })

    if (r.count === 0) {
      throw new HttpError(409, `ขออภัย "${l.name}" เหลือไม่พอสำหรับจำนวนที่เลือก`)
    }

    await tx.stockLog.create({
      data: {
        branchId: Number(branchId),
        menuId: l.menuId,
        type: 'out',
        qty: l.stockUnits,
        note: `${label} ${receiptNo} (${l.qty} ${l.size})`,
        staffId: staffId || null,
        orderId,
      },
    })
  }
}

// ตรวจสต็อกก่อนรับออเดอร์ออนไลน์ (ไม่ตัดสต็อก — ตัดตอนพนักงานยืนยันสลิป)
// รวมหน่วยของเมนูเดียวกันทุกบรรทัดก่อนเทียบ เช่น เป็ดเต็มตัว + เป็ดครึ่งตัว
const stockLabel = (hasHalf, units) => {
  const u = Math.max(0, Math.floor(units))
  if (!hasHalf) return `${u} ชิ้น`
  const whole = Math.floor(u / 2)
  const half = u % 2
  if (whole > 0 && half) return `${whole} ตัว กับอีกครึ่งตัว`
  if (whole > 0) return `${whole} ตัว`
  return half ? 'ครึ่งตัว' : '0'
}

async function assertStockEnough(tx, branchId, lines) {
  const need = new Map()

  for (const l of lines) {
    const cur = need.get(l.menuId) || { name: l.name, units: 0, hasHalf: false }
    cur.units += l.stockUnits
    cur.hasHalf = cur.hasHalf || l.size === 'half' || l.stockUnits === l.qty * 2
    need.set(l.menuId, cur)
  }

  const rows = await tx.branchStock.findMany({
    where: { branchId: Number(branchId), menuId: { in: [...need.keys()] } },
  })

  const have = new Map(rows.map(r => [r.menuId, Number(r.qty || 0)]))

  for (const [menuId, n] of need) {
    const left = have.get(menuId) || 0

    if (left < n.units) {
      throw new HttpError(
        409,
        left <= 0
          ? `ขออภัย "${n.name}" หมดแล้ว กรุณานำออกจากตะกร้า`
          : `ขออภัย "${n.name}" เหลือเพียง ${stockLabel(n.hasHalf, left)} กรุณาลดจำนวน`
      )
    }
  }
}

// ยืนยันว่าออเดอร์ออนไลน์ชำระเงินแล้ว (ใช้ร่วมกันระหว่างพนักงานขายและแอดมิน)
//   ตัดสต็อก + บันทึกรับเงิน + เปลี่ยนเป็น completed/new เพื่อให้พนักงานเริ่มเตรียมของได้ทันที
async function confirmOnlineOrder(tx, orderId, { staffId, reference, label, requireSlip = false }) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { menu: true } } },
  })

  if (!order || order.orderChannel !== 'online') throw new HttpError(404, 'ไม่พบออเดอร์ออนไลน์')

  if (order.status !== 'pending_payment') {
    throw new HttpError(409, 'ออเดอร์นี้ไม่ได้อยู่ในสถานะรอตรวจสอบการชำระ')
  }

  if (requireSlip && !order.slipUrl) {
    throw new HttpError(409, 'ลูกค้ายังไม่ได้แนบสลิปโอนเงิน')
  }

  if (!order.branchId) throw new HttpError(400, 'ออเดอร์ไม่มีข้อมูลสาขา')

  await lockBranch(tx, order.branchId)

  const lines = order.items.map(i => {
    const halfOption = Boolean(i.menu?.hasHalfOption) || supportsHalf(i.menu?.category)
    const size = i.size === 'half' && halfOption ? 'half' : 'full'
    const qty = Number(i.qty)

    return {
      menuId: Number(i.menuId),
      name: i.menu?.name || 'สินค้า',
      qty,
      size,
      stockUnits: size === 'half' ? qty : qty * (halfOption ? 2 : 1),
    }
  })

  await cutStock(tx, {
    branchId: order.branchId,
    lines,
    orderId: order.id,
    receiptNo: order.receiptNo,
    staffId,
    label,
  })

  await tx.payment.create({
    data: { orderId: order.id, method: 'qr', amount: order.totalAmount, refNo: reference },
  })

  return tx.order.update({
    where: { id: order.id },
    data: { status: 'completed', fulfillmentStatus: 'new' },
  })
}

module.exports = {
  confirmOnlineOrder,
  cleanNote,
  supportsHalf,
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
}
