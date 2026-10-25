import { useState } from 'react'
import { api } from '../api'

// =====================================================
// แท็บ "2 หมัก" — รายการชุดหมัก (ไก่หมัก/เป็ดหมัก)
//  - เรียงตามชุดที่หมักก่อน (FIFO) ชุดแรกที่ยังใช้ได้ติดป้าย "ใช้ก่อน"
//  - แสดงสถานะ: ปกติ / ใกล้หมดอายุ (ไม่ถึง 24 ชม.) / หมดอายุแล้ว
//  - ทิ้งชุดที่เสีย/หมดอายุ (ทั้งชุดหรือบางส่วน) เพื่อไม่ให้ยอดค้างในระบบ
// ฟอร์ม "เริ่มหมัก" อยู่ใต้รายการนี้ใน StockPage
// =====================================================

const HOUR = 3600 * 1000

const STATE = {
  expired: { text: 'หมดอายุแล้ว', color: '#c62828', bg: '#fdecea' },
  expiring: { text: 'ใกล้หมดอายุ', color: '#b26a00', bg: '#fff4e0' },
  ok: { text: 'ปกติ', color: '#2e7d32', bg: '#edf7ed' },
}

const fmtDateTime = v =>
  v
    ? new Date(v).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-'

function stateOf(batch, now) {
  if (!batch.expiresAt) return { key: 'ok', left: null }

  const left = new Date(batch.expiresAt).getTime() - now

  if (left <= 0) return { key: 'expired', left }
  if (left < 24 * HOUR) return { key: 'expiring', left }

  return { key: 'ok', left }
}

function leftText(ms) {
  if (ms == null || ms <= 0) return ''

  const hours = Math.floor(ms / HOUR)

  return hours >= 24 ? `อีก ${Math.floor(hours / 24)} วัน ${hours % 24} ชม.` : `อีก ${Math.max(hours, 1)} ชม.`
}

function Badge({ color, bg, children }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 'bold',
        color,
        background: bg,
        marginRight: 6,
      }}
    >
      {children}
    </span>
  )
}

export default function PrepBatches({ batches = [], onChanged }) {
  const [waste, setWaste] = useState(null) // { batch, qty }
  const [msg, setMsg] = useState('')
  const now = Date.now()

  // ชุดแรกที่ "ยังไม่หมดอายุ" ตามลำดับหมักก่อน = ใช้ก่อน
  const firstUsable = batches.find(x => stateOf(x, now).key !== 'expired')

  async function discard() {
    try {
      const r = await api.discardPrepBatch(waste.batch.id, {
        qty: waste.qty === '' ? undefined : Number(waste.qty),
      })

      setMsg(`✅ ทิ้ง ${r.name} #${r.batchNo} จำนวน ${r.wasted} แล้ว (เหลือ ${r.remaining})`)
      setWaste(null)
      onChanged && onChanged()
    } catch (e) {
      setMsg('❌ ' + e.message)
    }
  }

  return (
    <div>
      <small>เรียงตามชุดที่หมักก่อน — ชุดที่หมักก่อนควรถูกใช้ก่อน (FIFO)</small>

      {msg && <div className="card gray">{msg}</div>}

      {batches.length === 0 && <div className="card">ยังไม่มีชุดหมักที่ใช้ได้</div>}

      {batches.map(x => {
        const st = stateOf(x, now)
        const style = STATE[st.key]
        const unit = x.prepItem?.unit || 'ตัว'

        return (
          <div className="card" key={x.id} style={{ borderLeft: `5px solid ${style.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>
                {x.prepItem?.name} #{x.batchNo || x.id}
              </b>
              <b>
                เหลือ {Number(x.qtyRemaining)} / {Number(x.qtyProduced)} {unit}
              </b>
            </div>

            <div style={{ margin: '4px 0' }}>
              <Badge color={style.color} bg={style.bg}>
                {style.text}
                {st.key !== 'expired' && st.left != null ? ` (${leftText(st.left)})` : ''}
              </Badge>

              {firstUsable && firstUsable.id === x.id && (
                <Badge color="#1565c0" bg="#e3f2fd">ใช้ก่อน</Badge>
              )}
            </div>

            <small>
              หมักเมื่อ {fmtDateTime(x.preparedAt)}
              {x.expiresAt ? ` · หมดอายุ ${fmtDateTime(x.expiresAt)}` : ' · ไม่ได้ตั้งอายุหมัก'}
            </small>

            {st.key === 'expired' && (
              <div>
                <small style={{ color: '#c62828' }}>
                  <b>หมดอายุแล้ว — ถ้าไม่มีของแล้วหรือต้องทิ้ง กดทิ้งเพื่อตัดยอดออก</b>
                </small>
              </div>
            )}

            <div style={{ marginTop: 6 }}>
              <button
                className="btn-outline"
                style={{ width: 'auto', padding: '4px 12px' }}
                onClick={() => setWaste({ batch: x, qty: '' })}
              >
                ทิ้ง
              </button>
            </div>

            {waste && waste.batch.id === x.id && (
              <div className="card gray" style={{ marginTop: 8 }}>
                <b>ทิ้งชุดหมัก #{x.batchNo || x.id}</b>
                <input
                  type="number"
                  placeholder={`จำนวนที่ทิ้ง (ว่าง = ทั้งหมด ${Number(x.qtyRemaining)})`}
                  value={waste.qty}
                  onChange={e => setWaste({ ...waste, qty: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" onClick={discard}>ยืนยันทิ้ง</button>
                  <button className="btn-outline" onClick={() => setWaste(null)}>ยกเลิก</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
