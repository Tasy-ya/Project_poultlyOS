// =====================================================
// ล็อตวัตถุดิบ (Lot Tracking) + ตัดสต็อกแบบ FEFO / FIFO
//
//  - รับเข้า  : สร้าง "ล็อตใหม่" เสมอ (ไม่เขียนทับล็อตเดิม) + เพิ่มยอดรวม + บันทึกประวัติ
//  - เบิกออก  : ค่าตั้งต้นใช้ FIFO = ล็อตที่ "รับเข้าก่อน" ใช้ก่อน (STOCK_PICK_MODE=fefo เพื่อใช้หมดอายุก่อน)
//               ข้ามล็อตที่ตั้งวันหมดอายุไว้และหมดอายุแล้ว (ต้องบันทึกทิ้งก่อน)
//  - ยอดรวม branch_stock_raw.qty ถูกปรับใน transaction เดียวกับล็อตเสมอ
//
// ทุกฟังก์ชันรับ tx (prisma transaction client) เป็นพารามิเตอร์แรก
// =====================================================

const r3 = n => Math.round(Number(n || 0) * 1000) / 1000

// -----------------------------------------------------
// รอบ 15: สถานะการเก็บ + อายุเก็บมาตรฐาน
//   ambient = อุณหภูมิห้อง / chilled = แช่เย็น / frozen = แช่แข็ง / thawed = ละลายแล้ว
//   วันหมดอายุที่พนักงานกรอกเองมาก่อนเสมอ ถ้าไม่กรอกจึงคำนวณจากอายุมาตรฐานของวัตถุดิบ
// -----------------------------------------------------
const DAY_MS = 24 * 3600 * 1000
const STORAGES = ['ambient', 'chilled', 'frozen', 'thawed']
const DEFAULT_THAWED_DAYS = 1 // ไม่ได้ตั้งอายุหลังละลาย -> ใช้ 1 วัน (ปลอดภัยไว้ก่อน)

const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY_MS)

// อายุมาตรฐาน (วัน) ของสถานะนั้น — null = ไม่มี (อุณหภูมิห้องไม่คำนวณให้)
function shelfDays(material, storage) {
  if (!material) return null

  const pick = v => (Number(v) > 0 ? Number(v) : null)

  if (storage === 'frozen') return pick(material.shelfLifeFrozenDays)
  if (storage === 'chilled') return pick(material.shelfLifeChilledDays)
  if (storage === 'thawed') return pick(material.shelfLifeThawedDays) || DEFAULT_THAWED_DAYS

  return null
}

const isExpired = (lot, now = new Date()) =>
  Boolean(lot.expiresAt) && new Date(lot.expiresAt).getTime() <= now.getTime()

// ลำดับการเบิก
//   ค่าตั้งต้น = FIFO: ล็อตที่ "รับเข้าก่อน" ใช้ก่อน (ดูแค่วันที่รับสินค้า ไม่สนวันหมดอายุ)
//   ตั้ง STOCK_PICK_MODE=fefo ใน .env ถ้าอยากกลับไปใช้ "หมดอายุก่อนใช้ก่อน"
const pickMode = () => (process.env.STOCK_PICK_MODE === 'fefo' ? 'fefo' : 'fifo')

function fifoCompare(a, b) {
  const ra = new Date(a.receivedAt).getTime()
  const rb = new Date(b.receivedAt).getTime()

  if (ra !== rb) return ra - rb

  return a.id - b.id
}

// FEFO: หมดอายุก่อนมาก่อน (ไม่มีวันหมดอายุ = ท้ายสุด) -> FIFO: รับเข้าก่อน -> id
function fefoOnlyCompare(a, b) {
  const ea = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity
  const eb = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity

  if (ea !== eb) return ea < eb ? -1 : 1

  return fifoCompare(a, b)
}

const fefoCompare = (a, b) => (pickMode() === 'fefo' ? fefoOnlyCompare(a, b) : fifoCompare(a, b))

const ymd = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

// กันสองคนตัดสต็อกวัตถุดิบเดียวกันพร้อมกัน
async function lockLots(tx, branchId, materialId) {
  if (typeof tx.$queryRaw !== 'function') return

  await tx.$queryRaw`
    SELECT id FROM raw_material_lots
    WHERE branch_id = ${branchId} AND material_id = ${materialId}
    FOR UPDATE`
}

async function nextLotNo(tx, branchId, materialId, date) {
  const prefix = `${ymd(date)}-${materialId}-`

  const count = await tx.rawMaterialLot.count({
    where: { branchId, materialId, lotNo: { startsWith: prefix } },
  })

  return `${prefix}${String(count + 1).padStart(2, '0')}`
}

