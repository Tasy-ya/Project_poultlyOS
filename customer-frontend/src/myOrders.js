// เก็บลิงก์ส่วนตัว (token) ของออเดอร์ที่สั่งจากเครื่องนี้ไว้ในเครื่องลูกค้า
// ใช้แสดงหน้า "ออเดอร์ของฉัน" (ไม่ต้องล็อกอิน)
const KEY = 'poultryos_my_orders_v1'
const MAX = 10

export function getMyTokens() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter(t => /^[0-9a-f]{32}$/.test(t)).slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberOrder(token) {
  if (!/^[0-9a-f]{32}$/.test(String(token || ''))) return

  try {
    const next = [token, ...getMyTokens().filter(t => t !== token)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // เก็บไม่ได้ก็ใช้งานต่อได้
  }
}

export function forgetOrder(token) {
  try {
    localStorage.setItem(KEY, JSON.stringify(getMyTokens().filter(t => t !== token)))
  } catch {
    // ignore
  }
}
