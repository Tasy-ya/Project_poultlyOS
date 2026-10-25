import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, adminClosuresApi } from '../api'

// =====================================================
// Admin > วันหยุดร้าน
//
// - ปิดร้านวันนี้/ช่วงวันที่ (เช่น หยุดปีใหม่ 3 วัน) เลือกสาขาหรือทุกสาขา
// - หยุดประจำทุกสัปดาห์ (เช่น ทุกวันจันทร์) กดสลับเปิด/ปิดได้ทีละวัน
// - ลูกค้าเห็นวันหยุดบนหน้าสั่งซื้อ: วันหยุดสั่งซื้อเลยไม่ได้ และจองวันรับสินค้าที่หยุดไม่ได้
// =====================================================

const RED = '#ff1111'

const WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

const thaiDate = dateStr =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const addDays = (dateStr, n) =>
  new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

const card = {
  background: '#fff',
  borderRadius: 14,
  padding: 16,
  marginBottom: 14,
  boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
}

const input = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  border: '1px solid #ccc',
  borderRadius: 10,
  fontSize: 15,
  background: '#fff',
}

const primaryBtn = {
  border: 'none',
  borderRadius: 10,
  background: RED,
  color: '#fff',
  padding: '12px 16px',
  cursor: 'pointer',
  fontWeight: 700,
}

const outlineBtn = {
  border: `1px solid ${RED}`,
  borderRadius: 10,
  background: '#fff',
  color: RED,
  padding: '8px 12px',
  cursor: 'pointer',
  fontWeight: 700,
}

