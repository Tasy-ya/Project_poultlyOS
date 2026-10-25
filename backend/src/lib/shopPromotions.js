// =====================================================
// โปรโมชั่นที่แอดมินสร้าง (shop_promotions)
// เก็บข้อมูลทั้งก้อนจากหน้าแอดมินไว้ใน data (JSON) แล้วใช้ตารางเดียวกันให้
//   - แอดมิน  : GET/POST/PUT/DELETE /api/admin/promotions
//   - พนักงาน : GET /api/promotions/active?branchId=
//   - ลูกค้า  : GET /api/public/promotions?branchId=
// branchId ว่าง = ใช้กับทุกสาขา (หน้าแอดมินสร้างเป็น "ทุกสาขา")
// =====================================================

const { bangkokDateStr } = require('./closures')

let warned = false

function tableMissing(err) {
  return err && err.code === 'P2021'
}

function warnOnce() {
  if (!warned) {
    console.warn('[promotions] ยังไม่มีตาราง shop_promotions — รัน backend/prisma/upgrade_round13_promotions.sql ใน pgAdmin แล้ว npx prisma generate')
  }
  warned = true
}

// แถวจากฐานข้อมูล -> รูปแบบที่หน้าแอดมินใช้
function toAdminView(row) {
  const data = row.data && typeof row.data === 'object' ? row.data : {}

  return {
    ...data,
    id: row.id,
    branchId: row.branchId,
    isActive: data.isActive ?? data.is_active ?? true,
  }
}

// ล้างข้อมูลที่รับจากหน้าแอดมินก่อนบันทึก
function cleanPayload(body) {
  const { id, branchId, createdAt, updatedAt, ...rest } = body || {}
  const isActive = rest.isActive ?? rest.is_active ?? true

  return { ...rest, isActive: Boolean(isActive), is_active: Boolean(isActive) }
}

// โปรโมชั่นที่ "กำลังใช้งานวันนี้" ตามเวลาไทย
function isLiveToday(promo, today) {
  if (!promo.isActive) return false
  if (promo.startDate && promo.startDate > today) return false
  if (promo.endDate && promo.endDate < today) return false
  return true
}

// audience: 'staff' | 'customer'
async function livePromotions(db, branchId, audience) {
  if (!db.shopPromotion) {
    warnOnce()
    return []
  }

  const id = Number(branchId)
  const where = Number.isInteger(id) && id > 0
    ? { OR: [{ branchId: null }, { branchId: id }] }
    : {}

  let rows
  try {
    rows = await db.shopPromotion.findMany({ where, orderBy: { id: 'desc' } })
  } catch (err) {
    if (tableMissing(err)) {
      warnOnce()
      return []
    }
    throw err
  }

  const today = bangkokDateStr()

  return rows
    .map(toAdminView)
    .filter(p => isLiveToday(p, today))
    .filter(p => (audience === 'staff' ? p.showToStaff !== false : p.showToCustomer !== false))
}

// จำนวนขั้นต่ำของโปรโมชั่น: ใช้ช่อง "ซื้อตั้งแต่ (ตัว)" ก่อน
// ถ้าว่าง ให้อ่านจากข้อความในโปร เช่น "20ตัวขึ้นไป" (จุดเดียวที่ใช้ทั้งพนักงาน ลูกค้า และ backend)
function minQtyOf(promo) {
  const pricing = (promo && promo.pricing) || {}
  const fromField = Number(pricing.minQty || 0)
  if (fromField > 0) return fromField
  const text = `${promo?.title || promo?.name || ''} ${promo?.summary || ''} ${promo?.description || ''}`
  const m = text.match(/(\d+)\s*(?:ตัว|ชิ้น|รายการ)\s*(?:ขึ้นไป|ขึ้น|อย่างน้อย)/)
  return m ? Number(m[1]) : 0
}

// รูปแบบสำหรับหน้าลูกค้า/พนักงาน (ชื่อฟิลด์ name/description เหมือนเดิมที่ ShopHome ใช้)
function toPublicView(p) {
  const g = p.giveaway || {}
  const pr = p.pricing || {}
  let summary = p.summary || ''

  if (!summary && p.type === 'giveaway' && g.prizeCount) {
    summary = `แจก ${g.prizeCount} รางวัล คนละ ${g.prizePerPerson || 1} ตัว`
  }
  if (!summary && p.type === 'bulk' && pr.minQty) {
    summary = `ซื้อ ${pr.minQty} ตัวขึ้นไป รับราคาพิเศษ`
  }

  return {
    id: p.id,
    name: p.title || p.name || 'โปรโมชั่น',
    type: p.type || 'other',
    description: p.description || summary || '',
    summary,
    startDate: p.startDate || null,
    endDate: p.endDate || null,
    minOrderAmount: 0,
    productName: p.productName || null,
    giveaway: p.type === 'giveaway' ? g : null,
    pricing: p.type !== 'giveaway' ? { ...pr, minQty: minQtyOf(p) || pr.minQty || '' } : null,
    branchId: p.branchId,
  }
}

module.exports = { minQtyOf, toAdminView, cleanPayload, livePromotions, toPublicView, tableMissing, warnOnce }
