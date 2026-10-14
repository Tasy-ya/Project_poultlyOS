const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  }

  const token = header.split(' ')[1];

  try {
    req.staff = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.staff) {
    return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  }

  const position = String(req.staff.position || '').toLowerCase();
  const allowed = ['admin', 'owner', 'manager'];

  if (!allowed.includes(position)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์สำหรับผู้ดูแลระบบ' });
  }

  next();
}

module.exports = { requireAuth, requireAdmin };
