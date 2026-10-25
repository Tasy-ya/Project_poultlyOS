// จำที่อยู่จัดส่งที่เคยใช้ + ชื่อ/เบอร์ผู้สั่ง ไว้ในเครื่องลูกค้า (localStorage)
// - ที่อยู่เก็บได้สูงสุด MAX_PLACES แห่ง เรียงล่าสุดก่อน
// - หมุดที่อยู่ใกล้กันมาก (< ~40 ม.) ถือเป็นที่เดียวกัน จะอัปเดตข้อความแทนการเพิ่มซ้ำ
import { useCallback, useState } from 'react'

const PLACES_KEY = 'poultryos_places_v1'
const BUYER_KEY = 'poultryos_buyer_v1'
const MAX_PLACES = 5
const SAME_PLACE_METERS = 40

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v ?? fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // พื้นที่เก็บข้อมูลเต็ม/ปิดไว้ — ใช้งานต่อได้ แค่ไม่จำ
  }
}

// ระยะห่างระหว่างสองพิกัด (เมตร)
export function distanceMeters(a, b) {
  const R = 6371000
  const rad = d => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const validPlace = p =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && String(p.address || '').trim()

export function loadPlaces() {
  const list = read(PLACES_KEY, [])
  return Array.isArray(list) ? list.filter(validPlace) : []
}

// เพิ่ม/อัปเดตที่อยู่ แล้วดันขึ้นเป็นล่าสุด — คืนรายการใหม่
export function rememberPlace({ address, lat, lng }) {
  const place = { address: String(address || '').trim().slice(0, 500), lat: Number(lat), lng: Number(lng) }
  if (!validPlace(place)) return loadPlaces()

  const rest = loadPlaces().filter(p => distanceMeters(p, place) > SAME_PLACE_METERS)
  const next = [{ ...place, usedAt: Date.now() }, ...rest].slice(0, MAX_PLACES)
  write(PLACES_KEY, next)
  return next
}

export function forgetPlace(lat, lng) {
  const next = loadPlaces().filter(p => distanceMeters(p, { lat, lng }) > 1)
  write(PLACES_KEY, next)
  return next
}

// hook: ใช้ในคอมโพเนนต์เพื่อให้รายการอัปเดตทันทีหลังบันทึก/ลบ
export function useSavedPlaces() {
  const [places, setPlaces] = useState(loadPlaces)

  const remember = useCallback(p => setPlaces(rememberPlace(p)), [])
  const forget = useCallback((lat, lng) => setPlaces(forgetPlace(lat, lng)), [])

  return { places, remember, forget }
}

// ชื่อ + เบอร์ผู้สั่ง (ใช้ร่วมกันทั้งสั่งซื้อเลยและจองล่วงหน้า)
export function loadBuyer() {
  const v = read(BUYER_KEY, {})
  return {
    name: typeof v.name === 'string' ? v.name : '',
    phone: typeof v.phone === 'string' ? v.phone : '',
  }
}

export function saveBuyer({ name, phone }) {
  write(BUYER_KEY, {
    name: String(name || '').trim().slice(0, 100),
    phone: String(phone || '').trim().slice(0, 20),
  })
}
