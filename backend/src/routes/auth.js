
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const prisma = require('../db')
const { departmentOf } = require('../middleware/auth')

const router = express.Router()

// =====================================================
// ตำแหน่งงาน
// staff.position: sales / prep / manager
// =====================================================
const REGISTER_POSITIONS = {
  sales: 'sales',
  stock: 'prep',
  admin: 'manager',
}

// =====================================================
// สร้าง JWT Token
// =====================================================
function makeToken(staff, loginType = 'staff', dept = null) {
  return jwt.sign(
    {
      id: staff.id,
      name: staff.name,
      branchId: staff.branchId,
      position: staff.position,
      loginType,
      dept,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  )
}

// =====================================================
// ข้อมูลพนักงานที่ส่งกลับ Frontend
// =====================================================
function staffPayload(staff, dept = null) {
  return {
    id: staff.id,
    name: staff.name,
    firstName: null,
    lastName: null,
    phone: staff.phone || null,
    position: staff.position,
    branchId: staff.branchId,
    dept,
  }
}

// =====================================================
// จำกัดการเดารหัสผ่าน
// =====================================================
const FAIL_LIMIT = 5
const FAIL_WINDOW = 15 * 60 * 1000
const failures = new Map()

function failKey(req, identifier) {
  return `${req.ip}|${String(identifier || '').trim()}`
}

function isLocked(key) {
  const row = failures.get(key)

  if (!row) return false

  if (Date.now() - row.first > FAIL_WINDOW) {
    failures.delete(key)
    return false
  }

  return row.count >= FAIL_LIMIT
}

function addFailure(key) {
  const row = failures.get(key)

  if (!row || Date.now() - row.first > FAIL_WINDOW) {
    failures.set(key, {
      count: 1,
      first: Date.now(),
    })
    return
  }

  row.count += 1
}

const LOCK_MESSAGE =
  'ใส่รหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

// =====================================================
// ค้นหาพนักงานด้วยรหัสพนักงานหรือเบอร์โทร
// =====================================================
async function findStaffByIdentifier(identifier) {
  const raw = String(identifier || '').trim()

  if (!raw) return null

  const digits = onlyDigits(raw)

  if (/^0\d{8,9}$/.test(digits)) {
    return prisma.staff.findFirst({
      where: { phone: digits },
    })
  }

  if (/^\d+$/.test(raw)) {
    const id = Number(raw)

    if (!Number.isSafeInteger(id)) return null

    return prisma.staff.findUnique({
      where: { id },
    })
  }

  return null
}

// =====================================================
// POST /api/auth/register
// สมัครพนักงานและแอดมิน
// =====================================================
router.post('/register', async (req, res) => {
  try {
    const firstName = String(req.body.firstName || '').trim()
    const lastName = String(req.body.lastName || '').trim()
    const phone = onlyDigits(req.body.phone)
    const positionKey = String(req.body.position || '').trim()
    const password = String(req.body.password || '')
    const confirmPassword = String(req.body.confirmPassword || '')

    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'กรุณากรอกชื่อและนามสกุล',
      })
    }

    if (!/^0\d{8,9}$/.test(phone)) {
      return res.status(400).json({
        error: 'เบอร์โทรไม่ถูกต้อง (ตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0)',
      })
    }

    const position = REGISTER_POSITIONS[positionKey]

    if (!position) {
      return res.status(400).json({
        error: 'กรุณาเลือกตำแหน่งงาน',
      })
    }

    if (password.length < 4) {
      return res.status(400).json({
        error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร',
      })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        error: 'รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน',
      })
    }

    // -----------------------------------------------
    // ตรวจสอบรหัสสมัครแอดมิน
    // -----------------------------------------------
    if (position === 'manager') {
      const signupCode = String(
        process.env.ADMIN_SIGNUP_CODE || ''
      ).trim()

      const submittedCode = String(
        req.body.adminCode || ''
      ).trim()

      if (signupCode) {
        if (submittedCode !== signupCode) {
          return res.status(403).json({
            error: 'รหัสลงทะเบียนแอดมินไม่ถูกต้อง',
          })
        }
      } else {
        const existingAdmin = await prisma.staff.count({
          where: {
            position: {
              in: ['manager', 'admin', 'owner'],
            },
          },
        })

        if (existingAdmin > 0) {
          return res.status(403).json({
            error:
              'มีแอดมินในระบบแล้ว กรุณาตั้ง ADMIN_SIGNUP_CODE ใน backend/.env',
          })
        }
      }
    }

    // -----------------------------------------------
    // ตรวจสอบเบอร์โทรซ้ำ
    // -----------------------------------------------
    const duplicate = await prisma.staff.findFirst({
      where: { phone },
      select: { id: true },
    })

    if (duplicate) {
      return res.status(409).json({
        error: 'เบอร์โทรนี้ลงทะเบียนไว้แล้ว',
      })
    }

    // -----------------------------------------------
    // เลือกสาขาเริ่มต้น
    // -----------------------------------------------
    const firstBranch = await prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true },
    })

    const pinHash = await bcrypt.hash(password, 10)
    const fullName = `${firstName} ${lastName}`.trim()

    // ใช้คอลัมน์ name แทน firstName / lastName
    // เนื่องจากตาราง staff ที่ตรวจสอบมีคอลัมน์ name
    const staff = await prisma.staff.create({
      data: {
        name: fullName,
        phone,
        position,
        branchId: firstBranch ? firstBranch.id : null,
        pinHash,
        active: true,
      },
    })

    return res.status(201).json({
      ok: true,
      staff: staffPayload(staff, departmentOf(position)),
    })
  } catch (err) {
    console.error('Register Error:', err)

    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการลงทะเบียน',
      detail:
        process.env.NODE_ENV === 'development'
          ? err.message
          : undefined,
    })
  }
})