function cleanDate(value, label) {
  if (value === undefined || value === null || value === '') return null

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) throw new Error(`${label}ไม่ถูกต้อง`)

  return d
}

// -----------------------------------------------------
// รับเข้า -> สร้างล็อตใหม่
// merge=true ใช้ตอนโอนสาขา: ถ้ามีเลขล็อตเดียวกันที่ปลายทางอยู่แล้ว ให้รวมเข้าล็อตนั้น
// -----------------------------------------------------
async function receiveLot(tx, p) {
  const qty = r3(p.qty)

  if (!(qty > 0)) throw new Error('จำนวนรับเข้าต้องมากกว่า 0')

  const receivedAt = cleanDate(p.receivedAt, 'วันที่รับสินค้า') || new Date()
  const storage = p.storage || 'ambient'

  // วันที่รับสินค้าย้อนหลังได้ (เช่น ลืมบันทึก) แต่ห้ามเป็นอนาคต
  if (receivedAt.getTime() > Date.now() + DAY_MS) throw new Error('วันที่รับสินค้าเป็นอนาคตไม่ได้')

  if (!STORAGES.includes(storage)) throw new Error('สถานะการเก็บไม่ถูกต้อง')

  // วันหมดอายุ: ที่กรอกมา > คำนวณจากอายุมาตรฐาน (ถ้ามี) > ไม่มี
  const entered = cleanDate(p.expiresAt, 'วันหมดอายุ')
  const autoDays = entered || p.autoExpiry === false ? null : shelfDays(p.material, storage)
  const expiresAt = entered || (autoDays ? addDays(receivedAt, autoDays) : null)
  const expirySource = p.expirySource || (entered ? 'entered' : autoDays ? 'auto' : 'none')

  if (expiresAt && expiresAt.getTime() <= Date.now() && !p.allowPast) {
    throw new Error('วันหมดอายุผ่านไปแล้ว รับเข้าสต็อกไม่ได้')
  }

  await lockLots(tx, p.branchId, p.materialId)

  const lotNo =
    String(p.lotNo || '').trim().slice(0, 50) ||
    (await nextLotNo(tx, p.branchId, p.materialId, receivedAt))

  const existing = await tx.rawMaterialLot.findFirst({
    where: { branchId: p.branchId, materialId: p.materialId, lotNo },
  })

  let lot

  if (existing) {
    if (!p.merge) {
      throw new Error(`เลขล็อต "${lotNo}" มีอยู่แล้ว ใช้เลขล็อตใหม่ หรือเว้นว่างให้ระบบสร้างให้`)
    }

    lot = await tx.rawMaterialLot.update({
      where: { id: existing.id },
      data: {
        qtyReceived: r3(Number(existing.qtyReceived) + qty),
        qtyRemaining: r3(Number(existing.qtyRemaining) + qty),
        status: 'active',
      },
    })
  } else {
    lot = await tx.rawMaterialLot.create({
      data: {
        branchId: p.branchId,
        materialId: p.materialId,
        lotNo,
        qtyReceived: qty,
        qtyRemaining: qty,
        unitCost: p.unitCost ? Number(p.unitCost) : null,
        supplier: p.supplier ? String(p.supplier).trim().slice(0, 100) : null,
        receivedAt,
        expiresAt,
        note: p.lotNote ? String(p.lotNote).slice(0, 255) : null,
        staffId: p.staffId || null,
        storage,
        frozenAt: p.frozenAt || (storage === 'frozen' ? receivedAt : null),
        thawedAt: p.thawedAt || null,
        expirySource,
      },
    })
  }

  await tx.branchStockRaw.upsert({
    where: { branchId_materialId: { branchId: p.branchId, materialId: p.materialId } },
    update: { qty: { increment: qty } },
    create: { branchId: p.branchId, materialId: p.materialId, qty },
  })

  await tx.rawMaterialLog.create({
    data: {
      branchId: p.branchId,
      materialId: p.materialId,
      type: p.type || 'in',
      qty,
      note: `${p.note ? p.note + ' ' : ''}[ล็อต ${lot.lotNo}]`.slice(0, 255),
      staffId: p.staffId || null,
      lotId: lot.id,
    },
  })

  return lot
}

