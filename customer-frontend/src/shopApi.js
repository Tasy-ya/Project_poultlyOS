import { newLocalId } from './localId'

// ที่อยู่ backend: ใช้ค่าเดียวกับระบบพนักงาน (VITE_API_URL หรือ ชื่อเครื่องเดียวกับหน้าเว็บ + พอร์ต 3001)
// - dev (npm run dev): ชื่อเครื่องเดียวกับหน้าเว็บ + พอร์ต 3001
// - build แล้ว (backend เสิร์ฟหน้าให้): ใช้ /api ของโดเมน/พอร์ตเดียวกับหน้าเว็บ จึงใช้ผ่านลิงก์/โดเมน/Tunnel ได้
export const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:3001/api`
    : `${window.location.origin}/api`)

const BASE_URL = API_BASE

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
    const message = data?.error || `เกิดข้อผิดพลาด (${res.status})`

    // ตอนพัฒนา backend จะแนบ detail (สาเหตุ/วิธีแก้) มาด้วย — ตอนใช้งานจริงจะไม่มี
    throw new Error(data?.detail ? `${message} — ${data.detail}` : message)
  }

  return data
}

const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body) })

export const shopApi = {
  config: () => request('/config'),
  branches: () => request('/branches'),
  closures: branchId => request(`/closures?branchId=${encodeURIComponent(branchId)}`),
  menus: branchId => request(`/menus?branchId=${encodeURIComponent(branchId)}`),
  promotions: branchId => request(`/promotions${branchId == null ? '' : `?branchId=${encodeURIComponent(branchId)}`}`),
  createOrder: body => post('/orders', body),
  createReservation: body => post('/reservations', body),
  receipt: token => request(`/receipt/${encodeURIComponent(token)}`),
  customerStatus: phone => request(`/customer-status?phone=${encodeURIComponent(phone)}`),
  review: (token, body) => post(`/receipt/${encodeURIComponent(token)}/review`, body),
  track: tokens => request(`/track?tokens=${encodeURIComponent(tokens.join(','))}`),

  // แนบสลิป: ส่งไฟล์รูปดิบ (ไม่ใช่ JSON)
  uploadSlip: async (token, blob) => {
    let res

    try {
      res = await fetch(`${BASE_URL}/public/receipt/${encodeURIComponent(token)}/slip`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
      })
    } catch {
      throw new Error('เชื่อมต่อร้านไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')
    }

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      const message = data?.error || `แนบสลิปไม่สำเร็จ (${res.status})`
      throw new Error(data?.detail ? `${message} — ${data.detail}` : message)
    }

    return data
  },
}

// ย่อรูปสลิปก่อนส่ง (ด้านยาวสุด 1600px, JPEG) ให้ส่งไวบนมือถือ
export function shrinkImage(file, maxSide = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('เปิดรูปนี้ไม่ได้ กรุณาเลือกรูปภาพ JPG หรือ PNG'))
    }

    img.src = url
  })
}

// สถานะการเตรียมออเดอร์ที่ลูกค้าเห็น
export const SHOP_PHONE = '0649093663'
export const formatPhone = p => {
  const d = String(p || '').replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d
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
