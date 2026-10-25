const express = require('express')
const prisma = require('../db')
const { requireAuth, requireDept } = require('../middleware/auth')
const {
  r3,
  isExpired,
  fefoCompare,
  receiveLot,
  consumeFEFO,
  moveLotStorage,
  syncStockToLots,
  STORAGES,
} = require('../lib/rawLots')

// =====================================================
// ล็อตวัตถุดิบ — mount ที่ /api/stock/lots (ฝ่ายสต็อก และ Admin)
//
//   GET  /:branchId/summary?days=3     สรุปรายวัตถุดิบ: ใช้ได้ / ใกล้หมดอายุ / หมดอายุ / ยอดไม่ตรง
//   GET  /:branchId?materialId=&status=active|all&category=
//                                       รายการล็อต เรียงตามลำดับที่ระบบจะเบิก (FEFO -> FIFO)
//   POST /waste      { lotId, qty?, reason }          ทิ้งของเสีย/หมดอายุ
//   POST /move       { lotId, to: 'frozen'|'thawed', qty? }  แช่แข็ง / ละลาย (แยกเป็นล็อตใหม่ คำนวณวันหมดอายุใหม่)
//   PUT  /material/:id { defaultStorage, chilledDays, frozenDays, thawedDays }  ตั้งอายุเก็บมาตรฐาน
//   POST /stocktake  { branchId, materialId, countedQty, note? }
//                                       ตรวจนับของจริง เทียบยอดระบบ บันทึกส่วนต่าง
//
// การรับเข้า (สร้างล็อต) ใช้ POST /api/stock/raw/receive เดิม
// ส่ง lotNo, expiresAt, supplier เพิ่มได้ (ไม่ส่ง = ระบบสร้างเลขล็อตให้)
// =====================================================

const router = express.Router()

router.use(requireAuth, requireDept('stock'))

const wrap = fn => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('[stockLots]', err)
    res.status(400).json({ error: err.message || 'เกิดข้อผิดพลาด' })
  }
}

const DAY = 24 * 3600 * 1000

function view(lot, now, soonDays, rank) {
  const expired = isExpired(lot, now)

  const daysLeft = lot.expiresAt
    ? Math.ceil((new Date(lot.expiresAt).getTime() - now.getTime()) / DAY)
    : null

  let state = 'no_expiry'

  if (lot.expiresAt) {
    state = expired ? 'expired' : daysLeft <= soonDays ? 'expiring' : 'ok'
  }

  return {
    id: lot.id,
    lotNo: lot.lotNo,
    materialId: lot.materialId,
    material: lot.material
      ? { id: lot.material.id, name: lot.material.name, unit: lot.material.unit, category: lot.material.category }
      : undefined,
    qtyReceived: Number(lot.qtyReceived),
    qtyRemaining: Number(lot.qtyRemaining),
    unitCost: lot.unitCost == null ? null : Number(lot.unitCost),
    supplier: lot.supplier,
    receivedAt: lot.receivedAt,
    expiresAt: lot.expiresAt,
    status: lot.status,
    note: lot.note,
    storage: lot.storage || 'ambient',
    frozenAt: lot.frozenAt || null,
    thawedAt: lot.thawedAt || null,
    expirySource: lot.expirySource || 'none',
    daysLeft,
    state,
    // ลำดับที่ระบบจะเบิก (1 = ใช้ก่อน) เฉพาะล็อตที่ใช้ได้
    pickOrder: rank || null,
  }
}

// -----------------------------------------------------
// สรุปรายวัตถุดิบ
// -----------------------------------------------------
router.get('/:branchId/summary', wrap(async (req, res) => {
  const branchId = Number(req.params.branchId)
  const soonDays = Math.max(0, Number(req.query.days ?? 3))
  const now = new Date()

  const [stockRows, lots] = await Promise.all([
    prisma.branchStockRaw.findMany({ where: { branchId }, include: { material: true } }),
    prisma.rawMaterialLot.findMany({ where: { branchId, status: 'active', qtyRemaining: { gt: 0 } } }),
  ])

  const byMat = new Map()

  for (const l of lots) {
    if (!byMat.has(l.materialId)) byMat.set(l.materialId, [])
    byMat.get(l.materialId).push(l)
  }

  const rows = stockRows.map(s => {
    const list = byMat.get(s.materialId) || []

    let usable = 0
    let expiring = 0
    let expired = 0
    let nearest = null
    const byStorage = { ambient: 0, chilled: 0, frozen: 0, thawed: 0 }

    for (const l of list) {
      const q = Number(l.qtyRemaining)

      if (isExpired(l, now)) {
        expired += q
        continue
      }

      usable += q
      byStorage[l.storage || 'ambient'] = r3((byStorage[l.storage || 'ambient'] || 0) + q)

      if (l.expiresAt) {
        const left = (new Date(l.expiresAt).getTime() - now.getTime()) / DAY

        if (left <= soonDays) expiring += q
        if (!nearest || new Date(l.expiresAt) < nearest) nearest = new Date(l.expiresAt)
      }
    }

    const lotTotal = r3(usable + expired)

    return {
      materialId: s.materialId,
      name: s.material?.name,
      unit: s.material?.unit,
      category: s.material?.category,
      stockQty: Number(s.qty),
      lotTotal,
      usableQty: r3(usable),
      expiringQty: r3(expiring),
      expiredQty: r3(expired),
      lotCount: list.length,
      byStorage,
      nearestExpiry: nearest,
      // ยอดรวมกับผลรวมล็อตไม่ตรงกัน -> ควรตรวจนับ
      mismatch: Math.abs(Number(s.qty) - lotTotal) > 0.0005,
    }
  })

  res.json({ branchId, soonDays, rows })
}))

