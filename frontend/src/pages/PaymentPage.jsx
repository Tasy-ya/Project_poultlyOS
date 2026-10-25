import { useEffect, useRef, useState } from 'react'
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
import { promptPayPayload, maskPromptPayId } from '../payment/promptpay'
import { qrSvgPath } from '../payment/qr'

const paymentMethods = [
  ['cash', 'เงินสด'],
  ['qr', 'QR Code'],
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
  const [paymentConfig, setPaymentConfig] = useState(null)
  const [slipFile, setSlipFile] = useState(null)
  const [slipPreview, setSlipPreview] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const cameraRef = useRef(null)
  // รหัสกันบันทึกซ้ำ: ใช้รหัสเดิมทุกครั้งที่กดยืนยันซ้ำในหน้านี้
  const localIdRef = useRef(newLocalId())

  useEffect(() => {
    api.getPaymentConfig()
      .then(setPaymentConfig)
      .catch(err => console.error('โหลดข้อมูล PromptPay ไม่สำเร็จ:', err))
  }, [])

  useEffect(() => () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview)
  }, [slipPreview])

  // ผูกภาพจากกล้องเข้ากับ <video> หลังจาก video แสดงขึ้นมาแล้ว
  // ถ้า 5 วินาทียังไม่มีภาพ ให้ปิดแล้วใช้กล้องเครื่องแทน
  useEffect(() => {
    if (!cameraOpen) return undefined
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return undefined
    video.srcObject = stream
    video.play?.().catch(() => {})
    const timer = setTimeout(() => {
      if (!video.videoWidth) {
        streamRef.current?.getTracks?.().forEach(track => track.stop())
        streamRef.current = null
        setCameraOpen(false)
        setError('กล้องในระบบไม่ส่งภาพ — กดปุ่ม "ถ่ายด้วยกล้องเครื่อง" ด้านล่างแทน')
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [cameraOpen])

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
  const subtotal = cart.reduce(
    (sum, item) => sum + Number(linePrice(item) || 0),
    0
  )
  const total = Number.isFinite(Number(source.total))
    ? Number(source.total)
    : subtotal
  const discount = Math.max(0, subtotal - total)
  const promptPayId = paymentConfig?.promptPayId || ''
  const bankTransferSelected = method === 'qr'
  const qr = (() => {
    if (!promptPayId || !(total > 0)) return null
    try { return qrSvgPath(promptPayPayload(promptPayId, total)) }
    catch { return null }
  })()

  // เบราว์เซอร์ในแอป (Messenger / Facebook / LINE / Instagram) เปิดกล้องผ่านเว็บไม่ได้
  // จึงเปิดกล้องของเครื่องแทน (ถ่ายแล้วได้ภาพกลับมาเหมือนกัน)
  const isInAppBrowser = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\//i.test(navigator.userAgent || '')

  const openNativeCamera = () => cameraRef.current?.click()

  const openCamera = async () => {
    setError('')
    if (isInAppBrowser || !navigator.mediaDevices?.getUserMedia) {
      openNativeCamera()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      setCameraOpen(true)
    } catch (err) {
      setError(`${err.message || 'เปิดกล้องไม่ได้'} — กดปุ่ม "ถ่ายด้วยกล้องเครื่อง" ด้านล่างแทน`)
    }
  }

  const closeCamera = () => {
    streamRef.current?.getTracks?.().forEach(track => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const takePhoto = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('กล้องยังไม่พร้อม กรุณารอสักครู่แล้วลองใหม่')
      return
    }
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
    if (!blob) {
      setError('ถ่ายภาพไม่สำเร็จ กรุณาลองอีกครั้ง')
      return
    }
    setSlipFile(blob)
    setSlipPreview(URL.createObjectURL(blob))
    setAiResult(null)
    setError('')
    closeCamera()
  }

  const onCaptureSlip = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError('กรุณาถ่ายภาพสลิปเป็น JPG, PNG หรือ WebP')
      return
    }
    setError('')
    try {
      // ลดขนาดภาพเพื่อส่งเข้าระบบได้เร็วขึ้น โดยยังอ่านข้อมูลบนสลิปได้
      const image = await createImageBitmap(file)
      const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      image.close?.()
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86))
      if (!blob) throw new Error('อ่านภาพสลิปไม่สำเร็จ กรุณาถ่ายใหม่')
      setSlipFile(blob)
      setSlipPreview(URL.createObjectURL(blob))
      setAiResult(null)
    } catch (err) {
      setError(err.message || 'อ่านภาพสลิปไม่สำเร็จ')
    }
  }

  const staff = getStaff()

  // -----------------------------------------------------
  // ยืนยันการชำระเงิน
  // -----------------------------------------------------
  const confirmPayment = async () => {

    if (loading) return

    setError('')
    if (bankTransferSelected && !slipFile) {
      setError('กรุณากดถ่ายสลิปจากกล้อง แล้วกดส่งยืนยัน')
      return
    }
    if (bankTransferSelected && !paymentConfig?.promptPayId) {
      setError('ร้านยังไม่ได้ตั้งค่า PromptPay กรุณาติดต่อเจ้าของร้านก่อนรับโอน')
      return
    }
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
      subtotal,
      discount,
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

      if (bankTransferSelected && outcome.status !== 'saved') {
        throw new Error('ไม่สามารถบันทึกการโอนเงินขณะออฟไลน์ได้ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วส่งยืนยันอีกครั้ง')
      }

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

        if (bankTransferSelected) {
          const orderId = Number(result?.order?.id || result?.id || 0)
          if (!orderId) throw new Error('บันทึกออเดอร์แล้วแต่ไม่พบรหัสออเดอร์ จึงยังแนบสลิปไม่ได้')
          await api.uploadStaffOrderSlip(orderId, slipFile)
          receiptState.slipUploaded = true
          receiptState.slipOrderId = orderId
          try {
            const checked = await api.checkStaffOrderSlip(orderId)
            receiptState.slipAi = checked
            setAiResult(checked)
          } catch (aiError) {
            // เก็บสลิปไว้แล้ว แม้ AI ใช้งานไม่ได้ก็ไม่ทำให้ข้อมูลสลิปหาย
            receiptState.slipAiError = aiError.message || 'AI ตรวจสลิปไม่สำเร็จ ต้องตรวจด้วยตนเอง'
          }
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

        {bankTransferSelected && (
          <div style={{ marginTop: 18, padding: 14, border: '1px solid #eee', borderRadius: 12, textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>สแกน QR เพื่อโอนเงิน</h3>
            {qr ? (
              <>
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={`QR PromptPay ${total} บาท`} style={{ width: 'min(78vw, 280px)', height: 'auto', background: '#fff', padding: 8 }} shapeRendering="crispEdges">
                  <rect width={qr.size} height={qr.size} fill="#fff" />
                  <path d={qr.d} fill="#000" />
                </svg>
                {paymentConfig?.promptPayName && <div><b>{paymentConfig.promptPayName}</b></div>}
                <div>พร้อมเพย์ {maskPromptPayId(promptPayId)}</div>
                <div style={{ color: '#e9231b', fontWeight: 800, fontSize: 24, margin: '8px 0' }}>{baht(total)}</div>
                <small>QR นี้กำหนดยอดสุทธิหลังหักส่วนลดแล้ว</small>
              </>
            ) : (
              <p style={{ color: '#b91c1c' }}>ยังสร้าง QR ไม่ได้ กรุณาตรวจสอบการตั้งค่า PromptPay ใน backend/.env</p>
            )}

            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>ถ่ายสลิปผ่านกล้องในระบบ</label>
              {!cameraOpen && (
                <button type="button" className="btn-primary" onClick={openCamera} disabled={loading} style={{ width: '100%' }}>
                   เปิดกล้องเพื่อถ่ายสลิป
                </button>
              )}
              {cameraOpen && (
                <div style={{ marginTop: 10 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 360, objectFit: 'contain', background: '#111', borderRadius: 8 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                    <button type="button" className="btn-primary" onClick={takePhoto}>ถ่ายภาพสลิป</button>
                    <button type="button" className="btn-outline" onClick={closeCamera}>ปิดกล้อง</button>
                  </div>
                </div>
              )}
              <label className="btn-outline" style={{ display: 'block', width: '100%', marginTop: 8, textAlign: 'center', boxSizing: 'border-box', cursor: 'pointer' }}>
                 ถ่ายด้วยกล้องเครื่อง / เลือกรูปสลิป
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onCaptureSlip}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>
              {slipPreview && (
                <div style={{ marginTop: 10 }}>
                  <img src={slipPreview} alt="ภาพสลิปที่ถ่าย" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', border: '1px solid #ddd', borderRadius: 8 }} />
                  <p style={{ color: '#218838', fontSize: 13, marginBottom: 0 }}>ถ่ายสลิปแล้ว พร้อมกดส่งยืนยัน</p>
                </div>
              )}
              {aiResult && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: aiResult.verdict === 'pass' ? '#e6f6ea' : aiResult.verdict === 'fail' ? '#fde8e8' : '#fff6dd' }}>
                  <b>{aiResult.verdict === 'pass' ? 'AI: ผ่านการตรวจเบื้องต้น' : aiResult.verdict === 'fail' ? 'AI: พบความผิดปกติ' : 'AI: ต้องตรวจสอบเพิ่มเติม'}</b>
                  <div style={{ fontSize: 13, marginTop: 4 }}>บันทึกผลตรวจสลิปไว้กับออเดอร์แล้ว กรุณาตรวจสอบเงินเข้าในแอปธนาคารก่อนยืนยันขั้นสุดท้าย</div>
                </div>
              )}
            </div>
          </div>
        )}

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
          ? (bankTransferSelected ? 'กำลังส่งสลิปและตรวจสอบ...' : 'กำลังบันทึกออเดอร์...')
          : (bankTransferSelected ? 'ส่งสลิปยืนยันและบันทึกออเดอร์' : 'ชำระเงินเรียบร้อย')}
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