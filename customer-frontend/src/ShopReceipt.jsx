import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { shopApi, baht, sizeLabel, fmtDateTime } from './shopApi'
import StatusTracker from './StatusTracker'
import { rememberOrder } from './myOrders'

const methodLabel = m =>
  ({ qr: 'QR / PromptPay', cash: 'เงินสด', transfer: 'โอนเงิน', card: 'บัตร' })[m] || m || '-'

const orderLabel = d =>
  d.status === 'cancelled'
    ? 'ออเดอร์ถูกยกเลิก'
    : d.status === 'pending_payment'
      ? d.slipUploaded
        ? 'แนบสลิปแล้ว รอพนักงานรับออเดอร์'
        : 'รอแนบสลิปโอนเงิน'
      : fulfillLabel(d.fulfillmentStatus, d.deliveryMethod)

const fulfillLabel = (s, method) =>
  ({
    new: 'ร้านรับออเดอร์แล้ว',
    preparing: 'กำลังเตรียมสินค้า',
    ready: method === 'delivery' ? 'พร้อมจัดส่ง' : 'พร้อมรับออเดอร์',
    picked_up: 'รับสินค้าแล้ว',
  })[s] || 'ร้านรับออเดอร์แล้ว'

const reserveLabel = s =>
  ({ pending_payment: 'รอแนบสลิป/รอร้านตรวจสอบมัดจำ', confirmed: 'จองสำเร็จ (ชำระมัดจำแล้ว)', ready: 'สินค้าพร้อมให้รับ', completed: 'รับสินค้าและชำระครบแล้ว', cancelled: 'ยกเลิกการจอง' })[s] || s

