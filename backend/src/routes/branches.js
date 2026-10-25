const express = require('express')
const prisma = require('../db')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

// =====================================================
// สิทธิ์
// -----------------------------------------------------
// GET: พนักงานทุกคนที่ล็อกอินเรียกได้ (ใช้ในกล่องเลือกสาขา)
// POST / PUT / DELETE: ควรเป็นแอดมินเท่านั้น
// ถ้ามี middleware เช็ก role อยู่แล้ว ให้เปลี่ยนบรรทัดล่างเป็น
//   const adminOnly = [requireAuth, requireAdmin]
// =====================================================

const adminOnly = [requireAuth]

function cleanText(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text === '' ? null : text
}

function readActive(body) {
  if (body.isActive !== undefined) return Boolean(body.isActive)
  if (body.is_active !== undefined) return Boolean(body.is_active)
  return undefined
}

// =====================================================
// สร้าง BranchStock ให้สาขาใหม่
// -----------------------------------------------------
// เมนูเป็นข้อมูลกลาง แต่สต็อกแยกตามสาขา (ตาราง BranchStock)
// สาขาใหม่ต้องมีแถวสต็อกของทุกเมนู ไม่งั้นหน้าขายและหน้า Stock จะว่าง
// - จำนวนเริ่มที่ 0 เสมอ (ไม่คัดลอกสต็อกจากสาขาอื่น)
// - ถ้าเลือกสาขาต้นแบบ จะคัดลอกจุดสั่งซื้อ (reorderPoint) ตามมาด้วย
// =====================================================

async function createBranchStock(tx, targetId, sourceId) {
  const menus = await tx.menu.findMany({
    select: { id: true },
  })

  if (menus.length === 0) return

  let reorderByMenu = new Map()

  if (sourceId) {
    const sourceStock = await tx.branchStock.findMany({
      where: { branchId: sourceId },
      select: { menuId: true, reorderPoint: true },
    })

    reorderByMenu = new Map(
      sourceStock.map(row => [row.menuId, row.reorderPoint ?? 0])
    )
  }

  await tx.branchStock.createMany({
    data: menus.map(menu => ({
      branchId: targetId,
      menuId: menu.id,
      qty: 0,
      reorderPoint: reorderByMenu.get(menu.id) ?? 0,
    })),
    skipDuplicates: true,
  })
}

// =====================================================
// คัดลอกโปรโมชั่นจากสาขาต้นแบบ (รวมรายการเมนูที่ร่วมโปรโมชั่น)
// =====================================================

async function copyBranchData(tx, sourceId, targetId) {
  const promotions = await tx.promotion.findMany({
    where: { branchId: sourceId },
    include: { promotionMenus: true },
  })

  for (const promotion of promotions) {
    const { id, branchId, promotionMenus, ...rest } = promotion

    await tx.promotion.create({
      data: {
        ...rest,
        branchId: targetId,
        promotionMenus: {
          create: promotionMenus.map(item => ({
            menuId: item.menuId,
          })),
        },
      },
    })
  }
}

// =====================================================
// GET /api/branches
// ดึงรายการสาขาทั้งหมด
// =====================================================

router.get(
  '/',
  requireAuth,
  async (req, res) => {
    try {
      const branches = await prisma.branch.findMany({
        orderBy: {
          id: 'asc',
        },
      })

      res.json(branches)
    } catch (error) {
      console.error('Get branches error:', error)

      res.status(500).json({
        error: 'ไม่สามารถโหลดข้อมูลสาขาได้',
        detail: error.message,
      })
    }
  }
)

// =====================================================
// GET /api/branches/:id
// ดึงข้อมูลสาขาตาม ID
// =====================================================

router.get(
  '/:id',
  requireAuth,
  async (req, res) => {
    try {
      const id = Number(req.params.id)

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: 'รหัสสาขาไม่ถูกต้อง',
        })
      }

      const branch = await prisma.branch.findUnique({
        where: {
          id,
        },
      })

      if (!branch) {
        return res.status(404).json({
          error: 'ไม่พบสาขาที่ต้องการ',
        })
      }

      res.json(branch)
    } catch (error) {
      console.error('Get branch error:', error)

      res.status(500).json({
        error: 'ไม่สามารถโหลดข้อมูลสาขาได้',
        detail: error.message,
      })
    }
  }
)