export default function AdminClosuresPage() {
  const [data, setData] = useState(null)
  const [branches, setBranches] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [branchId, setBranchId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    adminClosuresApi
      .list()
      .then(d => {
        setData(d)
        setError('')
      })
      .catch(e => setError(e.message || 'โหลดวันหยุดไม่สำเร็จ'))
  }, [])

  useEffect(() => {
    load()
    api
      .getBranches()
      .then(list => setBranches(Array.isArray(list) ? list : []))
      .catch(() => setBranches([]))
  }, [load])

  const today = data?.today || ''

  const weekly = useMemo(() => (data?.closures || []).filter(c => c.kind === 'weekly'), [data])

  const ranges = useMemo(
    () => (data?.closures || []).filter(c => c.kind === 'range'),
    [data]
  )

  const upcoming = ranges.filter(c => c.endDate >= today)
  const past = ranges.filter(c => c.endDate < today)

  const days =
    startDate && endDate && endDate >= startDate
      ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000 + 1
      : 0

  const run = async fn => {
    setBusy(true)
    setError('')

    try {
      await fn()
      load()
    } catch (e) {
      setError(e.message || 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const addRange = (from, to) =>
    run(async () => {
      await adminClosuresApi.addRange({
        branchId: branchId || null,
        startDate: from,
        endDate: to,
        reason: reason.trim(),
      })
      setStartDate('')
      setEndDate('')
      setReason('')
    })

  const submitRange = () => {
    if (!startDate) {
      setError('กรุณาเลือกวันที่เริ่มหยุด')
      return
    }

    addRange(startDate, endDate || startDate)
  }

  // วันหยุดประจำสัปดาห์ของ "ขอบเขตที่เลือกอยู่" (ทุกสาขา หรือสาขาที่เลือก)
  const weeklyFor = wd =>
    weekly.find(c => c.weekday === wd && String(c.branchId || '') === String(branchId || ''))

  const toggleWeekly = wd =>
    run(async () => {
      const found = weeklyFor(wd)

      if (found) await adminClosuresApi.remove(found.id)
      else await adminClosuresApi.addWeekly({ branchId: branchId || null, weekday: wd })
    })

  const remove = c => {
    const what =
      c.kind === 'weekly'
        ? `หยุดทุกวัน${WEEKDAYS[c.weekday]}`
        : c.startDate === c.endDate
          ? thaiDate(c.startDate)
          : `${thaiDate(c.startDate)} – ${thaiDate(c.endDate)}`

    if (!window.confirm(`ยกเลิกวันหยุด "${what}" (${c.branchName})?\nร้านจะกลับมาเปิดรับออเดอร์ในวันนั้นตามปกติ`)) return

    run(() => adminClosuresApi.remove(c.id))
  }

  const scopeName = branchId
    ? branches.find(b => String(b.id) === String(branchId))?.name || `สาขา ${branchId}`
    : 'ทุกสาขา'

  const row = c => (
    <div
      key={c.id}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderTop: '1px solid #eee',
      }}
    >
      <div>
        <b>
          {c.kind === 'weekly'
            ? `ทุกวัน${WEEKDAYS[c.weekday]}`
            : c.startDate === c.endDate
              ? thaiDate(c.startDate)
              : `${thaiDate(c.startDate)} – ${thaiDate(c.endDate)}`}
        </b>

        <div style={{ fontSize: 13, color: '#666' }}>
          {c.branchName}
          {c.kind === 'range' && c.startDate !== c.endDate
            ? ` · ${(Date.parse(`${c.endDate}T00:00:00Z`) - Date.parse(`${c.startDate}T00:00:00Z`)) / 86400000 + 1} วัน`
            : ''}
          {c.reason ? ` · ${c.reason}` : ''}
        </div>
      </div>

      <button style={outlineBtn} disabled={busy} onClick={() => remove(c)}>
        ลบ
      </button>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', padding: '20px 16px 60px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 13, color: '#777', marginBottom: 4 }}>
          <Link to="/admin" style={{ color: '#777' }}>PoultryOS Admin</Link>
          {' / '}
          <Link to="/admin/branches" style={{ color: '#777' }}>จัดการสาขา</Link>
        </div>

        <h1 style={{ margin: '0 0 4px', fontSize: 28 }}>วันหยุดร้าน</h1>

        <div style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
          วันที่ร้านหยุด ลูกค้าจะเห็นบนหน้าสั่งซื้อ และ <b>สั่งซื้อเลยไม่ได้</b> ส่วนการ <b>จองล่วงหน้า</b> จองได้เฉพาะวันรับสินค้าที่ร้านเปิด
        </div>

        {error && (
          <div style={{ background: '#fde8e8', color: '#a11', padding: 12, borderRadius: 10, marginBottom: 12 }}>
            {error}
            {/shop_closures|prisma/i.test(error) && (
              <div style={{ fontSize: 13, marginTop: 4 }}>
                ถ้าเพิ่งอัปเดต ให้รัน backend/prisma/upgrade_round12_closures.sql ใน pgAdmin แล้ว npx prisma generate
              </div>
            )}
          </div>
        )}

        {/* ขอบเขต */}
        <div style={card}>
          <b>ตั้งวันหยุดให้</b>

          <select style={{ ...input, marginTop: 8 }} value={branchId} onChange={e => setBranchId(e.target.value)}>
            <option value="">ทุกสาขา</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>
            ส่วนด้านล่าง (หยุดประจำสัปดาห์ / ช่วงวันที่) จะตั้งให้ "{scopeName}"
          </div>
        </div>

        {/* หยุดประจำสัปดาห์ */}
        <div style={card}>
          <b>หยุดประจำทุกสัปดาห์</b>

          <div style={{ fontSize: 13, color: '#666', margin: '4px 0 10px' }}>
            กดเลือกวันที่ร้านหยุดประจำ (กดซ้ำเพื่อยกเลิก) · สีแดง = หยุดทุกสัปดาห์
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WEEKDAYS.map((name, wd) => {
              const on = Boolean(weeklyFor(wd))

              return (
                <button
                  key={name}
                  type="button"
                  disabled={busy || !data}
                  onClick={() => toggleWeekly(wd)}
                  style={{
                    border: `1px solid ${on ? RED : '#ccc'}`,
                    background: on ? RED : '#fff',
                    color: on ? '#fff' : '#333',
                    borderRadius: 20,
                    padding: '8px 14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              )
            })}
          </div>
        </div>

        {/* ช่วงวันที่ */}
        <div style={card}>
          <b>ปิดร้านเป็นช่วงวัน</b>

          <div style={{ fontSize: 13, color: '#666', margin: '4px 0 10px' }}>
            เลือกวันเริ่มหยุด และวันสุดท้าย (หยุดวันเดียวไม่ต้องเลือกวันสุดท้าย)
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button
              style={outlineBtn}
              disabled={busy || !today}
              onClick={() => addRange(today, today)}
            >
              ปิดร้านวันนี้
            </button>

            <button
              style={outlineBtn}
              disabled={busy || !today}
              onClick={() => addRange(addDays(today, 1), addDays(today, 1))}
            >
              ปิดร้านพรุ่งนี้
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 13 }}>
              เริ่มหยุด
              <input
                type="date"
                style={input}
                value={startDate}
                min={today}
                onChange={e => {
                  setStartDate(e.target.value)
                  if (endDate && endDate < e.target.value) setEndDate('')
                }}
              />
            </label>

            <label style={{ fontSize: 13 }}>
              วันสุดท้าย
              <input
                type="date"
                style={input}
                value={endDate}
                min={startDate || today}
                onChange={e => setEndDate(e.target.value)}
              />
            </label>
          </div>

          <input
            style={{ ...input, marginTop: 8 }}
            placeholder="เหตุผล (ไม่บังคับ) เช่น หยุดปีใหม่ — ลูกค้าจะเห็นข้อความนี้"
            value={reason}
            maxLength={120}
            onChange={e => setReason(e.target.value)}
          />

          <button
            style={{ ...primaryBtn, width: '100%', marginTop: 10 }}
            disabled={busy || !startDate}
            onClick={submitRange}
          >
            {busy
              ? 'กำลังบันทึก...'
              : startDate
                ? `บันทึกวันหยุด ${days > 1 ? `${days} วัน` : '1 วัน'} · ${scopeName}`
                : 'เลือกวันที่หยุดก่อน'}
          </button>
        </div>

        {/* รายการ */}
        <div style={card}>
          <b>วันหยุดที่ตั้งไว้</b>

          {!data && <div style={{ color: '#888', padding: 10 }}>กำลังโหลด...</div>}

          {data && weekly.length === 0 && upcoming.length === 0 && (
            <div style={{ color: '#888', padding: 10 }}>ยังไม่มีวันหยุด — ร้านเปิดทุกวัน</div>
          )}

          {weekly.map(row)}
          {upcoming.map(row)}
        </div>

        {past.length > 0 && (
          <div style={{ ...card, opacity: 0.75 }}>
            <b>วันหยุดที่ผ่านมาแล้ว (30 วันล่าสุด)</b>
            {past.map(row)}
          </div>
        )}
      </div>
    </div>
  )
}
