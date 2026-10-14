const express = require('express');
const prisma = require('../db');
const { requireAuth, requireDept } = require('../middleware/auth');

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

// POST /api/stock/raw/receive  body: { branchId, materialId, qty, note }
// รับวัตถุดิบสดเข้าสต็อก
router.post('/raw/receive', stockOnly, async (req, res) => {
  const { branchId, materialId, qty, note, cost } = req.body;
  if (!branchId || !materialId || !qty) {
    return res.status(400).json({ error: 'ต้องระบุ branchId, materialId, qty' });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (cost) await tx.rawMaterial.update({ where: { id: materialId }, data: { costPerUnit: cost } });
    const stock = await tx.branchStockRaw.upsert({
      where: { branchId_materialId: { branchId, materialId } },
      update: { qty: { increment: qty } },
      create: { branchId, materialId, qty },
    });
    await tx.rawMaterialLog.create({
      data: { branchId, materialId, type: 'in', qty, note, staffId: req.staff.id },
    });
    return stock;
  });

  res.status(201).json(result);
});

// ---------- ขั้นที่ 2: หมัก (prep) ----------

// GET /api/stock/prep/:branchId - ล็อตของหมักที่ยังใช้ได้ (active)
router.get('/prep/:branchId', stockOnly, async (req, res) => {
  const branchId = Number(req.params.branchId);
  const { category } = req.query;
  const batches = await prisma.prepBatch.findMany({
    where: { branchId, status: 'active', ...(category ? { prepItem: { category } } : {}) },
    include: { prepItem: true },
    orderBy: { expiresAt: 'asc' }, // FEFO - ใกล้หมดอายุก่อน
  });
  res.json(batches);
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
        const rawStock = await tx.branchStockRaw.findUnique({
          where: { branchId_materialId: { branchId, materialId: r.materialId } },
        });
        if (!rawStock || Number(rawStock.qty) < needed) {
          throw new Error(`วัตถุดิบดิบไม่พอสำหรับหมัก "${prepItem.name}"`);
        }
        await tx.branchStockRaw.update({
          where: { branchId_materialId: { branchId, materialId: r.materialId } },
          data: { qty: { decrement: needed } },
        });
        await tx.rawMaterialLog.create({
          data: {
            branchId,
            materialId: r.materialId,
            type: 'out',
            qty: needed,
            note: `ใช้หมัก "${prepItem.name}"`,
            staffId: req.staff.id,
          },
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
// นำของหมัก (หรือวัตถุดิบดิบ ถ้าเมนูไม่ผ่านขั้นหมัก) มาทำเป็นพร้อมขาย
// qtyWholeUnits = จำนวน "เต็มตัว" ที่ทำเสร็จ เช่น ทอดเป็ดเสร็จ 6 ตัว -> ระบบจะ x2 เป็น 12 หน่วยครึ่งตัวเข้าสต็อกขาย
router.post('/ready/produce', stockOnly, async (req, res) => {
  const { branchId, menuId, prepBatchId, qtyWholeUnits } = req.body;
  if (!branchId || !menuId || !qtyWholeUnits) {
    return res.status(400).json({ error: 'ต้องระบุ branchId, menuId, qtyWholeUnits' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const menu = await tx.menu.findUnique({ where: { id: menuId } });
      if (!menu) throw new Error('ไม่พบเมนูนี้');

      // ถ้าอ้างอิงล็อตของหมัก ให้ตัด qty_remaining ของล็อตนั้น
      if (prepBatchId) {
        const batch = await tx.prepBatch.findUnique({ where: { id: prepBatchId } });
        if (!batch || Number(batch.qtyRemaining) < qtyWholeUnits) {
          throw new Error('ของหมักในล็อตนี้เหลือไม่พอ');
        }
        const remaining = Number(batch.qtyRemaining) - qtyWholeUnits;
        await tx.prepBatch.update({
          where: { id: prepBatchId },
          data: { qtyRemaining: remaining, status: remaining <= 0 ? 'used_up' : 'active' },
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

      const source = await tx.branchStockRaw.findUnique({
        where: { branchId_materialId: { branchId: fromBranchId, materialId } },
      });

      if (!source || Number(source.qty) < qty) {
        throw new Error(`วัตถุดิบ "${material.name}" ของ ${from.name} ไม่พอสำหรับโอน`);
      }

      await tx.branchStockRaw.update({
        where: { branchId_materialId: { branchId: fromBranchId, materialId } },
        data: { qty: { decrement: qty } },
      });

      await tx.branchStockRaw.upsert({
        where: { branchId_materialId: { branchId: toBranchId, materialId } },
        update: { qty: { increment: qty } },
        create: { branchId: toBranchId, materialId, qty },
      });

      await tx.rawMaterialLog.create({
        data: {
          branchId: fromBranchId,
          materialId,
          type: 'out',
          qty,
          note: `โอนไป ${to.name}${extra}`,
          staffId: req.staff.id,
        },
      });

      await tx.rawMaterialLog.create({
        data: {
          branchId: toBranchId,
          materialId,
          type: 'in',
          qty,
          note: `รับโอนจาก ${from.name}${extra}`,
          staffId: req.staff.id,
        },
      });

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

module.exports = router;
