import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { esc, printHtml } from '../printUtil'
import {
  baht,
  linePrice,
  PAY_LABEL,
  clearCart,
  clearPendingOrder,
} from '../api'

// =====================================================
// ไอคอนเครื่องพิมพ์
// =====================================================
function PrinterIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* ตัวเครื่องพิมพ์ */}
      <path
        d="M6 9V4H18V9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* กระดาษ */}
      <path
        d="M7 17H5C3.9 17 3 16.1 3 15V10C3 8.9 3.9 8 5 8H19C20.1 8 21 8.9 21 10V15C21 16.1 20.1 17 19 17H17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* กระดาษที่พิมพ์ออก */}
      <path
        d="M7 14H17V21H7V14Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* จุดสถานะเครื่องพิมพ์ */}
      <circle
        cx="18"
        cy="11"
        r="1"
        fill="currentColor"
      />
    </svg>
  )
}

export default function ReceiptPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  // =====================================================
  // ตรวจสอบข้อมูลใบเสร็จ
  // =====================================================
  if (!state?.cart?.length) {
    return (
      <Layout title="ใบเสร็จ" back={false}>

        <div className="receipt-box">
          <h3
            style={{
              textAlign: 'center',
            }}
          >
            ไม่พบข้อมูลใบเสร็จ
          </h3>

          <p
            style={{
              textAlign: 'center',
            }}
          >
            กรุณากลับไปทำรายการใหม่
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => navigate('/sell')}
        >
          กลับไปหน้าขาย
        </button>

      </Layout>
    )
  }

  const cart = state.cart
  const order = state.order || {}

  // =====================================================
  // ยอดรวม
  // ใช้ยอดจาก Backend ก่อน
  // =====================================================
  const total = Number(
    order.totalAmount ??
      state.total ??
      cart.reduce(
        (sum, item) =>
          sum + linePrice(item),
        0
      )
  )

  // =====================================================
  // เลขที่ใบเสร็จ
  // =====================================================
  const receiptNo =
    order.receiptNo ||
    state.receiptNo ||
    `R${Date.now()
      .toString()
      .slice(-6)}`

  // =====================================================
  // วันที่
  // =====================================================
  const createdAt = order.createdAt
    ? new Date(order.createdAt)
    : new Date()

  // =====================================================
  // วิธีชำระเงิน
  // =====================================================
  const paymentMethod =
    PAY_LABEL[state.method] ||
    state.method ||
    'เงินสด'

  // =====================================================
  // ออเดอร์ใหม่
  // =====================================================
  const newOrder = () => {
    clearCart()
    clearPendingOrder()

    navigate('/sell', {
      replace: true,
    })
  }

  // =====================================================
  // พิมพ์ใบเสร็จ
  // =====================================================
  const printReceipt = () => {
    const rows = cart
      .map(item => {
        const size =
          item.size === 'half' ? 'ครึ่งตัว' : 'เต็มตัว'

        return `<div class="row"><span>${esc(item.name)} <span class="sm">${size} x${Number(item.qty || 0)}</span></span><span>${baht(linePrice(item))}</span></div>`
      })
      .join('')

    printHtml(
      'ใบเสร็จ',
      `<h2>PoultryOS</h2>
       <div class="c">ใบเสร็จรับเงิน</div>
       ${state.pending ? '<div class="c sm">(ใบเสร็จชั่วคราว - รอซิงค์ระบบ)</div>' : ''}
       <div class="line"></div>
       <div class="row"><span>เลขที่</span><span>${esc(receiptNo)}</span></div>
       <div class="row"><span>วันที่</span><span>${esc(createdAt.toLocaleString('th-TH'))}</span></div>
       <div class="line"></div>
       ${rows}
       <div class="line"></div>
       <div class="row b"><span>ยอดรวม</span><span>${baht(total)}</span></div>
       <div class="row"><span>ชำระโดย</span><span>${esc(paymentMethod)}</span></div>
       <div class="line"></div>
       <div class="c">ขอบคุณที่อุดหนุน</div>`
    )
  }

  return (
    <Layout
      title="ใบเสร็จ"
      back={false}
    >

      {/* =================================================
          ใบเสร็จ
      ================================================= */}
      <div
        className="receipt-box"
        id="receipt-print"
      >
        {state.slipUploaded && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#f5f7fa', fontSize: 13 }}>
            <b>บันทึกสลิปพร้อมออเดอร์แล้ว</b>
            <div>รหัสออเดอร์: {state.slipOrderId}</div>
            {state.slipAi ? (
              <div style={{ marginTop: 5, color: state.slipAi.verdict === 'pass' ? '#218838' : state.slipAi.verdict === 'fail' ? '#b91c1c' : '#946200' }}>
                {state.slipAi.verdict === 'pass' ? 'AI ผ่านการตรวจเบื้องต้น' : state.slipAi.verdict === 'fail' ? 'AI พบความผิดปกติ กรุณาตรวจสอบ' : 'AI แนะนำให้ตรวจสลิปด้วยตนเอง'}
              </div>
            ) : (
              <div style={{ marginTop: 5, color: '#946200' }}>{state.slipAiError || 'ยังไม่มีผลตรวจจาก AI กรุณาตรวจสอบด้วยตนเอง'}</div>
            )}
            <div>AI เป็นตัวช่วยคัดกรอง ไม่ใช่หลักฐานยืนยันว่าเงินเข้าบัญชีแล้ว</div>
          </div>
        )}
        {state.pending && (
          <div
            style={{
              marginBottom: 12,
              padding: '8px 10px',
              borderRadius: 8,
              background: '#fff4e0',
              color: '#a35c00',
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            บันทึกออฟไลน์ — เลขที่ใบเสร็จนี้เป็นชั่วคราว
            ระบบจะบันทึกและตัดสต็อกให้เมื่อมีเน็ต
          </div>
        )}

        {/* =================================================
            หัวใบเสร็จ
        ================================================= */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              margin: 0,
            }}
          >
            PoultryOS
          </h2>

          <div
            style={{
              marginTop: 5,
            }}
          >
            ใบเสร็จรับเงิน
          </div>
        </div>

        {/* =================================================
            ข้อมูลใบเสร็จ
        ================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6,
            gap: 10,
          }}
        >
          <span>
            เลขที่ใบเสร็จ
          </span>

          <b>
            {receiptNo}
          </b>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 12,
            gap: 10,
          }}
        >
          <span>
            วันที่
          </span>

          <span>
            {createdAt.toLocaleString(
              'th-TH'
            )}
          </span>
        </div>

        <div className="divider" />

        {/* =================================================
            รายการสินค้า
        ================================================= */}
        <h4
          style={{
            marginBottom: 10,
          }}
        >
          รายการสินค้า
        </h4>

        {cart.map((item, index) => {
          const qty =
            Number(item.qty || 0)

          const price =
            linePrice(item)

          return (
            <div
              key={`${item.menuId || item.id}-${index}`}
              style={{
                padding: '10px 0',
                borderBottom:
                  '1px solid #eee',
              }}
            >

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  gap: 10,
                }}
              >

                {/* ข้อมูลสินค้า */}
                <div>
                  <b>
                    {item.name}
                  </b>

                  <div
                    style={{
                      fontSize: 13,
                      color: '#666',
                      marginTop: 3,
                    }}
                  >
                    {item.size === 'half'
                      ? 'ครึ่งตัว'
                      : 'เต็มตัว'}

                    {' × '}

                    {qty}
                  </div>
                </div>

                {/* ราคา */}
                <b>
                  {baht(price)}
                </b>

              </div>

            </div>
          )
        })}

        <div className="divider" />

        {/* =================================================
            ยอดรวม
        ================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            fontSize: 20,
            marginTop: 10,
          }}
        >
          <b>
            ยอดรวม
          </b>

          <b>
            {baht(total)}
          </b>
        </div>

        {/* =================================================
            วิธีชำระเงิน
        ================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            marginTop: 12,
          }}
        >
          <span>
            วิธีชำระเงิน
          </span>

          <b>
            {paymentMethod}
          </b>
        </div>

        {/* =================================================
            ข้อความท้ายใบเสร็จ
        ================================================= */}
        <div
          style={{
            textAlign: 'center',
            marginTop: 25,
            fontSize: 13,
            color: '#666',
          }}
        >
          ขอบคุณที่ใช้บริการ PoultryOS
        </div>

      </div>

      {/* =================================================
          ปุ่มพิมพ์ใบเสร็จ
      ================================================= */}
      <button
        className="btn-primary"
        onClick={printReceipt}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <PrinterIcon />
        <span>
          พิมพ์ใบเสร็จ
        </span>
      </button>

      {/* =================================================
          ออเดอร์ใหม่
      ================================================= */}
      <button
        className="btn-outline"
        style={{
          width: '100%',
          marginTop: 10,
        }}
        onClick={newOrder}
      >
        ออเดอร์ใหม่
      </button>

    </Layout>
  )
}