// -----------------------------------------------------
// รายการล็อต (เรียงตามลำดับที่จะเบิก)
// -----------------------------------------------------
router.get('/:branchId', wrap(async (req, res) => {
  const branchId = Number(req.params.branchId)
  const materialId = req.query.materialId ? Number(req.query.materialId) : null
  const showAll = req.query.status === 'all'
  const soonDays = Math.max(0, Number(req.query.days ?? 3))
  const category = req.query.category || null
  const now = new Date()

  const lots = await prisma.rawMaterialLot.findMany({
    where: {
      branchId,
      ...(materialId ? { materialId } : {}),
      ...(showAll ? {} : { status: 'active', qtyRemaining: { gt: 0 } }),
      ...(category ? { material: { category } } : {}),
    },
    include: { material: true },
    take: showAll ? 300 : undefined,
  })

  // จัดอันดับการเบิกต่อวัตถุดิบ
  const ranks = new Map()
  const active = lots
    .filter(l => l.status === 'active' && Number(l.qtyRemaining) > 0 && !isExpired(l, now))
    .sort(fefoCompare)
  const counter = {}

  for (const l of active) {
    counter[l.materialId] = (counter[l.materialId] || 0) + 1
    ranks.set(l.id, counter[l.materialId])
  }

  const rows = lots
    .sort((a, b) => a.materialId - b.materialId || fefoCompare(a, b))
    .map(l => view(l, now, soonDays, ranks.get(l.id)))

  res.json(rows)
}))

// -----------------------------------------------------
// ทิ้งของเสีย / หมดอายุ
// -----------------------------------------------------
router.post('/waste', wrap(async (req, res) => {
  const lotId = Number(req.body.lotId)
  const reason = String(req.body.reason || '').trim().slice(0, 120)

  if (!lotId) throw new Error('ต้องระบุล็อต')
  if (!reason) throw new Error('ต้องระบุเหตุผลที่ทิ้ง (เช่น หมดอายุ / เสีย / ตกพื้น)')

  const result = await prisma.$transaction(async tx => {
    const lot = await tx.rawMaterialLot.findUnique({ where: { id: lotId }, include: { material: true } })

    if (!lot) throw new Error('ไม่พบล็อตนี้')

    // Admin ทำได้ทุกสาขา — ฝ่ายสต็อกเฉพาะสาขาตัวเอง ไม่บังคับ (สอดคล้องกับหน้าเลือกสาขาเดิม)
    const remaining = Number(lot.qtyRemaining)
    const qty = req.body.qty === undefined || req.body.qty === '' ? remaining : r3(req.body.qty)

    if (!(qty > 0)) throw new Error('จำนวนที่ทิ้งต้องมากกว่า 0')
    if (qty > remaining + 0.0005) throw new Error(`ล็อตนี้เหลือ ${remaining} ทิ้งเกินไม่ได้`)

    const left = r3(remaining - qty)

    await tx.rawMaterialLot.update({
      where: { id: lot.id },
      data: { qtyRemaining: left, status: left <= 0 ? 'discarded' : 'active' },
    })

    await tx.branchStockRaw.update({
      where: { branchId_materialId: { branchId: lot.branchId, materialId: lot.materialId } },
      data: { qty: { decrement: qty } },
    })

    await tx.rawMaterialLog.create({
      data: {
        branchId: lot.branchId,
        materialId: lot.materialId,
        type: 'waste',
        qty,
        note: `ทิ้ง: ${reason} [ล็อต ${lot.lotNo}]`.slice(0, 255),
        staffId: req.staff.id,
        lotId: lot.id,
      },
    })

    return { lotNo: lot.lotNo, material: lot.material?.name, wasted: qty, remaining: left }
  })

  res.status(201).json(result)
}))

// -----------------------------------------------------
// แช่แข็ง / ละลาย — แยกเป็นล็อตใหม่ ยอดรวมไม่เปลี่ยน
// -----------------------------------------------------
router.post('/move', wrap(async (req, res) => {
  const lotId = Number(req.body.lotId)
  const to = req.body.to

  if (!lotId) throw new Error('ต้องระบุล็อต')
  if (to !== 'frozen' && to !== 'thawed') throw new Error('เปลี่ยนสถานะได้เฉพาะ แช่แข็ง หรือ ละลาย')

  const r = await prisma.$transaction(tx =>
    moveLotStorage(tx, { lotId, to, qty: req.body.qty, staffId: req.staff.id })
  )

  res.status(201).json({
    material: r.material,
    unit: r.unit,
    qty: r.qty,
    to: r.to,
    fromLotNo: r.fromLot.lotNo,
    lotNo: r.lot.lotNo,
    expiresAt: r.expiresAt,
    expirySource: r.expirySource,
  })
}))

