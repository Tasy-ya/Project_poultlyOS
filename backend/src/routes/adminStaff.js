const express = require('express')
const bcrypt = require('bcryptjs')
const prisma = require('../db')
const {
  requireAuth,
  requireAdmin,
  invalidateStaff,
} = require('../middleware/auth')

const router = express.Router()

// =====================================================
// GET /api/admin/staff
//
// รายชื่อผู้ใช้งานระบบทั้งหมด (สำหรับ Admin เท่านั้น)
// ส่ง: ชื่อ นามสกุล เบอร์ ไอดีไลน์ ตำแหน่ง สาขา สถานะ
// ไม่ส่งรหัสผ่านออกไปเด็ดขาด
// =====================================================

router.get(
  '/staff',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const rows = await prisma.staff.findMany({
        include: {
          branch: true,
        },
        orderBy: {
          id: 'asc',
        },
      })

      res.json(
        rows.map(s => ({
          id: s.id,
          name: s.name,
          firstName: s.firstName || null,
          lastName: s.lastName || null,
          phone: s.phone || null,
          lineId: s.lineId || null,
          position: s.position,
          branchId: s.branchId,
          branchName: s.branch?.name || null,
          active: s.active,
        }))
      )
    } catch (error) {
      console.error('GET /admin/staff error:', error)

      res.status(500).json({
        error: 'ไม่สามารถโหลดรายชื่อผู้ใช้งานได้',
      })
    }
  }
)

// =====================================================
// ตำแหน่ง: sales / stock / admin  ->  ค่าในฐานข้อมูล
// =====================================================
const POSITION_DB = {
  sales: 'sales',
  stock: 'prep',
  admin: 'manager',
}

const ADMIN_POSITIONS = ['manager', 'admin', 'owner']

// จำนวนแอดมินที่ยังใช้งานอยู่ (ไม่นับ excludeId)
async function otherActiveAdmins(excludeId) {
  return prisma.staff.count({
    where: {
      id: { not: excludeId },
      active: true,
      position: { in: ADMIN_POSITIONS },
    },
  })
}

// =====================================================
// PUT /api/admin/staff/:id
// แก้ไขข้อมูลพนักงาน
// body: { firstName, lastName, phone, lineId, position, branchId }
// =====================================================
router.put(
  '/staff/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id)

      const target = await prisma.staff.findUnique({
        where: { id },
      })

      if (!target) {
        return res.status(404).json({ error: 'ไม่พบพนักงาน' })
      }

      const firstName = String(req.body.firstName || '').trim()
      const lastName = String(req.body.lastName || '').trim()
      const phone = String(req.body.phone || '').replace(/\D/g, '')
      const lineId = String(req.body.lineId || '').trim()
      const position = POSITION_DB[req.body.position]

      if (!firstName || !lastName) {
        return res.status(400).json({ error: 'กรุณากรอกชื่อและนามสกุล' })
      }

      if (!/^0\d{8,9}$/.test(phone)) {
        return res.status(400).json({
          error: 'เบอร์โทรไม่ถูกต้อง (ตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0)',
        })
      }

      if (!position) {
        return res.status(400).json({ error: 'ตำแหน่งไม่ถูกต้อง' })
      }

      const duplicate = await prisma.staff.findFirst({
        where: { phone, id: { not: id } },
      })

      if (duplicate) {
        return res.status(409).json({ error: 'เบอร์โทรนี้ถูกใช้โดยพนักงานคนอื่นแล้ว' })
      }

      // ห้ามลดสิทธิ์แอดมินคนสุดท้าย
      const wasAdmin = ADMIN_POSITIONS.includes(
        String(target.position || '').toLowerCase()
      )

      if (
        wasAdmin &&
        position !== 'manager' &&
        (await otherActiveAdmins(id)) === 0
      ) {
        return res.status(400).json({
          error: 'ต้องมีแอดมินที่ใช้งานอยู่อย่างน้อย 1 คน',
        })
      }

      let branchId = target.branchId

      if (req.body.branchId !== undefined) {
        if (req.body.branchId === '' || req.body.branchId === null) {
          branchId = null
        } else {
          const branch = await prisma.branch.findUnique({
            where: { id: Number(req.body.branchId) },
          })

          if (!branch) {
            return res.status(400).json({ error: 'ไม่พบสาขาที่เลือก' })
          }

          branchId = branch.id
        }
      }

      const updated = await prisma.staff.update({
        where: { id },
        data: {
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          phone,
          lineId,
          position,
          branchId,
        },
      })

      res.json({ ok: true, id: updated.id })
    } catch (error) {
      console.error('PUT /admin/staff/:id error:', error)

      res.status(500).json({ error: 'ไม่สามารถบันทึกข้อมูลพนักงานได้' })
    }
  }
)

// =====================================================
// PUT /api/admin/staff/:id/active   body: { active: true | false }
// เปิด / ปิดการใช้งานบัญชี (ปิดแล้วเข้าสู่ระบบไม่ได้ทันที)
// =====================================================
router.put(
  '/staff/:id/active',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id)
      const active = Boolean(req.body.active)

      const target = await prisma.staff.findUnique({
        where: { id },
      })

      if (!target) {
        return res.status(404).json({ error: 'ไม่พบพนักงาน' })
      }

      if (!active) {
        if (id === Number(req.staff.id)) {
          return res.status(400).json({ error: 'ปิดบัญชีของตัวเองไม่ได้' })
        }

        const isAdmin = ADMIN_POSITIONS.includes(
          String(target.position || '').toLowerCase()
        )

        if (isAdmin && (await otherActiveAdmins(id)) === 0) {
          return res.status(400).json({
            error: 'ต้องมีแอดมินที่ใช้งานอยู่อย่างน้อย 1 คน',
          })
        }
      }

      await prisma.staff.update({
        where: { id },
        data: { active },
      })

      invalidateStaff(id)

      res.json({ ok: true, active })
    } catch (error) {
      console.error('PUT /admin/staff/:id/active error:', error)

      res.status(500).json({ error: 'ไม่สามารถเปลี่ยนสถานะบัญชีได้' })
    }
  }
)

// =====================================================
// PUT /api/admin/staff/:id/password   body: { password }
// รีเซ็ตรหัสผ่านให้พนักงานที่ลืมรหัส
// =====================================================
router.put(
  '/staff/:id/password',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const id = Number(req.params.id)
      const password = String(req.body.password || '')

      if (password.length < 4) {
        return res.status(400).json({
          error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร',
        })
      }

      const target = await prisma.staff.findUnique({
        where: { id },
      })

      if (!target) {
        return res.status(404).json({ error: 'ไม่พบพนักงาน' })
      }

      await prisma.staff.update({
        where: { id },
        data: { pinHash: await bcrypt.hash(password, 10) },
      })

      res.json({ ok: true })
    } catch (error) {
      console.error('PUT /admin/staff/:id/password error:', error)

      res.status(500).json({ error: 'ไม่สามารถรีเซ็ตรหัสผ่านได้' })
    }
  }
)

module.exports = router
