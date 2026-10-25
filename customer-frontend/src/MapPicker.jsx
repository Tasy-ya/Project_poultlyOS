import { useEffect, useRef, useState } from 'react'
import { COARSE_METERS, formatAccuracy, getCurrentCoords, reverseOsm, zoomForAccuracy } from './geo'

// แผนที่ปักหมุดจุดส่งของ (แบบ LINE MAN: หมุดอยู่กลางจอ เลื่อนแผนที่ใต้หมุดเพื่อเลือกจุด)
//  - มี Google Maps API key (ตั้ง GOOGLE_MAPS_API_KEY ใน backend/.env) -> ใช้ Google Maps จริง + ค้นหาที่อยู่
//  - ไม่มี key -> ใช้ OpenStreetMap (Leaflet)
//  - เลื่อน/ซูมแผนที่เสร็จ -> อ่านพิกัดตรงหมุด -> หาที่อยู่ -> เรียก onChange({ lat, lng, address, pending })
//  - autoLocate: เปิดมาแล้วพาไปที่ตำแหน่งปัจจุบันทันที (ใช้ตอนยังไม่เคยมีที่อยู่ที่จำไว้)
const HAT_YAI = { lat: 7.0086, lng: 100.4747 }
const SAME = 1e-5 // ~1 เมตร: พิกัดใกล้กันกว่านี้ถือว่าเป็นจุดเดิม ไม่ต้องหาที่อยู่ซ้ำ

// ดึงพิกัดจากลิงก์/ข้อความของ Google Maps (เช่น .../@7.0086,100.4747,17z หรือ ?q=7.0086,100.4747)
export function parseGoogleLink(text) {
  let t = String(text || '').trim()
  try { t = decodeURIComponent(t) } catch { /* ใช้ข้อความเดิม */ }

  const pats = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/,
  ]

  for (const re of pats) {
    const m = t.match(re)
    if (m) {
      const la = Number(m[1])
      const ln = Number(m[2])
      if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) return { lat: la, lng: ln }
    }
  }

  return null
}

const loaded = {}

function loadScript(src, key) {
  if (loaded[key]) return loaded[key]

  loaded[key] = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = () => {
      delete loaded[key] // ให้ลองโหลดใหม่ได้ถ้าเน็ตหลุด
      reject(new Error('โหลดแผนที่ไม่สำเร็จ'))
    }
    document.head.appendChild(s)
  })

  return loaded[key]
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement('link')
  l.rel = 'stylesheet'
  l.href = href
  document.head.appendChild(l)
}

