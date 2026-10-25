import { useEffect, useState } from 'react'
import { useShop } from './ShopContext'
import { shopApi, baht } from './shopApi'
import LocationSheet from './LocationSheet'
import { COARSE_METERS, formatAccuracy, getCurrentCoords, reverseOsm, zoomForAccuracy } from './geo'
import { distanceMeters, useSavedPlaces } from './savedPlaces'
import storeIcon from './assets/icon-store.png'
import deliveryIcon from './assets/icon-delivery.png'

// ไอคอนทึบ (ร้านค้า / รถส่งของ) ใช้เป็น mask เพื่อให้เปลี่ยนสีตามปุ่มที่เลือก (ขาวเมื่อเลือก / เทาเมื่อไม่เลือก)
const Icon = ({ src }) => (
  <span
    className="fulfillment-icon"
    aria-hidden="true"
    style={{ WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` }}
  />
)

// ช่อง "ต้องการให้ส่ง": เลือกรับที่ร้าน/ให้ส่ง -> ที่อยู่ที่จำไว้ + ปักหมุดแผนที่
// ใช้ทั้งหน้าตะกร้าและหน้าชำระเงิน (ข้อมูลเก็บร่วมกันใน ShopContext)
//  - ที่อยู่ที่เคยใช้ถูกจำไว้ในเครื่อง ครั้งต่อไปไม่ต้องกรอกใหม่ กด "เปลี่ยน" ได้ทันที
//  - "ใช้ตำแหน่งปัจจุบัน" ปักหมุด + เติมที่อยู่ให้เลยโดยไม่ต้องเปิดแผนที่
export default function DeliveryBox({ cfg: cfgProp, newCustomer = false, itemCount }) {
  const shop = useShop()
  const { method, address, lat, lng } = shop.delivery
  const { places, remember, forget } = useSavedPlaces()
  const [cfgLocal, setCfgLocal] = useState(null)
  // sheet: null = ปิด, ไม่ก็ { lat, lng, address, warn, zoom } = จุดเริ่มต้นของหน้าต่างแผนที่
  const [sheet, setSheet] = useState(null)
  const [locating, setLocating] = useState(false)
  const [err, setErr] = useState('')

  const hasPin = lat != null && lng != null

  useEffect(() => {
    if (cfgProp) return undefined
    let alive = true
    shopApi.config().then(c => alive && setCfgLocal(c)).catch(() => {})
    return () => { alive = false }
  }, [cfgProp])

  const cfg = cfgProp || cfgLocal
  const count = itemCount ?? shop.count
  const minItems = cfg?.deliveryMinItems ?? 5
  const baseFee = cfg?.deliveryFee ?? 30
  const free = count >= minItems || newCustomer

  // ใช้ที่อยู่ที่เลือก: ตั้งเป็นจุดส่งปัจจุบัน + จำไว้
  // keepTyped: ถ้าลูกค้าพิมพ์ที่อยู่เองไว้ก่อนแล้ว (ยังไม่เคยปักหมุด) ให้คงข้อความที่พิมพ์
  const applyPlace = (p, keepTyped = false) => {
    const text = keepTyped && address.trim() ? address.trim() : p.address
    shop.setDelivery({ address: text, lat: p.lat, lng: p.lng })
    remember({ address: text, lat: p.lat, lng: p.lng })
  }

  // เปิดโหมดส่งถึงที่ แล้วยังไม่มีหมุด -> ใช้ที่อยู่ล่าสุดที่จำไว้ให้ทันที (เช่นกลับมาสั่งซ้ำ)
  useEffect(() => {
    if (method === 'delivery' && !hasPin && places[0]) applyPlace(places[0], true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  // ปักหมุดตำแหน่งปัจจุบันทันที ไม่ต้องเปิดแผนที่
  const locateNow = async () => {
    setErr('')
    setLocating(true)
    try {
      const c = await getCurrentCoords()

      // ตำแหน่งหยาบ (IP/ไวไฟ ไม่ใช่ GPS) — ห้ามใช้เลย ให้ลูกค้าตรวจและเลื่อนหมุดบนแผนที่ก่อน
      if (c.accuracy > COARSE_METERS) {
        setSheet({
          lat: c.lat,
          lng: c.lng,
          address: '',
          zoom: zoomForAccuracy(c.accuracy),
          warn: `ตำแหน่งที่อุปกรณ์ให้มาอาจคลาดเคลื่อนประมาณ ${formatAccuracy(c.accuracy)} (มักเกิดบนคอมพิวเตอร์ที่ไม่มี GPS) — เลื่อนแผนที่ให้หมุดตรงจุดส่งของคุณ แล้วกดยืนยัน`,
        })
        return
      }

      const addr = await reverseOsm(c.lat, c.lng)
      applyPlace({ lat: c.lat, lng: c.lng, address: addr || `พิกัด ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` }, !hasPin)
    } catch (e) {
      setErr(e.message)
    } finally {
      setLocating(false)
    }
  }

  const chooseDelivery = () => {
    shop.setDelivery({ method: 'delivery' })
    // ยังไม่เคยมีที่อยู่เลย -> ขอตำแหน่งปัจจุบันให้ทันที (เหมือน LINE MAN)
    if (!hasPin && places.length === 0) locateNow()
  }

  const confirmSheet = p => {
    applyPlace(p, !hasPin)
    setSheet(null)
    setErr('')
  }

  // ที่อยู่อื่นที่เคยใช้ (ไม่รวมจุดที่เลือกอยู่ตอนนี้)
  const others = places
    .filter(p => !hasPin || distanceMeters(p, { lat, lng }) > 40)
    .slice(0, 4)

  const shopMap = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cfg?.shopAddress || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')}`

  return (
    <div className="delivery-box">
      <h4>วิธีรับสินค้า</h4>

      <div className="seg">
        <button type="button" className={method === 'pickup' ? 'on' : ''} onClick={() => shop.setDelivery({ method: 'pickup' })}>
          <Icon src={storeIcon} />
          <span>รับที่ร้าน</span>
        </button>

        <button type="button" className={method === 'delivery' ? 'on' : ''} onClick={chooseDelivery}>
          <Icon src={deliveryIcon} />
          <span>ต้องการให้ส่ง</span>
        </button>
      </div>

      {method === 'pickup' ? (
        <div className="note">
          รับสินค้าที่ร้านได้ตามเวลาทำการ{' '}
          <a href={shopMap} target="_blank" rel="noreferrer">เปิดแผนที่ร้าน</a>
        </div>
      ) : (
        <>
          <div className="note">
            ส่งฟรีเมื่อสั่งครบ {minItems} ชิ้น หรือเป็นลูกค้าใหม่ · นอกนั้นค่าจัดส่ง {baht(baseFee)}
            {free ? ' — ออเดอร์นี้ส่งฟรี 🎉' : ''}
          </div>

          <label className="field-label">ส่งที่</label>

          {hasPin ? (
            <div className="loc-card">
              <span className="loc-card-pin" aria-hidden="true">📍</span>
              <div className="loc-card-text">
                <div className="loc-card-addr">{address || `พิกัด ${lat.toFixed(5)}, ${lng.toFixed(5)}`}</div>
                <a className="loc-card-link" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">
                  ดูใน Google Maps
                </a>
              </div>
              <button type="button" className="loc-card-change" onClick={() => setSheet({ lat, lng, address })}>เปลี่ยน</button>
            </div>
          ) : (
            <div className="loc-empty">
              <button type="button" className="btn-primary" onClick={locateNow} disabled={locating}>
                {locating ? 'กำลังหาตำแหน่ง…' : '📍 ใช้ตำแหน่งปัจจุบัน'}
              </button>
              <button type="button" className="btn-outline" onClick={() => setSheet({ lat: null, lng: null, address })}>🗺️ เลือกบนแผนที่ / ค้นหา</button>
            </div>
          )}

          {hasPin && (
            <button type="button" className="loc-now" onClick={locateNow} disabled={locating}>
              {locating ? 'กำลังหาตำแหน่ง…' : '◎ ใช้ตำแหน่งปัจจุบันของฉัน'}
            </button>
          )}

          {err && <div className="err" style={{ marginTop: 6 }}>{err}</div>}

          {others.length > 0 && (
            <div className="loc-saved">
              <div className="loc-saved-title">ที่อยู่ที่เคยใช้</div>
              {others.map(p => (
                <div key={`${p.lat},${p.lng}`} className="loc-saved-row">
                  <button type="button" className="loc-saved-pick" onClick={() => { applyPlace(p); setErr('') }}>
                    <span aria-hidden="true">🕘</span>
                    <span className="loc-saved-addr">{p.address}</span>
                  </button>
                  <button type="button" className="loc-saved-del" onClick={() => forget(p.lat, p.lng)} aria-label="ลบที่อยู่นี้">×</button>
                </div>
              ))}
            </div>
          )}

          <label className="field-label">รายละเอียดที่อยู่ (บ้านเลขที่ ซอย จุดสังเกต)</label>
          <textarea
            placeholder="บ้านเลขที่ ถนน ซอย จุดสังเกต"
            value={address}
            rows={3}
            maxLength={500}
            onChange={e => shop.setDelivery({ address: e.target.value })}
            onBlur={() => { if (hasPin && address.trim()) remember({ address, lat, lng }) }}
          />
        </>
      )}

      {sheet && (
        <LocationSheet
          initial={{ lat: sheet.lat, lng: sheet.lng, address: sheet.address }}
          warn={sheet.warn}
          initialZoom={sheet.zoom}
          googleKey={cfg?.googleMapsKey || ''}
          onConfirm={confirmSheet}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