export default function ShopReceipt() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewMsg, setReviewMsg] = useState('')

  useEffect(() => {
    rememberOrder(token)
  }, [token])

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

    // อัปเดตสถานะอัตโนมัติ (เช่น "ร้านยืนยันเงินเข้าแล้ว", "พร้อมรับสินค้า")
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  const sendReview = async () => {
    if (rating < 1) {
      setReviewMsg('กรุณาเลือกจำนวนดาวก่อนส่งรีวิว')
      return
    }

    setReviewBusy(true)
    setReviewMsg('')

    try {
      await shopApi.review(token, { rating, comment })
      setReviewMsg('ขอบคุณสำหรับรีวิวค่ะ 💛')
      load()
    } catch (e) {
      setReviewMsg(e.message)
    } finally {
      setReviewBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('คัดลอกลิงก์ใบเสร็จ', window.location.href)
    }
  }

  const isOrder = data?.type === 'order'
  const isFinal = isOrder && data.status === 'completed'
  const isPending = data?.status === 'pending_payment'

  // ต้องแนบสลิปและให้พนักงานรับออเดอร์ก่อน ถึงจะดูหน้าสถานะคำสั่งซื้อได้
  if (isPending) {
    return <Navigate to={`/pay/${token}`} replace />
  }

  return (
    <ShopLayout title={isOrder ? 'ใบเสร็จรับเงิน' : 'ใบรับเงินมัดจำ'}>
      {error && <div className="err">{error}</div>}
      {!data && !error && <p className="muted">กำลังโหลด...</p>}

      {data && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <b style={{ fontSize: 18 }}>{data.shop?.name}</b>
            {data.shop?.address && <div className="muted">{data.shop.address}</div>}
            {data.shop?.taxId && <div className="muted">เลขประจำตัวผู้เสียภาษี {data.shop.taxId}</div>}
            {data.branch && (
              <div className="muted">
                สาขา {data.branch.name}
                {data.branch.phone ? ` · โทร ${data.branch.phone}` : ''}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '10px 0' }}>
            <span className={`pill ${data.status === 'cancelled' ? 'bad' : 'ok'}`}>
              {isOrder ? orderLabel(data) : reserveLabel(data.status)}
            </span>
          </div>

          {data.status === 'cancelled' && (
            <div className="err">
              <b>{isOrder ? 'ออเดอร์นี้ถูกยกเลิกโดยร้าน' : 'การจองนี้ถูกยกเลิก'}</b>
              {data.cancelReason && <div>เหตุผล: {data.cancelReason}</div>}
              <div>หากมีข้อสงสัย กรุณาติดต่อร้านตามเบอร์ด้านบน</div>
            </div>
          )}

          {isOrder && <StatusTracker data={data} />}

          <div className="receipt-box">
            <table>
              <tbody>
                <tr>
                  <td>{isOrder ? 'เลขที่ใบเสร็จ' : 'เลขที่การจอง'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <b>{isOrder ? data.receiptNo : data.reservationNo}</b>
                  </td>
                </tr>
                <tr>
                  <td>วันที่</td>
                  <td style={{ textAlign: 'right' }}>{fmtDateTime(data.createdAt)}</td>
                </tr>
                <tr>
                  <td>ลูกค้า</td>
                  <td style={{ textAlign: 'right' }}>
                    {data.customerName} · {data.customerPhone}
                  </td>
                </tr>
                {isOrder && data.pickupAt && (
                  <tr>
                    <td>เวลาที่ต้องการ</td>
                    <td style={{ textAlign: 'right' }}>{fmtDateTime(data.pickupAt)}</td>
                  </tr>
                )}
                <tr>
                  <td>วิธีรับสินค้า</td>
                  <td style={{ textAlign: 'right' }}>
                    {data.deliveryMethod === 'delivery' ? 'ส่งถึงที่' : 'รับที่ร้าน'}
                  </td>
                </tr>
                {data.deliveryMethod === 'delivery' && data.deliveryAddress && (
                  <tr>
                    <td>ที่อยู่จัดส่ง</td>
                    <td style={{ textAlign: 'right' }}>
                      {data.deliveryAddress}
                      {data.deliveryLat != null && data.deliveryLng != null && (
                        <div>
                          <a
                            href={`https://www.google.com/maps?q=${data.deliveryLat},${data.deliveryLng}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: 'var(--red)' }}
                          >
                            ดูหมุดใน Google Maps
                          </a>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {!isOrder && (
                  <tr>
                    <td>{data.deliveryMethod === 'delivery' ? 'นัดส่งสินค้า' : 'นัดรับสินค้า'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <b>{fmtDateTime(data.pickupAt)}</b>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="divider" />

            <table className="sum">
              <tbody>
                {data.items.map((i, idx) => (
                  <tr key={idx}>
                    <td>
                      {i.name}
                      {i.size === 'half' ? ` (${sizeLabel('half')})` : ''} × {i.qty}
                      {i.note && <div className="muted">📝 {i.note}</div>}
                    </td>
                    <td>{baht(i.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divider" />

            <table className="sum">
              <tbody>
                {isOrder && data.discount > 0 && (
                  <tr>
                    <td>ส่วนลด</td>
                    <td>-{baht(data.discount)}</td>
                  </tr>
                )}

                {data.deliveryMethod === 'delivery' && (
                  <tr>
                    <td>ค่าจัดส่ง</td>
                    <td>{data.deliveryFee > 0 ? baht(data.deliveryFee) : 'ฟรี'}</td>
                  </tr>
                )}

                <tr>
                  <td>
                    <b>ยอดรวม</b>
                  </td>
                  <td>
                    <b>{baht(data.total)}</b>
                  </td>
                </tr>

                {data.payments.map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      {!isOrder
                        ? { deposit: 'ชำระมัดจำ', balance: 'ชำระส่วนที่เหลือ', refund: 'คืนเงินมัดจำ' }[p.kind]
                        : 'ชำระเงิน'}{' '}
                      ({methodLabel(p.method)})
                    </td>
                    <td>{p.kind === 'refund' ? '-' : ''}{baht(p.amount)}</td>
                  </tr>
                ))}

                {!isOrder && data.status !== 'cancelled' && !isPending && (
                  <tr>
                    <td>
                      <b>{data.status === 'completed' ? 'คงเหลือ' : 'ชำระส่วนที่เหลือตอนรับสินค้า'}</b>
                    </td>
                    <td>
                      <b>{baht(data.balanceDue)}</b>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {data.note && (
              <>
                <div className="divider" />
                <div className="muted">หมายเหตุ: {data.note}</div>
              </>
            )}

            {data.cancelReason && (
              <>
                <div className="divider" />
                <div className="muted">เหตุผลที่ยกเลิก: {data.cancelReason}</div>
              </>
            )}
          </div>

          {!isOrder && data.status === 'confirmed' && (
            <div className="note">
              กรุณาแสดงเลขที่การจองหรือหน้านี้ตอนมารับสินค้า และชำระส่วนที่เหลือที่ร้าน
            </div>
          )}

          {isFinal && <div className="muted" style={{ textAlign: 'center' }}>ขอบคุณที่อุดหนุนค่ะ</div>}

          {isOrder && data.review && (
            <div className="review-box">
              <b>รีวิวของคุณ</b>
              <div className="stars done">{'★'.repeat(data.review.rating)}{'☆'.repeat(5 - data.review.rating)}</div>
              {data.review.comment && <div>{data.review.comment}</div>}
            </div>
          )}

          {isOrder && data.canReview && (
            <div className="review-box">
              <b>ให้คะแนนและรีวิวร้าน</b>
              <div className="muted">รสชาติเป็นอย่างไรบ้าง บอกเราได้เลย</div>
              <div className="stars" role="radiogroup" aria-label="ให้คะแนน">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    type="button"
                    key={n}
                    className={n <= rating ? 'on' : ''}
                    aria-label={`${n} ดาว`}
                    onClick={() => setRating(n)}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="เล่ารสชาติ ความอร่อย บริการ (ไม่บังคับ)"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
              <button type="button" className="btn-primary" disabled={reviewBusy} onClick={sendReview} style={{ width: '100%' }}>
                {reviewBusy ? 'กำลังส่ง...' : 'ส่งรีวิว'}
              </button>
              {reviewMsg && <div className="note" style={{ marginTop: 8 }}>{reviewMsg}</div>}
            </div>
          )}

          <div className="no-print" style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <button className="btn-primary" onClick={() => window.print()}>
              พิมพ์ / บันทึกเป็น PDF
            </button>

            <button className="btn-outline" onClick={copyLink}>
              {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ใบเสร็จ'}
            </button>

            <Link to="/orders" style={{ textAlign: 'center', color: 'var(--red)', fontWeight: 'bold' }}>
              ออเดอร์ของฉัน
            </Link>

            <Link to="/" style={{ textAlign: 'center', color: 'var(--red)', fontWeight: 'bold' }}>
              สั่งซื้อ/จองเพิ่ม
            </Link>

            <div className="muted" style={{ textAlign: 'center' }}>
              เก็บลิงก์นี้ไว้เพื่อดูใบเสร็จและสถานะย้อนหลัง
            </div>
          </div>
        </>
      )}
    </ShopLayout>
  )
}
