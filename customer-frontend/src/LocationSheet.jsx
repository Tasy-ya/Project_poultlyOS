import { useEffect, useRef, useState } from 'react'
import MapPicker from './MapPicker'
import { reverseOsm } from './geo'

// หน้าต่างเลือกตำแหน่งเต็มจอ (แบบ LINE MAN): เลื่อนแผนที่ให้หมุดตรงจุดส่ง แล้วกด "ยืนยันตำแหน่งนี้"
//  - ถ้าเคยมีที่อยู่ที่จำไว้ จะเปิดที่จุดนั้น  ถ้ายังไม่เคย จะพาไปตำแหน่งปัจจุบันทันที
export default function LocationSheet({ initial, googleKey, onConfirm, onClose, warn = '', initialZoom }) {
  const hasInit = initial.lat != null && initial.lng != null

  const [draft, setDraft] = useState(
    hasInit ? { lat: initial.lat, lng: initial.lng, address: initial.address || '', pending: !initial.address } : null
  )

  // เปิดมาพร้อมพิกัดแต่ยังไม่มีที่อยู่ (เช่นตำแหน่งปัจจุบันที่หยาบ) -> หาที่อยู่ให้
  useEffect(() => {
    if (!hasInit || initial.address) return undefined
    let alive = true

    reverseOsm(initial.lat, initial.lng).then(addr => {
      if (!alive) return
      setDraft(d => (d && d.lat === initial.lat && d.lng === initial.lng ? { ...d, address: addr, pending: false } : d))
    })

    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ล็อกการเลื่อนหน้าด้านหลัง + กด Esc เพื่อปิด (ทำครั้งเดียวตอนเปิด/ปิดหน้าต่าง)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const confirm = () => {
    if (!draft || draft.pending) return

    const address =
      draft.address ||
      initial.address ||
      `พิกัด ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`

    onConfirm({ lat: draft.lat, lng: draft.lng, address })
  }

  return (
    <div className="loc-sheet" role="dialog" aria-modal="true" aria-label="เลือกตำแหน่งจัดส่ง">
      <div className="loc-sheet-head">
        <button type="button" className="loc-sheet-close" onClick={onClose} aria-label="ปิด">×</button>
        <b>เลือกตำแหน่งจัดส่ง</b>
      </div>

      {warn && <div className="loc-sheet-warn">{warn}</div>}

      <MapPicker
        initialZoom={initialZoom}
        lat={initial.lat}
        lng={initial.lng}
        googleKey={googleKey}
        autoLocate={!hasInit}
        onChange={setDraft}
      />

      <div className="loc-sheet-foot">
        <div className="loc-sheet-addr">
          {!draft && 'เลื่อนแผนที่ให้หมุดอยู่ตรงจุดที่ต้องการให้ส่ง'}
          {draft?.pending && 'กำลังหาที่อยู่…'}
          {draft && !draft.pending && (draft.address || `พิกัด ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}`)}
        </div>

        <button type="button" className="btn-primary" onClick={confirm} disabled={!draft || draft.pending}>
          ยืนยันตำแหน่งนี้
        </button>
      </div>
    </div>
  )
}
