const express = require('express')
const prisma = require('../db')
const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth')

const router = express.Router()


// =====================================================
// ชื่อหมวดที่รองรับครึ่งตัว
// =====================================================

function supportsHalfOption(category) {
  return (
    category === 'duck' ||
    category === 'chicken'
  )
}


// =====================================================
// GET /api/menus
// ดึงเมนูทั้งหมด
// =====================================================

router.get('/', async (req, res) => {

  try {

    const { category } = req.query

    const menus = await prisma.menu.findMany({

      where: category
        ? { category }
        : {},

      orderBy: {
        name: 'asc',
      },

    })

    // บังคับให้เป็ดและไก่รองรับครึ่งตัว
    const result = menus.map(menu => ({

      ...menu,

      hasHalfOption:
        menu.hasHalfOption ||
        supportsHalfOption(menu.category),

    }))

    res.json(result)

  } catch (error) {

    console.error('GET /menus error:', error)

    res.status(500).json({
      error: 'ไม่สามารถโหลดเมนูได้',
    })

  }

})


// =====================================================
// GET /api/menus/:branchId/stock
// ดึงสินค้าของสาขา
// =====================================================

router.get('/:branchId/stock', requireAuth, async (req, res) => {

  try {

    const branchId = Number(req.params.branchId)

    if (!Number.isInteger(branchId)) {

      return res.status(400).json({
        error: 'branchId ไม่ถูกต้อง',
      })

    }

    const stock = await prisma.branchStock.findMany({

      where: {
        branchId,
      },

      include: {
        menu: true,
      },

      orderBy: {
        menu: {
          name: 'asc',
        },
      },

    })


    // =================================================
    // สำคัญ
    // ทำให้เป็ดและไก่มี hasHalfOption = true
    // =================================================

    const result = stock.map(item => ({

      ...item,

      menu: item.menu
        ? {
            ...item.menu,

            hasHalfOption:
              item.menu.hasHalfOption ||
              supportsHalfOption(item.menu.category),

          }
        : null,

    }))


    res.json(result)

  } catch (error) {

    console.error(
      'GET /menus/:branchId/stock error:',
      error
    )

    res.status(500).json({
      error: 'ไม่สามารถโหลดสต็อกสินค้าได้',
    })

  }

})


// =====================================================
// POST /api/menus
// เพิ่มเมนูใหม่
// =====================================================

router.post('/', requireAuth, requireAdmin, async (req, res) => {

  try {

    const {
      name,
      unit,
      price,
      hasHalfOption,
      category,
    } = req.body


    if (!name || price === undefined) {

      return res.status(400).json({
        error: 'กรุณาระบุชื่อสินค้าและราคา',
      })

    }


    // เป็ดและไก่เปิดใช้ครึ่งตัวอัตโนมัติ
    const finalHasHalfOption =
      hasHalfOption !== undefined
        ? !!hasHalfOption
        : supportsHalfOption(category)


    const menu = await prisma.menu.create({

      data: {

        name: name.trim(),

        unit:
          unit ||
          'ตัว',

        price:
          Number(price),

        hasHalfOption:
          finalHasHalfOption,

        category:
          category ||
          'other',

      },

    })


    // ===================================================
    // สร้าง BranchStock ให้ทุกสาขา
    // ===================================================

    const branches =
      await prisma.branch.findMany({

        select: {
          id: true,
        },

      })


    if (branches.length > 0) {

      await prisma.branchStock.createMany({

        data: branches.map(branch => ({

          branchId:
            branch.id,

          menuId:
            menu.id,

          qty:
            0,

          reorderPoint:
            0,

        })),

        skipDuplicates: true,

      })

    }


    res.status(201).json(menu)

  } catch (error) {

    console.error(
      'POST /menus error:',
      error
    )

    res.status(500).json({
      error: 'ไม่สามารถเพิ่มสินค้าได้',
    })

  }

})


// =====================================================
// PUT /api/menus/:id
// แก้ไขสินค้า
// =====================================================

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {

  try {

    const id =
      Number(req.params.id)


    if (!Number.isInteger(id)) {

      return res.status(400).json({
        error: 'รหัสสินค้าไม่ถูกต้อง',
      })

    }


    const {
      name,
      price,
      unit,
      hasHalfOption,
      category,
    } = req.body


    const data = {}


    if (name !== undefined) {

      data.name =
        String(name).trim()

    }


    if (price !== undefined) {

      data.price =
        Number(price)

    }


    if (unit !== undefined) {

      data.unit =
        unit

    }


    if (category !== undefined) {

      data.category =
        category

    }


    // =================================================
    // จัดการครึ่งตัว
    // =================================================

    if (hasHalfOption !== undefined) {

      data.hasHalfOption =
        !!hasHalfOption

    } else if (category !== undefined) {

      // ถ้าเปลี่ยนเป็นเป็ดหรือไก่
      // ให้เปิดครึ่งตัวอัตโนมัติ

      if (supportsHalfOption(category)) {

        data.hasHalfOption =
          true

      }

    }


    const menu =
      await prisma.menu.update({

        where: {
          id,
        },

        data,

      })


    res.json(menu)

  } catch (error) {

    console.error(
      'PUT /menus/:id error:',
      error
    )

    res.status(500).json({
      error: 'ไม่สามารถแก้ไขสินค้าได้',
    })

  }

})


// =====================================================
// DELETE /api/menus/:id
// ลบสินค้า
// =====================================================

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {

  try {

    const id =
      Number(req.params.id)


    if (!Number.isInteger(id)) {

      return res.status(400).json({
        error: 'รหัสสินค้าไม่ถูกต้อง',
      })

    }


    // ลบ BranchStock ก่อน
    await prisma.branchStock.deleteMany({

      where: {
        menuId: id,
      },

    })


    // ลบสินค้า
    await prisma.menu.delete({

      where: {
        id,
      },

    })


    res.json({
      deleted: true,
    })

  } catch (error) {

    console.error(
      'DELETE /menus/:id error:',
      error
    )

    res.status(500).json({
      error: 'ไม่สามารถลบสินค้าได้',
    })

  }

})


// =====================================================
// GET /api/menus/reference/raw-materials
// =====================================================

router.get(
  '/reference/raw-materials',
  requireAuth,
  async (req, res) => {

    try {

      const { category } =
        req.query

      const materials =
        await prisma.rawMaterial.findMany({

          where: category
            ? { category }
            : {},

        })

      res.json(materials)

    } catch (error) {

      console.error(
        'GET raw-materials error:',
        error
      )

      res.status(500).json({
        error: 'ไม่สามารถโหลดวัตถุดิบได้',
      })

    }

  }
)


// =====================================================
// GET /api/menus/reference/prep-items
// =====================================================

router.get(
  '/reference/prep-items',
  requireAuth,
  async (req, res) => {

    try {

      const { category } =
        req.query

      const items =
        await prisma.prepItem.findMany({

          where: category
            ? { category }
            : {},

        })

      res.json(items)

    } catch (error) {

      console.error(
        'GET prep-items error:',
        error
      )

      res.status(500).json({
        error: 'ไม่สามารถโหลดรายการเตรียมได้',
      })

    }

  }
)


module.exports = router