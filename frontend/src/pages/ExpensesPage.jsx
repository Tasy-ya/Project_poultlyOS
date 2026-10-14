import { useCallback, useEffect, useState } from 'react'
import Layout from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import { api, baht, getSelectedBranchId, onBranchChange } from '../api'
import { getActiveBranches } from '../branch'

// =====================================================
// ค่าใช้จ่ายประจำวัน (เช่น ซื้อน้ำแข็ง ค่าถุง ค่าขนส่ง)
// - บันทึกเป็นรายการของ "วันนี้"
// - ติ๊ก "จ่ายจากเงินในลิ้นชัก" เพื่อให้นับรวมตอนปิดกะ
// =====================================================
export default function ExpensesPage() {
  const [branchId, setBranchId] = useState(getSelectedBranchId() || '')

  useEffect(() => onBranchChange(id => setBranchId(id || '')), [])

  const branchName =
    getActiveBranches().find(b => String(b.id) === String(branchId))?.name || ''

  const [rows, setRows] = useState([])
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [drawer, setDrawer] = useState(true)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!branchId) return

    try {
      const data = await api.getExpenses(branchId)

      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setMsg('❌ ' + e.message)
    }
  }, [branchId])

  useEffect(() => {
    setMsg('')
    load()
  }, [load])

  async function add() {
    setMsg('')

    if (!label.trim()) {
      setMsg('❌ กรุณากรอกรายการ')
      return
    }

    if (!(Number(amount) > 0)) {
      setMsg('❌ จำนวนเงินต้องมากกว่า 0')
      return
    }

    try {
      setBusy(true)

      await api.addExpense({
        branchId: Number(branchId),
        label,
        amount: Number(amount),
        paidFromDrawer: drawer,
      })

      setLabel('')
      setAmount('')

      await load()
    } catch (e) {
      setMsg('❌ ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    if (!window.confirm(`ลบรายการ "${row.label}" ?`)) return

    try {
      await api.deleteExpense(row.id)

      await load()
    } catch (e) {
      setMsg('❌ ' + e.message)
    }
  }

  const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0)

  return (
    <Layout title="ค่าใช้จ่าย" back={false} right={<BranchSelector compact />}>
      <div className="card gray" style={{ padding: '8px 12px' }}>
        <small>ค่าใช้จ่ายวันนี้ · {branchName}</small>

        <div style={{ fontSize: 24, fontWeight: 'bold' }}>{baht(total)}</div>
      </div>

      {msg && <p>{msg}</p>}

      <div className="card gray">
        <b>เพิ่มค่าใช้จ่าย</b>

        <input
          placeholder="รายการ เช่น น้ำแข็ง, ถุงพลาสติก"
          value={label}
          onChange={e => setLabel(e.target.value)}
        />

        <input
          type="number"
          inputMode="decimal"
          placeholder="จำนวนเงิน (บาท)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
          <input
            type="checkbox"
            style={{ width: 20, height: 20, margin: 0 }}
            checked={drawer}
            onChange={e => setDrawer(e.target.checked)}
          />
          จ่ายจากเงินในลิ้นชัก
        </label>

        <button className="btn-primary" disabled={busy} onClick={add}>
          {busy ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่าย'}
        </button>
      </div>

      {rows.length === 0 && <div className="card">วันนี้ยังไม่มีค่าใช้จ่าย</div>}

      {rows.map(r => (
        <div
          className="card"
          key={r.id}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}
        >
          <div>
            <b>{r.label}</b>

            <div style={{ fontSize: 12, color: '#777' }}>
              {r.paidFromDrawer ? 'จ่ายจากลิ้นชัก' : 'ไม่ได้จ่ายจากลิ้นชัก'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <b>{baht(r.amount)}</b>

            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '4px 10px' }}
              onClick={() => remove(r)}
            >
              ลบ
            </button>
          </div>
        </div>
      ))}
    </Layout>
  )
}