// -----------------------------------------------------
// เบิกออกแบบ FEFO/FIFO  -> คืน [{ lot, take }]
// type: 'out' | 'adjust' | 'waste'
// allowExpired: true เฉพาะตอนตรวจนับสต็อก (ของจริงรวมของหมดอายุที่ยังไม่ทิ้ง)
// -----------------------------------------------------
async function consumeFEFO(tx, p) {
  const qty = r3(p.qty)

  if (!(qty > 0)) throw new Error('จำนวนที่เบิกต้องมากกว่า 0')

  await lockLots(tx, p.branchId, p.materialId)

  const now = new Date()

  const lots = await tx.rawMaterialLot.findMany({
    where: {
      branchId: p.branchId,
      materialId: p.materialId,
      status: 'active',
      qtyRemaining: { gt: 0 },
    },
  })

  const usable = lots
    .filter(l => p.allowExpired || !isExpired(l, now))
    .sort(fefoCompare)

  const usableQty = r3(usable.reduce((s, l) => s + Number(l.qtyRemaining), 0))

  if (usableQty + 0.0005 < qty) {
    const expiredQty = r3(
      lots.filter(l => isExpired(l, now)).reduce((s, l) => s + Number(l.qtyRemaining), 0)
    )

    const name = p.materialName ? `"${p.materialName}"` : 'วัตถุดิบ'

    throw new Error(
      `${name}ที่ใช้ได้ไม่พอ${p.forWhat ? `สำหรับ${p.forWhat}` : ''} (ใช้ได้ ${usableQty}, ต้องการ ${qty}` +
        (expiredQty > 0 ? `, มีล็อตหมดอายุ ${expiredQty} ต้องบันทึกทิ้งก่อน` : '') +
        ')'
    )
  }

  const allocations = []
  let left = qty

  for (const lot of usable) {
    if (left <= 0) break

    const take = r3(Math.min(left, Number(lot.qtyRemaining)))
    const remaining = r3(Number(lot.qtyRemaining) - take)

    const updated = await tx.rawMaterialLot.update({
      where: { id: lot.id },
      data: { qtyRemaining: remaining, status: remaining <= 0 ? 'used_up' : 'active' },
    })

    await tx.rawMaterialLog.create({
      data: {
        branchId: p.branchId,
        materialId: p.materialId,
        type: p.type || 'out',
        qty: take,
        note: `${p.note ? p.note + ' ' : ''}[ล็อต ${lot.lotNo}]`.slice(0, 255),
        staffId: p.staffId || null,
        lotId: lot.id,
      },
    })

    allocations.push({ lot: { ...lot, ...updated }, take })
    left = r3(left - take)
  }

  await tx.branchStockRaw.update({
    where: { branchId_materialId: { branchId: p.branchId, materialId: p.materialId } },
    data: { qty: { decrement: qty } },
  })

  return allocations
}

// -----------------------------------------------------
// เปลี่ยนสถานะการเก็บ: แช่แข็ง (chilled -> frozen) / ละลาย (frozen -> thawed)
//   - แยกจำนวนที่เปลี่ยนออกเป็น "ล็อตใหม่" (เลขล็อตเดิม + -F01 / -T01) ส่วนที่เหลือคงสถานะเดิม
//   - วันหมดอายุคำนวณใหม่ตามอายุมาตรฐานของสถานะใหม่
//       ละลาย: ไม่เกินวันหมดอายุเดิมของล็อตแช่แข็ง และห้ามแช่แข็งซ้ำ
//   - ยอดรวม branch_stock_raw ไม่เปลี่ยน (แค่ย้ายระหว่างล็อต)
// -----------------------------------------------------
async function nextSuffixLotNo(tx, lot, suffix) {
  const prefix = `${lot.lotNo}-${suffix}`

  let n = await tx.rawMaterialLot.count({
    where: { branchId: lot.branchId, materialId: lot.materialId, lotNo: { startsWith: prefix } },
  })

  for (;;) {
    n += 1

    const candidate = `${prefix}${String(n).padStart(2, '0')}`.slice(0, 50)

    const hit = await tx.rawMaterialLot.findFirst({
      where: { branchId: lot.branchId, materialId: lot.materialId, lotNo: candidate },
    })

    if (!hit) return candidate
  }
}

