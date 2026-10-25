import { useState } from 'react'

// =====================================================
// AI ตรวจสลิป (ฝั่งพนักงานขาย)
//  - กด "ให้ AI ตรวจสลิป" -> ได้ผล ผ่าน / ควรตรวจเอง / ไม่ผ่าน พร้อมรายการที่ตรวจ
//  - เป็นตัวช่วยคัดกรองเท่านั้น: พนักงานยังต้องกดยืนยัน/ปฏิเสธเองเสมอ
// =====================================================

const VERDICT = {
  pass: { bg: '#e6f6ea', border: '#7cc68b', color: '#1b6b2a', icon: '✅', title: 'AI: ผ่านการตรวจเบื้องต้น', hint: 'ทุกรายการตรงกัน — ยังควรดูเงินเข้าในแอปธนาคารก่อนกดยืนยัน' },
  review: { bg: '#fff6dd', border: '#f0c24f', color: '#8a5a00', icon: '⚠️', title: 'AI: ควรตรวจเองอีกครั้ง', hint: 'มีบางรายการที่ AI ยืนยันไม่ได้ — เช็กในแอปธนาคารก่อนยืนยัน' },
  fail: { bg: '#fde8e8', border: '#ef9a9a', color: '#a11', icon: '⛔', title: 'AI: พบความผิดปกติ ไม่แนะนำให้ยืนยัน', hint: 'ตรวจกับยอดเข้าบัญชีจริง ถ้าไม่ตรงให้กด "ไม่รับออเดอร์"' },
}

const ICON = { ok: '✔', warn: '!', bad: '✖' }
const COLOR = { ok: '#1b6b2a', warn: '#b36b00', bad: '#c62828' }

const fmt = v => (v ? new Date(v).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '')

export default function SlipAICheck({ initial, enabled, run }) {
  const [result, setResult] = useState(initial || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    setBusy(true)
    setError('')

    try {
      setResult(await run())
    } catch (e) {
      setError(e.message || 'AI ตรวจสลิปไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  // ผลจากการตรวจอัตโนมัติ (AI_SLIP_AUTO) อาจมาทีหลัง — ให้รับค่าใหม่จากรายการที่โหลดซ้ำ
  const shown = result || initial || null
  const v = shown ? VERDICT[shown.verdict] || VERDICT.review : null

  return (
    <div style={{ margin: '8px 0' }}>
      {!shown && (
        <button
          type="button"
          className="btn-outline"
          disabled={busy || enabled === false}
          onClick={check}
          style={{ width: '100%' }}
        >
          {busy ? ' AI กำลังอ่านสลิป...' : ' ให้ AI ตรวจสลิป'}
        </button>
      )}

      {enabled === false && !shown && (
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
          ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน backend/.env — ตรวจสลิปด้วยตาไปก่อน
        </div>
      )}

      {error && (
        <div style={{ background: '#ffe8e8', color: '#a11', borderRadius: 9, padding: 9, fontSize: 13, marginTop: 6 }}>
          {error}
        </div>
      )}

      {shown && v && (
        <div style={{ background: v.bg, border: `1px solid ${v.border}`, borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 900, color: v.color }}>
            {v.icon} {v.title}
          </div>

          <div style={{ fontSize: 12, color: '#555', margin: '2px 0 6px' }}>{v.hint}</div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: 13 }}>
            {shown.checks.map(c => (
              <li key={c.key} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <b style={{ color: COLOR[c.status], width: 14, flex: 'none', textAlign: 'center' }}>{ICON[c.status]}</b>
                <span>
                  <b>{c.label}</b>
                  <span style={{ color: '#555' }}> — {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          {shown.extracted && (shown.extracted.amount != null || shown.extracted.transactionRef) && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 6, borderTop: '1px dashed #0002', paddingTop: 6 }}>
              AI อ่านได้:
              {shown.extracted.amount != null && <> ยอด ฿{Number(shown.extracted.amount).toLocaleString('th-TH')}</>}
              {shown.extracted.bank && <> · {shown.extracted.bank}</>}
              {shown.extracted.transactionRef && <> · อ้างอิง {shown.extracted.transactionRef}</>}
            </div>
          )}

          {shown.notes && <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{shown.notes}</div>}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
            <small style={{ color: '#777' }}>ตรวจเมื่อ {fmt(shown.checkedAt)}</small>
            <button
              type="button"
              onClick={check}
              disabled={busy}
              style={{ border: 'none', background: 'none', color: '#1a5fd0', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
            >
              {busy ? 'กำลังตรวจ...' : 'ตรวจใหม่'}
            </button>
          </div>

          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            AI ช่วยคัดกรองจากรูปเท่านั้น ไม่เห็นยอดเงินเข้าบัญชีจริง — ตัดสินใจโดยพนักงานเสมอ
          </div>
        </div>
      )}
    </div>
  )
}
