import { useEffect, useState } from 'react'
import { useShop } from './ShopContext'
import { shopApi } from './shopApi'

const pad = n => String(n).padStart(2, '0')

export const toLocalInput = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

// ตรวจเวลาที่ลูกค้าเลือก (ใช้ทั้งหน้าตะกร้าและหน้าชำระเงิน) — คืนข้อความ error หรือ '' ถ้าผ่าน
export function checkPickupTime(value, { isReserve, cfg }) {
  if (!value) return isReserve ? 'กรุณาเลือกวันและเวลารับสินค้า' : ''

  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return 'เวลาที่เลือกไม่ถูกต้อง'

  const lead = isReserve ? (cfg?.minLeadHours ?? 0) * 3600000 : -5 * 60000
  if (when.getTime() < Date.now() + lead) {
    return isReserve
      ? `ต้องจองล่วงหน้าอย่างน้อย ${cfg?.minLeadHours ?? 0} ชั่วโมง`
      : 'เวลาที่เลือกผ่านไปแล้ว กรุณาเลือกเวลาใหม่'
  }

  const maxDays = cfg?.maxDaysAhead ?? 14
  if (when.getTime() > Date.now() + maxDays * 86400000) {
    return `เลือกเวลาล่วงหน้าได้ไม่เกิน ${maxDays} วัน`
  }

  if (cfg?.openHour != null && cfg?.closeHour != null) {
    const h = when.getHours() + when.getMinutes() / 60
    if (h < cfg.openHour || h > cfg.closeHour) {
      return `ร้านเปิด ${cfg.openHour}:00–${cfg.closeHour}:00 น. กรุณาเลือกเวลาในช่วงนี้`
    }
  }

  return ''
}

// ข้อมูลผู้สั่ง: ชื่อ + เบอร์โทร + เวลารับ/ส่ง — ใช้ได้ทั้ง "สั่งซื้อเลย" และ "จองล่วงหน้า"
// เก็บร่วมกันใน ShopContext จึงกรอกที่หน้าตะกร้าหรือหน้าชำระเงินก็ได้
export default function BuyerBox({ cfg: cfgProp }) {
  const shop = useShop()
  const isReserve = shop.mode === 'reserve'
  const { name, phone, pickupAt } = shop.buyer
  const [cfgLocal, setCfgLocal] = useState(null)

  useEffect(() => {
    if (cfgProp) return undefined
    let alive = true
    shopApi.config().then(c => alive && setCfgLocal(c)).catch(() => {})
    return () => { alive = false }
  }, [cfgProp])

  const cfg = cfgProp || cfgLocal
  const lead = isReserve ? (cfg?.minLeadHours ?? 0) * 3600000 : 0
  const min = toLocalInput(new Date(Date.now() + lead))
  const max = toLocalInput(new Date(Date.now() + (cfg?.maxDaysAhead ?? 14) * 86400000))

  return (
    <div className="buyer-box">
      <h4>ข้อมูลผู้สั่ง</h4>

      <input
        placeholder="ชื่อ"
        value={name}
        onChange={e => shop.setBuyer({ name: e.target.value })}
        autoComplete="name"
        maxLength={100}
      />

      <input
        placeholder="เบอร์โทรศัพท์"
        inputMode="tel"
        value={phone}
        onChange={e => shop.setBuyer({ phone: e.target.value })}
        autoComplete="tel"
        maxLength={20}
      />

      <label className="field-label">
        {isReserve ? 'วันและเวลารับสินค้า' : 'เวลาที่ต้องการรับ/ให้ส่ง (ไม่บังคับ)'}
      </label>

      <input
        type="datetime-local"
        value={pickupAt}
        min={min}
        max={max}
        onChange={e => shop.setBuyer({ pickupAt: e.target.value })}
      />

      {!isReserve && pickupAt && (
        <button type="button" className="btn-outline" style={{ marginTop: 6 }} onClick={() => shop.setBuyer({ pickupAt: '' })}>
          ล้างเวลา (ให้ร้านเตรียมให้เร็วที่สุด)
        </button>
      )}

      <div className="muted" style={{ marginTop: 6 }}>
        {isReserve
          ? `จองล่วงหน้าอย่างน้อย ${cfg?.minLeadHours ?? '-'} ชั่วโมง`
          : 'ไม่เลือกเวลา = ให้ร้านเตรียมให้เร็วที่สุด'}
        {cfg ? ` · ร้านเปิด ${cfg.openHour}:00–${cfg.closeHour}:00 น.` : ''}
      </div>
    </div>
  )
}
