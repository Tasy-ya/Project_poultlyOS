// ตัวช่วยตำแหน่ง: ขอพิกัดปัจจุบันจากอุปกรณ์ + แปลงพิกัดเป็นที่อยู่

// ความคลาดเคลื่อน (เมตร) ที่เกินนี้ ถือว่า "หยาบ" — มักเป็นตำแหน่งจาก IP/ไวไฟ (เช่นคอมพิวเตอร์ไม่มี GPS) ไม่ใช่ GPS จริง
export const COARSE_METERS = 300

export function formatAccuracy(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} กม.` : `${Math.round(m)} ม.`
}

// ระดับซูมที่เหมาะกับความคลาดเคลื่อนของตำแหน่ง (ยิ่งคลาดมากยิ่งซูมออก เพื่อให้เลื่อนหาจุดจริงได้)
export function zoomForAccuracy(m) {
  if (m > 20000) return 10
  if (m > 5000) return 12
  if (m > 1000) return 13
  if (m > COARSE_METERS) return 15
  return 17
}

// ขอพิกัดปัจจุบัน — เฝ้าดูสูงสุด maxWait มิลลิวินาที แล้วใช้ค่าที่แม่นที่สุด (GPS มักแม่นขึ้นหลังผ่านไปไม่กี่วินาที)
// คืน { lat, lng, accuracy(เมตร) } — reject เป็น Error ที่มีข้อความภาษาไทยพร้อมแสดงผู้ใช้
export function getCurrentCoords({ goodEnough = 50, maxWait = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      // เบราว์เซอร์บล็อกตำแหน่งเมื่อเปิดผ่าน http (ยกเว้น localhost)
      return reject(new Error('ใช้ตำแหน่งปัจจุบันได้เมื่อเปิดเว็บผ่าน https เท่านั้น — ตอนนี้ปักหมุดบนแผนที่เองได้เลย'))
    }

    if (!navigator.geolocation) {
      return reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง — ปักหมุดบนแผนที่เองได้เลย'))
    }

    let best = null
    let done = false
    let timer = null
    let id = null

    const stop = () => {
      done = true
      clearTimeout(timer)
      if (id != null) navigator.geolocation.clearWatch(id)
    }

    const finish = () => {
      if (done) return
      stop()
      if (best) resolve(best)
      else reject(new Error('หาตำแหน่งปัจจุบันไม่เจอ ลองอีกครั้ง หรือปักหมุดบนแผนที่เอง'))
    }

    id = navigator.geolocation.watchPosition(
      p => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy || 99999 }
        if (!best || c.accuracy < best.accuracy) best = c
        if (c.accuracy <= goodEnough) finish()
      },
      e => {
        if (done) return
        if (best) return finish()
        stop()
        if (e?.code === 1) {
          reject(new Error('ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งของเบราว์เซอร์ หรือปักหมุดบนแผนที่เอง'))
        } else {
          reject(new Error('หาตำแหน่งปัจจุบันไม่เจอ ลองอีกครั้ง หรือปักหมุดบนแผนที่เอง'))
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )

    timer = setTimeout(finish, maxWait)
  })
}

// พิกัด -> ที่อยู่ (OpenStreetMap Nominatim) — ไม่ได้ผลคืนสตริงว่าง
export async function reverseOsm(lat, lng) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=th`
    )
    const j = await r.json()
    return j?.display_name || ''
  } catch {
    return ''
  }
}
