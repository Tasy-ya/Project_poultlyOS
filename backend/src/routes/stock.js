const express = require('express');
const prisma = require('../db');
const { requireAuth, requireDept } = require('../middleware/auth');
const { receiveLot, consumeFEFO, STORAGES } = require('../lib/rawLots');

// ทุกเส้นทางใน /api/stock สำหรับฝ่ายสต็อก (และ Admin) เท่านั้น
const stockOnly = [requireAuth, requireDept('stock')];

const router = express.Router();

// เป็ด/ไก่ขายครึ่งตัวได้เสมอ (ตรงกับกฎตอนขายใน orders.js)
// สต็อกพร้อมขายเก็บเป็น "หน่วยครึ่งตัว" -> เต็มตัว x2
function unitsPerWhole(menu) {
  return menu.hasHalfOption ||
    menu.category === 'duck' ||
    menu.category === 'chicken'
    ? 2
    : 1;
}

// ---------- ขั้นที่ 1: วัตถุดิบดิบ ----------

// GET /api/stock/raw/:branchId
router.get('/raw/:branchId', stockOnly, async (req, res) => {
  const branchId = Number(req.params.branchId);
  const { category } = req.query;
  const stock = await prisma.branchStockRaw.findMany({
    where: { branchId, ...(category ? { material: { category } } : {}) },
    include: { material: true },
  });
  res.json(stock);
});

