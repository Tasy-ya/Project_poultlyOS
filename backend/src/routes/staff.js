const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../../db');
const { requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();
router.use(requireAdminAuth);

// GET /api/admin/staff?branchId=
router.get('/', async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const staff = await prisma.staff.findMany({
    where: branchId ? { branchId } : {},
    select: { id: true, name: true, position: true, branchId: true, dailyWage: true, active: true },
    orderBy: { name: 'asc' },
  });
  res.json(staff);
});

// POST /api/admin/staff  body: { name, position, branchId, dailyWage, pin }
router.post('/', async (req, res) => {
  const { name, position, branchId, dailyWage, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'ต้องระบุ name และ pin' });

  const pinHash = await bcrypt.hash(pin, 10);
  const staff = await prisma.staff.create({
    data: { name, position, branchId: branchId ? Number(branchId) : null, dailyWage, pinHash, active: true },
  });
  res.status(201).json({ id: staff.id, name: staff.name });
});

// PUT /api/admin/staff/:id  body: { name?, position?, branchId?, dailyWage?, active? }
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, position, branchId, dailyWage, active } = req.body;
  const staff = await prisma.staff.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(position !== undefined ? { position } : {}),
      ...(branchId !== undefined ? { branchId: Number(branchId) } : {}),
      ...(dailyWage !== undefined ? { dailyWage } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });
  res.json(staff);
});

// PUT /api/admin/staff/:id/reset-pin  body: { pin }
router.put('/:id/reset-pin', async (req, res) => {
  const id = Number(req.params.id);
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'ต้องระบุ pin ใหม่' });
  const pinHash = await bcrypt.hash(pin, 10);
  await prisma.staff.update({ where: { id }, data: { pinHash } });
  res.json({ ok: true });
});

// DELETE /api/admin/staff/:id  (ปิดใช้งานแทนการลบจริง กันประวัติ order พัง)
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.staff.update({ where: { id }, data: { active: false } });
  res.json({ ok: true, note: 'ปิดใช้งานพนักงานแล้ว (ไม่ลบประวัติ)' });
});

module.exports = router;