// =====================================================
// POST /api/auth/login
// เข้าสู่ระบบพนักงาน
// =====================================================
router.post('/login', async (req, res) => {
  try {
    const identifier =
      req.body.identifier ?? req.body.staffId

    const { pin } = req.body

    const requested =
      req.body.department === 'stock'
        ? 'stock'
        : req.body.department === 'sales'
          ? 'sales'
          : null

    if (!identifier || !pin) {
      return res.status(400).json({
        error: 'กรุณากรอกรหัสพนักงาน/เบอร์โทร และรหัสผ่าน',
      })
    }

    const key = failKey(req, identifier)

    if (isLocked(key)) {
      return res.status(429).json({
        error: LOCK_MESSAGE,
      })
    }

    const staff = await findStaffByIdentifier(identifier)

    if (!staff || !staff.active) {
      addFailure(key)

      return res.status(401).json({
        error: 'ไม่พบบัญชีพนักงาน หรือถูกปิดใช้งาน',
      })
    }

    const valid = await bcrypt.compare(
      String(pin),
      staff.pinHash || ''
    )

    if (!valid) {
      addFailure(key)

      return res.status(401).json({
        error: 'รหัสผ่านไม่ถูกต้อง',
      })
    }

    failures.delete(key)

    const own = departmentOf(staff.position)

    if (requested && own !== 'admin' && own !== requested) {
      return res.status(403).json({
        error:
          requested === 'stock'
            ? 'บัญชีนี้ไม่ใช่ฝ่ายสต็อก ส่วนนี้ต้องใช้บัญชีฝ่ายสต็อกหรือแอดมิน'
            : 'บัญชีนี้ไม่ใช่ฝ่ายขาย ส่วนนี้ต้องใช้บัญชีฝ่ายขายหรือแอดมิน',
      })
    }

    const token = makeToken(staff, 'staff', own)

    return res.json({
      token,
      staff: staffPayload(staff, own),
    })
  } catch (err) {
    console.error('Staff Login Error:', err)

    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
    })
  }
})

// =====================================================
// POST /api/auth/admin-login
// เข้าสู่ระบบ Admin / Owner / Manager
// =====================================================
router.post('/admin-login', async (req, res) => {
  try {
    const identifier =
      req.body.identifier ?? req.body.staffId

    const { pin } = req.body

    if (!identifier || !pin) {
      return res.status(400).json({
        error: 'ต้องระบุรหัสพนักงาน/เบอร์โทร และรหัสผ่าน',
      })
    }

    const key = failKey(req, identifier)

    if (isLocked(key)) {
      return res.status(429).json({
        error: LOCK_MESSAGE,
      })
    }

    const staff = await findStaffByIdentifier(identifier)

    if (!staff || !staff.active) {
      addFailure(key)

      return res.status(401).json({
        error: 'ไม่พบผู้ดูแลระบบ หรือถูกปิดใช้งาน',
      })
    }

    const position = String(staff.position || '')
      .trim()
      .toLowerCase()

    const allowedPositions = [
      'admin',
      'administrator',
      'owner',
      'manager',
    ]

    if (!allowedPositions.includes(position)) {
      return res.status(403).json({
        error: 'บัญชีนี้ไม่มีสิทธิ์เข้า Admin',
      })
    }

    const valid = await bcrypt.compare(
      String(pin),
      staff.pinHash || ''
    )

    if (!valid) {
      addFailure(key)

      return res.status(401).json({
        error: 'รหัสผ่านไม่ถูกต้อง',
      })
    }

    failures.delete(key)

    const token = makeToken(staff, 'admin', 'admin')

    return res.json({
      token,
      staff: staffPayload(staff, 'admin'),
    })
  } catch (err) {
    console.error('Admin Login Error:', err)

    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ Admin',
    })
  }
})

module.exports = router
