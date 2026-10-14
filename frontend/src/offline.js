import { api } from './api'

// =====================================================
// ขายตอนเน็ตหลุด (ออฟไลน์) แล้วซิงค์ภายหลัง
//
// - ทุกการขายมี localId (UUID) กันบันทึกซ้ำ
// - ถ้าส่งไป backend ไม่ได้เพราะเน็ต -> เก็บในเครื่อง (localStorage) แล้วขายต่อได้
// - เน็ตกลับมา -> ส่งขึ้น backend อัตโนมัติ (ตัดสต็อกตอนซิงค์)
// - ถ้า backend ปฏิเสธ (เช่น สต็อกไม่พอตอนซิงค์) -> เก็บไว้ให้คนตรวจที่หน้า "คิวออฟไลน์"
// - จำเมนู/สต็อกล่าสุดไว้ใช้ตอนออฟไลน์ (แคช)
//
// ข้อจำกัด: ตอนออฟไลน์ ตัวเลขสต็อกบนหน้าขายเป็นค่าล่าสุดที่โหลดไว้
// ไม่ลดลงตามที่ขายออฟไลน์ไป
// =====================================================

const QUEUE_KEY = 'poultryos_offline_orders'
const CACHE_PREFIX = 'poultryos_cache_'
const EVENT = 'poultryos:offline-queue'

// ---------- แคชเมนู/สต็อก ----------

export function cacheSet(key, value) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify(value)
    )
  } catch {
    // พื้นที่เต็ม ข้ามไป
  }
}

export function cacheGet(key) {
  try {
    const text = localStorage.getItem(CACHE_PREFIX + key)

    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

// ---------- รหัสกันซ้ำ ----------

export function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    c => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8

      return v.toString(16)
    }
  )
}

// ---------- คิวออฟไลน์ ----------

export function loadQueue() {
  try {
    const list = JSON.parse(
      localStorage.getItem(QUEUE_KEY) || '[]'
    )

    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function saveQueue(list) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list))

  window.dispatchEvent(new Event(EVENT))
}

export function onQueueChange(handler) {
  window.addEventListener(EVENT, handler)

  return () => window.removeEventListener(EVENT, handler)
}

export function removeFromQueue(localId) {
  saveQueue(loadQueue().filter(item => item.localId !== localId))
}

export function resetFailed(localId) {
  saveQueue(
    loadQueue().map(item =>
      item.localId === localId
        ? { ...item, failed: false, error: '' }
        : item
    )
  )
}

// ---------- ตรวจว่าเป็นปัญหาเครือข่ายหรือไม่ ----------

export function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    error?.code === 'TIMEOUT' ||
    /Failed to fetch|NetworkError|Load failed/i.test(
      String(error?.message || '')
    )
  )
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const err = new Error('Backend ใช้เวลานานเกินกำหนด')

        err.code = 'TIMEOUT'

        reject(err)
      }, ms)
    }),
  ])
}

// =====================================================
// ส่งออเดอร์
//
// คืนค่า
//   { status: 'saved',  result, localId }  บันทึกลง backend แล้ว
//   { status: 'queued', localId, createdAt } เน็ตหลุด เก็บไว้ในเครื่องแล้ว
// ถ้า backend ปฏิเสธ (เช่น สต็อกไม่พอ) จะ throw Error ให้หน้าจอแสดง
// =====================================================
export async function submitOrder(payload) {
  const localId = payload.localId || newLocalId()

  const body = {
    ...payload,
    localId,
    clientCreatedAt:
      payload.clientCreatedAt || new Date().toISOString(),
  }

  try {
    const result = await withTimeout(api.createOrder(body), 8000)

    return { status: 'saved', result, localId }
  } catch (error) {
    if (!isNetworkError(error)) {
      throw error
    }

    const queue = loadQueue()

    if (!queue.some(item => item.localId === localId)) {
      queue.push({
        localId,
        body,
        queuedAt: new Date().toISOString(),
        failed: false,
        error: '',
      })

      saveQueue(queue)
    }

    return {
      status: 'queued',
      localId,
      createdAt: body.clientCreatedAt,
    }
  }
}

// =====================================================
// ซิงค์คิวขึ้น backend
// =====================================================
let syncing = false

export async function syncQueue() {
  if (syncing) return

  syncing = true

  try {
    const queue = loadQueue()

    for (const item of queue) {
      if (item.failed) continue

      try {
        await api.createOrder(item.body)

        removeFromQueue(item.localId)
      } catch (error) {
        if (isNetworkError(error)) {
          // ยังไม่มีเน็ต หยุดรอรอบหน้า
          break
        }

        if (/เซสชันหมดอายุ/.test(String(error?.message))) {
          // ต้องล็อกอินใหม่ คิวยังอยู่ครบ
          break
        }

        // backend ปฏิเสธ: เก็บไว้ให้คนตรวจ ไม่ลบทิ้งเงียบ ๆ
        saveQueue(
          loadQueue().map(row =>
            row.localId === item.localId
              ? {
                  ...row,
                  failed: true,
                  error: error?.message || 'ซิงค์ไม่สำเร็จ',
                }
              : row
          )
        )
      }
    }
  } finally {
    syncing = false
  }
}

// =====================================================
// เริ่มซิงค์อัตโนมัติ (เรียกครั้งเดียวจาก Layout)
// =====================================================
let started = false

export function startAutoSync() {
  if (started) return

  started = true

  window.addEventListener('online', () => {
    syncQueue()
  })

  setInterval(() => {
    if (
      loadQueue().some(item => !item.failed) &&
      localStorage.getItem('token')
    ) {
      syncQueue()
    }
  }, 20 * 1000)

  if (localStorage.getItem('token')) {
    syncQueue()
  }
}
