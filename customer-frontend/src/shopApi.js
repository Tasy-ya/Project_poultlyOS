import { newLocalId } from './localId'

// ที่อยู่ backend: ใช้ค่าเดียวกับระบบพนักงาน (VITE_API_URL หรือ ชื่อเครื่องเดียวกับหน้าเว็บ + พอร์ต 3001)
const BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001/api`

async function request(path, options = {}) {
  let res

  try {
    res = await fetch(`${BASE_URL}/public${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
  } catch {
    throw new Error('เชื่อมต่อร้านไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
  }

  const text = await res.text()
  let data = null

  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.error || `เกิดข้อผิดพลาด (${res.status})`)
  }

  return data
}

const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body) })

export const shopApi = {
  config: () => request('/config'),
  branches: () => request('/branches'),
  menus: branchId => request(`/menus?branchId=${encodeURIComponent(branchId)}`),
  promotions: branchId => request(`/promotions${branchId == null ? '' : `?branchId=${encodeURIComponent(branchId)}`}`),
  createOrder: body => post('/orders', body),
  createReservation: body => post('/reservations', body),
  receipt: token => request(`/receipt/${encodeURIComponent(token)}`),
}

export { newLocalId }

export const baht = n =>
  '฿' +
  Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })

export const sizeLabel = size => (size === 'half' ? 'ครึ่งตัว' : 'เต็มตัว')

export const fmtDateTime = value =>
  new Date(value).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

// ราคาต่อหน่วยตามขนาด (ครึ่งตัว = ครึ่งหนึ่งของเต็มตัว) — ใช้แสดงผลเท่านั้น เซิร์ฟเวอร์คำนวณจริงเสมอ
export const unitPrice = item =>
  item.size === 'half' ? item.price / 2 : item.price

// มัดจำ: สูตรเดียวกับเซิร์ฟเวอร์ (ใช้แสดงตัวอย่างก่อนจ่าย)
export const depositFor = (total, percent) =>
  Math.min(total, Math.ceil((total * percent) / 100 / 10) * 10)
