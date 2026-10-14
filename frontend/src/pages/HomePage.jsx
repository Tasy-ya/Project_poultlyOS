import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout, { getStaff } from '../components/Layout'
import { api, getSelectedBranchId, onBranchChange } from '../api'
import BranchSelector from '../components/BranchSelector'

const baht = n =>
  '฿' +
  Number(n || 0).toLocaleString('th-TH', {
    maximumFractionDigits: 0,
  })

function AdminIcon() {
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="19"
        cy="14"
        r="7"
        fill="currentColor"
      />

      <path
        d="M6 38C6 29.716 11.82 24 19 24C26.18 24 32 29.716 32 38V41H6V38Z"
        fill="currentColor"
      />

      <rect
        x="27"
        y="27"
        width="16"
        height="15"
        rx="3"
        fill="currentColor"
      />

      <path
        d="M31 27V23C31 19.686 33.686 17 37 17C40.314 17 43 19.686 43 23V27"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <circle
        cx="35"
        cy="34"
        r="2"
        fill="white"
      />
    </svg>
  )
}

// ลิงก์ที่กดไม่ได้ถ้าฝ่ายนี้ไม่มีสิทธิ์เข้าหน้านั้น
function MaybeLink({ enabled = true, children, ...props }) {
  if (enabled) {
    return <Link {...props}>{children}</Link>
  }

  return <div>{children}</div>
}

// สต็อกเก็บเป็นหน่วยครึ่งตัว -> แสดงเป็น "ตัว" (เศษ = ครึ่งตัว)
function fmtQty(qty, perWhole = 1) {
  const q = Number(qty || 0)
  const per = Number(perWhole || 1)

  if (per <= 1) return `${q}`

  const whole = Math.floor(q / per)

  return q % per ? `${whole} ตัว + ครึ่ง` : `${whole} ตัว`
}

