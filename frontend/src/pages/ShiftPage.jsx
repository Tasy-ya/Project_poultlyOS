import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import {
  api,
  baht,
  PAY_LABEL,
  getSelectedBranchId,
  onBranchChange,
} from '../api'
import { getActiveBranches } from '../branch'
import { esc, printHtml } from '../printUtil'

// =====================================================
// กะการขาย (เปิดกะ / ปิดกะ นับเงินในลิ้นชัก)
//
// เปิดกะ  : ใส่เงินทอนตั้งต้นในลิ้นชัก
// ระหว่างกะ: ระบบรวมยอดขาย แยกตามวิธีจ่าย และค่าใช้จ่ายที่จ่ายจากลิ้นชัก
// ปิดกะ   : ใส่เงินสดที่นับได้ -> เทียบกับยอดที่ควรมี แสดงส่วนต่าง
// =====================================================

const payName = key => PAY_LABEL?.[key] || key

const dt = value =>
  value ? new Date(value).toLocaleString('th-TH') : '-'

function diffText(n) {
  if (n === 0) return 'ตรงพอดี'

  return n > 0 ? `เกิน ${baht(n)}` : `ขาด ${baht(Math.abs(n))}`
}

export default function ShiftPage() {
  const [branchId, setBranchId] = useState(getSelectedBranchId() || '')

  useEffect(() => onBranchChange(id => setBranchId(id || '')), [])

  const branchName =
    getActiveBranches().find(b => String(b.id) === String(branchId))?.name || ''

  const [shift, setShift] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [opening, setOpening] = useState('')
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')
  const [closedResult, setClosedResult] = useState(null)

  const load = useCallback(async () => {
    if (!branchId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const [cur, rec] = await Promise.all([
        api.getCurrentShift(branchId),
        api.getRecentShifts(branchId),
      ])

      setShift(cur?.shift || null)
      setRecent(Array.isArray(rec) ? rec : [])
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [branchId])

  useEffect(() => {
    setClosedResult(null)
    setMsg('')
    load()
  }, [load])

  async function openShift() {
    setMsg('')

    if (opening === '' || Number(opening) < 0) {
      setMsg('❌ กรุณาใส่เงินทอนตั้งต้น (ใส่ 0 ได้)')
      return
    }

    try {
      setBusy(true)

      await api.openShift({
        branchId: Number(branchId),
        openingCash: Number(opening),
      })

      setOpening('')
      setClosedResult(null)

      await load()
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    setMsg('')

    if (counted === '' || Number(counted) < 0) {
      setMsg('❌ กรุณาใส่จำนวนเงินสดที่นับได้')
      return
    }

    if (!window.confirm('ยืนยันปิดกะ? ปิดแล้วแก้ไขไม่ได้')) return

    try {
      setBusy(true)

      const r = await api.closeShift({
        shiftId: shift.id,
        countedCash: Number(counted),
        note,
      })

      setClosedResult(r.shift)
      setCounted('')
      setNote('')

      await load()
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  function printSummary(s) {
    const sum = s.summary

    const methods = Object.entries(sum?.byMethod || {})
      .map(
        ([k, v]) =>
          `<div class="row"><span>${esc(payName(k))}</span><span>${baht(v)}</span></div>`
      )
      .join('')

    printHtml(
      'สรุปกะ',
      `<h2>สรุปปิดกะ</h2>
       <div class="c sm">${esc(branchName)}</div>
       <div class="line"></div>
       <div class="row"><span>เปิดกะ</span><span>${esc(dt(s.openedAt))}</span></div>
       <div class="row"><span>ปิดกะ</span><span>${esc(dt(s.closedAt))}</span></div>
       <div class="line"></div>
       <div class="row"><span>จำนวนออเดอร์</span><span>${sum?.orderCount ?? 0}</span></div>
       <div class="row"><span>ยกเลิก</span><span>${sum?.cancelledCount ?? 0}</span></div>
       <div class="row b"><span>ยอดขายรวม</span><span>${baht(sum?.totalSales)}</span></div>
       ${methods}
       <div class="line"></div>
       <div class="row"><span>เงินทอนตั้งต้น</span><span>${baht(s.openingCash)}</span></div>
       <div class="row"><span>+ เงินสดที่ขายได้</span><span>${baht(sum?.cashSales)}</span></div>
       <div class="row"><span>- จ่ายจากลิ้นชัก</span><span>${baht(sum?.drawerExpenses)}</span></div>
       <div class="row b"><span>เงินสดที่ควรมี</span><span>${baht(s.expectedCash)}</span></div>
       <div class="row"><span>เงินสดที่นับได้</span><span>${baht(s.countedCash)}</span></div>
       <div class="row b"><span>ส่วนต่าง</span><span>${esc(diffText(Number(s.difference || 0)))}</span></div>
       ${s.note ? `<div class="line"></div><div class="sm">หมายเหตุ: ${esc(s.note)}</div>` : ''}`
    )
  }

  const sum = shift?.summary

  const expected = sum ? Number(sum.expectedCash) : 0

  return (
    <Layout title="กะการขาย" back={false} right={<BranchSelector compact />}>
      {msg && <p>{msg}</p>}

      {loading && <div className="card">กำลังโหลด...</div>}

      {/* ---------- ยังไม่เปิดกะ ---------- */}
      {!loading && !shift && (
        <div className="card gray">
          <b>เปิดกะ — {branchName}</b>

          <input
            type="number"
            inputMode="decimal"
            placeholder="เงินทอนตั้งต้นในลิ้นชัก (บาท)"
            value={opening}
            onChange={e => setOpening(e.target.value)}
          />

          <button className="btn-primary" disabled={busy} onClick={openShift}>
            {busy ? 'กำลังเปิดกะ...' : 'เปิดกะ'}
          </button>
        </div>
      )}

      {/* ---------- กะที่เปิดอยู่ ---------- */}
      {!loading && shift && (
        <>
          <div className="card gray">
            <small>กะที่เปิดอยู่ · {branchName}</small>

            <div>เปิดเมื่อ {dt(shift.openedAt)}</div>
            <div>เงินทอนตั้งต้น <b>{baht(shift.openingCash)}</b></div>
          </div>

          <div className="card">
            <div>จำนวนออเดอร์: <b>{sum?.orderCount ?? 0}</b> (ยกเลิก {sum?.cancelledCount ?? 0})</div>
            <div>ยอดขายรวม: <b>{baht(sum?.totalSales)}</b></div>

            {Object.entries(sum?.byMethod || {}).map(([k, v]) => (
              <div key={k} style={{ paddingLeft: 12, color: '#555' }}>
                {payName(k)}: {baht(v)}
              </div>
            ))}

            <div style={{ marginTop: 6 }}>
              จ่ายจากลิ้นชัก (ค่าใช้จ่าย): <b>{baht(sum?.drawerExpenses)}</b>
            </div>

            <div style={{ marginTop: 6, fontSize: 18 }}>
              เงินสดที่ควรมีในลิ้นชัก: <b>{baht(expected)}</b>
            </div>
          </div>

          <div className="card gray">
            <b>ปิดกะ</b>

            <input
              type="number"
              inputMode="decimal"
              placeholder="เงินสดที่นับได้จริง (บาท)"
              value={counted}
              onChange={e => setCounted(e.target.value)}
            />

            {counted !== '' && (
              <div style={{ margin: '6px 0' }}>
                ส่วนต่าง: <b>{diffText(Number(counted) - expected)}</b>
              </div>
            )}

            <input
              placeholder="หมายเหตุ (ถ้ามี)"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            <button className="btn-primary" disabled={busy} onClick={closeShift}>
              {busy ? 'กำลังปิดกะ...' : 'ปิดกะ'}
            </button>
          </div>
        </>
      )}

      {/* ---------- ผลปิดกะล่าสุด ---------- */}
      {closedResult && (
        <div className="card" style={{ border: '2px solid #1a8f3c' }}>
          <b>ปิดกะเรียบร้อย</b>

          <div>ยอดขายรวม {baht(closedResult.summary?.totalSales)} ({closedResult.summary?.orderCount} ออเดอร์)</div>
          <div>เงินสดที่ควรมี {baht(closedResult.expectedCash)}</div>
          <div>นับได้ {baht(closedResult.countedCash)}</div>
          <div><b>ส่วนต่าง: {diffText(Number(closedResult.difference || 0))}</b></div>

          <button
            className="btn-outline"
            style={{ marginTop: 10 }}
            onClick={() => printSummary(closedResult)}
          >
            พิมพ์สรุปกะ
          </button>
        </div>
      )}

      {/* ---------- กะที่ปิดแล้วล่าสุด ---------- */}
      {recent.length > 0 && (
        <>
          <h4 style={{ marginTop: 18 }}>กะที่ปิดแล้วล่าสุด</h4>

          {recent.map(r => (
            <div className="card" key={r.id}>
              <small>{dt(r.openedAt)} → {dt(r.closedAt)}</small>

              <div>
                นับได้ {baht(r.countedCash)} / ควรมี {baht(r.expectedCash)} ·{' '}
                <b>{diffText(Number(r.difference || 0))}</b>
              </div>

              {r.note && <small>หมายเหตุ: {r.note}</small>}
            </div>
          ))}
        </>
      )}
    </Layout>
  )
}
