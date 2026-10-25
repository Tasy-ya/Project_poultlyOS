// รัน:  node backend/test/rawLots.test.js
// ทดสอบตรรกะ FEFO/FIFO ด้วยฐานข้อมูลจำลองในหน่วยความจำ (ไม่ต้องต่อ DB)

const assert = require('assert')
process.env.STOCK_PICK_MODE = 'fefo' // ชุดทดสอบเดิมทดสอบโหมด FEFO
const { receiveLot, consumeFEFO, moveLotStorage, syncStockToLots } = require('../src/lib/rawLots')

function fakeTx(materials = {}) {
  const lots = []
  const logs = []
  const stock = {}
  let id = 0

  const match = (row, where) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object') {
        if ('gt' in v) return Number(row[k]) > v.gt
        if ('startsWith' in v) return String(row[k]).startsWith(v.startsWith)
      }
      return row[k] === v
    })

  const key = w => `${w.branchId_materialId.branchId}:${w.branchId_materialId.materialId}`

  return {
    lots, logs, stock,
    rawMaterialLot: {
      count: async ({ where }) => lots.filter(l => match(l, where)).length,
      findFirst: async ({ where }) => lots.find(l => match(l, where)) || null,
      findMany: async ({ where }) => lots.filter(l => match(l, where)).map(l => ({ ...l })),
      findUnique: async ({ where, include }) => {
        const l = lots.find(x => x.id === where.id)
        if (!l) return null
        return { ...l, ...(include && include.material ? { material: materials[l.materialId] || null } : {}) }
      },
      create: async ({ data }) => { const row = { id: ++id, status: 'active', ...data }; lots.push(row); return { ...row } },
      update: async ({ where, data }) => { const row = lots.find(l => l.id === where.id); Object.assign(row, data); return { ...row } },
    },
    branchStockRaw: {
      upsert: async ({ where, update, create }) => {
        const k = key(where)
        if (stock[k] === undefined) stock[k] = Number(create.qty)
        else if (update.qty && update.qty.increment !== undefined) stock[k] += update.qty.increment
        else stock[k] = Number(update.qty)
        return { qty: stock[k] }
      },
      update: async ({ where, data }) => { stock[key(where)] -= data.qty.decrement },
    },
    rawMaterialLog: { create: async ({ data }) => { logs.push(data) } },
  }
}

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d }
const rem = (tx, no) => Number(tx.lots.find(l => l.lotNo === no).qtyRemaining)
const base = { branchId: 1, materialId: 7, staffId: 1 }