export default function HomePage() {
  const staff = getStaff()

  // กดเข้าส่วนของอีกฝ่ายได้ แต่ต้องใส่รหัสของฝ่ายนั้นก่อน (Guard)
  const canSell = true
  const canStock = true

  // สาขาที่กำลังใช้งาน (เปลี่ยนได้จากกล่องเลือกสาขาที่หัวหน้า)
  // เริ่มต้นที่สาขาของพนักงาน ถ้ายังไม่เคยเลือก
  const [branchId, setBranchId] = useState(
    getSelectedBranchId() || staff?.branchId || ''
  )

  useEffect(() => {
    return onBranchChange(id => setBranchId(id || ''))
  }, [])

  const [sum, setSum] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // โหลดยอดขาย / สต็อก ของสาขาที่เลือก (โหลดใหม่ทุกครั้งที่เปลี่ยนสาขา)
  useEffect(() => {
    if (!branchId) {
      setLoading(false)
      setError('ไม่พบสาขาของพนักงาน')
      return
    }

    let alive = true

    setLoading(true)
    setError('')

    api.getDashboard(branchId)
      .then(data => {
        if (!alive) return

        console.log('Dashboard data:', data)
        setSum(data)
      })
      .catch(err => {
        if (!alive) return

        console.error(
          'โหลด Dashboard ไม่สำเร็จ:',
          err
        )

        setError(
          err.message ||
            'ไม่สามารถโหลดข้อมูล Dashboard ได้'
        )

        setSum(null)
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
        }
      })

    return () => {
      alive = false
    }
  }, [branchId])

  const revenue = Number(
    sum?.revenue || 0
  )

  const orderCount = Number(
    sum?.orderCount || 0
  )

  const stock = Array.isArray(
    sum?.stock
  )
    ? sum.stock
    : []

  // ของใกล้หมด: เหลือ <= จุดแจ้งเตือน (ค่าเริ่มต้น 0 = แจ้งเมื่อหมด)
  const lowItems = stock.filter(
    item => Number(item.qty || 0) <= Number(item.reorderPoint || 0)
  )

  return (
    <Layout
      title="Dashboard"
      back={false}
      right={<BranchSelector compact />}
    >

      {/* =================================================
          FOR ADMIN
          ต้อง Login ก่อนเข้า Admin
      ================================================= */}
      <MaybeLink
        to="/admin/login"
        style={{
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          className="card"
          style={{
            marginBottom: 12,
            padding: '12px 16px',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#222',
                  flexShrink: 0,
                }}
              >
                <AdminIcon />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  สำหรับผู้ดูแลระบบ
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    marginTop: 2,
                  }}
                >
                  For admin
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 24,
                color: '#777',
              }}
            >
              ›
            </div>
          </div>
        </div>
      </MaybeLink>

      {/* ERROR */}
      {error && (
        <div
          className="card"
          style={{
            background: '#ffe5e5',
            color: '#c00',
            marginBottom: 12,
          }}
        >
          <b>
            ไม่สามารถโหลดข้อมูลได้
          </b>

          <div
            style={{
              marginTop: 5,
              fontSize: 13,
            }}
          >
            {error}
          </div>

          <button
            className="btn-primary"
            style={{
              marginTop: 10,
            }}
            onClick={() => {
              if (!branchId) return

              setLoading(true)
              setError('')

              api.getDashboard(branchId)
                .then(setSum)
                .catch(err => {
                  console.error(err)

                  setError(
                    err.message ||
                      'ไม่สามารถโหลดข้อมูลได้'
                  )
                })
                .finally(() => {
                  setLoading(false)
                })
            }}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ยอดขายรวม */}
      <MaybeLink
        enabled={canSell}
        to="/history"
        style={{
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          className="card"
          style={{
            cursor: 'pointer',
            background: '#ffd4d4',
          }}
        >
          <small>
            ยอดขายรวมวันนี้
          </small>

          <h1
            style={{
              margin: 0,
              marginTop: 3,
            }}
          >
            {loading
              ? 'กำลังโหลด...'
              : baht(revenue)}
          </h1>

          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginTop: 4,
            }}
          >
            {canSell
              ? 'กดเพื่อดูประวัติการขาย'
              : 'ยอดขายของสาขานี้'}
          </div>
        </div>
      </MaybeLink>

      {/* จำนวนออเดอร์ */}
      <MaybeLink
        enabled={canSell}
        to="/history"
        style={{
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          className="card gray"
          style={{
            cursor: 'pointer',
          }}
        >
          <small>
            จำนวนออเดอร์วันนี้
          </small>

          <h1
            style={{
              margin: 0,
              marginTop: 3,
            }}
          >
            {loading
              ? 'กำลังโหลด...'
              : orderCount}
          </h1>

          <div
            style={{
              fontSize: 12,
              color: '#666',
              marginTop: 4,
            }}
          >
            ออเดอร์ที่ชำระเงินสำเร็จ
          </div>
        </div>
      </MaybeLink>

      {/* สต็อก */}
      {/* =================================================
          แจ้งเตือนของใกล้หมด / หมด
      ================================================= */}

      {!loading && lowItems.length > 0 && (
        <MaybeLink
          enabled={canStock}
          to="/stock"
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: '#ffe9e9',
              border: '1px solid #ff9a9a',
              color: '#a30000',
            }}
          >
            <b>⚠ ของใกล้หมด / หมด ({lowItems.length} รายการ)</b>

            <div style={{ marginTop: 4, fontSize: 14 }}>
              {lowItems
                .map(item =>
                  `${item.name} (${Number(item.qty || 0) <= 0 ? 'หมด' : 'เหลือ ' + fmtQty(item.qty, item.unitsPerWhole)})`
                )
                .join(', ')}
            </div>
          </div>
        </MaybeLink>
      )}

      <MaybeLink
        enabled={canStock}
        to="/stock"
        style={{
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div
          className="card yellow"
          style={{
            marginTop: 12,
            cursor: 'pointer',
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
              <small>
                สต็อกปัจจุบัน
              </small>

              <h2
                style={{
                  margin: '5px 0 0',
                  fontSize: 22,
                }}
              >
                {loading
                  ? 'กำลังโหลด...'
                  : `${stock.length} รายการ`}
              </h2>
            </div>

            <span
              style={{
                color: '#222',
                fontSize: 14,
                fontWeight: 'bold',
              }}
            >
              ดูทั้งหมด ›
            </span>
          </div>

          {!loading &&
            stock.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  background: '#fff',
                  borderRadius: 10,
                  border:
                    '1px solid #e8dfa0',
                  overflow: 'hidden',
                }}
              >
                {stock
                  .slice(0, 4)
                  .map(item => {
                    const qty = Number(
                      item.qty || 0
                    )

                    const reorder =
                      Number(
                        item.reorderPoint ||
                          0
                      )

                    const isLow =
                      qty <= reorder

                    return (
                      <div
                        key={
                          item.menuId
                        }
                        style={{
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          alignItems:
                            'center',
                          padding:
                            '10px 12px',
                          borderBottom:
                            '1px solid #f0ead0',
                        }}
                      >
                        <span>
                          {item.name}
                        </span>

                        <span
                          style={{
                            fontWeight:
                              'bold',
                            color:
                              isLow
                                ? 'red'
                                : '#222',
                          }}
                        >
                          {fmtQty(qty, item.unitsPerWhole)}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}

          {!loading &&
            stock.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 15,
                  background: '#fff',
                  borderRadius: 10,
                  textAlign: 'center',
                  color: '#888',
                }}
              >
                ยังไม่มีข้อมูลสต็อก
              </div>
            )}
        </div>
      </MaybeLink>

      {/* ทางลัด: กะการขาย / ค่าใช้จ่าย */}
      {canSell && (
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <Link to="/shift" style={{ flex: 1, textDecoration: 'none' }}>
            <div className="card gray" style={{ margin: 0, textAlign: 'center', color: '#222', fontWeight: 'bold' }}>
              กะการขาย
            </div>
          </Link>

          <Link to="/expenses" style={{ flex: 1, textDecoration: 'none' }}>
            <div className="card gray" style={{ margin: 0, textAlign: 'center', color: '#222', fontWeight: 'bold' }}>
              ค่าใช้จ่าย
            </div>
          </Link>
        </div>
      )}

      {/* ปุ่มเริ่มขาย */}
      {canSell && (
        <Link
          to="/sell"
          style={{
            textDecoration: 'none',
          }}
        >
          <button className="btn-primary">
            เริ่มขาย
          </button>
        </Link>
      )}

    </Layout>
  )
}