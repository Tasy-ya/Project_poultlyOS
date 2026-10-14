const jwt = require('jsonwebtoken')
const prisma = require('../db')

// =====================================================
// ตรวจว่าบัญชียังเปิดใช้งานอยู่ (แคช 60 วินาที)
// ถ้าแอดมินปิดบัญชีพนักงาน token เดิมจะใช้ต่อไม่ได้ทันที
// =====================================================
const activeCache = new Map()

async function isStaffActive(id) {
  const cached = activeCache.get(id)

  if (cached && Date.now() - cached.at < 60 * 1000) {
    return cached.active
  }

  const row = await prisma.staff.findUnique({
    where: { id: Number(id) },
    select: { active: true },
  })

  const active = Boolean(row && row.active)

  activeCache.set(id, { active, at: Date.now() })

  return active
}

function invalidateStaff(id) {
  activeCache.delete(Number(id))
}

// =====================================================
// ตรวจว่ามี Login หรือไม่
// =====================================================
async function requireAuth(req, res, next) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'ไม่ได้เข้าสู่ระบบ',
    })
  }

  const token = header.split(' ')[1]

  try {
    req.staff = jwt.verify(
      token,
      process.env.JWT_SECRET
    )
  } catch (err) {
    return res.status(401).json({
      error: 'token ไม่ถูกต้องหรือหมดอายุ',
    })
  }

  try {
    if (!(await isStaffActive(req.staff.id))) {
      return res.status(401).json({
        error: 'บัญชีนี้ถูกปิดใช้งานแล้ว',
      })
    }
  } catch (err) {
    console.error('Check staff active error:', err)

    return res.status(500).json({
      error: 'ตรวจสอบบัญชีผู้ใช้ไม่สำเร็จ',
    })
  }

  next()
}

// =====================================================
// ตรวจว่าเป็น Admin / Owner / Manager หรือไม่
// =====================================================
function requireAdmin(req, res, next) {
  // ต้อง Login ก่อน
  if (!req.staff) {
    return res.status(401).json({
      error: 'ไม่ได้เข้าสู่ระบบ',
    })
  }

  // ตรวจประเภท Login
  if (req.staff.loginType !== 'admin') {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์เข้าถึงส่วน Admin',
    })
  }

  // ตรวจตำแหน่งอีกชั้น
  const position = String(
    req.staff.position || ''
  ).toLowerCase()

  const allowedPositions = [
    'admin',
    'administrator',
    'owner',
    'manager',
  ]

  if (!allowedPositions.includes(position)) {
    return res.status(403).json({
      error: 'บัญชีนี้ไม่มีสิทธิ์ Admin',
    })
  }

  next()
}

// =====================================================
// แยกสิทธิ์ตามฝ่าย
//
// dept = 'sales'  -> ฝ่ายขาย (position: sales)
// dept = 'stock'  -> ฝ่ายสต็อก (position: prep)
//
// - ฝ่ายขายเข้าส่วนสต็อกไม่ได้ / ฝ่ายสต็อกเข้าส่วนขายไม่ได้
// - Admin (loginType = 'admin') เข้าได้ทุกส่วน
// =====================================================
function departmentOf(position) {
  const p = String(position || '').trim().toLowerCase()

  if (['prep', 'stock'].includes(p)) return 'stock'
  if (['admin', 'administrator', 'owner', 'manager'].includes(p)) {
    return 'admin'
  }

  return 'sales'
}

function requireDept(dept) {
  return (req, res, next) => {
    if (!req.staff) {
      return res.status(401).json({
        error: 'ไม่ได้เข้าสู่ระบบ',
      })
    }

    if (
      req.staff.loginType === 'admin' ||
      req.staff.dept === 'admin'
    ) {
      return next()
    }

    if (req.staff.dept !== dept) {
      return res.status(403).json({
        error:
          dept === 'sales'
            ? 'ส่วนนี้สำหรับฝ่ายขายเท่านั้น'
            : 'ส่วนนี้สำหรับฝ่ายสต็อกเท่านั้น',
      })
    }

    next()
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireDept,
  departmentOf,
  invalidateStaff,
}