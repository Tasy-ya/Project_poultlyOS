import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import {
  api,
  baht,
  getSelectedBranchId,
  onBranchChange,
} from '../api'

import BranchSelector from '../components/BranchSelector'

// =====================================================
// ICONS
// =====================================================

function HomeIcon({ size = 25, active = false }) {
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


function formatDateTime(value) {
  if (!value) return '-'

  const d = new Date(value)

  if (Number.isNaN(d.getTime())) {
    return String(value)
  }

  return d.toLocaleString(
    'th-TH',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  )
}


// =====================================================
// PAYMENT LABEL
// =====================================================

function channelLabel(channel) {
  const map = {
    cash: 'เงินสด',
    qr: 'QR Code',
    transfer: 'โอนเงิน',
    card: 'บัตร',
    delivery: 'Delivery',
    unknown: 'ไม่ระบุ',
  }

  return (
    map[channel] ||
    channel ||
    'ไม่ระบุ'
  )
}


// =====================================================
// PAYMENT ICON
// =====================================================

function channelIcon(channel) {
  const map = {
    cash: '฿',
    qr: '▣',
    transfer: '↗',
    card: '▭',
    delivery: '◈',
  }

  return (
    map[channel] ||
    '•'
  )
}


// =====================================================
// ADMIN SALES PAGE
// =====================================================

export default function AdminSalesPage() {

  // ===================================================
  // FILTER
  // ===================================================

  const [date, setDate] =
    useState(
      todayString()
    )

  // สาขาที่กำลังใช้งาน (เปลี่ยนได้จากกล่องเลือกสาขาที่หัวหน้า)
  const [branch, setBranch] =
    useState(
      getSelectedBranchId() || ''
    )

  useEffect(() => {
    return onBranchChange(
      id => setBranch(id || '')
    )
  }, [])

  const [channel, setChannel] =
    useState('all')

  const [keyword, setKeyword] =
    useState('')


  // ===================================================
  // DATA
  // ===================================================

  const [sales, setSales] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')


  // ===================================================
  // LOAD SALES
  // ===================================================

  async function loadSales(
    showLoading = true
  ) {

    try {

      if (showLoading) {
        setLoading(true)
      }

      setError('')

      const result =
        await api.getAdminSales(
          date,
          date,
          branch === 'all'
            ? ''
            : branch
        )

      console.log(
        'Admin Sales:',
        result
      )

      /*
        รองรับ response หลายรูปแบบ

        {
          sales: [...]
        }

        หรือ

        {
          data: [...]
        }

        หรือ

        [...]
      */

      const rows =
        Array.isArray(result)
          ? result
          : Array.isArray(
              result?.sales
            )
          ? result.sales
          : Array.isArray(
              result?.data
            )
          ? result.data
          : []

      setSales(rows)

    } catch (err) {

      console.error(
        'Admin Sales Error:',
        err
      )

      setError(
        err?.message ||
          'ไม่สามารถโหลดประวัติการขายได้'
      )

      setSales([])

    } finally {

      if (showLoading) {
        setLoading(false)
      }

    }
  }


  // ===================================================
  // LOAD WHEN DATE / BRANCH CHANGES
  //
  // รอให้รู้สาขาก่อน ไม่งั้นจะโหลดทุกสาขามารวมกันแวบหนึ่ง
  // ===================================================

  useEffect(() => {

    if (!branch) return

    loadSales()

  }, [
    date,
    branch,
  ])


  // ===================================================
  // FILTER CHANNEL + KEYWORD
  // ===================================================

  const filteredSales =
    useMemo(() => {

      return sales.filter(
        item => {

          // -------------------------------------------
          // CHANNEL
          // -------------------------------------------

          if (
            channel !== 'all' &&
            item.channel !== channel &&
            item.payment_method !==
              channel &&
            item.paymentMethod !==
              channel
          ) {
            return false
          }


          // -------------------------------------------
          // KEYWORD
          // -------------------------------------------

          if (
            !keyword.trim()
          ) {
            return true
          }

          const search =
            keyword
              .trim()
              .toLowerCase()

          const text = [
            item.id,
            item.orderId,
            item.order_id,
            item.orderNo,
            item.order_no,
            item.branchId,
            item.branch_id,
            item.branchName,
            item.branch_name,
            item.channel,
            item.payment_method,
            item.paymentMethod,
            item.items,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return text.includes(
            search
          )
        }
      )

    }, [
      sales,
      channel,
      keyword,
    ])


  // ===================================================
  // TOTAL
  // ===================================================

  const totalSales =
    filteredSales.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.total ||
            item.total_amount ||
            item.totalAmount ||
            item.sales ||
            item.amount ||
            0
        ),
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
          maxWidth: 900,
          margin: '0 auto',
        }}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            marginBottom: 20,
          }}
        >

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
            ประวัติการขาย
          </h1>

          <div
            style={{
              marginTop: 5,
              color: '#666',
              fontSize: 14,
            }}
          >
            ตรวจสอบรายการขายย้อนหลังตามวันที่
            สาขา และช่องทางการชำระเงิน
          </div>

          <div
            style={{
              marginTop: 14,
            }}
          >
            <BranchSelector />
          </div>

        </div>


        {/* =================================================
            FILTER
        ================================================= */}

        <div
          style={{
            background: '#fff',
            border:
              '1px solid #e5e5e5',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >

          {/* DATE */}

          <div
            style={{
              marginBottom: 14,
            }}
          >

            <div
              style={{
                fontSize: 12,
                color: '#666',
                marginBottom: 5,
              }}
            >
              วันที่
            </div>

            <input
              type="date"
              value={date}
              onChange={e =>
                setDate(
                  e.target.value
                )
              }
              style={{
                width: '100%',
                boxSizing:
                  'border-box',
                padding:
                  '11px 12px',
                border:
                  '1px solid #ddd',
                borderRadius: 9,
                fontSize: 14,
                background: '#fff',
              }}
            />

          </div>


          {/* CHANNEL */}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
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
                ช่องทาง
              </div>

              <select
                value={channel}
                onChange={e =>
                  setChannel(
                    e.target.value
                  )
                }
                style={{
                  width: '100%',
                  padding:
                    '11px 12px',
                  border:
                    '1px solid #ddd',
                  borderRadius: 9,
                  fontSize: 14,
                  background: '#fff',
                }}
              >

                <option value="all">
                  ทั้งหมด
                </option>

                <option value="cash">
                  เงินสด
                </option>

                <option value="qr">
                  QR Code
                </option>

                <option value="transfer">
                  โอนเงิน
                </option>

                <option value="card">
                  บัตร
                </option>

              </select>

            </div>

          </div>


          {/* SEARCH */}

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
            }}
          >

            <input
              type="text"
              value={keyword}
              onChange={e =>
                setKeyword(
                  e.target.value
                )
              }
              placeholder="ค้นหาเลขออเดอร์ / รายการขาย"
              style={{
                flex: 1,
                minWidth: 0,
                padding:
                  '11px 12px',
                border:
                  '1px solid #ddd',
                borderRadius: 9,
                fontSize: 14,
              }}
            />

            <button
              type="button"
              onClick={() =>
                loadSales()
              }
              style={{
                border: 'none',
                borderRadius: 7,
                background:
                  '#222',
                color: '#fff',
                padding:
                  '0 18px',
                cursor:
                  'pointer',
                fontWeight: 500,
              }}
            >
              ค้นหา
            </button>

          </div>

        </div>


        {/* =================================================
            SUMMARY
        ================================================= */}

        <div
          style={{
            background:
              '#ffd4d4',
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
          }}
        >

          <div
            style={{
              fontSize: 13,
              color: '#666',
            }}
          >
            ยอดขายวันที่เลือก
          </div>

          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              marginTop: 4,
            }}
          >
            {baht(
              totalSales
            )}
          </div>

          <div
            style={{
              fontSize: 12,
              color: '#777',
              marginTop: 3,
            }}
          >
            {filteredSales.length.toLocaleString()}
            {' '}รายการขาย
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
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >

            <b>
              ไม่สามารถโหลดประวัติการขายได้
            </b>

            <div
              style={{
                marginTop: 5,
                fontSize: 13,
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
              borderRadius: 14,
              padding: 30,
              textAlign:
                'center',
            }}
          >
            กำลังโหลดประวัติการขาย...
          </div>

        )}


        {/* =================================================
            EMPTY
        ================================================= */}

        {!loading &&
          filteredSales.length === 0 && (

            <div
              style={{
                background:
                  '#fff',
                border:
                  '1px solid #e5e5e5',
                borderRadius: 14,
                padding: 35,
                textAlign:
                  'center',
                color: '#777',
              }}
            >

              <div
                style={{
                  marginBottom: 10,
                  display: 'flex',
                  justifyContent:
                    'center',
                  color: '#222',
                }}
              >
                <ReceiptIcon
                  size={42}
                />
              </div>

              ไม่พบรายการขายในวันที่เลือก

            </div>

          )}


        {/* =================================================
            SALES LIST
        ================================================= */}

        {!loading &&
          filteredSales.map(
            (
              item,
              index
            ) => {

              const orderId =
                item.orderNo ||
                item.order_no ||
                item.orderId ||
                item.order_id ||
                item.id ||
                `#${String(
                  index + 1
                ).padStart(
                  3,
                  '0'
                )}`


              const total =
                Number(
                  item.total ||
                    item.total_amount ||
                    item.totalAmount ||
                    item.sales ||
                    item.amount ||
                    0
                )


              const branchName =
                item.branchName ||
                item.branch_name ||
                (
                  item.branchId ||
                  item.branch_id
                    ? `สาขา ${
                        item.branchId ||
                        item.branch_id
                      }`
                    : 'ไม่ระบุสาขา'
                )


              const payment =
                item.channel ||
                item.payment_method ||
                item.paymentMethod ||
                'unknown'


              // -----------------------------------------
              // ITEMS
              // -----------------------------------------

              let items = []

              if (
                Array.isArray(
                  item.items
                )
              ) {

                items =
                  item.items

              } else if (
                Array.isArray(
                  item.orderItems
                )
              ) {

                items =
                  item.orderItems

              } else if (
                Array.isArray(
                  item.order_items
                )
              ) {

                items =
                  item.order_items

              }


              return (

                <div
                  key={
                    item.id ||
                    item.orderId ||
                    index
                  }
                  style={{
                    background:
                      '#fff',

                    border:
                      '1px solid #e5e5e5',

                    borderRadius: 14,

                    padding: 16,

                    marginBottom: 12,
                  }}
                >

                  {/* TOP */}

                  <div
                    style={{
                      display:
                        'flex',

                      justifyContent:
                        'space-between',

                      alignItems:
                        'flex-start',

                      gap: 10,

                      marginBottom: 8,
                    }}
                  >

                    <div>

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        #
                        {String(
                          orderId
                        ).replace(
                          /^#/,
                          ''
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: '#777',
                          marginTop: 2,
                        }}
                      >
                        {formatDateTime(
                          item.created_at ||
                            item.createdAt ||
                            item.date
                        )}
                      </div>

                    </div>


                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 18,
                      }}
                    >
                      {baht(
                        total
                      )}
                    </div>

                  </div>


                  {/* BRANCH */}

                  <div
                    style={{
                      fontSize: 13,
                      color: '#555',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        marginRight: 5,
                      }}
                    >
                      📍
                    </span>

                    {branchName}
                  </div>


                  {/* ITEMS */}

                  <div
                    style={{
                      borderTop:
                        '1px solid #eee',

                      borderBottom:
                        '1px solid #eee',

                      padding:
                        '9px 0',

                      marginBottom: 9,
                    }}
                  >

                    {items.length > 0 ? (

                      items.map(
                        (
                          product,
                          productIndex
                        ) => {

                          const name =
                            product.name ||
                            product.menu_name ||
                            product.menuName ||
                            product.product_name ||
                            'สินค้า'


                          const qty =
                            Number(
                              product.qty ||
                                product.quantity ||
                                0
                            )


                          return (

                            <div
                              key={
                                product.id ||
                                productIndex
                              }
                              style={{
                                display:
                                  'flex',

                                justifyContent:
                                  'space-between',

                                fontSize:
                                  13,

                                marginBottom:
                                  productIndex <
                                  items.length -
                                    1
                                    ? 5
                                    : 0,
                              }}
                            >

                              <span>
                                {name}
                              </span>

                              <span>
                                × {qty}
                              </span>

                            </div>

                          )
                        }
                      )

                    ) : (

                      <div
                        style={{
                          fontSize: 13,
                          color: '#777',
                        }}
                      >
                        ไม่พบรายละเอียดสินค้า
                      </div>

                    )}

                  </div>


                  {/* PAYMENT */}

                  <div
                    style={{
                      fontSize: 13,
                      color: '#555',
                    }}
                  >

                    <span
                      style={{
                        display:
                          'inline-flex',
                        width: 22,
                        height: 22,
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        marginRight: 5,
                        borderRadius: 5,
                        background:
                          '#f2f2f2',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {channelIcon(
                        payment
                      )}
                    </span>

                    {channelLabel(
                      payment
                    )}

                  </div>

                </div>

              )
            }
          )}

      </div>


      {/* =====================================================
          ADMIN BOTTOM NAVIGATION
      ===================================================== */}

      <nav
        style={{
          position:
            'fixed',

          left: 0,

          right: 0,

          bottom: 0,

          height: 74,

          background:
          '#ff1111',

          display:
            'flex',

          justifyContent:
            'center',

          zIndex: 3000,

          boxShadow:
            '0 -2px 10px rgba(0,0,0,0.12)',
        }}
      >

        <div
          style={{
            width: '100%',

            maxWidth: 2000,

            display: 'grid',

            gridTemplateColumns:
              'repeat(5, 1fr)',

            alignItems:
              'stretch',
          }}
        >

          {/* =================================================
              HOME
          ================================================= */}

          <Link
            to="/admin"
            style={{
              textDecoration:
                'none',

              color: '#fff',

              display:
                'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 4,

              fontSize: 11,

              fontWeight: 600,

              transition:
                'background 0.2s',
            }}
          >

            <HomeIcon
              size={26}
            />

            <span>
              หน้าหลัก
            </span>

          </Link>


          {/* =================================================
              SALES HISTORY - ACTIVE
          ================================================= */}

          <Link
            to="/admin/sales"
            style={{
              textDecoration:
                'none',

              color: '#fff',

              display:
                'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 4,

              fontSize: 11,

              fontWeight: 700,

              background:
                'rgba(255,255,255,0.20)',

              borderRadius:
                '12px 12px 0 0',

              marginTop: 4,
            }}
          >

            <ReceiptIcon
              size={27}
            />

            <span>
              ประวัติการขาย
            </span>

          </Link>


          {/* =================================================
              PRODUCTS
          ================================================= */}

          <Link
            to="/admin/products"
            style={{
              textDecoration:
                'none',

              color: '#fff',

              display:
                'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 4,

              fontSize: 11,

              fontWeight: 600,
            }}
          >

            <ShoppingBagIcon
              size={26}
            />

            <span>
              แก้ไขสินค้า
            </span>

          </Link>


          {/* =================================================
              PROMOTIONS
          ================================================= */}

          <Link
            to="/admin/promotions"
            style={{
              textDecoration:
                'none',

              color: '#fff',

              display:
                'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 4,

              fontSize: 11,

              fontWeight: 600,
            }}
          >

            <GiftIcon
              size={26}
            />

            <span>
              โปรโมชั่น
            </span>

          </Link>


          {/* =================================================
              BRANCHES
          ================================================= */}

          <Link
            to="/admin/branches"
            style={{
              textDecoration:
                'none',

              color: '#fff',

              display:
                'flex',

              flexDirection:
                'column',

              alignItems:
                'center',

              justifyContent:
                'center',

              gap: 4,

              fontSize: 11,

              fontWeight: 600,
            }}
          >

            <BuildingIcon
              size={26}
            />

            <span>
              จัดการสาขา
            </span>

          </Link>

        </div>

      </nav>

    </div>
  )
}
