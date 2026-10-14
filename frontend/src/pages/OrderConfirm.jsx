import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  baht,
  linePrice,
  loadPendingOrder,
  savePendingOrder,
} from '../api'

export default function OrderConfirm() {
  const location = useLocation()
  const navigate = useNavigate()

  const order =
    location.state?.cart?.length
      ? location.state
      : loadPendingOrder()

  // =====================================================
  // ไม่มีรายการ
  // =====================================================
  if (!order?.cart?.length) {
    return (
      <Layout title="รอการยืนยันออเดอร์">
        <div className="receipt-box">
          <p style={{ textAlign: 'center' }}>
            ไม่มีรายการออเดอร์
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => navigate('/sell')}
        >
          กลับไปสั่งใหม่
        </button>
      </Layout>
    )
  }

  const cart = order.cart

  const total = cart.reduce(
    (sum, item) =>
      sum + linePrice(item),
    0
  )

  const totalQty = cart.reduce(
    (sum, item) =>
      sum + Number(item.qty || 0),
    0
  )

  // =====================================================
  // กลับไปสั่งสินค้าใหม่
  // =====================================================
  const goBackToSell = () => {
    navigate('/sell')
  }

  // =====================================================
  // ยืนยันออเดอร์
  //
  // ตอนนี้ให้จำลองว่าออเดอร์ได้รับการยืนยันแล้ว
  // แล้วจึงไปหน้าชำระเงิน
  // =====================================================
  const confirmOrder = () => {
    const nextOrder = {
      ...order,
      cart,
      total,
      totalQty,
      status: 'confirmed',
    }

    savePendingOrder(nextOrder)

    navigate('/payment', {
      state: nextOrder,
    })
  }

  return (
    <Layout title="รอการยืนยันออเดอร์">

      {/* =================================================
          สถานะออเดอร์
      ================================================= */}
      <div
        style={{
          background: '#fff8e8',
          borderRadius: 16,
          padding: 18,
          marginBottom: 15,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 38,
            marginBottom: 8,
          }}
        >
          🧾
        </div>

        <h3
          style={{
            margin: '0 0 6px',
          }}
        >
          รอการยืนยันออเดอร์
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: '#666',
          }}
        >
          กรุณาตรวจสอบรายการก่อนยืนยัน
        </p>
      </div>

      {/* =================================================
          รายการออเดอร์
      ================================================= */}
      <div className="receipt-box">

        <h3
          style={{
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          รายการออเดอร์
        </h3>

        {cart.map((item, index) => (
          <div
            key={`${item.menuId || item.id}-${index}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 0',
              borderBottom:
                '1px solid #eee',
            }}
          >

            {/* ข้อมูลสินค้า */}
            <div
              style={{
                flex: 1,
              }}
            >
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

                {item.qty}
              </div>
            </div>

            {/* ราคา */}
            <b>
              {baht(
                linePrice(item)
              )}
            </b>

          </div>
        ))}

        {/* =================================================
            จำนวนรวม
        ================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 15,
            fontSize: 15,
          }}
        >
          <span>
            จำนวนทั้งหมด
          </span>

          <b>
            {totalQty} รายการ
          </b>
        </div>

        {/* =================================================
            ยอดรวม
        ================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTop:
              '2px solid #eee',
            fontSize: 20,
          }}
        >
          <b>
            ยอดรวม
          </b>

          <b>
            {baht(total)}
          </b>
        </div>

      </div>

      {/* =================================================
          ปุ่มยืนยัน
      ================================================= */}
      <button
        className="btn-primary"
        onClick={confirmOrder}
        style={{
          width: '100%',
          marginTop: 15,
        }}
      >
        ยืนยันออเดอร์
      </button>

      {/* =================================================
          ปุ่มกลับไปสั่งใหม่
      ================================================= */}
      <button
        className="btn-outline"
        onClick={goBackToSell}
        style={{
          width: '100%',
          marginTop: 10,
        }}
      >
        กลับไปสั่งใหม่
      </button>

    </Layout>
  )
}