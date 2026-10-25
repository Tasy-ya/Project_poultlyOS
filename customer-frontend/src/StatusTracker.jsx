import { IconSlip, IconReceived, IconPrep, IconReady, IconCheck } from './Icons'

// แถบสถานะออเดอร์ที่ลูกค้าดูได้:
// ตรวจสลิป -> รับออเดอร์แล้ว -> กำลังเตรียม -> พร้อมรับออเดอร์
// (ไอคอนเป็นเส้นสีเดียว เปลี่ยนสีตามสถานะผ่าน CSS)
const STEPS = [
  { key: 'slip', label: 'ตรวจสลิป', Icon: IconSlip },
  { key: 'new', label: 'รับออเดอร์แล้ว', Icon: IconReceived },
  { key: 'preparing', label: 'กำลังเตรียม', Icon: IconPrep },
  { key: 'ready', label: 'พร้อมรับออเดอร์', Icon: IconReady },
]

// ตำแหน่งขั้นปัจจุบัน (0-3) / 4 = ส่งมอบแล้ว / -1 = ยกเลิก
export function stepIndex(data) {
  if (!data || data.status === 'cancelled') return -1
  if (data.status === 'pending_payment') return 0

  const f = data.fulfillmentStatus || 'new'
  if (f === 'picked_up') return 4
  if (f === 'ready') return 3
  if (f === 'preparing') return 2
  return 1
}

export default function StatusTracker({ data }) {
  if (!data || data.status === 'cancelled') return null

  const idx = stepIndex(data)
  const delivery = data.deliveryMethod === 'delivery'
  const pending = data.status === 'pending_payment'
  const readyLabel = delivery ? 'พร้อมจัดส่ง' : 'พร้อมรับออเดอร์'

  return (
    <div className="tracker" aria-label="สถานะออเดอร์">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s.key} className={i < idx || (i === idx && i === 3) ? 'done' : i === idx ? 'now' : ''}>
            <span className="dot">{i < idx ? <IconCheck size={20} /> : <s.Icon size={20} />}</span>
            <span className="lbl">{s.key === 'ready' ? readyLabel : s.label}</span>
          </li>
        ))}
      </ol>
      <div className="tracker-msg">
        {pending
          ? data.slipUploaded
            ? 'แนบสลิปแล้ว — รอพนักงานตรวจสลิป แล้วออเดอร์จะเข้าคิวเตรียมทันที'
            : 'ยังไม่ได้แนบสลิป — กรุณาโอนเงินและแนบสลิปเพื่อให้ร้านเริ่มเตรียมออเดอร์'
          : idx === 4
            ? 'รับสินค้าเรียบร้อยแล้ว ขอบคุณค่ะ'
            : idx === 3
              ? delivery ? 'ออเดอร์พร้อมจัดส่งแล้ว' : 'ออเดอร์พร้อมแล้ว มารับได้เลยค่ะ'
              : idx === 2
                ? 'ร้านกำลังเตรียมออเดอร์ของคุณ'
                : 'ร้านตรวจสลิปแล้ว รับออเดอร์เรียบร้อย กำลังจะเริ่มเตรียม'}
      </div>
    </div>
  )
}
