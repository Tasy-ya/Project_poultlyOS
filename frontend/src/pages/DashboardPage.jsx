import { useEffect, useState } from 'react'
import Layout, { getStaff } from '../components/Layout'
import { api, baht } from '../api'

export default function DashboardPage() {
  const staff = getStaff()

  const [d, setD] = useState(null)

  useEffect(() => {
    if (!staff?.branchId) {
      return
    }

    const branchId = staff.branchId

    // ---------------------------------------------------
    // โหลด Dashboard ของ "วันนี้"
    // ---------------------------------------------------
    const loadDashboard = () => {
      // วันที่ปัจจุบันของเครื่อง
      const now = new Date()

      // วันที่วันนี้ เช่น 2026-09-28
      const today = now.toISOString().slice(0, 10)

      console.log(
        'กำลังโหลด Dashboard ของวันที่:',
        today
      )

      api.getDashboard(branchId, today, today)
        .then((data) => {
          console.log(
            'Dashboard data วันนี้:',
            data
          )

          setD(data)
        })
        .catch((error) => {
          console.error(
            'Dashboard error:',
            error
          )

          // ถ้าโหลดไม่ได้ ให้แสดงค่า 0
          setD({
            revenue: 0,
            orderCount: 0,
            lowStockCount: 0,
          })
        })
    }

    loadDashboard()

    // ---------------------------------------------------
    // ตรวจสอบวันใหม่ทุก 1 นาที
    // ถ้าเปลี่ยนวัน ให้โหลด Dashboard ใหม่
    // ---------------------------------------------------
    const timer = setInterval(() => {
      loadDashboard()
    }, 60 * 1000)

    return () => {
      clearInterval(timer)
    }
  }, [staff?.branchId])

  // =====================================================
  // ไม่พบพนักงาน
  // =====================================================
  if (!staff) {
    return (
      <Layout
        title="Dashboard"
        back={false}
      >
        <div className="card">
          <p>
            ไม่พบข้อมูลพนักงาน
          </p>
        </div>
      </Layout>
    )
  }

  // =====================================================
  // ไม่พบสาขา
  // =====================================================
  if (!staff.branchId) {
    return (
      <Layout
        title="Dashboard"
        back={false}
      >
        <div className="card">
          <p>
            ไม่พบข้อมูลสาขา
          </p>
        </div>
      </Layout>
    )
  }

  // =====================================================
  // กำลังโหลด
  // =====================================================
  if (!d) {
    return (
      <Layout
        title="Dashboard"
        back={false}
      >
        <div className="card">
          <p
            style={{
              textAlign: 'center',
            }}
          >
            กำลังโหลด...
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout
      title="Dashboard"
      back={false}
    >

      {/* =================================================
          1. ยอดขายรวมของวันนี้
      ================================================== */}
      <div className="card">
        <small>
          ยอดขายวันนี้
        </small>

        <h1
          style={{
            margin: 0,
          }}
        >
          {baht(d.revenue ?? 0)}
        </h1>
      </div>

      {/* =================================================
          2. จำนวนออเดอร์ของวันนี้
      ================================================== */}
      <div className="card gray">
        <small>
          จำนวนออเดอร์วันนี้
        </small>

        <h1
          style={{
            margin: 0,
          }}
        >
          {d.orderCount ?? 0}
        </h1>
      </div>

      {/* =================================================
          3. สต็อกใกล้หมด
          ส่วนนี้ไม่รีเซ็ต เพราะเป็นสถานะสต็อกปัจจุบัน
      ================================================== */}
      <div className="card yellow">
        <small>
          สต็อกใกล้หมด
        </small>

        <h1
          style={{
            margin: 0,
            color:
              Number(d.lowStockCount || 0) > 0
                ? 'red'
                : 'green',
          }}
        >
          {d.lowStockCount ?? 0}

          {Number(d.lowStockCount || 0) > 0 && (
            <span
              style={{
                fontSize: 14,
              }}
            >
              {' '}
              ⚠️ เมนูใกล้หมด
            </span>
          )}
        </h1>
      </div>

      {/* =================================================
          4. รายการจอง
      ================================================== */}
      <div
        className="card"
        style={{
          marginTop: 12,
          padding: 18,
          background: '#ffffff',
          border: '1px solid #eeeeee',
          borderRadius: 16,
          display: 'block',
          visibility: 'visible',
          opacity: 1,
        }}
      >

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <small
              style={{
                color: '#777',
              }}
            >
              รายการจอง
            </small>

            <h2
              style={{
                margin: '4px 0 0',
                fontSize: 22,
              }}
            >
              📋 รายการจอง
            </h2>
          </div>

          <div
            style={{
              fontSize: 28,
            }}
          >
            📅
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 14,
            background: '#f7f7f7',
            borderRadius: 12,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 30,
              marginBottom: 6,
            }}
          >
            📋
          </div>

          <div
            style={{
              fontWeight: 'bold',
              fontSize: 16,
            }}
          >
            รายการจอง
          </div>

          <div
            style={{
              fontSize: 13,
              color: '#777',
              marginTop: 4,
            }}
          >
            ระบบจองจะเชื่อมต่อข้อมูลในส่วนนี้
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{
            width: '100%',
            marginTop: 12,
          }}
          onClick={() => {
            console.log(
              'กดดูรายการจอง'
            )
          }}
        >
          ดูรายการจอง
        </button>

      </div>

    </Layout>
  )
}