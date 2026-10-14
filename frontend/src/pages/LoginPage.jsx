import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import logo from '../assets/logo.jpg'

export default function LoginPage() {
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  // มาจากการกดเข้าส่วนของอีกฝ่าย เช่น /login?dept=stock&next=/stock
  const [params] = useSearchParams()
  const rawDept = params.get('dept')
  const dept =
    rawDept === 'stock' || rawDept === 'sales' ? rawDept : null
  const next = params.get('next')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const nav = useNavigate()

  async function submit() {
    setErr('')

    if (!staffId || !pin) {
      setErr('กรุณากรอกรหัสพนักงาน/เบอร์โทร และรหัสผ่าน')
      return
    }

    setLoading(true)

    try {
      const r = await api.login(staffId.trim(), pin, dept || undefined)

      localStorage.setItem('token', r.token)
      localStorage.setItem('staff', JSON.stringify(r.staff))

      nav(next && next.startsWith('/') ? next : '/', { replace: true })
    } catch (e) {
      setErr(
        e.message || 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #root {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }

        .poultry-login {
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          background: #ffffff;

          display: flex;
          justify-content: center;
          align-items: center;

          padding: 30px 20px;
        }

        .poultry-login-box {
          width: 100%;
          max-width: 400px;

          display: flex;
          flex-direction: column;
          align-items: center;

          text-align: center;
        }

        .poultry-logo {
          width: 170px;
          height: 170px;

          object-fit: contain;

          display: block;

          margin-bottom: 14px;
        }

        .poultry-welcome {
          margin: 0;

          font-size: 32px;
          line-height: 1.15;
          font-weight: 700;

          color: #333333;
        }

        .poultry-name {
          margin: 4px 0 0;

          font-size: 42px;
          line-height: 1.1;
          font-weight: 800;

          color: #ed1c24;
        }

        .poultry-login-title {
          margin: 4px 0 32px;

          font-size: 32px;
          line-height: 1.15;
          font-weight: 700;

          color: #ed1c24;
        }

        .poultry-form {
          width: 100%;
        }
        .poultry-notice {
          margin: 0 0 14px;
          padding: 10px 12px;
          background: #fff4f4;
          border: 1px solid #f3b3b3;
          border-radius: 10px;
          color: #b00000;
          font-size: 14px;
          line-height: 1.4;
          text-align: left;
        }
        .poultry-register {
          display: block;
          margin-top: 16px;
          color: #ed1c24;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
        }

        .poultry-input {
          display: block;

          width: 100%;
          height: 52px;

          margin: 0 0 14px;

          padding: 0 16px;

          border: 1px solid #cccccc;
          border-radius: 10px;

          background: #ffffff;

          color: #222222;

          font-family: inherit;
          font-size: 16px;

          outline: none;
        }

        .poultry-input:focus {
          border-color: #ed1c24;
        }

        .poultry-error {
          margin: 0 0 12px;

          color: #d00000;

          font-size: 14px;
        }

        .poultry-button {
          display: block;

          width: 100%;
          height: 52px;

          margin-top: 18px;

          border: none;
          border-radius: 10px;

          background: #ed1c24;
          color: #ffffff;

          font-family: inherit;
          font-size: 17px;
          font-weight: 700;

          cursor: pointer;
        }

        .poultry-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }


        /* ==============================
           โทรศัพท์
        ============================== */

        @media (max-width: 600px) {

          .poultry-login {
            min-height: 100dvh;

            padding:
              24px
              20px;
          }

          .poultry-login-box {
            max-width: 100%;
          }

          .poultry-logo {
            width: 145px;
            height: 145px;

            margin-bottom: 12px;
          }

          .poultry-welcome {
            font-size: 30px;
          }

          .poultry-name {
            font-size: 40px;
          }

          .poultry-login-title {
            font-size: 30px;

            margin-bottom: 30px;
          }

          .poultry-input {
            height: 52px;
            font-size: 16px;
          }

          .poultry-button {
            height: 52px;
            font-size: 17px;
          }
        }


        /* ==============================
           โทรศัพท์จอเล็ก
        ============================== */

        @media (max-width: 380px) {

          .poultry-login {
            padding:
              18px
              16px;
          }

          .poultry-logo {
            width: 120px;
            height: 120px;
          }

          .poultry-welcome {
            font-size: 27px;
          }

          .poultry-name {
            font-size: 35px;
          }

          .poultry-login-title {
            font-size: 27px;
            margin-bottom: 24px;
          }

          .poultry-input {
            height: 50px;
          }

          .poultry-button {
            height: 50px;
          }
        }


        /* ==============================
           คอมพิวเตอร์จอใหญ่
        ============================== */

        @media (min-width: 1000px) {

          .poultry-logo {
            width: 180px;
            height: 180px;
          }

          .poultry-welcome {
            font-size: 34px;
          }

          .poultry-name {
            font-size: 44px;
          }

          .poultry-login-title {
            font-size: 34px;
          }
        }
      `}</style>


      <div className="poultry-login">

        <div className="poultry-login-box">

          {/* LOGO */}
          <img
            src={logo}
            alt="PoultryOS"
            className="poultry-logo"
          />

          {/* Welcome */}
          <h2 className="poultry-welcome">
            Welcome
          </h2>

          {/* PoultryOS */}
          <h1 className="poultry-name">
            PoultryOS
          </h1>

          {/* เข้าสู่ระบบ */}
          <h2 className="poultry-login-title">
            เข้าสู่ระบบ
          </h2>


          {/* FORM */}
          <div className="poultry-form">
            {/* แจ้งเมื่อต้องใส่รหัสของอีกฝ่าย */}
            {dept && (
              <div className="poultry-notice">
                {dept === 'stock'
                  ? 'ส่วนนี้สำหรับฝ่ายสต็อก กรุณาเข้าสู่ระบบด้วยรหัสฝ่ายสต็อก (หรือแอดมิน)'
                  : 'ส่วนนี้สำหรับฝ่ายขาย กรุณาเข้าสู่ระบบด้วยรหัสฝ่ายขาย (หรือแอดมิน)'}
              </div>
            )}

            <input
              type="text"
              inputMode="text"
              placeholder="รหัสพนักงาน หรือ เบอร์โทร"
              value={staffId}
              onChange={(e) =>
                setStaffId(e.target.value)
              }
              className="poultry-input"
            />

            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submit()
                }
              }}
              className="poultry-input"
            />

            {err && (
              <p className="poultry-error">
                {err}
              </p>
            )}

            <button
              type="button"
              className="poultry-button"
              onClick={submit}
              disabled={loading}
            >
              {loading
                ? 'กำลังเข้าสู่ระบบ...'
                : 'ยืนยัน'}
            </button>

            <Link
              to="/register"
              className="poultry-register"
            >
              ยังไม่มีบัญชี? ลงทะเบียน
            </Link>

          </div>

        </div>

      </div>
    </>
  )
}