// -----------------------------------------------------
// ตั้งอายุเก็บมาตรฐานของวัตถุดิบ (วัน) — ว่าง/null = ไม่ตั้ง
// -----------------------------------------------------
function cleanDays(v, label) {
  if (v === undefined) return undefined
  if (v === null || v === '') return null

  const n = Number(v)

  if (!Number.isInteger(n) || n < 1 || n > 3650) {
    throw new Error(`${label}ต้องเป็นจำนวนวันเต็ม 1-3650 (หรือเว้นว่างถ้าไม่ตั้ง)`)
  }

  return n
}

router.put('/material/:id', wrap(async (req, res) => {
  const id = Number(req.params.id)

  if (!id) throw new Error('ต้องระบุวัตถุดิบ')

  const data = {}
  const chilled = cleanDays(req.body.chilledDays, 'อายุแช่เย็น')
  const frozen = cleanDays(req.body.frozenDays, 'อายุแช่แข็ง')
  const thawed = cleanDays(req.body.thawedDays, 'อายุหลังละลาย')

  if (chilled !== undefined) data.shelfLifeChilledDays = chilled
  if (frozen !== undefined) data.shelfLifeFrozenDays = frozen
  if (thawed !== undefined) data.shelfLifeThawedDays = thawed

  if (req.body.defaultStorage !== undefined) {
    if (!STORAGES.slice(0, 3).includes(req.body.defaultStorage)) {
      throw new Error('สถานะเก็บตั้งต้นต้องเป็น อุณหภูมิห้อง / แช่เย็น / แช่แข็ง')
    }

    data.defaultStorage = req.body.defaultStorage
  }

  if (!Object.keys(data).length) throw new Error('ไม่มีข้อมูลที่จะบันทึก')

  const m = await prisma.rawMaterial.update({ where: { id }, data })

  res.json(m)
}))

// -----------------------------------------------------
// ตรวจนับสต็อก (Stock Reconciliation)
//   นับจริง < ระบบ : ตัดส่วนต่างตาม FEFO (type adjust)
//   นับจริง > ระบบ : สร้างล็อตปรับยอด ADJ-... (type adjust)
// -----------------------------------------------------
router.post('/stocktake', wrap(async (req, res) => {
  const branchId = Number(req.body.branchId)
  const materialId = Number(req.body.materialId)
  const counted = r3(req.body.countedQty)
  const note = String(req.body.note || '').trim().slice(0, 100)

  if (!branchId || !materialId) throw new Error('ต้องระบุสาขาและวัตถุดิบ')
  if (!Number.isFinite(counted) || counted < 0 || req.body.countedQty === '' || req.body.countedQty == null) {
    throw new Error('จำนวนที่นับได้ไม่ถูกต้อง')
  }

  const result = await prisma.$transaction(async tx => {
    const material = await tx.rawMaterial.findUnique({ where: { id: materialId } })

    if (!material) throw new Error('ไม่พบวัตถุดิบนี้')

    const lots = await tx.rawMaterialLot.findMany({
      where: { branchId, materialId, status: 'active', qtyRemaining: { gt: 0 } },
    })

    const system = r3(lots.reduce((s, l) => s + Number(l.qtyRemaining), 0))
    const diff = r3(counted - system)
    const label = `ตรวจนับ: ระบบ ${system} นับได้ ${counted}${note ? ' · ' + note : ''}`

    if (diff < 0) {
      await consumeFEFO(tx, {
        branchId,
        materialId,
        qty: -diff,
        type: 'adjust',
        note: label,
        staffId: req.staff.id,
        allowExpired: true,
        materialName: material.name,
      })
    } else if (diff > 0) {
      await receiveLot(tx, {
        branchId,
        materialId,
        qty: diff,
        lotNo: `ADJ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
        type: 'adjust',
        note: label,
        lotNote: 'ล็อตปรับยอดจากการตรวจนับ',
        staffId: req.staff.id,
        allowPast: true,
        // ของที่นับเจอเกิน: ใช้สถานะตั้งต้น + อายุมาตรฐานของวัตถุดิบ (ถ้าตั้งไว้)
        material,
        storage: material.defaultStorage || 'ambient',
      })
    }

    // ยอดรวมต้องเท่ากับผลรวมล็อตเสมอหลังตรวจนับ
    const after = await syncStockToLots(tx, branchId, materialId)

    return {
      material: material.name,
      unit: material.unit,
      before: system,
      counted,
      diff,
      after,
    }
  })

  res.status(201).json(result)
}))

module.exports = router
