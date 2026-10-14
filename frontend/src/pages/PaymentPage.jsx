import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { newLocalId, submitOrder } from '../offline'
import {
  api,
  baht,
  linePrice,
  getStaff,
  getSelectedBranchId,
  loadPendingOrder,
  saveCart,
} from '../api'

const paymentMethods = [
  ['cash', 'เงินสด'],
  ['qr', 'QR Code'],
  ['transfer', 'โอนเงิน'],
  ['card', 'บัตร'],
]

export default function PaymentPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const saved = loadPendingOrder()

  const source =
    location.state?.cart?.length
      ? location.state
      : saved

  const [method, setMethod] = useState('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // รหัสกันบันทึกซ้ำ: ใช้รหัสเดิมทุกครั้งที่กดยืนยันซ้ำในหน้านี้
  const localIdRef = useRef(newLocalId())

  // -----------------------------------------------------
  // ไม่มีออเดอร์
  // -----------------------------------------------------
  if (!source?.cart?.length) {
    return (
      <Layout title="ชำระเงิน">

        <div className="receipt-box">
          <p style={{ textAlign: 'center' }}>
            ไม่มีข้อมูลออเดอร์
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

  const cart = source.cart

  // -----------------------------------------------------
  // คำนวณยอดรวม
  // -----------------------------------------------------
  const total = cart.reduce(
    (sum, item) =>
      sum + Number(linePrice(item) || 0),
    0
  )

  const staff = getStaff()

  // -----------------------------------------------------
  // ยืนยันการชำระเงิน
  // -----------------------------------------------------
  const confirmPayment = async () => {

    if (loading) return

    setError('')
    setLoading(true)

    const receiptNo =
      `R${Date.now().toString().slice(-6)}`

    const createdAt =
      new Date().toISOString()

    // ---------------------------------------------------
    // ข้อมูลเริ่มต้นสำหรับใบเสร็จ
    // ---------------------------------------------------
    const receiptState = {
      cart,
      total,
      method,
      receiptNo,
      order: {
        receiptNo,
        totalAmount: total,
        createdAt,
      },
    }

    // ---------------------------------------------------
    // ถ้ามีพนักงาน + สาขา
    // บันทึกออเดอร์ลง Backend
    // ---------------------------------------------------
    // สาขาที่เลือกไว้ที่หน้าขาย (ถ้าไม่มีใช้สาขาของพนักงาน)
    const orderBranchId = Number(
      getSelectedBranchId() || staff?.branchId
    )

    if (!orderBranchId) {
      setLoading(false)
      setError('ไม่พบสาขาที่ใช้งาน กรุณาเลือกสาขาที่หน้าแรกก่อน')
      return
    }

    const items = cart.map((item) => ({
      menuId: Number(item.menuId || item.id),
      size: item.size === 'half' ? 'half' : 'full',
      qty: Number(item.qty || 0),
    }))

    // ตรวจสอบข้อมูลก่อนส่ง
    const invalid = items.some(
      (item) =>
        !Number.isInteger(item.menuId) ||
        item.menuId <= 0 ||
        !Number.isInteger(item.qty) ||
        item.qty <= 0
    )

    if (invalid) {
      setLoading(false)
      setError('ข้อมูลสินค้าไม่ถูกต้อง')
      return
    }

    try {
      // ส่งออเดอร์ไป Backend
      // - สำเร็จ              -> status 'saved'
      // - เน็ตหลุด/ช้าเกินไป  -> เก็บในเครื่อง status 'queued' (ซิงค์ทีหลัง)
      // - backend ปฏิเสธ      -> throw (อยู่หน้านี้ ตะกร้ายังอยู่ ไม่ออกใบเสร็จ)
      const outcome = await submitOrder({
        branchId: orderBranchId,
        items,
        payments: [
          {
            method,
            amount: Number(total),
          },
        ],
        localId: localIdRef.current,
        clientCreatedAt: createdAt,
      })

      if (outcome.status === 'saved') {
        const result = outcome.result

        const finalReceiptNo =
          result?.receiptNo ||
          result?.order?.receiptNo ||
          receiptNo

        const finalTotal = Number(
          result?.total ??
            result?.order?.totalAmount ??
            total
        )

        receiptState.receiptNo = finalReceiptNo
        receiptState.total = finalTotal
        receiptState.order = {
          ...(result?.order || {}),
          receiptNo: finalReceiptNo,
          totalAmount: finalTotal,
          createdAt: result?.order?.createdAt || createdAt,
        }
      } else {
        // ออฟไลน์: ใบเสร็จชั่วคราว (เลขจริงจะออกตอนซิงค์)
        const tempNo = `OFF-${outcome.localId
          .slice(0, 6)
          .toUpperCase()}`

        receiptState.pending = true
        receiptState.receiptNo = tempNo
        receiptState.order = {
          receiptNo: tempNo,
          totalAmount: total,
          createdAt: outcome.createdAt,
        }
      }

      // ล้างตะกร้าหลังบันทึกแล้ว (หรือเก็บเข้าคิวออฟไลน์แล้ว)
      saveCart([])
    } catch (e) {
      console.error('บันทึกออเดอร์ไม่สำเร็จ:', e)

      setLoading(false)
      setError(
        e?.message ||
          'บันทึกออเดอร์ไม่สำเร็จ กรุณาลองใหม่'
      )

      return
    }

    // ---------------------------------------------------
    // ไปหน้าใบเสร็จ
    // ---------------------------------------------------
    console.log(
      'กำลังไปหน้าใบเสร็จ',
      receiptState
    )

    setLoading(false)

    navigate(
      '/receipt',
      {
        state: receiptState,
        replace: true,
      }
    )
  }

  // -----------------------------------------------------
  // หน้าชำระเงิน
  // -----------------------------------------------------
  return (
    <Layout title="ชำระเงิน">

      <div className="receipt-box">

        <h3
          style={{
            textAlign: 'center',
            marginTop: 0,
          }}
        >
          ยอดที่ต้องชำระ
        </h3>

        <div
          style={{
            textAlign: 'center',
            fontSize: 32,
            fontWeight: 'bold',
            marginBottom: 20,
          }}
        >
          {baht(total)}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              '1fr 1fr',
            gap: 10,
          }}
        >

          {paymentMethods.map(
            ([value, label]) => (

              <button
                key={value}
                type="button"
                className={
                  method === value
                    ? 'btn-primary'
                    : 'btn-outline'
                }
                onClick={() =>
                  setMethod(value)
                }
                disabled={loading}
              >
                {label}
              </button>

            )
          )}

        </div>

        <div
          style={{
            textAlign: 'center',
            marginTop: 15,
          }}
        >
          วิธีชำระเงิน:{' '}

          <b>
            {
              paymentMethods.find(
                ([value]) =>
                  value === method
              )?.[1]
            }
          </b>

        </div>

      </div>

      {error && (
        <div
          className="receipt-box"
          style={{
            color: '#c00',
            marginTop: 10,
            fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={loading}
        onClick={confirmPayment}
      >
        {loading
          ? 'กำลังบันทึกออเดอร์...'
          : 'ชำระเงินเรียบร้อย'}
      </button>

      <button
        type="button"
        className="btn-outline"
        style={{
          width: '100%',
          marginTop: 10,
        }}
        disabled={loading}
        onClick={() =>
          navigate(
            '/order-confirm',
            {
              state: source,
            }
          )
        }
      >
        กลับไปยืนยันออเดอร์
      </button>

    </Layout>
  )
}