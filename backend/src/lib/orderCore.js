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

module.exports = {
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
}