async function searchOsm(q) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=th&accept-language=th&q=${encodeURIComponent(q)}`
    )
    const j = await r.json()
    return j?.[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon), address: j[0].display_name } : null
  } catch {
    return null
  }
}

export default function MapPicker({ lat, lng, googleKey, onChange, autoLocate = false, initialZoom }) {
  const boxRef = useRef(null)
  const apiRef = useRef(null)
  const disposeRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [err, setErr] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [moving, setMoving] = useState(false)
  const [link, setLink] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // สร้างแผนที่ครั้งเดียว
  useEffect(() => {
    let dead = false
    const hasInit = lat != null && lng != null
    const start = { lat: hasInit ? lat : HAT_YAI.lat, lng: hasInit ? lng : HAT_YAI.lng }
    const zoom0 = initialZoom ?? (hasInit ? 17 : 14)

    // จุดล่าสุดที่แจ้งไปแล้ว (กันแจ้งซ้ำ/หาที่อยู่ซ้ำ)
    let last = { lat: start.lat, lng: start.lng }
    let seq = 0

    // แจ้งตำแหน่งใหม่ — ถ้ายังไม่มีที่อยู่ จะแจ้ง pending ก่อนแล้วค่อยแจ้งซ้ำเมื่อหาที่อยู่ได้
    const emit = async (la, ln, address, geocoder) => {
      if (Math.abs(la - last.lat) < SAME && Math.abs(ln - last.lng) < SAME) return
      last = { lat: la, lng: ln }
      const mine = ++seq

      if (address) {
        onChangeRef.current({ lat: la, lng: ln, address, pending: false })
        return
      }

      onChangeRef.current({ lat: la, lng: ln, address: '', pending: true })

      let addr = ''
      if (geocoder) {
        addr = await new Promise(resolve =>
          geocoder.geocode({ location: { lat: la, lng: ln } }, (res, st) =>
            resolve(st === 'OK' && res?.[0] ? res[0].formatted_address : '')
          )
        )
      }
      if (!addr) addr = await reverseOsm(la, ln)

      if (!dead && mine === seq) onChangeRef.current({ lat: la, lng: ln, address: addr, pending: false })
    }

    async function initGoogle() {
      await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleKey)}&language=th&region=TH`, 'gmaps')
      if (dead) return
      const g = window.google.maps
      const map = new g.Map(boxRef.current, {
        center: start,
        zoom: zoom0,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      })
      const geocoder = new g.Geocoder()

      map.addListener('dragstart', () => setMoving(true))
      map.addListener('idle', () => {
        setMoving(false)
        const c = map.getCenter()
        emit(c.lat(), c.lng(), '', geocoder)
      })

      apiRef.current = {
        move: (la, ln, address, zoom = 17) => {
          emit(la, ln, address, geocoder)
          map.setCenter({ lat: la, lng: ln })
          map.setZoom(zoom)
        },
        search: q =>
          new Promise(resolve =>
            geocoder.geocode({ address: q, region: 'TH' }, (res, st) => {
              if (st === 'OK' && res?.[0]) {
                const p = res[0].geometry.location
                resolve({ lat: p.lat(), lng: p.lng(), address: res[0].formatted_address })
              } else resolve(null)
            })
          ),
      }
    }

    async function initOsm() {
      loadCss('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css')
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'leaflet')
      if (dead) return
      const L = window.L
      const map = L.map(boxRef.current).setView([start.lat, start.lng], zoom0)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)

      // ลงทะเบียนหลัง setView เริ่มต้น เพื่อไม่ให้การตั้งค่าแรกถูกนับเป็นการเลื่อน
      map.on('movestart', () => setMoving(true))
      map.on('moveend', () => {
        setMoving(false)
        const c = map.getCenter()
        emit(c.lat, c.lng, '')
      })

      apiRef.current = {
        move: (la, ln, address, zoom = 17) => {
          emit(la, ln, address)
          map.setView([la, ln], zoom)
        },
        search: searchOsm,
      }
      disposeRef.current = () => map.remove()
      setTimeout(() => map.invalidateSize(), 200)
    }

    ;(googleKey ? initGoogle() : initOsm())
      .then(() => {
        if (!dead && autoLocate && !hasInit) locate()
      })
      .catch(e => !dead && setErr(e.message))

    return () => {
      dead = true
      apiRef.current = null
      if (disposeRef.current) {
        try { disposeRef.current() } catch { /* ignore */ }
        disposeRef.current = null
      }
      if (boxRef.current) boxRef.current.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleKey])

  async function locate() {
    setErr('')
    setLocating(true)
    try {
      const p = await getCurrentCoords()
      const coarse = p.accuracy > COARSE_METERS
      apiRef.current?.move(p.lat, p.lng, undefined, zoomForAccuracy(p.accuracy))
      if (coarse) {
        setErr(`ตำแหน่งที่อุปกรณ์ให้มาอาจคลาดเคลื่อนประมาณ ${formatAccuracy(p.accuracy)} (มักเกิดบนคอมพิวเตอร์ที่ไม่มี GPS) — เลื่อนแผนที่ให้หมุดตรงจุดของคุณก่อนกดยืนยัน`)
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setLocating(false)
    }
  }

  const find = async () => {
    if (!query.trim() || !apiRef.current) return
    setBusy(true)
    setErr('')
    const r = await apiRef.current.search(query.trim())
    setBusy(false)
    if (r) apiRef.current.move(r.lat, r.lng, r.address)
    else setErr('ไม่พบสถานที่นี้ ลองพิมพ์ชื่อถนน/ตำบลเพิ่ม หรือเลื่อนแผนที่เพื่อปักหมุด')
  }

  const useLink = () => {
    const p = parseGoogleLink(link)

    if (!p) {
      setErr('อ่านพิกัดจากลิงก์นี้ไม่ได้ — ใช้ลิงก์ยาวจาก Google Maps (เปิดในเบราว์เซอร์แล้วคัดลอกจากแถบที่อยู่) หรือเลื่อนแผนที่เพื่อปักหมุด')
      return
    }

    setErr('')
    apiRef.current?.move(p.lat, p.lng)
    setLink('')
  }

  return (
    <div className="map-picker">
      <div className="map-search">
        <input
          placeholder="ค้นหาสถานที่/ที่อยู่ เช่น หาดใหญ่ ถนนนิพัทธ์อุทิศ 3"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find() } }}
        />
        <button type="button" className="btn-outline" onClick={find} disabled={busy}>{busy ? '...' : 'ค้นหา'}</button>
      </div>

      <div className="map-wrap">
        <div ref={boxRef} className="map-canvas" />
        <div className={`map-center-pin${moving ? ' lift' : ''}`} aria-hidden="true">📍</div>
        <button type="button" className="map-locate-fab" onClick={locate} disabled={locating} aria-label="ใช้ตำแหน่งปัจจุบัน">
          {locating ? '…' : '◎'}
        </button>
      </div>

      <details className="map-link">
        <summary>มีลิงก์หมุดจาก Google Maps อยู่แล้ว?</summary>
        <div className="map-search">
          <input
            placeholder="วางลิงก์ Google Maps หรือพิกัด เช่น 7.0086, 100.4747"
            value={link}
            onChange={e => setLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); useLink() } }}
          />
          <button type="button" className="btn-outline" onClick={useLink}>ใช้ลิงก์นี้</button>
        </div>
      </details>

      {err && <div className="err">{err}</div>}
    </div>
  )
}
