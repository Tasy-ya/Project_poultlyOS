import { useEffect, useState } from 'react'
import { api } from '../api'

// =====================================================
// แท็บ "ล็อต" ในหน้า Stock (ฝ่ายสต็อก)
//
//  - สรุปรายวัตถุดิบ: ใช้ได้ / ใกล้หมดอายุ / หมดอายุ / ยอดไม่ตรงกับผลรวมล็อต
//  - รายการล็อต เรียงตามลำดับที่ระบบจะเบิก (FIFO = รับเข้าก่อนใช้ก่อน) ล็อตที่ "ใช้ก่อน" ติดป้ายไว้
//  - ทิ้งของเสีย/หมดอายุ (ต้องใส่เหตุผล)
//  - ตรวจนับสต็อก เทียบของจริงกับยอดในระบบ แล้วบันทึกส่วนต่าง
//
// การรับเข้า (สร้างล็อตใหม่) อยู่ที่แท็บ "1 ดิบ"
// =====================================================

const fmtDate = v =>
  v ? new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'

const STATE = {
  expired: { text: 'หมดอายุแล้ว', color: '#c62828', bg: '#fdecea' },
  expiring: { text: 'ใกล้หมดอายุ', color: '#b26a00', bg: '#fff4e0' },
  ok: { text: 'ปกติ', color: '#2e7d32', bg: '#edf7ed' },
  no_expiry: { text: 'ปกติ', color: '#2e7d32', bg: '#edf7ed' },
}