// =====================================================
// POST /api/branches
// เพิ่มสาขาใหม่ (คัดลอกจากสาขาต้นแบบได้)
// =====================================================

router.post(
  '/',
  adminOnly,
  async (req, res) => {
    try {
      const body = req.body || {}

      const name = cleanText(body.name)
      const address = cleanText(body.address)

      if (!name) {
        return res.status(400).json({
          error: 'กรุณากรอกชื่อสาขา',
        })
      }

      if (!address) {
        return res.status(400).json({
          error: 'กรุณากรอกที่อยู่สาขา',
        })
      }

      const code = cleanText(body.code)
      const isActive = readActive(body)

      const sourceNumber = Number(body.copyFromBranchId)

      const sourceId =
        Number.isInteger(sourceNumber) && sourceNumber > 0
          ? sourceNumber
          : null

      const branch = await prisma.$transaction(async tx => {
        const created = await tx.branch.create({
          data: {
            name,
            code: code ? code.toUpperCase() : null,
            province: cleanText(body.province),
            address,
            phone: cleanText(body.phone),
            isActive: isActive ?? true,
          },
        })

        // สต็อกของทุกเมนูสำหรับสาขาใหม่ (เริ่มที่ 0)
        await createBranchStock(tx, created.id, sourceId)

        // คัดลอกโปรโมชั่นของสาขาต้นแบบ
        if (sourceId) {
          await copyBranchData(tx, sourceId, created.id)
        }

        return created
      })

      res.status(201).json(branch)
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: 'รหัสสาขานี้ถูกใช้แล้ว',
        })
      }

      console.error('Create branch error:', error)

      res.status(500).json({
        error: 'ไม่สามารถเพิ่มสาขาได้',
        detail: error.message,
      })
    }
  }
)

// =====================================================
// PUT /api/branches/:id
// แก้ไขข้อมูลสาขา
// =====================================================

router.put(
  '/:id',
  adminOnly,
  async (req, res) => {
    try {
      const id = Number(req.params.id)

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: 'รหัสสาขาไม่ถูกต้อง',
        })
      }

      const body = req.body || {}

      const name = cleanText(body.name)
      const address = cleanText(body.address)

      if (!name) {
        return res.status(400).json({
          error: 'กรุณากรอกชื่อสาขา',
        })
      }

      if (!address) {
        return res.status(400).json({
          error: 'กรุณากรอกที่อยู่สาขา',
        })
      }

      const code = cleanText(body.code)
      const isActive = readActive(body)

      // ห้ามปิดสาขาสุดท้ายที่ยังเปิดอยู่ ไม่งั้นกล่องเลือกสาขาจะว่าง
      if (isActive === false) {
        const otherActive = await prisma.branch.count({
          where: {
            isActive: true,
            NOT: { id },
          },
        })

        if (otherActive === 0) {
          return res.status(400).json({
            error: 'ต้องมีสาขาที่เปิดใช้งานอย่างน้อย 1 สาขา',
          })
        }
      }

      const branch = await prisma.branch.update({
        where: { id },
        data: {
          name,
          code: code ? code.toUpperCase() : null,
          province: cleanText(body.province),
          address,
          phone: cleanText(body.phone),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      })

      res.json(branch)
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'ไม่พบสาขาที่ต้องการ',
        })
      }

      if (error.code === 'P2002') {
        return res.status(409).json({
          error: 'รหัสสาขานี้ถูกใช้แล้ว',
        })
      }

      console.error('Update branch error:', error)

      res.status(500).json({
        error: 'ไม่สามารถแก้ไขสาขาได้',
        detail: error.message,
      })
    }
  }
)

// =====================================================
// DELETE /api/branches/:id
// ลบสาขา (ถ้ามีประวัติการขายผูกอยู่ ให้ปิดใช้งานแทน)
// =====================================================

