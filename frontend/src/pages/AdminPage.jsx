import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  api,
  baht,
  getSelectedBranchId,
  onBranchChange,
} from '../api'
import BranchSelector from '../components/BranchSelector'

// =====================================================
// DATE
// =====================================================

function todayString() {
  const d = new Date()

  const year = d.getFullYear()
  const month = String(
    d.getMonth() + 1
  ).padStart(2, '0')

  const day = String(
    d.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function firstDayOfMonth() {
  const d = new Date()

  const year = d.getFullYear()
  const month = String(
    d.getMonth() + 1
  ).padStart(2, '0')

  return `${year}-${month}-01`
}

function formatDateLabel(value) {
  if (!value) return '-'

  const parts =
    String(value).split('-')

  if (parts.length !== 3) {
    return value
  }

  return `${parts[2]}/${parts[1]}`
}

// =====================================================
// LABEL
// =====================================================

function categoryLabel(category) {
  const map = {
    duck: 'เป็ด',
    chicken: 'ไก่',
    other: 'อื่น ๆ',
  }

  return (
    map[category] ||
    category ||
    'ไม่ระบุ'
  )
}

function channelLabel(channel) {
  const map = {
    cash: 'เงินสด',
    qr: 'QR',
    transfer: 'โอนเงิน',
    card: 'บัตร',
    unknown: 'ไม่ระบุ',
  }

  return (
    map[channel] ||
    channel ||
    'ไม่ระบุ'
  )
}

// =====================================================
// ICONS
// ใช้ชุดไอคอนเดียวกับแถบด้านล่างของไฟล์อื่น
// =====================================================

function HomeIcon({ size = 25 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M3 10.5L12 3L21 10.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9.5V20H19V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 20V14H15V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ReceiptIcon({ size = 25 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 3.5C4.9 3.5 4 4.4 4 5.5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V8L15.5 3.5H6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 3.5V8H20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 11H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 14.5H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 18H13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ShoppingBagIcon({ size = 25 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 8H19L20 20H4L5 8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 12C8 14.2 9.8 16 12 16C14.2 16 16 14.2 16 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function GiftIcon({ size = 25 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 10H20V20H4V10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 7H21V10H3V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7V20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 7H8.5C7.1 7 6 5.9 6 4.5C6 3.7 6.7 3 7.5 3C9.5 3 12 5.1 12 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7H15.5C16.9 7 18 5.9 18 4.5C18 3.7 17.3 3 16.5 3C14.5 3 12 5.1 12 7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BuildingIcon({ size = 25 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4 21V5L14 3V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 9H20V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 12H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 16H10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17 13H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17 17H18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

// =====================================================
// PIE CHART
// =====================================================

function PieChart({
  firstValue = 0,
  secondValue = 0,
  firstLabel = '',
  secondLabel = '',
}) {
  const first = Number(
    firstValue || 0
  )

  const second = Number(
    secondValue || 0
  )

  const total =
    first + second

  const firstPercent =
    total > 0
      ? (first / total) * 100
      : 50

  const secondPercent =
    total > 0
      ? (second / total) * 100
      : 50

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 25,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: '50%',
          background:
            `conic-gradient(
              #f59e0b 0% ${firstPercent}%,
              #d1d5db ${firstPercent}% 100%
            )`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {total > 0
            ? `${Math.round(firstPercent)}%`
            : '0%'}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 13,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#f59e0b',
            }}
          />

          <span>
            {firstLabel}
          </span>

          <b>
            {first.toLocaleString()}
          </b>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#d1d5db',
            }}
          />

          <span>
            {secondLabel}
          </span>

          <b>
            {second.toLocaleString()}
          </b>
        </div>

        <div
          style={{
            marginTop: 5,
            color: '#777',
            fontSize: 12,
          }}
        >
          รวม {total.toLocaleString()}
        </div>
      </div>
    </div>
  )
}

// =====================================================
// ADMIN PAGE
// =====================================================

export default function AdminPage() {
  const location = useLocation()

  // ===================================================
  // สาขาที่กำลังใช้งาน (เปลี่ยนได้จากกล่องเลือกสาขา)
  // ===================================================

  const [branchId, setBranchId] = useState(
    getSelectedBranchId() || ''
  )

  useEffect(() => {
    return onBranchChange(id => setBranchId(id || ''))
  }, [])

  function bottomNavStyle(path, activeFontWeight = 600) {
    const isActive =
      location.pathname === path

    return {
      textDecoration: 'none',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      fontSize: 11,
      fontWeight: isActive ? 700 : activeFontWeight,
      background: isActive
        ? 'rgba(255,255,255,0.20)'
        : 'transparent',
      borderRadius: isActive
        ? '12px 12px 0 0'
        : 0,
      marginTop: isActive ? 4 : 0,
      transition: 'background 0.2s, margin-top 0.2s',
    }
  }
  const [
    startDate,
    setStartDate,
  ] = useState(
    firstDayOfMonth()
  )

  const [
    endDate,
    setEndDate,
  ] = useState(
    todayString()
  )

  const [
    data,
    setData,
  ] = useState(null)

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    error,
    setError,
  ] = useState('')

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null)

  // ===================================================
  // LOAD DASHBOARD
  // ===================================================

  async function loadDashboard(
    showLoading = true
  ) {
    try {
      if (showLoading) {
        setLoading(true)
      }

      setError('')

      const result =
        await api.getAdminDashboard(
          startDate,
          endDate,
          branchId
        )

      console.log(
        'Admin Dashboard:',
        result
      )

      setData(result)

      setLastUpdated(
        new Date()
      )
    } catch (err) {
      console.error(
        'Admin Dashboard Error:',
        err
      )

      setError(
        err?.message ||
          'ไม่สามารถโหลดข้อมูล Admin Dashboard ได้'
      )
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  // ===================================================
  // INITIAL LOAD + โหลดใหม่เมื่อเปลี่ยนสาขา
  //
  // รอให้รู้สาขาก่อน ไม่งั้นจะโหลดข้อมูลทุกสาขามารวมกันแวบหนึ่ง
  // ===================================================

  useEffect(() => {
    if (!branchId) return

    loadDashboard()
  }, [branchId])

  // ===================================================
  // AUTO REFRESH
  //
  // อัปเดตทุก 5 วินาที
  // ===================================================

  useEffect(() => {
    if (!branchId) return

    const timer =
      setInterval(() => {
        loadDashboard(false)
      }, 5000)

    return () => {
      clearInterval(timer)
    }
  }, [
    startDate,
    endDate,
    branchId,
  ])

  // ===================================================
  // DATA
  // ===================================================

  const summary =
    data?.summary || {}

  const sales =
    Number(
      summary.sales || 0
    )

  const orders =
    Number(
      summary.orders || 0
    )

  const productCost =
    Number(
      summary.productCost || 0
    )

  const otherExpenses =
    Number(
      summary.otherExpenses || 0
    )

  const totalCost =
    Number(
      summary.totalCost || 0
    )

  const profit =
    Number(
      summary.profit || 0
    )

  const discount =
    Number(
      summary.discount || 0
    )

  const dailySales =
    Array.isArray(
      data?.dailySales
    )
      ? data.dailySales
      : []

  const monthlySales =
    Array.isArray(
      data?.monthlySales
    )
      ? data.monthlySales
      : []

  const categorySales =
    Array.isArray(
      data?.categorySales
    )
      ? data.categorySales
      : []

  const channelSales =
    Array.isArray(
      data?.channelSales
    )
      ? data.channelSales
      : []

  // ===================================================
  // MAX DAILY SALES
  // ===================================================

  const maxDailySales =
    useMemo(() => {
      if (
        !dailySales.length
      ) {
        return 1
      }

      return Math.max(
        ...dailySales.map(
          item =>
            Number(
              item.sales || 0
            )
        ),
        1
      )
    }, [dailySales])

  // ===================================================
  // MAX MONTHLY SALES
  // ===================================================

  const maxMonthlySales =
    useMemo(() => {
      if (
        !monthlySales.length
      ) {
        return 1
      }

      return Math.max(
        ...monthlySales.map(
          item =>
            Number(
              item.sales || 0
            )
        ),
        1
      )
    }, [monthlySales])

  // ===================================================
  // DUCK / CHICKEN
  // ===================================================

  const duckQty =
    categorySales
      .filter(
        item =>
          item.category ===
          'duck'
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.qty || 0
          ),
        0
      )

  const chickenQty =
    categorySales
      .filter(
        item =>
          item.category ===
          'chicken'
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(
            item.qty || 0
          ),
        0
      )

  // ===================================================
  // PROFIT / COST
  // ===================================================

  const profitPositive =
    Math.max(
      profit,
      0
    )

  const lossValue =
    Math.max(
      totalCost -
        sales,
      0
    )

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      style={{
        minHeight:
          '100vh',
        background:
          '#f7f7f7',
        paddingTop: 20,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 100,
        boxSizing:
          'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems:
              'center',
            gap: 15,
            marginBottom: 20,
            flexWrap:
              'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                color: '#777',
                marginBottom: 4,
              }}
            >
              PoultryOS
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 28,
              }}
            >
              Admin Dashboard
            </h1>

            <div
              style={{
                marginTop: 5,
                color: '#666',
                fontSize: 14,
              }}
            >
              ภาพรวมยอดขายและผลประกอบการ
            </div>

            {lastUpdated && (
              <div
                style={{
                  marginTop: 5,
                  color: '#999',
                  fontSize: 11,
                }}
              >
                อัปเดตล่าสุด{' '}
                {lastUpdated.toLocaleTimeString(
                  'th-TH'
                )}
              </div>
            )}
          </div>

          <BranchSelector />

          <button
            type="button"
            onClick={() =>
              loadDashboard()
            }
            style={{
              border:
                '1px solid #ddd',
              background:
                '#fff',
              borderRadius: 10,
              padding:
                '10px 16px',
              cursor:
                'pointer',
              fontWeight: 600,
            }}
          >
            ↻ รีเฟรช
          </button>
        </div>

        {/* =================================================
            FILTER
        ================================================= */}

        <div
          style={{
            background:
              '#fff',
            border:
              '1px solid #e5e5e5',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            เลือกช่วงวันที่
          </div>

          <div
            style={{
              display:
                'flex',
              gap: 12,
              flexWrap:
                'wrap',
              alignItems:
                'end',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#666',
                  marginBottom: 5,
                }}
              >
                วันที่เริ่มต้น
              </div>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={e =>
                  setStartDate(
                    e.target
                      .value
                  )
                }
                style={{
                  padding:
                    '9px 10px',
                  border:
                    '1px solid #ddd',
                  borderRadius: 8,
                }}
              />
            </div>

            <div>
              <div
                style={{
                  fontSize: 12,
                  color: '#666',
                  marginBottom: 5,
                }}
              >
                วันที่สิ้นสุด
              </div>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={e =>
                  setEndDate(
                    e.target
                      .value
                  )
                }
                style={{
                  padding:
                    '9px 10px',
                  border:
                    '1px solid #ddd',
                  borderRadius: 8,
                }}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                loadDashboard()
              }
              style={{
                padding:
                  '10px 18px',
                border: 'none',
                borderRadius: 8,
                background:
                  '#222',
                color:
                  '#fff',
                cursor:
                  'pointer',
                fontWeight:
                  600,
              }}
            >
              ดูข้อมูล
            </button>
          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            style={{
              background:
                '#ffe8e8',
              border:
                '1px solid #ffbcbc',
              color:
                '#b00000',
              borderRadius:
                12,
              padding: 14,
              marginBottom:
                16,
            }}
          >
            <b>
              ไม่สามารถโหลดข้อมูล Admin ได้
            </b>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                wordBreak:
                  'break-word',
              }}
            >
              {error}
            </div>
          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading && (
          <div
            style={{
              background:
                '#fff',
              borderRadius:
                14,
              padding: 30,
              textAlign:
                'center',
              marginBottom:
                16,
            }}
          >
            กำลังโหลดข้อมูล Admin...
          </div>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {!loading && (
          <>

            {/* =================================================
                SUMMARY
            ================================================= */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
                marginBottom:
                  16,
              }}
            >

              {/* SALES */}

              <div
                style={{
                  background:
                    '#ffd4d4',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  ยอดขายรวม
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginTop: 5,
                  }}
                >
                  {baht(
                    sales
                  )}
                </div>
              </div>

              {/* ORDERS */}

              <div
                style={{
                  background:
                    '#fff',
                  borderRadius:
                    14,
                  padding: 18,
                  border:
                    '1px solid #e5e5e5',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  จำนวนออเดอร์
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginTop: 5,
                  }}
                >
                  {orders}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#777',
                    marginTop: 3,
                  }}
                >
                  รายการที่ขายสำเร็จ
                </div>
              </div>

              {/* COST */}

              <div
                style={{
                  background:
                    '#fff',
                  borderRadius:
                    14,
                  padding: 18,
                  border:
                    '1px solid #e5e5e5',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  ต้นทุนรวม
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginTop: 5,
                  }}
                >
                  {baht(
                    totalCost
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#777',
                    marginTop: 3,
                  }}
                >
                  สินค้า{' '}
                  {baht(
                    productCost
                  )}
                </div>
              </div>

              {/* PROFIT */}

              <div
                style={{
                  background:
                    profit >= 0
                      ? '#e8f7e8'
                      : '#ffe5e5',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  {profit >= 0
                    ? 'กำไร'
                    : 'ขาดทุน'}
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    marginTop: 5,
                  }}
                >
                  {baht(
                    Math.abs(
                      profit
                    )
                  )}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#777',
                    marginTop: 3,
                  }}
                >
                  ค่าใช้จ่ายอื่น{' '}
                  {baht(
                    otherExpenses
                  )}
                </div>
              </div>
            </div>

            {/* =================================================
                DISCOUNT
            ================================================= */}

            {discount > 0 && (
              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    12,
                  padding: 12,
                  marginBottom:
                    16,
                  fontSize: 13,
                }}
              >
                ส่วนลดทั้งหมดในช่วงนี้:{' '}
                <b>
                  {baht(
                    discount
                  )}
                </b>
              </div>
            )}

            {/* =================================================
                DAILY SALES
            ================================================= */}

            <div
              style={{
                background:
                  '#fff',
                border:
                  '1px solid #e5e5e5',
                borderRadius:
                  14,
                padding: 18,
                marginBottom:
                  16,
              }}
            >
              <h2
                style={{
                  margin:
                    '0 0 18px',
                  fontSize: 20,
                }}
              >
                กราฟยอดขาย
              </h2>

              {dailySales.length ===
              0 ? (
                <div
                  style={{
                    color:
                      '#777',
                    textAlign:
                      'center',
                    padding: 25,
                  }}
                >
                  ไม่มีข้อมูลยอดขายในช่วงวันที่เลือก
                </div>
              ) : (
                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'end',
                    gap: 8,
                    minHeight:
                      240,
                    overflowX:
                      'auto',
                    padding:
                      '10px 5px 0',
                  }}
                >
                  {dailySales.map(
                    (
                      item,
                      index
                    ) => {
                      const value =
                        Number(
                          item.sales ||
                            0
                        )

                      const height =
                        value > 0
                          ? Math.max(
                              8,
                              (value /
                                maxDailySales) *
                                180
                            )
                          : 3

                      return (
                        <div
                          key={
                            item.date ||
                            `day-${index}`
                          }
                          style={{
                            minWidth:
                              42,
                            flex: 1,
                            maxWidth:
                              70,
                            display:
                              'flex',
                            flexDirection:
                              'column',
                            alignItems:
                              'center',
                            justifyContent:
                              'end',
                            height:
                              220,
                          }}
                        >
                          <div
                            style={{
                              fontSize:
                                10,
                              color:
                                '#555',
                              marginBottom:
                                5,
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {value >
                            0
                              ? value.toLocaleString()
                              : ''}
                          </div>

                          <div
                            title={`${formatDateLabel(
                              item.date
                            )}: ${baht(
                              value
                            )}`}
                            style={{
                              width:
                                '70%',
                              height,
                              background:
                                '#f59e0b',
                              borderRadius:
                                '6px 6px 2px 2px',
                            }}
                          />

                          <div
                            style={{
                              fontSize:
                                10,
                              color:
                                '#777',
                              marginTop:
                                7,
                              whiteSpace:
                                'nowrap',
                            }}
                          >
                            {formatDateLabel(
                              item.date
                            )}
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              )}
            </div>

            {/* =================================================
                PROFIT / LOSS + DUCK / CHICKEN
            ================================================= */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom:
                  16,
              }}
            >

              {/* PROFIT / COST */}

              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 20px',
                    fontSize: 20,
                  }}
                >
                  สัดส่วนกำไร / ต้นทุน
                </h2>

                <PieChart
                  firstValue={
                    profitPositive
                  }
                  secondValue={
                    totalCost
                  }
                  firstLabel="กำไร"
                  secondLabel="ต้นทุน"
                />

                <div
                  style={{
                    marginTop:
                      18,
                    paddingTop:
                      14,
                    borderTop:
                      '1px solid #eee',
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    fontSize: 18,
                  }}
                >
                  <span>
                    ผลต่าง
                  </span>

                  <b
                    style={{
                      color:
                        profit >= 0
                          ? '#15803d'
                          : '#dc2626',
                    }}
                  >
                    {profit >= 0
                      ? '+'
                      : '-'}
                    {baht(
                      Math.abs(
                        profit
                      )
                    )}
                  </b>
                </div>
              </div>

              {/* DUCK / CHICKEN */}

              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 20px',
                    fontSize: 20,
                  }}
                >
                  สัดส่วนสินค้าที่ขาย
                </h2>

                <PieChart
                  firstValue={
                    duckQty
                  }
                  secondValue={
                    chickenQty
                  }
                  firstLabel="เป็ด"
                  secondLabel="ไก่"
                />

                <div
                  style={{
                    marginTop:
                      18,
                    display:
                      'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      background:
                        '#fff7ed',
                      borderRadius:
                        10,
                      padding:
                        12,
                      textAlign:
                        'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          24,
                        color:
                          '#020202',
                      }}
                    >
                      เป็ด
                    </div>

                    <b
                      style={{
                        fontSize:
                          20,
                      }}
                    >
                      {duckQty.toLocaleString()}
                    </b>
                  </div>

                  <div
                    style={{
                      background:
                        '#f3f4f6',
                      borderRadius:
                        10,
                      padding:
                        12,
                      textAlign:
                        'center',
                    }}
                  >
                    <div
                      style={{
                        fontSize:
                          24,
                        color:
                          '#060606',
                      }}
                    >
                       ไก่
                    </div>

                    <b
                      style={{
                        fontSize:
                          20,
                      }}
                    >
                      {chickenQty.toLocaleString()}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================
                MONTHLY SALES
            ================================================= */}

            {monthlySales.length >
              0 && (
              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    14,
                  padding: 18,
                  marginBottom:
                    16,
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 18px',
                    fontSize: 20,
                  }}
                >
                  ยอดขายรายเดือน
                </h2>

                <div
                  style={{
                    display:
                      'flex',
                    flexDirection:
                      'column',
                    gap: 12,
                  }}
                >
                  {monthlySales.map(
                    (
                      item,
                      index
                    ) => {
                      const value =
                        Number(
                          item.sales ||
                            0
                        )

                      const width =
                        value > 0
                          ? Math.max(
                              3,
                              (value /
                                maxMonthlySales) *
                                100
                            )
                          : 0

                      return (
                        <div
                          key={
                            item.month ||
                            `month-${index}`
                          }
                        >
                          <div
                            style={{
                              display:
                                'flex',
                              justifyContent:
                                'space-between',
                              fontSize:
                                13,
                              marginBottom:
                                5,
                            }}
                          >
                            <span>
                              {
                                item.month
                              }
                            </span>

                            <b>
                              {baht(
                                value
                              )}
                            </b>
                          </div>

                          <div
                            style={{
                              height:
                                10,
                              background:
                                '#eee',
                              borderRadius:
                                10,
                              overflow:
                                'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${width}%`,
                                height:
                                  '100%',
                                background:
                                  '#f59e0b',
                                borderRadius:
                                  10,
                              }}
                            />
                          </div>
                        </div>
                      )
                    }
                  )}
                </div>
              </div>
            )}

            {/* =================================================
                CATEGORY + CHANNEL
            ================================================= */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
                marginBottom:
                  20,
              }}
            >

              {/* CATEGORY */}

              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 16px',
                    fontSize: 20,
                  }}
                >
                  ยอดขายตามหมวดสินค้า
                </h2>

                {categorySales.length ===
                0 ? (
                  <div
                    style={{
                      color:
                        '#777',
                      textAlign:
                        'center',
                      padding: 20,
                    }}
                  >
                    ไม่มีข้อมูล
                  </div>
                ) : (
                  <div
                    style={{
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      gap: 14,
                    }}
                  >
                    {categorySales.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.category ||
                            `category-${index}`
                          }
                        >
                          <div
                            style={{
                              display:
                                'flex',
                              justifyContent:
                                'space-between',
                              marginBottom:
                                5,
                              fontSize:
                                14,
                            }}
                          >
                            <span>
                              {categoryLabel(
                                item.category
                              )}
                            </span>

                            <b>
                              {baht(
                                Number(
                                  item.sales ||
                                    0
                                )
                              )}
                            </b>
                          </div>

                          <div
                            style={{
                              fontSize:
                                12,
                              color:
                                '#777',
                            }}
                          >
                            จำนวน{' '}
                            {Number(
                              item.qty ||
                                0
                            ).toLocaleString()}{' '}
                            หน่วย
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* CHANNEL */}

              <div
                style={{
                  background:
                    '#fff',
                  border:
                    '1px solid #e5e5e5',
                  borderRadius:
                    14,
                  padding: 18,
                }}
              >
                <h2
                  style={{
                    margin:
                      '0 0 16px',
                    fontSize: 20,
                  }}
                >
                  ยอดขายตามช่องทาง
                </h2>

                {channelSales.length ===
                0 ? (
                  <div
                    style={{
                      color:
                        '#777',
                      textAlign:
                        'center',
                      padding: 20,
                    }}
                  >
                    ไม่มีข้อมูล
                  </div>
                ) : (
                  <div
                    style={{
                      display:
                        'flex',
                      flexDirection:
                        'column',
                      gap: 14,
                    }}
                  >
                    {channelSales.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.channel ||
                            `channel-${index}`
                          }
                        >
                          <div
                            style={{
                              display:
                                'flex',
                              justifyContent:
                                'space-between',
                              marginBottom:
                                5,
                              fontSize:
                                14,
                            }}
                          >
                            <span>
                              {channelLabel(
                                item.channel
                              )}
                            </span>

                            <b>
                              {baht(
                                Number(
                                  item.sales ||
                                    0
                                )
                              )}
                            </b>
                          </div>

                          <div
                            style={{
                              fontSize:
                                12,
                              color:
                                '#777',
                            }}
                          >
                            {Number(
                              item.orders ||
                                0
                            )}{' '}
                            ออเดอร์
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* =================================================
                BRANCH
            ================================================= */}

            {data?.branchId && (
              <div
                style={{
                  textAlign:
                    'center',
                  color:
                    '#888',
                  fontSize:
                    12,
                  paddingBottom:
                    20,
                }}
              >
                ข้อมูลสาขา{' '}
                {data.branchId}
              </div>
            )}
          </>
        )}
      </div>

      {/* =====================================================
          ADMIN BOTTOM NAV
      ===================================================== */}

      <div
        style={{
          position:
            'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 72,
          background:
             '#ff1111',
          display:
            'flex',
          justifyContent:
            'center',
          zIndex: 1000,
          boxShadow:
            '0 -2px 10px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 2000,
            display:
              'grid',
            gridTemplateColumns:
              'repeat(5, 1fr)',
                alignItems: 'stretch',
          }}
        >

          {/* หน้าหลัก */}

          <Link
            to="/admin"
            style={bottomNavStyle(
              '/admin',
              700
            )}
          >
            <HomeIcon size={26} />
            <span>
              หน้าหลัก
            </span>
          </Link>

          {/* ประวัติ */}

          <Link
            to="/admin/sales"
            style={bottomNavStyle(
              '/admin/sales'
            )}
          >
            <ReceiptIcon size={27} />
            <span>
              ประวัติการขาย
            </span>
          </Link>

          {/* สินค้า */}

          <Link
            to="/admin/products"
            style={bottomNavStyle(
              '/admin/products'
            )}
          >
            <ShoppingBagIcon size={26} />
            <span>
              แก้ไขสินค้า
            </span>
          </Link>

          {/* โปรโมชั่น */}

          <Link
            to="/admin/promotions"
            style={bottomNavStyle(
              '/admin/promotions'
            )}
          >
            <GiftIcon size={26} />
            <span>
              โปรโมชั่น
            </span>
          </Link>

          {/* สาขา */}

          <Link
            to="/admin/branches"
            style={bottomNavStyle(
              '/admin/branches'
            )}
          >
            <BuildingIcon size={26} />
            <span>
              จัดการสาขา
            </span>
          </Link>

        </div>
      </div>
    </div>
  )
}