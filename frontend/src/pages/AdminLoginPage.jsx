import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

export default function AdminLoginPage() {
  const navigate = useNavigate()

  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()

    if (!staffId || !pin) {
      setError('กรุณากรอกรหัสผู้ดูแลและ PIN')
      return
    }

    try {
      setLoading(true)
      setError('')

      const result = await api.adminLogin(
        staffId,
        pin
      )

      console.log('Admin Login:', result)

      // ล็อกอิน Admin สำเร็จ
      navigate('/admin', {
        replace: true,
      })
    } catch (err) {
      console.error(
        'Admin Login Error:',
        err
      )

      setError(
        err?.message ||
          'เข้าสู่ระบบ Admin ไม่สำเร็จ'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f7f7',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          border: '1px solid #e5e5e5',
          borderRadius: 16,
          padding: 25,
          boxSizing: 'border-box',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 25,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: '#777',
              marginBottom: 5,
            }}
          >
            PoultryOS
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 26,
            }}
          >
            Admin Login
          </h1>

          <div
            style={{
              marginTop: 6,
              color: '#777',
              fontSize: 14,
            }}
          >
            เข้าสู่ระบบสำหรับผู้ดูแลร้าน
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: '#ffe5e5',
              border: '1px solid #ffbcbc',
              color: '#b00000',
              borderRadius: 10,
              padding: 12,
              marginBottom: 15,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin}>
          {/* STAFF ID */}
          <div
            style={{
              marginBottom: 15,
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: 13,
                marginBottom: 6,
                color: '#555',
              }}
            >
              รหัสผู้ดูแล
            </label>

            <input
              type="text"
              value={staffId}
              onChange={(e) =>
                setStaffId(e.target.value)
              }
              placeholder="รหัสพนักงาน หรือ เบอร์โทร"
              autoComplete="username"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: 9,
                fontSize: 15,
              }}
            />
          </div>

          {/* PIN */}
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: 13,
                marginBottom: 6,
                color: '#555',
              }}
            >
              PIN
            </label>

            <input
              type="password"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value)
              }
              placeholder="รหัสผ่าน"
              autoComplete="current-password"
              inputMode="numeric"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: 9,
                fontSize: 15,
              }}
            />
          </div>

          {/* LOGIN */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: 9,
              background: '#222',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading
                ? 'default'
                : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? 'กำลังเข้าสู่ระบบ...'
              : 'เข้าสู่ระบบ Admin'}
          </button>
        </form>

        {/* BACK */}
        <button
          type="button"
          disabled={loading}
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            marginTop: 10,
            padding: '11px',
            border: '1px solid #ddd',
            borderRadius: 9,
            background: '#fff',
            color: '#555',
            cursor: loading
              ? 'default'
              : 'pointer',
          }}
        >
          กลับหน้าพนักงาน
        </button>
      </div>
    </div>
  )
}