async function moveLotStorage(tx, p) {
  const to = p.to

  if (to !== 'frozen' && to !== 'thawed') throw new Error('เปลี่ยนสถานะได้เฉพาะ แช่แข็ง หรือ ละลาย')

  const first = await tx.rawMaterialLot.findUnique({ where: { id: p.lotId }, include: { material: true } })

  if (!first) throw new Error('ไม่พบล็อตนี้')

  await lockLots(tx, first.branchId, first.materialId)

  // อ่านซ้ำหลังล็อก กันยอดเปลี่ยนระหว่างรอ
  const lot = await tx.rawMaterialLot.findUnique({ where: { id: p.lotId }, include: { material: true } })
  const material = lot.material
  const now = new Date()

  if (lot.status !== 'active' || !(Number(lot.qtyRemaining) > 0)) throw new Error('ล็อตนี้ไม่มีของเหลือแล้ว')
  if (isExpired(lot, now)) throw new Error('ล็อตนี้หมดอายุแล้ว ต้องบันทึกทิ้ง ไม่ใช่เปลี่ยนสถานะ')

  if (to === 'frozen' && lot.storage !== 'chilled') {
    throw new Error('แช่แข็งได้เฉพาะล็อตที่เก็บแบบแช่เย็น (ละลายแล้วห้ามแช่แข็งซ้ำ)')
  }

  if (to === 'thawed' && lot.storage !== 'frozen') throw new Error('ละลายได้เฉพาะล็อตที่แช่แข็งอยู่')

  const remaining = Number(lot.qtyRemaining)
  const qty = p.qty === undefined || p.qty === null || p.qty === '' ? remaining : r3(p.qty)

  if (!(qty > 0)) throw new Error('จำนวนต้องมากกว่า 0')
  if (qty > remaining + 0.0005) throw new Error(`ล็อตนี้เหลือ ${remaining} เกินไม่ได้`)

  // วันหมดอายุใหม่
  let expiresAt = null
  const days = shelfDays(material, to)

  if (days) expiresAt = addDays(now, days)

  // ละลายแล้วอายุต้องไม่ยาวกว่าอายุเดิมของล็อตแช่แข็ง
  if (to === 'thawed' && lot.expiresAt && (!expiresAt || new Date(lot.expiresAt) < expiresAt)) {
    expiresAt = new Date(lot.expiresAt)
  }

  const left = r3(remaining - qty)

  const from = await tx.rawMaterialLot.update({
    where: { id: lot.id },
    data: { qtyRemaining: left, status: left <= 0 ? 'used_up' : 'active' },
  })

  const lotNo = await nextSuffixLotNo(tx, lot, to === 'frozen' ? 'F' : 'T')

  const moved = await tx.rawMaterialLot.create({
    data: {
      branchId: lot.branchId,
      materialId: lot.materialId,
      lotNo,
      qtyReceived: qty,
      qtyRemaining: qty,
      unitCost: lot.unitCost == null ? null : Number(lot.unitCost),
      supplier: lot.supplier,
      receivedAt: lot.receivedAt,
      expiresAt,
      note: `${to === 'frozen' ? 'แช่แข็ง' : 'ละลาย'}จากล็อต ${lot.lotNo}`.slice(0, 255),
      staffId: p.staffId || null,
      storage: to,
      frozenAt: to === 'frozen' ? now : lot.frozenAt || null,
      thawedAt: to === 'thawed' ? now : null,
      expirySource: expiresAt ? 'auto' : 'none',
    },
  })

  await tx.rawMaterialLog.create({
    data: {
      branchId: lot.branchId,
      materialId: lot.materialId,
      type: to === 'frozen' ? 'freeze' : 'thaw',
      qty,
      note: `${to === 'frozen' ? 'แช่แข็ง' : 'ละลาย'} [ล็อต ${lot.lotNo} → ${lotNo}]`.slice(0, 255),
      staffId: p.staffId || null,
      lotId: moved.id,
    },
  })

  return {
    material: material?.name,
    unit: material?.unit,
    qty,
    to,
    fromLot: { ...lot, ...from },
    lot: moved,
    expiresAt,
    // none = ยังไม่ได้ตั้งอายุมาตรฐานของสถานะนี้ ล็อตใหม่จึงไม่มีวันหมดอายุ
    expirySource: moved.expirySource,
  }
}

// ปรับยอดรวมให้เท่ากับผลรวมล็อต (ใช้หลังตรวจนับ)
async function syncStockToLots(tx, branchId, materialId) {
  const lots = await tx.rawMaterialLot.findMany({
    where: { branchId, materialId, status: 'active' },
  })

  const total = r3(lots.reduce((s, l) => s + Number(l.qtyRemaining), 0))

  await tx.branchStockRaw.upsert({
    where: { branchId_materialId: { branchId, materialId } },
    update: { qty: total },
    create: { branchId, materialId, qty: total },
  })

  return total
}

module.exports = {
  r3,
  isExpired,
  fefoCompare,
  fifoCompare,
  receiveLot,
  consumeFEFO,
  moveLotStorage,
  syncStockToLots,
  STORAGES,
  DEFAULT_THAWED_DAYS,
  shelfDays,
}