;(async () => {
  // ---- ตัวอย่างในเอกสาร: LOT-A 10, LOT-B 15, เบิก 12, รับ LOT-C 8 ----
  let tx = fakeTx()
  await receiveLot(tx, { ...base, qty: 10, lotNo: 'LOT-A', expiresAt: day(1), receivedAt: day(-3) })
  await receiveLot(tx, { ...base, qty: 15, lotNo: 'LOT-B', expiresAt: day(4), receivedAt: day(-1) })
  assert.strictEqual(tx.stock['1:7'], 25)

  const alloc = await consumeFEFO(tx, { ...base, qty: 12, type: 'out', note: 'ทดสอบ' })
  assert.deepStrictEqual(alloc.map(a => [a.lot.lotNo, a.take]), [['LOT-A', 10], ['LOT-B', 2]])
  assert.strictEqual(rem(tx, 'LOT-A'), 0)
  assert.strictEqual(rem(tx, 'LOT-B'), 13)
  assert.strictEqual(tx.lots.find(l => l.lotNo === 'LOT-A').status, 'used_up')

  await receiveLot(tx, { ...base, qty: 8, lotNo: 'LOT-C', expiresAt: day(6) })
  assert.strictEqual(tx.stock['1:7'], 21)
  assert.strictEqual(rem(tx, 'LOT-C'), 8)
  assert.ok(tx.logs.every(l => l.lotId), 'ทุก log ต้องอ้างล็อต')
  console.log('✓ ตัวอย่างในเอกสาร (A=0, B=13, C=8, รวม 21)')

  // ---- FEFO: ล็อตที่เข้าทีหลังแต่หมดอายุก่อน ต้องถูกใช้ก่อน ----
  tx = fakeTx()
  await receiveLot(tx, { ...base, qty: 10, lotNo: 'OLD-LONG', expiresAt: day(10), receivedAt: day(-5) })
  await receiveLot(tx, { ...base, qty: 10, lotNo: 'NEW-SHORT', expiresAt: day(2), receivedAt: day(-1) })
  const a2 = await consumeFEFO(tx, { ...base, qty: 4 })
  assert.deepStrictEqual(a2.map(a => a.lot.lotNo), ['NEW-SHORT'])
  console.log('✓ FEFO: หมดอายุก่อนใช้ก่อน แม้รับเข้าทีหลัง')

  // ---- FIFO: หมดอายุวันเดียวกัน -> รับเข้าก่อนใช้ก่อน / ไม่มีวันหมดอายุ -> ท้ายสุด ----
  tx = fakeTx()
  const same = day(5)
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'NOEXP', receivedAt: day(-9) })
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'LATER', expiresAt: same, receivedAt: day(-1) })
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'EARLIER', expiresAt: same, receivedAt: day(-3) })
  const a3 = await consumeFEFO(tx, { ...base, qty: 12 })
  assert.deepStrictEqual(a3.map(a => a.lot.lotNo), ['EARLIER', 'LATER', 'NOEXP'])
  console.log('✓ FIFO เมื่อวันหมดอายุเท่ากัน และล็อตไม่มีวันหมดอายุไว้ท้ายสุด')

  // ---- ข้ามล็อตหมดอายุ + แจ้งให้ทิ้งก่อน ----
  tx = fakeTx()
  await receiveLot(tx, { ...base, qty: 10, lotNo: 'EXPIRED', expiresAt: day(2) })
  tx.lots[0].expiresAt = day(-1) // จำลองว่าเวลาผ่านไป ล็อตหมดอายุแล้ว
  await receiveLot(tx, { ...base, qty: 3, lotNo: 'OK', expiresAt: day(5) })
  await assert.rejects(() => consumeFEFO(tx, { ...base, qty: 5, materialName: 'อกไก่' }), /หมดอายุ 10/)
  const a4 = await consumeFEFO(tx, { ...base, qty: 3 })
  assert.deepStrictEqual(a4.map(a => a.lot.lotNo), ['OK'])
  assert.strictEqual(rem(tx, 'EXPIRED'), 10)
  console.log('✓ ข้ามล็อตหมดอายุ และแจ้งให้ทิ้งก่อน')

  // ---- กันซ้ำ/รับของหมดอายุแล้ว ----
  await assert.rejects(() => receiveLot(tx, { ...base, qty: 1, lotNo: 'OK', expiresAt: day(5) }), /มีอยู่แล้ว/)
  await assert.rejects(() => receiveLot(tx, { ...base, qty: 1, expiresAt: day(-1) }), /หมดอายุ/)
  console.log('✓ ไม่เขียนทับล็อตเดิม / ไม่รับของหมดอายุ')

  // ---- เลขล็อตอัตโนมัติ + ตรวจนับ ----
  const auto = await receiveLot(tx, { ...base, qty: 2 })
  assert.ok(/^\d{8}-7-01$/.test(auto.lotNo), auto.lotNo)
  const total = await syncStockToLots(tx, 1, 7)
  assert.strictEqual(total, 10 + 2) // EXPIRED 10 + auto 2 (OK ถูกใช้หมดแล้ว)
  console.log('✓ เลขล็อตอัตโนมัติ + sync ยอดรวมตามล็อต')

  // =====================================================
  // รอบ 15: อายุเก็บมาตรฐาน + แช่แข็ง/ละลาย
  // =====================================================
  const chicken = {
    id: 7, name: 'ไก่สด', unit: 'ตัว',
    shelfLifeChilledDays: 3, shelfLifeFrozenDays: 90, shelfLifeThawedDays: 2,
  }
  const unset = { id: 7, name: 'ของไม่ตั้งอายุ', unit: 'กก.' }
  const near = (d, n, label) =>
    assert.ok(Math.abs((new Date(d).getTime() - Date.now()) / 86400000 - n) < 0.01, label)

  // ---- คำนวณวันหมดอายุอัตโนมัติ ----
  tx = fakeTx({ 7: chicken })
  let l1 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'C1', material: chicken, storage: 'chilled' })
  near(l1.expiresAt, 3, 'แช่เย็น 3 วัน'); assert.strictEqual(l1.expirySource, 'auto'); assert.strictEqual(l1.storage, 'chilled')
  let l2 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'F1', material: chicken, storage: 'frozen' })
  near(l2.expiresAt, 90, 'แช่แข็ง 90 วัน'); assert.ok(l2.frozenAt)
  let l3 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'U1', material: unset, storage: 'frozen' })
  assert.strictEqual(l3.expiresAt, null); assert.strictEqual(l3.expirySource, 'none')
  let l4 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'E1', material: chicken, storage: 'frozen', expiresAt: day(30) })
  assert.strictEqual(l4.expirySource, 'entered'); near(l4.expiresAt, 30, 'วันที่กรอกมาก่อนเสมอ')
  let l5 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'T0', material: chicken, storage: 'frozen', autoExpiry: false })
  assert.strictEqual(l5.expiresAt, null)
  let l6 = await receiveLot(tx, { ...base, qty: 5, lotNo: 'A1', material: chicken, storage: 'ambient' })
  assert.strictEqual(l6.expiresAt, null)
  await assert.rejects(() => receiveLot(tx, { ...base, qty: 1, storage: 'warm' }), /สถานะการเก็บ/)
  console.log('✓ วันหมดอายุอัตโนมัติ: แช่เย็น/แช่แข็ง/ไม่ตั้งอายุ/กรอกเอง/อุณหภูมิห้อง')

  // ---- แช่แข็ง: แยกล็อต ยอดรวมไม่เปลี่ยน ----
  tx = fakeTx({ 7: chicken })
  await receiveLot(tx, { ...base, qty: 10, lotNo: 'BUY1', material: chicken, storage: 'chilled' })
  const lotBuy = tx.lots[0]
  const fr = await moveLotStorage(tx, { lotId: lotBuy.id, to: 'frozen', qty: 4, staffId: 1 })
  assert.strictEqual(rem(tx, 'BUY1'), 6)
  assert.strictEqual(rem(tx, 'BUY1-F01'), 4)
  assert.strictEqual(tx.lots.find(l => l.lotNo === 'BUY1-F01').storage, 'frozen')
  near(fr.expiresAt, 90, 'แช่แข็งใหม่ 90 วัน')
  assert.strictEqual(tx.stock['1:7'], 10)
  assert.strictEqual(tx.logs.at(-1).type, 'freeze')
  await assert.rejects(() => moveLotStorage(tx, { lotId: lotBuy.id, to: 'frozen', qty: 99 }), /เกินไม่ได้/)
  console.log('✓ แช่แข็ง: แยกล็อต -F01 ยอดรวมไม่เปลี่ยน อายุใหม่ตามมาตรฐาน')

  // ---- ละลาย: อายุสั้นลง ไม่เกินอายุเดิม และใช้ก่อนล็อตแช่แข็งตาม FEFO ----
  const frozenLot = tx.lots.find(l => l.lotNo === 'BUY1-F01')
  const th = await moveLotStorage(tx, { lotId: frozenLot.id, to: 'thawed', qty: 3, staffId: 1 })
  near(th.expiresAt, 2, 'ละลายแล้ว 2 วัน')
  assert.strictEqual(tx.lots.find(l => l.lotNo === 'BUY1-F01-T01').storage, 'thawed')
  assert.strictEqual(rem(tx, 'BUY1-F01'), 1)
  assert.strictEqual(tx.stock['1:7'], 10)
  const pick = await consumeFEFO(tx, { ...base, qty: 3 })
  assert.deepStrictEqual(pick.map(a => a.lot.lotNo), ['BUY1-F01-T01'])
  console.log('✓ ละลาย: อายุ 2 วัน และถูกเบิกก่อนล็อตแช่แข็ง (FEFO)')

  // ---- ไม่ตั้งอายุหลังละลาย -> ใช้ค่าปลอดภัย 1 วัน / ไม่เกินอายุเดิม ----
  const noThaw = { ...chicken, shelfLifeThawedDays: null }
  tx = fakeTx({ 7: noThaw })
  await receiveLot(tx, { ...base, qty: 4, lotNo: 'Z1', material: noThaw, storage: 'frozen', expiresAt: new Date(Date.now() + 12 * 3600 * 1000) })
  let t2 = await moveLotStorage(tx, { lotId: tx.lots[0].id, to: 'thawed' })
  assert.ok(new Date(t2.expiresAt).getTime() <= tx.lots[0].expiresAt.getTime() + 1000, 'ไม่เกินอายุเดิม')
  tx = fakeTx({ 7: noThaw })
  await receiveLot(tx, { ...base, qty: 4, lotNo: 'Z2', material: noThaw, storage: 'frozen' })
  t2 = await moveLotStorage(tx, { lotId: tx.lots[0].id, to: 'thawed' })
  near(t2.expiresAt, 1, 'ไม่ตั้งอายุหลังละลาย = 1 วัน')
  console.log('✓ อายุหลังละลาย: ค่าปลอดภัย 1 วัน และไม่เกินอายุเดิม')

  // ---- กฎห้าม ----
  tx = fakeTx({ 7: chicken })
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'R1', material: chicken, storage: 'chilled' })
  await assert.rejects(() => moveLotStorage(tx, { lotId: tx.lots[0].id, to: 'thawed' }), /แช่แข็งอยู่/)
  const rr = await moveLotStorage(tx, { lotId: tx.lots[0].id, to: 'frozen', qty: 5 })
  assert.strictEqual(tx.lots[0].status, 'used_up')
  const tt = await moveLotStorage(tx, { lotId: rr.lot.id, to: 'thawed' })
  await assert.rejects(() => moveLotStorage(tx, { lotId: tt.lot.id, to: 'frozen' }), /ห้ามแช่แข็งซ้ำ/)
  tx.lots.find(l => l.id === tt.lot.id).expiresAt = day(-1)
  await assert.rejects(() => moveLotStorage(tx, { lotId: tt.lot.id, to: 'thawed' }), /หมดอายุ|แช่แข็งอยู่/)
  const exp = fakeTx({ 7: chicken })
  await receiveLot(exp, { ...base, qty: 2, lotNo: 'X1', material: chicken, storage: 'chilled', expiresAt: day(1) })
  exp.lots[0].expiresAt = day(-1)
  await assert.rejects(() => moveLotStorage(exp, { lotId: exp.lots[0].id, to: 'frozen' }), /หมดอายุแล้ว/)
  console.log('✓ กฎ: ละลายได้เฉพาะของแช่แข็ง / ห้ามแช่แข็งซ้ำ / ล็อตหมดอายุต้องทิ้ง')

  // =====================================================
  // โหมดค่าตั้งต้น: FIFO ตามวันที่รับสินค้า (ไม่สนวันหมดอายุ)
  // =====================================================
  delete process.env.STOCK_PICK_MODE
  tx = fakeTx()
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'NEW', receivedAt: day(-1), expiresAt: day(2) })
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'OLD', receivedAt: day(-6), expiresAt: day(30) })
  await receiveLot(tx, { ...base, qty: 5, lotNo: 'MID', receivedAt: day(-3) })
  const f1 = await consumeFEFO(tx, { ...base, qty: 12 })
  assert.deepStrictEqual(f1.map(a => [a.lot.lotNo, a.take]), [['OLD', 5], ['MID', 5], ['NEW', 2]])
  await assert.rejects(() => receiveLot(tx, { ...base, qty: 1, receivedAt: day(3) }), /อนาคต/)
  console.log('✓ FIFO: เบิกตามวันที่รับสินค้าเข้า เก่าสุดก่อน (ไม่สนวันหมดอายุ)')

  console.log('\nผ่านทั้งหมด')
})().catch(e => { console.error('✗', e.message); process.exit(1) })
