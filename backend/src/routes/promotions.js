const express = require('express');
const prisma = require('../db');

const router = express.Router();

// GET /api/promotions/active?branchId=1 - โปรโมชั่นที่ใช้ได้ตอนนี้ - ไม่ต้อง login
router.get('/active', async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;
  const today = new Date();

  const promos = await prisma.promotion.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: today } }] },
        { OR: [{ endDate: null }, { endDate: { gte: today } }] },
        { OR: [{ branchId: null }, { branchId }] },
      ],
    },
    include: { promotionMenus: true },
  });

  res.json(promos);
});

module.exports = router;