const STORAGE = {
  ambient: { text: 'อุณหภูมิห้อง', color: '#555', bg: '#f3f3f3' },
  chilled: { text: 'แช่เย็น', color: '#1565c0', bg: '#e3f2fd' },
  frozen: { text: 'แช่แข็ง', color: '#00695c', bg: '#e0f2f1' },
  thawed: { text: 'ละลายแล้ว', color: '#b26a00', bg: '#fff4e0' },
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

export default function StockLots({ branchId, branchName, category, materials = [], onChanged }) {
  const [summary, setSummary] = useState([])
  const [lots, setLots] = useState([])
  const [materialId, setMaterialId] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [msg, setMsg] = useState('')
  const [waste, setWaste] = useState(null) // { lot, qty, reason }
  const [count, setCount] = useState({ materialId: '', counted: '', note: '' })
  const [mv, setMv] = useState(null) // { lot, to, qty }
  const [life, setLife] = useState({ materialId: '', defaultStorage: 'ambient', chilledDays: '', frozenDays: '', thawedDays: '' })

  const pickLifeMaterial = id => {
    const m = materials.find(x => String(x.id) === String(id))

    setLife({
      materialId: id,
      defaultStorage: m?.defaultStorage || 'ambient',
      chilledDays: m?.shelfLifeChilledDays ?? '',
      frozenDays: m?.shelfLifeFrozenDays ?? '',
      thawedDays: m?.shelfLifeThawedDays ?? '',
    })
  }

  const load = () => {
    if (!branchId) return

    const fail = e => {
      setMsg('❌ ' + e.message)
      return null
    }

    api.getRawLotSummary(branchId, 3)
      .then(r => setSummary((r && r.rows) || []))
      .catch(fail)

    api.getRawLots(branchId, {
      category,
      materialId,
      status: showAll ? 'all' : '',
    })
      .then(r => setLots(Array.isArray(r) ? r : []))
      .catch(fail)
  }

  useEffect(() => {
    load()
  }, [branchId, category, materialId, showAll])

  async function run(fn, okText) {
    try {
      const r = await fn()

      setMsg(okText(r))
      setWaste(null)
      setMv(null)
      load()
      if (onChanged) onChanged()
    } catch (e) {
      setMsg('❌ ' + e.message)
    }
  }

  const expiredTotal = summary.filter(s => s.expiredQty > 0).length
  const soonTotal = summary.filter(s => s.expiringQty > 0).length
  const mismatchTotal = summary.filter(s => s.mismatch).length

  return (
    <>
      {msg && <p>{msg}</p>}

      {/* ---------- สรุป ---------- */}
      <div className="card gray">
        <b>สรุปวัตถุดิบ {branchName ? `· ${branchName}` : ''}</b>

        <div style={{ margin: '6px 0' }}>
          {expiredTotal > 0 && <Badge color="#c62828" bg="#fdecea">หมดอายุ {expiredTotal} รายการ</Badge>}
          {soonTotal > 0 && <Badge color="#b26a00" bg="#fff4e0">ใกล้หมดอายุ (≤3 วัน) {soonTotal} รายการ</Badge>}
          {mismatchTotal > 0 && <Badge color="#6a1b9a" bg="#f3e5f5">ยอดไม่ตรง {mismatchTotal} รายการ</Badge>}
          {expiredTotal + soonTotal + mismatchTotal === 0 && <Badge color="#2e7d32" bg="#edf7ed">ไม่มีรายการที่ต้องจัดการ</Badge>}
        </div>

        {summary.length === 0 && <small>ยังไม่มีวัตถุดิบในสาขานี้</small>}

        {summary.map(s => (
          <div
            key={s.materialId}
            style={{ padding: '6px 0', borderTop: '1px solid #e5e5e5', cursor: 'pointer' }}
            onClick={() => setMaterialId(String(materialId) === String(s.materialId) ? '' : String(s.materialId))}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {s.name} <small>({s.lotCount} ล็อต)</small>
              </span>
              <b>
                ใช้ได้ {s.usableQty} {s.unit}
              </b>
            </div>

            <small>
              {s.nearestExpiry ? `หมดอายุใกล้สุด ${fmtDate(s.nearestExpiry)}` : ''}
              {s.expiringQty > 0 && ` · ใกล้หมดอายุ ${s.expiringQty}`}
              {s.expiredQty > 0 && <b style={{ color: '#c62828' }}> · หมดอายุ {s.expiredQty} (ต้องทิ้ง)</b>}
              {s.mismatch && <b style={{ color: '#6a1b9a' }}> · ยอดรวม {s.stockQty} ≠ ผลรวมล็อต {s.lotTotal} (ควรตรวจนับ)</b>}
            </small>
          </div>
        ))}
      </div>

      {/* ---------- รายการล็อต ---------- */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}>
        <select style={{ flex: 1, margin: 0 }} value={materialId} onChange={e => setMaterialId(e.target.value)}>
          <option value="">ทุกวัตถุดิบ</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <label style={{ whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> รวมล็อตที่หมด/ทิ้งแล้ว
        </label>
      </div>

      <small>เรียงตามลำดับที่ระบบจะเบิก: ล็อตที่รับเข้าก่อนจะถูกใช้ก่อน (FIFO)</small>

      {lots.length === 0 && <div className="card">ไม่มีล็อต</div>}

      {lots.map(l => {
        const st = STATE[l.state] || STATE.ok
        const inactive = l.status !== 'active' || l.qtyRemaining <= 0

        return (
          <div
            className="card"
            key={l.id}
            style={{ borderLeft: `5px solid ${st.color}`, opacity: inactive ? 0.55 : 1 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>
                {l.material?.name} · {l.lotNo}
              </b>
              <b>
                {l.qtyRemaining} / {l.qtyReceived} {l.material?.unit}
              </b>
            </div>

            <div style={{ margin: '4px 0' }}>
              <Badge color={st.color} bg={st.bg}>
                {st.text}
                {l.daysLeft != null && l.state !== 'expired' ? ` (อีก ${l.daysLeft} วัน)` : ''}
              </Badge>

              {l.storage && STORAGE[l.storage] && (
                <Badge color={STORAGE[l.storage].color} bg={STORAGE[l.storage].bg}>
                  {STORAGE[l.storage].text}
                </Badge>
              )}

              {l.pickOrder && (
                <Badge color="#1565c0" bg="#e3f2fd">
                  {l.pickOrder === 1 ? 'ใช้ก่อน' : `ลำดับเบิก ${l.pickOrder}`}
                </Badge>
              )}

              {inactive && (
                <Badge color="#555" bg="#eee">
                  {l.status === 'discarded' ? 'ทิ้งแล้ว' : 'ใช้หมดแล้ว'}
                </Badge>
              )}
            </div>

            <small>
              รับเข้า {fmtDate(l.receivedAt)}{l.expiresAt ? ` · หมดอายุ ${fmtDate(l.expiresAt)}` : ''}
              {l.supplier ? ` · ${l.supplier}` : ''}
              {l.expirySource === 'auto' && ' · วันหมดอายุคำนวณจากอายุมาตรฐาน'}
            </small>

            {!inactive && (
              <div style={{ marginTop: 6 }}>
                <button
                  className="btn-outline"
                  style={{ width: 'auto', padding: '4px 12px' }}
                  onClick={() => setWaste({ lot: l, qty: '', reason: l.state === 'expired' ? 'หมดอายุ' : '' })}
                >
                  ทิ้ง
                </button>

                {l.storage === 'chilled' && l.state !== 'expired' && (
                  <button
                    className="btn-outline"
                    style={{ width: 'auto', padding: '4px 12px', marginLeft: 8 }}
                    onClick={() => setMv({ lot: l, to: 'frozen', qty: '' })}
                  >
                    แช่แข็ง
                  </button>
                )}

                {l.storage === 'frozen' && l.state !== 'expired' && (
                  <button
                    className="btn-outline"
                    style={{ width: 'auto', padding: '4px 12px', marginLeft: 8 }}
                    onClick={() => setMv({ lot: l, to: 'thawed', qty: '' })}
                  >
                    ละลาย
                  </button>
                )}
              </div>
            )}

            {mv && mv.lot.id === l.id && (
              <div className="card gray" style={{ marginTop: 8 }}>
                <b>{mv.to === 'frozen' ? 'แช่แข็ง' : 'ละลาย'}ล็อต {l.lotNo}</b>
                <small>
                  {mv.to === 'frozen'
                    ? 'แยกเป็นล็อตใหม่ (-F) วันหมดอายุคำนวณใหม่จากอายุแช่แข็ง ยอดรวมไม่เปลี่ยน'
                    : 'แยกเป็นล็อตใหม่ (-T) อายุสั้นลงตามอายุหลังละลาย (ไม่เกินอายุเดิม) ห้ามแช่แข็งซ้ำ'}
                </small>
                <input
                  type="number"
                  placeholder={`จำนวน (ว่าง = ทั้งหมด ${l.qtyRemaining})`}
                  value={mv.qty}
                  onChange={e => setMv({ ...mv, qty: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      run(
                        () =>
                          api.moveRawLot({
                            lotId: l.id,
                            to: mv.to,
                            qty: mv.qty === '' ? undefined : Number(mv.qty),
                          }),
                        r =>
                          `✅ ${r.to === 'frozen' ? 'แช่แข็ง' : 'ละลาย'} ${r.material} ${r.qty} ${r.unit} → ล็อต ${r.lotNo}` +
                          (r.expiresAt ? ` · หมดอายุ ${fmtDate(r.expiresAt)}` : ' · ⚠ ยังไม่ได้ตั้งอายุมาตรฐาน ล็อตใหม่จึงไม่มีวันหมดอายุ')
                      )
                    }
                  >
                    ยืนยัน
                  </button>
                  <button className="btn-outline" onClick={() => setMv(null)}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {waste && waste.lot.id === l.id && (
              <div className="card gray" style={{ marginTop: 8 }}>
                <b>ทิ้งล็อต {l.lotNo}</b>
                <input
                  type="number"
                  placeholder={`จำนวนที่ทิ้ง (ว่าง = ทั้งหมด ${l.qtyRemaining})`}
                  value={waste.qty}
                  onChange={e => setWaste({ ...waste, qty: e.target.value })}
                />
                <input
                  placeholder="เหตุผล (เช่น หมดอายุ / เสีย / ตกพื้น)"
                  value={waste.reason}
                  onChange={e => setWaste({ ...waste, reason: e.target.value })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      run(
                        () =>
                          api.wasteRawLot({
                            lotId: l.id,
                            qty: waste.qty === '' ? undefined : Number(waste.qty),
                            reason: waste.reason,
                          }),
                        r => `✅ ทิ้ง ${r.material} ล็อต ${r.lotNo} จำนวน ${r.wasted} แล้ว (เหลือ ${r.remaining})`
                      )
                    }
                  >
                    ยืนยันทิ้ง
                  </button>
                  <button className="btn-outline" onClick={() => setWaste(null)}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ---------- อายุเก็บมาตรฐาน ---------- */}
      <details className="card gray">
        <summary><b>ตั้งอายุเก็บมาตรฐาน (ไม่บังคับ — ระบบเบิกตามวันรับเข้าอยู่แล้ว)</b></summary>
        <small>
          ตอนรับเข้า ถ้าไม่กรอกวันหมดอายุ ระบบจะตั้งให้ = วันรับเข้า + อายุของสถานะนั้น · เว้นว่าง = ไม่ตั้ง (ล็อตจะไม่มีวันหมดอายุ)
        </small>

        <select value={life.materialId} onChange={e => pickLifeMaterial(e.target.value)}>
          <option value="">เลือกวัตถุดิบ</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
          ))}
        </select>

        {life.materialId && (
          <>
            <label><small>สถานะเก็บตั้งต้นตอนรับเข้า</small></label>
            <select value={life.defaultStorage} onChange={e => setLife({ ...life, defaultStorage: e.target.value })}>
              <option value="ambient">อุณหภูมิห้อง</option>
              <option value="chilled">แช่เย็น</option>
              <option value="frozen">แช่แข็ง</option>
            </select>

            <input
              type="number"
              min="1"
              placeholder="อายุแช่เย็น (วัน)"
              value={life.chilledDays}
              onChange={e => setLife({ ...life, chilledDays: e.target.value })}
            />
            <input
              type="number"
              min="1"
              placeholder="อายุแช่แข็ง (วัน)"
              value={life.frozenDays}
              onChange={e => setLife({ ...life, frozenDays: e.target.value })}
            />
            <input
              type="number"
              min="1"
              placeholder="อายุหลังละลาย (วัน) — ว่าง = 1 วัน"
              value={life.thawedDays}
              onChange={e => setLife({ ...life, thawedDays: e.target.value })}
            />

            <button
              className="btn-primary"
              onClick={() =>
                run(
                  () =>
                    api.setMaterialShelfLife(Number(life.materialId), {
                      defaultStorage: life.defaultStorage,
                      chilledDays: life.chilledDays === '' ? null : Number(life.chilledDays),
                      frozenDays: life.frozenDays === '' ? null : Number(life.frozenDays),
                      thawedDays: life.thawedDays === '' ? null : Number(life.thawedDays),
                    }),
                  r => `✅ บันทึกอายุเก็บมาตรฐานของ ${r.name} แล้ว (ใช้กับการรับเข้าครั้งต่อไป)`
                )
              }
            >
              บันทึกอายุมาตรฐาน
            </button>
          </>
        )}
      </details>

      {/* ---------- ตรวจนับสต็อก ---------- */}
      <div className="card gray">
        <b>ตรวจนับสต็อก (เทียบของจริงกับระบบ)</b>
        <small>
          นับได้น้อยกว่าระบบ → ตัดส่วนต่างจากล็อตเก่าสุดก่อน (FIFO) · นับได้มากกว่า → สร้างล็อตปรับยอด · ทุกครั้งมีประวัติ
        </small>

        <select value={count.materialId} onChange={e => setCount({ ...count, materialId: e.target.value })}>
          <option value="">เลือกวัตถุดิบ</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.unit})
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="จำนวนที่นับได้จริง"
          value={count.counted}
          onChange={e => setCount({ ...count, counted: e.target.value })}
        />

        <input
          placeholder="หมายเหตุ (ถ้ามี)"
          value={count.note}
          onChange={e => setCount({ ...count, note: e.target.value })}
        />

        <button
          className="btn-primary"
          onClick={() =>
            run(
              () => {
                if (!count.materialId || count.counted === '') {
                  throw new Error('เลือกวัตถุดิบและใส่จำนวนที่นับได้ก่อน')
                }

                return api.stocktakeRaw({
                  branchId: Number(branchId),
                  materialId: Number(count.materialId),
                  countedQty: Number(count.counted),
                  note: count.note || undefined,
                })
              },
              r => {
                setCount({ materialId: '', counted: '', note: '' })

                return r.diff === 0
                  ? `✅ ${r.material}: ยอดตรงกับระบบ (${r.after} ${r.unit})`
                  : `✅ ${r.material}: ระบบ ${r.before} → นับได้ ${r.counted} (ส่วนต่าง ${r.diff > 0 ? '+' : ''}${r.diff} ${r.unit})`
              }
            )
          }
        >
          บันทึกผลตรวจนับ
        </button>
      </div>
    </>
  )
}