// POST /api/stock/raw/receive
// body: { branchId, materialId, qty, note, cost, lotNo?, receivedAt?, expiresAt?, supplier?, storage? }
//   receivedAt = วันที่รับสินค้าเข้า (ว่าง = เวลานี้) -> ใช้เรียงลำดับเบิกแบบ FIFO
// รับวัตถุดิบสดเข้าสต็อก -> สร้าง "ล็อตใหม่" เสมอ (ไม่เขียนทับล็อตเดิม)
//   lotNo ว่าง = ระบบสร้างเลขล็อตให้
//   storage = ambient | chilled | frozen (ว่าง = ใช้ค่าตั้งต้นของวัตถุดิบ)
//   expiresAt ว่าง = ระบบคำนวณจาก "อายุเก็บมาตรฐาน" ของวัตถุดิบตามสถานะนั้น
//                    ถ้ายังไม่ได้ตั้งอายุมาตรฐาน = ไม่มีวันหมดอายุ (เบิกท้ายสุด)
router.post('/raw/receive', stockOnly, async (req, res) => {
  const { note, cost, lotNo, expiresAt, supplier, receivedAt } = req.body;
  const branchId = Number(req.body.branchId);
  const materialId = Number(req.body.materialId);
  const qty = Number(req.body.qty);

  if (!branchId || !materialId || !(qty > 0)) {
    return res.status(400).json({ error: 'ต้องระบุ branchId, materialId, qty' });
  }

  if (req.body.storage && !STORAGES.slice(0, 3).includes(req.body.storage)) {
    return res.status(400).json({ error: 'สถานะการเก็บต้องเป็น อุณหภูมิห้อง / แช่เย็น / แช่แข็ง' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const material = await tx.rawMaterial.findUnique({ where: { id: materialId } });
      if (!material) throw new Error('ไม่พบวัตถุดิบนี้');

      if (cost) await tx.rawMaterial.update({ where: { id: materialId }, data: { costPerUnit: cost } });

      const lot = await receiveLot(tx, {
        branchId,
        materialId,
        qty,
        lotNo,
        expiresAt,
        receivedAt,
        supplier,
        unitCost: cost,
        note,
        staffId: req.staff.id,
        material,
        storage: req.body.storage || material.defaultStorage || 'ambient',
      });

      const stock = await tx.branchStockRaw.findUnique({
        where: { branchId_materialId: { branchId, materialId } },
      });

      return { ...stock, lot };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- ขั้นที่ 2: หมัก (prep) ----------

// GET /api/stock/prep-recipes - สูตรหมักทั้งหมด (วัตถุดิบที่ต้องใช้ต่อ 1 หน่วย) ไว้โชว์ว่าหมักได้อีกกี่ตัว
router.get('/prep-recipes', stockOnly, async (req, res) => {
  const [rows, materials] = await Promise.all([
    prisma.prepRecipe.findMany(),
    prisma.rawMaterial.findMany({ select: { id: true, name: true, unit: true } }),
  ]);
  const byId = new Map(materials.map(m => [m.id, m]));

  res.json(rows.map(r => ({
    prepItemId: r.prepItemId,
    materialId: r.materialId,
    qtyPerUnit: Number(r.qtyPerUnit),
    material: byId.get(r.materialId) || null,
  })));
});

// GET /api/stock/prep/:branchId - ล็อตของหมักที่ยังใช้ได้ (active)
router.get('/prep/:branchId', stockOnly, async (req, res) => {
  const branchId = Number(req.params.branchId);
  const { category } = req.query;
  const batches = await prisma.prepBatch.findMany({
    where: { branchId, status: 'active', ...(category ? { prepItem: { category } } : {}) },
    include: { prepItem: true },
    orderBy: [{ preparedAt: 'asc' }, { id: 'asc' }], // FIFO - หมักก่อนใช้ก่อน
  });
  res.json(batches);
});

// POST /api/stock/prep/:id/discard  body: { qty? }  (ว่าง = ทิ้งทั้งชุดที่เหลือ)
// ทิ้งของหมักที่เสีย/หมดอายุ: ลดยอดคงเหลือของชุด ถ้าหมดจะปิดชุดเป็น 'wasted'
router.post('/prep/:id/discard', stockOnly, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'รหัสชุดหมักไม่ถูกต้อง' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.prepBatch.findUnique({ where: { id }, include: { prepItem: true } });
      if (!batch || batch.status !== 'active') throw new Error('ไม่พบชุดหมักนี้ หรือถูกใช้/ทิ้งไปแล้ว');

      const remain = Number(batch.qtyRemaining);
      const qty = req.body.qty == null || req.body.qty === '' ? remain : Number(req.body.qty);
      if (!(qty > 0)) throw new Error('จำนวนที่ทิ้งต้องมากกว่า 0');
      if (qty > remain + 0.0005) throw new Error(`ชุดนี้เหลือ ${remain} ทิ้งเกินไม่ได้`);

      const left = Math.max(0, Math.round((remain - qty) * 1000) / 1000);
      await tx.prepBatch.update({
        where: { id },
        data: { qtyRemaining: left, status: left <= 0 ? 'wasted' : 'active' },
      });

      return { name: batch.prepItem?.name, batchNo: batch.batchNo || batch.id, wasted: qty, remaining: left };
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/stock/prep/start  body: { branchId, prepItemId, qtyProduced, batchNo }
// เริ่มหมัก: ดึงวัตถุดิบดิบตามสูตร (prep_recipe) มาใช้ แล้วสร้างล็อตของหมักใหม่
router.post('/prep/start', stockOnly, async (req, res) => {
  const { branchId, prepItemId, qtyProduced, batchNo } = req.body;
  if (!branchId || !prepItemId || !qtyProduced) {
    return res.status(400).json({ error: 'ต้องระบุ branchId, prepItemId, qtyProduced' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const prepItem = await tx.prepItem.findUnique({ where: { id: prepItemId } });
      if (!prepItem) throw new Error('ไม่พบรายการของหมักนี้');

      const recipe = await tx.prepRecipe.findMany({ where: { prepItemId } });

      // ตัดวัตถุดิบดิบตามสูตร
      for (const r of recipe) {
        const needed = Number(r.qtyPerUnit) * qtyProduced;
        const material = await tx.rawMaterial.findUnique({ where: { id: r.materialId } });

        // เบิกวัตถุดิบดิบแบบ FEFO/FIFO (ล็อตที่หมดอายุก่อน / รับเข้าก่อน ใช้ก่อน)
        await consumeFEFO(tx, {
          branchId,
          materialId: r.materialId,
          qty: needed,
          type: 'out',
          note: `ใช้หมัก "${prepItem.name}"`,
          staffId: req.staff.id,
          materialName: material?.name,
          forWhat: `หมัก "${prepItem.name}"`,
        });
      }

      // คำนวณวันหมดอายุจาก shelf_life_hours
      const expiresAt = prepItem.shelfLifeHours
        ? new Date(Date.now() + prepItem.shelfLifeHours * 3600 * 1000)
        : null;

      const batch = await tx.prepBatch.create({
        data: {
          branchId,
          prepItemId,
          batchNo: batchNo || null,
          qtyProduced,
          qtyRemaining: qtyProduced,
          preparedById: req.staff.id,
          expiresAt,
        },
      });

      return batch;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- ขั้นที่ 3: พร้อมขาย (จุดแปลงเป็นหน่วยครึ่งตัว) ----------

// POST /api/stock/ready/produce  body: { branchId, menuId, prepBatchId?, qtyWholeUnits }
// ทำเสร็จ -> พร้อมขาย: "ต้องมีของให้ตัดก่อนเสมอ" ไม่ใช่เพิ่มตัวเลขลอย ๆ
//   - เมนูที่สูตรใช้ "ของหมัก" (menu_recipe.prep_item_id): ตัดจากชุดหมักของสาขานี้
//       * ระบุ prepBatchId = ตัดจากชุดนั้น (ต้องตรงกับเมนู ยังไม่หมดอายุ และเหลือพอ)
//       * ไม่ระบุ = ตัดจากชุดที่หมักก่อนอัตโนมัติ (FIFO) ถ้ารวมกันยังไม่พอ = ปฏิเสธ ต้องหมักก่อน
//   - เมนูที่สูตรใช้ "วัตถุดิบดิบ" (menu_recipe.material_id): เบิกแบบ FEFO/FIFO ถ้าไม่พอ = ปฏิเสธ
//   - เมนูที่ไม่มีสูตรเลย: ไม่มีอะไรให้ตัด (เพิ่มเข้าสต็อกได้ตามเดิม)
// qtyWholeUnits = จำนวน "เต็มตัว" ที่ทำเสร็จ เช่น ทอดเป็ดเสร็จ 6 ตัว -> ระบบจะ x2 เป็น 12 หน่วยครึ่งตัวเข้าสต็อกขาย
router.post('/ready/produce', stockOnly, async (req, res) => {
  const branchId = Number(req.body.branchId);
  const menuId = Number(req.body.menuId);
  const qtyWholeUnits = Number(req.body.qtyWholeUnits);
  const prepBatchId = req.body.prepBatchId ? Number(req.body.prepBatchId) : null;

  if (!branchId || !menuId || !(qtyWholeUnits > 0)) {
    return res.status(400).json({ error: 'ต้องระบุ branchId, menuId, qtyWholeUnits' });
  }

  if (!Number.isInteger(qtyWholeUnits)) {
    return res.status(400).json({ error: 'จำนวนตัวเต็มต้องเป็นจำนวนเต็ม' });
  }

  const r3 = (n) => Math.round(n * 1000) / 1000;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.findUnique({ where: { id: menuId } });
      if (!menu) throw new Error('ไม่พบเมนูนี้');

      const recipe = await tx.menuRecipe.findMany({ where: { menuId } });
      const prepLines = recipe.filter((r) => r.prepItemId);
      const rawLines = recipe.filter((r) => !r.prepItemId && r.materialId);

      const perUnit = (r) => (Number(r.qtyPerUnit) > 0 ? Number(r.qtyPerUnit) : 1);
      const now = new Date();

      // ชุดหมักที่เลือกมา ต้องเป็นของสาขานี้ และตรงกับของหมักที่เมนูนี้ใช้
      if (prepBatchId) {
        const picked = await tx.prepBatch.findUnique({ where: { id: prepBatchId } });

        if (!picked || picked.branchId !== branchId) {
          throw new Error('ไม่พบชุดหมักนี้ในสาขาที่เลือก');
        }

        if (!prepLines.some((l) => l.prepItemId === picked.prepItemId)) {
          throw new Error(`ชุดหมัก #${picked.id} ไม่ใช่ของหมักที่เมนู "${menu.name}" ใช้`);
        }
      }

      // ---- ตัดของหมัก ----
      for (const line of prepLines) {
        const need = r3(perUnit(line) * qtyWholeUnits);
        const prepItem = await tx.prepItem.findUnique({ where: { id: line.prepItemId } });
        const label = prepItem ? `"${prepItem.name}"` : 'ของหมัก';

        const batches = await tx.prepBatch.findMany({
          where: { branchId, prepItemId: line.prepItemId, status: 'active', qtyRemaining: { gt: 0 } },
          orderBy: [{ preparedAt: 'asc' }, { id: 'asc' }], // FIFO - หมักก่อนใช้ก่อน
        });
        const usable = batches.filter((b) => !b.expiresAt || b.expiresAt > now);

        let pool = usable;

        if (prepBatchId) {
          const chosen = batches.find((b) => b.id === prepBatchId);
          const pickedItem = (await tx.prepBatch.findUnique({ where: { id: prepBatchId } }))?.prepItemId;
          const isThisLine = pickedItem === line.prepItemId;

          if (isThisLine) {
            if (!chosen) throw new Error('ไม่พบชุดหมักนี้ในสาขา หรือถูกใช้/ทิ้งไปแล้ว');
            if (chosen.expiresAt && chosen.expiresAt <= now) throw new Error(`ชุดหมัก #${chosen.id} หมดอายุแล้ว ต้องบันทึกทิ้งก่อน`);
            if (Number(chosen.qtyRemaining) + 0.0005 < need) {
              throw new Error(`ชุดหมัก #${chosen.id} เหลือ ${Number(chosen.qtyRemaining)} ไม่พอสำหรับ ${need} ตัว`);
            }
            pool = [chosen];
          }
        }

        const have = r3(pool.reduce((sum, b) => sum + Number(b.qtyRemaining), 0));

        if (have + 0.0005 < need) {
          throw new Error(
            `ของหมัก ${label} ในสาขานี้ไม่พอ (มี ${have}, ต้องการ ${need}) — ต้องหมักก่อนจึงจะทำเสร็จเป็นพร้อมขายได้`
          );
        }

        let left = need;

        for (const b of pool) {
          if (left <= 0) break;

          const take = r3(Math.min(left, Number(b.qtyRemaining)));
          const remaining = r3(Number(b.qtyRemaining) - take);

          await tx.prepBatch.update({
            where: { id: b.id },
            data: { qtyRemaining: remaining, status: remaining <= 0 ? 'used_up' : 'active' },
          });

          left = r3(left - take);
        }
      }

      // ---- เบิกวัตถุดิบดิบ (เมนูที่ไม่ผ่านขั้นหมัก) ----
      for (const line of rawLines) {
        const material = await tx.rawMaterial.findUnique({ where: { id: line.materialId } });

        await consumeFEFO(tx, {
          branchId,
          materialId: line.materialId,
          qty: r3(perUnit(line) * qtyWholeUnits),
          type: 'out',
          note: `ทำพร้อมขาย "${menu.name}" ${qtyWholeUnits} ตัว`,
          staffId: req.staff.id,
          materialName: material?.name,
          forWhat: `ทำ "${menu.name}"`,
        });
      }

      // ★ จุดแปลงหน่วย: เต็มตัว -> หน่วยครึ่งตัว (x2) เข้าสต็อกที่ขายได้จริง
      const halfUnitsToAdd = qtyWholeUnits * unitsPerWhole(menu);

      const stock = await tx.branchStock.upsert({
        where: { branchId_menuId: { branchId, menuId } },
        update: { qty: { increment: halfUnitsToAdd } },
        create: { branchId, menuId, qty: halfUnitsToAdd },
      });

      await tx.readyProductionLog.create({
        data: {
          branchId,
          menuId,
          prepBatchId: prepBatchId || null,
          qtyProduced: qtyWholeUnits,
          staffId: req.staff.id,
        },
      });

      await tx.stockLog.create({
        data: {
          branchId,
          menuId,
          type: 'in',
          qty: halfUnitsToAdd,
          note: `ผลิตพร้อมขาย ${qtyWholeUnits} ตัว (=${halfUnitsToAdd} หน่วยครึ่งตัว)`,
          staffId: req.staff.id,
        },
      });

      return { menu: menu.name, addedHalfUnits: halfUnitsToAdd, stock };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- โอนสต็อกระหว่างสาขา ----------

// POST /api/stock/transfer
// body: { fromBranchId, toBranchId, kind: 'ready' | 'raw',
//         menuId (kind=ready) / materialId (kind=raw),
//         qty  (ready = จำนวน "ตัวเต็ม", raw = ตามหน่วยวัตถุดิบ), note }
// ตัดจากสาขาต้นทาง แล้วเพิ่มให้สาขาปลายทาง ใน transaction เดียว
router.post('/transfer', stockOnly, async (req, res) => {
  const fromBranchId = Number(req.body.fromBranchId);
  const toBranchId = Number(req.body.toBranchId);
  const kind = req.body.kind === 'raw' ? 'raw' : 'ready';
  const qty = Number(req.body.qty);
  const extra = req.body.note ? ` (${String(req.body.note).slice(0, 80)})` : '';

  if (!fromBranchId || !toBranchId || !(qty > 0)) {
    return res.status(400).json({ error: 'ต้องระบุสาขาต้นทาง สาขาปลายทาง และจำนวน' });
  }

  if (fromBranchId === toBranchId) {
    return res.status(400).json({ error: 'สาขาต้นทางและปลายทางต้องเป็นคนละสาขา' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [from, to] = await Promise.all([
        tx.branch.findUnique({ where: { id: fromBranchId } }),
        tx.branch.findUnique({ where: { id: toBranchId } }),
      ]);

      if (!from || !to) throw new Error('ไม่พบสาขาที่เลือก');
      if (!to.isActive) throw new Error('สาขาปลายทางปิดใช้งานอยู่');

      if (kind === 'ready') {
        const menuId = Number(req.body.menuId);

        if (!Number.isInteger(qty)) {
          throw new Error('จำนวนตัวเต็มต้องเป็นจำนวนเต็ม');
        }

        const menu = await tx.menu.findUnique({ where: { id: menuId } });
        if (!menu) throw new Error('ไม่พบเมนูนี้');

        const units = qty * unitsPerWhole(menu);

        const source = await tx.branchStock.findUnique({
          where: { branchId_menuId: { branchId: fromBranchId, menuId } },
        });

        if (!source || Number(source.qty) < units) {
          throw new Error(`สต็อก "${menu.name}" ของ ${from.name} ไม่พอสำหรับโอน`);
        }

        await tx.branchStock.update({
          where: { branchId_menuId: { branchId: fromBranchId, menuId } },
          data: { qty: { decrement: units } },
        });

        await tx.branchStock.upsert({
          where: { branchId_menuId: { branchId: toBranchId, menuId } },
          update: { qty: { increment: units } },
          create: { branchId: toBranchId, menuId, qty: units },
        });

        await tx.stockLog.create({
          data: {
            branchId: fromBranchId,
            menuId,
            type: 'out',
            qty: units,
            note: `โอนไป ${to.name}${extra}`,
            staffId: req.staff.id,
          },
        });

        await tx.stockLog.create({
          data: {
            branchId: toBranchId,
            menuId,
            type: 'in',
            qty: units,
            note: `รับโอนจาก ${from.name}${extra}`,
            staffId: req.staff.id,
          },
        });

        return { kind, item: menu.name, qty, units, from: from.name, to: to.name };
      }

      // ---- วัตถุดิบดิบ ----
      const materialId = Number(req.body.materialId);

      const material = await tx.rawMaterial.findUnique({ where: { id: materialId } });
      if (!material) throw new Error('ไม่พบวัตถุดิบนี้');

      // ตัดจากสาขาต้นทางแบบ FEFO/FIFO แล้วส่ง "ล็อตเดิม" ไปปลายทาง (คงเลขล็อต/วันหมดอายุ/วันรับเข้า)
      const allocations = await consumeFEFO(tx, {
        branchId: fromBranchId,
        materialId,
        qty,
        type: 'out',
        note: `โอนไป ${to.name}${extra}`,
        staffId: req.staff.id,
        materialName: material.name,
        forWhat: 'โอน',
      });

      for (const a of allocations) {
        await receiveLot(tx, {
          branchId: toBranchId,
          materialId,
          qty: a.take,
          lotNo: a.lot.lotNo,
          expiresAt: a.lot.expiresAt,
          receivedAt: a.lot.receivedAt,
          supplier: a.lot.supplier,
          unitCost: a.lot.unitCost,
          note: `รับโอนจาก ${from.name}${extra}`,
          staffId: req.staff.id,
          merge: true,
          allowPast: true,
          // โอนล็อตเดิม: คงสถานะการเก็บ/วันหมดอายุเดิม ไม่คำนวณใหม่
          storage: a.lot.storage || 'ambient',
          frozenAt: a.lot.frozenAt,
          thawedAt: a.lot.thawedAt,
          expirySource: a.lot.expirySource,
          autoExpiry: false,
        });
      }

      return { kind, item: material.name, qty, unit: material.unit, from: from.name, to: to.name };
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- จุดแจ้งเตือนของใกล้หมด ----------

// PUT /api/stock/ready/reorder  body: { branchId, menuId, reorderPoint }
// reorderPoint = จำนวน "หน่วยครึ่งตัว" ที่เหลือแล้วให้แจ้งเตือน
router.put('/ready/reorder', stockOnly, async (req, res) => {
  const branchId = Number(req.body.branchId);
  const menuId = Number(req.body.menuId);
  const reorderPoint = Number(req.body.reorderPoint);

  if (!branchId || !menuId || !Number.isInteger(reorderPoint) || reorderPoint < 0) {
    return res.status(400).json({ error: 'ข้อมูลจุดแจ้งเตือนไม่ถูกต้อง' });
  }

  const row = await prisma.branchStock.upsert({
    where: { branchId_menuId: { branchId, menuId } },
    update: { reorderPoint },
    create: { branchId, menuId, qty: 0, reorderPoint },
  });

  res.json(row);
});

// ---------- ล็อตวัตถุดิบ / ทิ้งของ / ตรวจนับ ----------
router.use('/lots', require('./stockLots'));

module.exports = router;