router.delete(
  '/:id',
  adminOnly,
  async (req, res) => {
    try {
      const id = Number(req.params.id)

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          error: 'รหัสสาขาไม่ถูกต้อง',
        })
      }

      const total = await prisma.branch.count()

      if (total <= 1) {
        return res.status(400).json({
          error: 'ไม่สามารถลบสาขาสุดท้ายได้',
        })
      }

      const target = await prisma.branch.findUnique({
        where: { id },
      })

      if (!target) {
        return res.status(404).json({
          error: 'ไม่พบสาขาที่ต้องการ',
        })
      }

      if (target.isActive) {
        const otherActive = await prisma.branch.count({
          where: {
            isActive: true,
            NOT: { id },
          },
        })

        if (otherActive === 0) {
          return res.status(400).json({
            error: 'ต้องมีสาขาที่เปิดใช้งานอย่างน้อย 1 สาขา',
          })
        }
      }

      // ---------------------------------------------------
      // ถ้าสาขามีประวัติการขายอยู่ ห้ามลบจริง (จะทำให้ยอดขายเก่าหาย)
      // ให้ "ปิดใช้งาน" แทน -> สาขาจะหายจากกล่องเลือกสาขาทุกหน้าทันที
      // และยังไปดูได้ในหน้าจัดการสาขา แท็บ "ปิดใช้งาน"
      // ---------------------------------------------------
      const orderCount = await prisma.order.count({
        where: { branchId: id },
      })

      if (orderCount > 0) {
        await prisma.branch.update({
          where: { id },
          data: { isActive: false },
        })

        return res.json({
          ok: true,
          archived: true,
          message:
            'สาขานี้มีประวัติการขายอยู่ จึงปิดใช้งานแทนการลบ (สาขาจะไม่แสดงในกล่องเลือกสาขาอีก)',
        })
      }

      // ---------------------------------------------------
      // ไม่มีประวัติการขาย -> ลบสาขาพร้อมข้อมูลที่ผูกอยู่ทั้งหมด
      // (ทำใน transaction เดียว ถ้าพลาดจะย้อนกลับทั้งหมด)
      // ---------------------------------------------------
      await prisma.$transaction(async tx => {
        const where = { branchId: id }

        await tx.notification.deleteMany({ where })
        await tx.stockLog.deleteMany({ where })
        await tx.branchStock.deleteMany({ where })
        await tx.readyProductionLog.deleteMany({ where })
        await tx.prepBatch.deleteMany({ where })
        await tx.rawMaterialLog.deleteMany({ where })
        await tx.rawMaterialLot.deleteMany({ where })
        await tx.branchStockRaw.deleteMany({ where })
        await tx.otherExpense.deleteMany({ where })
        await tx.shift.deleteMany({ where })

        const reservations = await tx.reservation.findMany({
          where,
          select: { id: true },
        })

        if (reservations.length > 0) {
          await tx.reservationItem.deleteMany({
            where: {
              reservationId: {
                in: reservations.map(r => r.id),
              },
            },
          })

          await tx.reservation.deleteMany({ where })
        }

        const promotions = await tx.promotion.findMany({
          where,
          select: { id: true },
        })

        if (promotions.length > 0) {
          await tx.promotionMenu.deleteMany({
            where: {
              promotionId: {
                in: promotions.map(p => p.id),
              },
            },
          })

          await tx.promotion.deleteMany({ where })
        }

        // พนักงานของสาขานี้ไม่ถูกลบ แต่ไม่ผูกสาขาแล้ว
        await tx.staff.updateMany({
          where,
          data: { branchId: null },
        })

        await tx.branch.delete({
          where: { id },
        })
      })

      res.json({ ok: true })
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          error: 'ไม่พบสาขาที่ต้องการ',
        })
      }

      if (error.code === 'P2003') {
        return res.status(409).json({
          error: 'สาขานี้มีข้อมูลที่เกี่ยวข้องอยู่ ลบไม่ได้ ให้ปิดใช้งานแทน',
        })
      }

      console.error('Delete branch error:', error)

      res.status(500).json({
        error: 'ไม่สามารถลบสาขาได้',
        detail: error.message,
      })
    }
  }
)

module.exports = router
