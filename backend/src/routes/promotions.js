const express = require('express');
const prisma = require('../db');
const { livePromotions, toPublicView } = require('../lib/shopPromotions');

const router = express.Router();

// GET /api/promotions/active?branchId=1 - ส่วนลดที่ใช้ได้ตอนนี้ (ตะกร้าพนักงาน) - ไม่ต้อง login
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

// GET /api/promotions/shop?branchId=1 - โปรโมชั่น/กิจกรรมที่แอดมินสร้าง (แสดงที่หน้าหลักพนักงาน)
// เฉพาะที่กำลังใช้งานวันนี้และติ๊ก "แสดงให้พนักงานเห็น"
router.get('/shop', async (req, res) => {
  const rows = await livePromotions(prisma, req.query.branchId, 'staff');
  res.json(rows.map(toPublicView));
});

module.exports = router;
