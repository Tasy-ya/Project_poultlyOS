import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import logo from '../assets/logo.jpg'

// =====================================================
// ลงทะเบียนพนักงานใหม่ (ทำครั้งแรกก่อนเข้าระบบ)
//
// ชื่อ / นามสกุล / เบอร์โทร / ไอดีไลน์ / ตำแหน่งงาน
// รหัสผ่าน + ยืนยันรหัสผ่าน (ตั้งเอง)
//
// ตำแหน่งงานใช้แยกสิทธิ์
//   ฝ่ายขาย   -> หน้าขาย / รับออเดอร์ / ประวัติ
//   ฝ่ายสต็อก -> หน้า Stock
//   แอดมิน    -> เข้าได้ทุกหน้า (ต้องมีรหัสลงทะเบียนแอดมิน)
// =====================================================

const POSITIONS = [
  { value: 'sales', label: 'ฝ่ายขาย' },
  { value: 'stock', label: 'ฝ่ายสต็อก' },
  { value: 'admin', label: 'แอดมิน' },
]

export default function RegisterPage() {
  const nav = useNavigate()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    lineId: '',
    position: '',
    password: '',
    confirmPassword: '',
    adminCode: '',
  })

  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  function set(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  async function submit() {
    setErr('')

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErr('กรุณากรอกชื่อและนามสกุล')
      return
    }

    if (!/^0\d{8,9}$/.test(form.phone.replace(/\D/g, ''))) {
      setErr('เบอร์โทรไม่ถูกต้อง (ตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0)')
      return
    }

    if (!form.lineId.trim()) {
      setErr('กรุณากรอกไอดีไลน์')
      return
    }

    if (!form.position) {
      setErr('กรุณาเลือกตำแหน่งงาน')
      return
    }

    if (form.password.length < 4) {
      setErr('รหัสต้องมีอย่างน้อย 4 ตัวอักษร')
      return
    }

    if (form.password !== form.confirmPassword) {
      setErr('รหัสและการยืนยันรหัสไม่ตรงกัน')
      return
    }

    setLoading(true)

    try {
      const r = await api.register(form)

      setDone(r?.staff || {})
    } catch (e) {
      setErr(e.message || 'ลงทะเบียนไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100%; }
        .reg-page {
          width: 100%;
          min-height: 100dvh;
          background: #ffffff;
          display: flex;
          justify-content: center;
          padding: 28px 20px 40px;
        }
        .reg-box {
          width: 100%;
          max-width: 420px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .reg-logo { width: 110px; height: 110px; object-fit: contain; margin-bottom: 8px; }
        .reg-title { margin: 0 0 4px; font-size: 30px; font-weight: 800; color: #ed1c24; }
        .reg-sub { margin: 0 0 22px; color: #666; font-size: 14px; text-align: center; }
        .reg-form { width: 100%; }
        .reg-label { display: block; margin: 0 0 6px 2px; font-size: 13px; font-weight: 700; color: #444; }
        .reg-input {
          display: block;
          width: 100%;
          height: 50px;
          margin: 0 0 14px;
          padding: 0 14px;
          border: 1px solid #cccccc;
          border-radius: 10px;
          background: #ffffff;
          color: #222222;
          font-family: inherit;
          font-size: 16px;
          outline: none;
        }
        .reg-input:focus { border-color: #ed1c24; }
        .reg-row { display: flex; gap: 10px; }
        .reg-row > div { flex: 1; min-width: 0; }
        .reg-error { margin: 0 0 12px; color: #d00000; font-size: 14px; }
        .reg-button {
          display: block;
          width: 100%;
          height: 52px;
          margin-top: 6px;
          border: none;
          border-radius: 10px;
          background: #ed1c24;
          color: #ffffff;
          font-family: inherit;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
        }
        .reg-button:disabled { opacity: 0.6; }
        .reg-back { display: block; margin-top: 16px; text-align: center; color: #ed1c24; font-weight: 700; text-decoration: none; }
        .reg-done { text-align: center; padding: 10px 0; }
        .reg-done h2 { color: #1a8f3c; margin: 8px 0; }
        .reg-id { margin: 14px 0; padding: 12px; background: #f5f5f5; border-radius: 10px; font-size: 15px; line-height: 1.6; }
      `}</style>

      <div className="reg-page">
        <div className="reg-box">
          <img src={logo} alt="PoultryOS" className="reg-logo" />

          <h1 className="reg-title">ลงทะเบียน</h1>

          <p className="reg-sub">
            กรอกข้อมูลให้ครบ เพื่อให้ระบบแยกสิทธิ์การใช้งานได้ถูกต้อง
          </p>

          {done ? (
            <div className="reg-done">
              <h2>ลงทะเบียนสำเร็จ</h2>

              <div className="reg-id">
                รหัสพนักงานของคุณคือ <b>{done.id}</b>
                <br />
                เข้าสู่ระบบด้วยรหัสพนักงานหรือเบอร์โทร
                และรหัสผ่านที่ตั้งไว้
              </div>

              <button
                type="button"
                className="reg-button"
                onClick={() => nav('/login')}
              >
                ไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : (
            <div className="reg-form">
              <div className="reg-row">
                <div>
                  <label className="reg-label">ชื่อ</label>
                  <input
                    className="reg-input"
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                  />
                </div>

                <div>
                  <label className="reg-label">นามสกุล</label>
                  <input
                    className="reg-input"
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                  />
                </div>
              </div>

              <label className="reg-label">เบอร์โทร</label>
              <input
                className="reg-input"
                inputMode="tel"
                placeholder="08XXXXXXXX"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
              />

              <label className="reg-label">ไอดีไลน์</label>
              <input
                className="reg-input"
                value={form.lineId}
                onChange={e => set('lineId', e.target.value)}
              />

              <label className="reg-label">ตำแหน่งงาน</label>
              <select
                className="reg-input"
                value={form.position}
                onChange={e => set('position', e.target.value)}
              >
                <option value="">เลือกตำแหน่งงาน</option>
                {POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              {form.position === 'admin' && (
                <>
                  <label className="reg-label">
                    รหัสลงทะเบียนแอดมิน
                  </label>
                  <input
                    className="reg-input"
                    type="password"
                    placeholder="เว้นว่างได้ถ้าเป็นแอดมินคนแรก"
                    value={form.adminCode}
                    onChange={e => set('adminCode', e.target.value)}
                  />
                </>
              )}

              <label className="reg-label">ตั้งรหัสผ่าน</label>
              <input
                className="reg-input"
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />

              <label className="reg-label">ยืนยันรหัสผ่าน</label>
              <input
                className="reg-input"
                type="password"
                value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submit()
                }}
              />

              {err && <p className="reg-error">{err}</p>}

              <button
                type="button"
                className="reg-button"
                onClick={submit}
                disabled={loading}
              >
                {loading ? 'กำลังลงทะเบียน...' : 'ลงทะเบียน'}
              </button>

              <Link to="/login" className="reg-back">
                มีบัญชีแล้ว? เข้าสู่ระบบ
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
