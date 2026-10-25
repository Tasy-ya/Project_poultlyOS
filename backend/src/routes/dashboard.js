const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function menuCostPerUnit(menuId, cache) {
  if (cache.has(menuId)) return cache.get(menuId);

  // ต้นทุนที่แอดมินกำหนดไว้ที่เมนู (ถ้ามี) ใช้ก่อนสูตรวัตถุดิบ
  const menuRow = await prisma.menu.findUnique({ where: { id: menuId }, select: { cost: true } });
  if (menuRow && Number(menuRow.cost) > 0) {
    cache.set(menuId, Number(menuRow.cost));
    return Number(menuRow.cost);
  }

  const recipe = await prisma.menuRecipe.findMany({ where: { menuId } });
  let cost = 0;

  for (const r of recipe) {
    if (r.materialId) {
      const m = await prisma.rawMaterial.findUnique({ where: { id: r.materialId } });
      if (m) cost += Number(r.qtyPerUnit) * Number(m.costPerUnit);
    } else if (r.prepItemId) {
      const prepRecipe = await prisma.prepRecipe.findMany({ where: { prepItemId: r.prepItemId } });
      let unitCost = 0;
      for (const p of prepRecipe) {
        const m = await prisma.rawMaterial.findUnique({ where: { id: p.materialId } });
        if (m) unitCost += Number(p.qtyPerUnit) * Number(m.costPerUnit);
      }
      cost += Number(r.qtyPerUnit) * unitCost;
    }
  }

  cache.set(menuId, cost);
  return cost;
}

// GET /api/dashboard/summary?branchId=1&date=2026-10-02
// ★ ค่าเริ่มต้น (ไม่ส่ง date มา) = "วันนี้" เท่านั้น -> รีเซ็ตเองทุกวันโดยอัตโนมัติ
router.get('/summary', requireAuth, async (req, res) => {
  const { branchId, date } = req.query;
  const bId = branchId ? Number(branchId) : null;

  const day = date ? new Date(date) : new Date();
  const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 3600 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: 'completed',
      ...(bId ? { branchId: bId } : {}),
      createdAt: { gte: startOfDay, lt: endOfDay },
    },
    include: { items: true },
  });

  const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
  const discount = orders.reduce((s, o) => s + Number(o.discountAmount), 0);
  const orderCount = orders.length;

  // ค่าใช้จ่ายเฉพาะ "วัน" ที่ดู (เก็บเป็นวันที่แบบ UTC เที่ยงคืน)
  const expenseDay = new Date(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
  );

  const expenses = await prisma.otherExpense.findMany({
    where: { ...(bId ? { branchId: bId } : {}), expenseDate: expenseDay },
  });
  const otherExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const costCache = new Map();
  let cogs = 0;
  for (const o of orders) {
    for (const item of o.items) {
      const perUnit = await menuCostPerUnit(item.menuId, costCache);
      const units = item.size === 'half' ? item.qty * 0.5 : item.qty;
      cogs += perUnit * units;
    }
  }

  const stockRows = await prisma.branchStock.findMany({
    where: bId ? { branchId: bId } : {},
    include: { menu: true },
  });
  const stock = stockRows.map((s) => ({
    menuId: s.menuId,
    name: s.menu?.name || '',
    qty: s.qty,
    reorderPoint: s.reorderPoint || 0,
    // สต็อกเก็บเป็นหน่วยครึ่งตัว: เป็ด/ไก่ 1 ตัว = 2 หน่วย (ใช้แสดงผลเป็น "ตัว")
    unitsPerWhole:
      s.menu?.hasHalfOption ||
      s.menu?.category === 'duck' ||
      s.menu?.category === 'chicken'
        ? 2
        : 1,
  }));
  const lowStockCount = stock.filter((s) => s.qty <= s.reorderPoint).length;

  const estimatedProfit = revenue - otherExpense - cogs;

  res.json({
    date: startOfDay.toISOString().slice(0, 10),
    orderCount,
    revenue,
    discount,
    otherExpense,
    cogs,
    estimatedProfit,
    netProfit: estimatedProfit,
    lowStockCount,
    stock,
  });
});

module.exports = router;