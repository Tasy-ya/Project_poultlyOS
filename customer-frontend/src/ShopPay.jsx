import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { shopApi, baht, shrinkImage } from './shopApi'
import { promptPayPayload, maskPromptPayId } from './promptpay'
import { qrSvgPath } from './qr'
import { IconSlip, IconCheck } from './Icons'

// สถานะที่ถือว่า "ร้านยืนยันเงินเข้าแล้ว"
const PAID = new Set(['completed', 'confirmed', 'ready'])

// แปลง QR (SVG) เป็นรูป PNG เพื่อให้ลูกค้าบันทึกไปเลือกสแกนจากแอปธนาคาร
function downloadQrPng(path, size, fileName) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`

  const img = new Image()

  img.onload = () => {
    const px = 900
    const canvas = document.createElement('canvas')
    canvas.width = px
    canvas.height = px

    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, px, px)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0, px, px)

    canvas.toBlob(blob => {
      if (!blob) return

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export default function ShopPay() {
  const { token } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [cfg, setCfg] = useState(null)
  const [error, setError] = useState('')
  const [slipBusy, setSlipBusy] = useState(false)
  const [slipMsg, setSlipMsg] = useState('')
  const [preview, setPreview] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    shopApi.config().then(setCfg).catch(e => setError(e.message))
  }, [])

  const load = useCallback(() => {
    shopApi
      .receipt(token)
      .then(d => {
        setData(d)
        setError('')
      })
      .catch(e => setError(e.message))
  }, [token])

  useEffect(() => {
    load()

    // เช็กสถานะทุก 5 วินาที — เมื่อร้านยืนยันเงินเข้าจะพาไปหน้าใบเสร็จอัตโนมัติ
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (data && PAID.has(data.status)) {
      navigate(`/receipt/${token}`, { replace: true })
    }
  }, [data, navigate, token])

  const onPickSlip = async e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setSlipMsg('')
    setError('')

    if (!/^image\//.test(file.type)) {
      setError('กรุณาเลือกรูปภาพสลิป (JPG / PNG)')
      return
    }

    setSlipBusy(true)

    try {
      const blob = await shrinkImage(file)
      setPreview(URL.createObjectURL(blob))
      await shopApi.uploadSlip(token, blob)
      setSlipMsg('แนบสลิปเรียบร้อย — รอพนักงานตรวจสลิปและรับออเดอร์')

      // ยังไม่พาไปหน้าสถานะ: ต้องรอพนักงานรับออเดอร์ก่อน (หน้านี้เช็กทุก 5 วินาทีและพาไปให้เอง)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSlipBusy(false)
    }
  }

  const isOrder = data?.type === 'order'

  // พนักงานตรวจสลิปและรับออเดอร์แล้ว (ลูกค้าถึงจะดูสถานะคำสั่งซื้อได้)
  const accepted = Boolean(data && data.slipUploaded && PAID.has(data.status))

  // สั่งซื้อเลย = ยอดเต็ม / จองล่วงหน้า = ยอดมัดจำ (ยอดมาจากเซิร์ฟเวอร์เสมอ)
  const amount = data ? (isOrder ? data.total : data.deposit) : 0

  const promptPayId = cfg?.promptPayId || ''

  const qr = useMemo(() => {
    if (!promptPayId || !(amount > 0)) return null

    try {
      return qrSvgPath(promptPayPayload(promptPayId, amount))
    } catch {
      return null
    }
  }, [promptPayId, amount])

  if (data && data.status === 'cancelled') {
    return <Navigate to={`/receipt/${token}`} replace />
  }

  const refNo = data ? (isOrder ? data.receiptNo : data.reservationNo) : ''

  return (
    <ShopLayout title="ชำระเงิน">
      {error && <div className="err">{error}</div>}
      {!data && !error && <p className="muted">กำลังโหลด...</p>}

      {data && (
        <>
          <div className="pay-amount">
            <div className="pay-amount-label">
              {isOrder ? 'ยอดที่ต้องชำระ' : 'ยอดมัดจำที่ต้องชำระ'}
            </div>
            <div className="pay-amount-value">{baht(amount)}</div>
            <div className="pay-amount-ref">
              {isOrder ? 'ออเดอร์' : 'การจอง'} {refNo}
            </div>
          </div>

          {qr ? (
            <div className="pay-qr-card">
              <div className="pay-qr-head">
                <span className="pay-qr-badge">PromptPay</span>
                <span>สแกนเพื่อชำระเงิน</span>
              </div>

              <svg
                className="pay-qr-svg"
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                shapeRendering="crispEdges"
                role="img"
                aria-label={`QR PromptPay ยอด ${amount} บาท`}
              >
                <rect width={qr.size} height={qr.size} fill="#fff" />
                <path d={qr.d} fill="#000" />
              </svg>

              <div className="pay-qr-account">
                {cfg?.promptPayName && <b>{cfg.promptPayName}</b>}
                <span>พร้อมเพย์ {maskPromptPayId(promptPayId)}</span>
              </div>

              <div className="pay-qr-amount">{baht(amount)}</div>
              <small>ยอดเงินถูกกำหนดไว้ใน QR แล้ว ไม่ต้องกรอกเอง</small>

              <button
                type="button"
                className="btn-outline pay-save"
                onClick={() => downloadQrPng(qr.d, qr.size, `qr-${refNo || 'pay'}.png`)}
              >
                บันทึกรูป QR ไว้สแกนจากแอปธนาคาร
              </button>
            </div>
          ) : (
            <div className="err">
              {!promptPayId
                ? 'ร้านยังไม่ได้ตั้งค่าบัญชี PromptPay จึงยังแสดง QR ไม่ได้ กรุณาติดต่อร้าน (เจ้าของร้าน: ใส่ PROMPTPAY_ID ในไฟล์ backend/.env แล้วรีสตาร์ต backend)'
                : 'สร้าง QR ไม่สำเร็จ กรุณาตรวจสอบ PromptPay ID ของร้าน'}
            </div>
          )}

          <ol className="pay-steps">
            <li>เปิดแอปธนาคาร แล้วสแกน QR (หรือเลือกรูป QR ที่บันทึกไว้)</li>
            <li>ตรวจสอบชื่อบัญชีและยอด <b>{baht(amount)}</b> ให้ตรง แล้วยืนยันโอน</li>
            <li><b>แนบสลิปโอนเงิน</b> ด้านล่าง — พนักงานตรวจสลิปและรับออเดอร์แล้ว คุณจึงจะดูสถานะคำสั่งซื้อได้</li>
          </ol>

          <div className="slip-box">
            <div className="slip-title">
              {data.slipUploaded ? <IconCheck size={20} /> : <IconSlip size={22} />}
              <span>{data.slipUploaded ? 'แนบสลิปแล้ว' : 'แนบสลิปโอนเงิน'}</span>
            </div>

            {preview && <img src={preview} alt="สลิปที่แนบ" className="slip-preview" />}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onPickSlip}
            />

            <button
              type="button"
              className={data.slipUploaded ? 'btn-outline' : 'btn-primary'}
              disabled={slipBusy}
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%' }}
            >
              {slipBusy ? 'กำลังส่งสลิป...' : data.slipUploaded ? 'เปลี่ยนรูปสลิป' : 'เลือกรูปสลิปจากเครื่อง'}
            </button>

            {slipMsg && <div className="note" style={{ marginTop: 8 }}>{slipMsg}</div>}
          </div>

          <div className="note">
            สถานะ:{' '}
            <b>
              {data.slipUploaded
                ? 'แนบสลิปแล้ว — รอพนักงานตรวจสลิปและรับออเดอร์'
                : 'รอลูกค้าโอนเงินและแนบสลิป'}
            </b>{' '}
            — เมื่อพนักงานรับออเดอร์แล้ว หน้านี้จะพาไปดูสถานะคำสั่งซื้อให้อัตโนมัติ
            ถ้าพนักงานไม่รับ ออเดอร์จะถูกยกเลิกพร้อมแจ้งเหตุผล
          </div>

          <div className="no-print" style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {/* ปุ่มดูสถานะจะขึ้นก็ต่อเมื่อแนบสลิปแล้วและพนักงานรับออเดอร์แล้วเท่านั้น */}
            {accepted && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate(`/receipt/${token}`)}
              >
                ดูสถานะคำสั่งซื้อ
              </button>
            )}

            <Link
              to="/"
              style={{ textAlign: 'center', color: 'var(--red)', fontWeight: 'bold' }}
            >
              กลับหน้าสั่งซื้อ
            </Link>
          </div>
        </>
      )}
    </ShopLayout>
  )
}
