const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

// =====================================================
// ข้าวเหนียว: พนักงานขายเป็นคนทำเอง จึงให้พนักงานขายบันทึกเอง
//   - ซื้อข้าวเหนียวดิบมากี่ กก.  -> เข้าสต็อกวัตถุดิบ (กก.)
//   - ทำเสร็จกี่ถุง               -> เข้าสต็อกพร้อมขาย (ถุง)
// (ไม่ผ่านฝ่ายสต็อก / ไม่ต้องมีของหมัก)
// =====================================================

const router = express.Router();

const isSticky = (name) => String(name || '').includes('ข้าวเหนียว');

// สต็อกพร้อมขายเก็บเป็น "หน่วย" ตามกติกาเดียวกับ stock.js
function unitsPerWhole(menu) {
  return menu.hasHalfOption || menu.category === 'duck' || menu.category === 'chicken' ? 2 : 1;
}

async function findStickyRice() {
  const menus = await prisma.menu.findMany({ orderBy: { id: 'asc' } });
  const menu = menus.find((m) => isSticky(m.name)) || null;

  const mats = await prisma.rawMaterial.findMany({ orderBy: { id: 'asc' } });
  const stickyMats = mats.filter((m) => isSticky(m.name));
  // เลือกตัวที่หน่วยเป็นกิโลก่อน
  const material =
    stickyMats.find((m) => /กก|กิโล|kg/i.test(String(m.unit || ''))) || stickyMats[0] || null;

  return { menu, material };
}

// GET /api/sticky-rice/:branchId
router.get('/:branchId', requireAuth, async (req, res) => {
  try {
    const branchId = Number(req.params.branchId);
    const { menu, material } = await findStickyRice();

    let bags = 0;
    let rawKg = 0;

    if (menu) {
      const row = await prisma.branchStock.findUnique({
        where: { branchId_menuId: { branchId, menuId: menu.id } },
      });
      bags = Number(row?.qty || 0) / unitsPerWhole(menu);
    }
    if (material) {
      const row = await prisma.branchStockRaw.findUnique({
        where: { branchId_materialId: { branchId, materialId: material.id } },
      });
      rawKg = Number(row?.qty || 0);
    }

    res.json({
      menuId: menu?.id || null,
      menuName: menu?.name || null,
      materialId: material?.id || null,
      materialName: material?.name || null,
      materialUnit: material?.unit || 'กก.',
      bags,
      rawKg,
    });
  } catch (err) {
    console.error('GET /sticky-rice error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลข้าวเหนียวได้' });
  }
});

// POST /api/sticky-rice/record
// body: { branchId, kgBought?, price?, bagsMade? }
router.post('/record', requireAuth, async (req, res) => {
  const branchId = Number(req.body.branchId);
  const kgBought = Number(req.body.kgBought || 0);
  const bagsMade = Number(req.body.bagsMade || 0);
  const price = Number(req.body.price || 0);

  if (!branchId) return res.status(400).json({ error: 'ต้องระบุสาขา' });
  if (!(kgBought > 0) && !(bagsMade > 0)) {
    return res.status(400).json({ error: 'กรอกจำนวน กก. ที่ซื้อ หรือจำนวนถุงที่ทำได้อย่างน้อย 1 อย่าง' });
  }
  if (kgBought < 0 || bagsMade < 0 || price < 0) {
    return res.status(400).json({ error: 'ตัวเลขต้องไม่ติดลบ' });
  }
  if (bagsMade > 0 && !Number.isInteger(bagsMade)) {
    return res.status(400).json({ error: 'จำนวนถุงต้องเป็นจำนวนเต็ม' });
  }

  try {
    const { menu, material } = await findStickyRice();
    if (kgBought > 0 && !material) {
      return res.status(400).json({ error: 'ไม่พบวัตถุดิบ "ข้าวเหนียว" ในระบบ' });
    }
    if (bagsMade > 0 && !menu) {
      return res.status(400).json({ error: 'ไม่พบเมนู "ข้าวเหนียว" ในระบบ' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const out = {};

      if (kgBought > 0) {
        if (price > 0) {
          await tx.rawMaterial.update({
            where: { id: material.id },
            data: { costPerUnit: Math.round((price / kgBought) * 100) / 100 },
          });
        }
        out.raw = await tx.branchStockRaw.upsert({
          where: { branchId_materialId: { branchId, materialId: material.id } },
          update: { qty: { increment: kgBought } },
          create: { branchId, materialId: material.id, qty: kgBought },
        });
        await tx.rawMaterialLog.create({
          data: {
            branchId,
            materialId: material.id,
            type: 'in',
            qty: kgBought,
            note: price > 0 ? `พนักงานขายซื้อข้าวเหนียว ${kgBought} กก. ราคา ${price} บาท` : `พนักงานขายซื้อข้าวเหนียว ${kgBought} กก.`,
            staffId: req.staff.id,
          },
        });
      }

      if (bagsMade > 0) {
        const unitsToAdd = bagsMade * unitsPerWhole(menu);
        out.ready = await tx.branchStock.upsert({
          where: { branchId_menuId: { branchId, menuId: menu.id } },
          update: { qty: { increment: unitsToAdd } },
          create: { branchId, menuId: menu.id, qty: unitsToAdd },
        });
        await tx.readyProductionLog.create({
          data: { branchId, menuId: menu.id, qtyProduced: bagsMade, staffId: req.staff.id },
        });
        await tx.stockLog.create({
          data: {
            branchId,
            menuId: menu.id,
            type: 'in',
            qty: unitsToAdd,
            note: `พนักงานขายทำข้าวเหนียวเสร็จ ${bagsMade} ถุง`,
            staffId: req.staff.id,
          },
        });
      }

      return out;
    });

    res.status(201).json({ ok: true, kgBought, bagsMade, ...result });
  } catch (err) {
    console.error('POST /sticky-rice/record error:', err);
    res.status(400).json({ error: err.message || 'บันทึกข้าวเหนียวไม่สำเร็จ' });
  }
});

module.exports = router;
