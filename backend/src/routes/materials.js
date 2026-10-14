const express = require('express');
const prisma = require('../../db');
const { requireAdminAuth } = require('../../middleware/adminAuth');

const router = express.Router();
router.use(requireAdminAuth);

// GET /api/admin/materials?category=
router.get('/', async (req, res) => {
  const { category } = req.query;
  res.json(await prisma.rawMaterial.findMany({ where: category ? { category } : {} }));
});

// POST /api/admin/materials  body: { name, unit, costPerUnit, category }
router.post('/', async (req, res) => {
  const { name, unit, costPerUnit, category } = req.body;
  if (!name || !unit || costPerUnit === undefined) {
    return res.status(400).json({ error: 'ต้องระบุ name, unit, costPerUnit' });
  }
  const material = await prisma.rawMaterial.create({ data: { name, unit, costPerUnit, category } });
  res.status(201).json(material);
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, unit, costPerUnit, category } = req.body;
  const material = await prisma.rawMaterial.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(costPerUnit !== undefined ? { costPerUnit } : {}),
      ...(category !== undefined ? { category } : {}),
    },
  });
  res.json(material);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.rawMaterial.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: 'ลบไม่ได้ เพราะมีสูตรหรือสต็อกผูกอยู่' });
  }
});

// ---- prep items (ของหมัก) + สูตร ----

// GET /api/admin/materials/prep-items?category=
router.get('/prep-items', async (req, res) => {
  const { category } = req.query;
  const items = await prisma.prepItem.findMany({
    where: category ? { category } : {},
    include: { prepRecipe: { include: { material: true } } },
  });
  res.json(items);
});

// POST /api/admin/materials/prep-items
// body: { name, unit, shelfLifeHours, category, recipe: [{materialId, qtyPerUnit}] }
router.post('/prep-items', async (req, res) => {
  const { name, unit, shelfLifeHours, category, recipe } = req.body;
  if (!name || !unit) return res.status(400).json({ error: 'ต้องระบุ name และ unit' });

  const item = await prisma.prepItem.create({ data: { name, unit, shelfLifeHours, category } });

  if (Array.isArray(recipe) && recipe.length) {
    await prisma.prepRecipe.createMany({
      data: recipe.map((r) => ({
        prepItemId: item.id,
        materialId: Number(r.materialId),
        qtyPerUnit: r.qtyPerUnit,
      })),
    });
  }

  res.status(201).json(item);
});

// PUT /api/admin/materials/prep-items/:id/recipe - แก้สูตรทั้งชุด (ลบของเก่า ใส่ใหม่)
router.put('/prep-items/:id/recipe', async (req, res) => {
  const prepItemId = Number(req.params.id);
  const { recipe } = req.body; // [{materialId, qtyPerUnit}]
  await prisma.prepRecipe.deleteMany({ where: { prepItemId } });
  if (Array.isArray(recipe) && recipe.length) {
    await prisma.prepRecipe.createMany({
      data: recipe.map((r) => ({ prepItemId, materialId: Number(r.materialId), qtyPerUnit: r.qtyPerUnit })),
    });
  }
  res.json({ ok: true });
});

module.exports = router;
