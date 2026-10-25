import { useEffect, useState } from 'react'
import Layout, { getStaff } from '../components/Layout'
import { api, baht } from '../api'

export default function DashboardPage() {
  const staff = getStaff()

  const [d, setD] = useState(null)
  const [promos, setPromos] = useState([])

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

  // ---------------------------------------------------
  // โปรโมชั่นที่แอดมินสร้าง (เฉพาะที่กำลังใช้งานและเปิดให้พนักงานเห็น)
  // ---------------------------------------------------
  useEffect(() => {
    if (!staff?.branchId) {
      return
    }

    let alive = true

    const loadPromos = () => {
      api.getShopPromotions(staff.branchId)
        .then((rows) => {
          if (alive) {
            setPromos(Array.isArray(rows) ? rows : [])
          }
        })
        .catch(() => {
          if (alive) {
            setPromos([])
          }
        })
    }

    loadPromos()

    const timer = setInterval(loadPromos, 60 * 1000)

    return () => {
      alive = false
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
          โปรโมชั่นและกิจกรรมของร้าน (จากหน้าแอดมิน)
      ================================================== */}
      <div
        className="card"
        style={{
          marginTop: 12,
          padding: 18,
          background: '#fff7ec',
          border: '1px solid #ffd9a8',
          borderRadius: 16,
          display: 'block',
        }}
      >
        <small>โปรโมชั่นและกิจกรรมของร้าน</small>

        {promos.length === 0 ? (
          <p style={{ margin: '6px 0 0', color: '#777' }}>
            ขณะนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งาน
          </p>
        ) : (
          promos.map((p) => (
            <div
              key={p.id}
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px dashed #f0c78f',
              }}
            >
              <b>{p.name}</b>

              {p.description && (
                <div
                  style={{
                    whiteSpace: 'pre-line',
                    fontSize: 14,
                    color: '#444',
                    marginTop: 2,
                  }}
                >
                  {p.description}
                </div>
              )}

              {(p.startDate || p.endDate) && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {p.startDate || '-'} ถึง {p.endDate || '-'}
                </div>
              )}
            </div>
          ))
        )}
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