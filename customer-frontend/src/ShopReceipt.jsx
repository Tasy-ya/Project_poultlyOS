import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { shopApi, baht, sizeLabel, fmtDateTime } from './shopApi'

const methodLabel = m =>
  ({ qr: 'QR / PromptPay', cash: 'เงินสด', transfer: 'โอนเงิน', card: 'บัตร' })[m] || m || '-'

const fulfillLabel = s =>
  ({ new: 'ร้านรับออเดอร์แล้ว', preparing: 'กำลังเตรียมสินค้า', ready: 'พร้อมรับสินค้า', picked_up: 'รับสินค้าแล้ว' })[s] || 'ร้านรับออเดอร์แล้ว'

const reserveLabel = s =>
  ({ confirmed: 'จองสำเร็จ (ชำระมัดจำแล้ว)', ready: 'สินค้าพร้อมให้รับ', completed: 'รับสินค้าและชำระครบแล้ว', cancelled: 'ยกเลิกการจอง' })[s] || s

export default function ShopReceipt() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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

    // อัปเดตสถานะอัตโนมัติทุก 20 วินาที (เช่น "พร้อมรับสินค้า")
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

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
              {isOrder ? fulfillLabel(data.fulfillmentStatus) : reserveLabel(data.status)}
            </span>
          </div>

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
                {!isOrder && (
                  <tr>
                    <td>นัดรับสินค้า</td>
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

                {!isOrder && data.status !== 'cancelled' && (
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

          <div className="no-print" style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <button className="btn-primary" onClick={() => window.print()}>
              พิมพ์ / บันทึกเป็น PDF
            </button>

            <button className="btn-outline" onClick={copyLink}>
              {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ใบเสร็จ'}
            </button>

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
