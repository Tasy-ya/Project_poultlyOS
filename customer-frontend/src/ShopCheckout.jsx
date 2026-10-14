import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { useShop } from './ShopContext'
import {
  shopApi,
  newLocalId,
  baht,
  sizeLabel,
  unitPrice,
  depositFor,
} from './shopApi'

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const DELIVERY_MIN_ITEMS = Number(import.meta.env.VITE_DELIVERY_MIN_ITEMS || 5)
const DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE || 30)
const PROMPTPAY_ID = (import.meta.env.VITE_PROMPTPAY_ID || '').replace(/\D/g, '')
const FACEBOOK_URL =
  import.meta.env.VITE_SHOP_FACEBOOK_URL ||
  'https://www.facebook.com/profile.php?id=100090386508496'
const FACEBOOK_LIVE_URL = import.meta.env.VITE_SHOP_FACEBOOK_LIVE_URL || ''

export default function ShopCheckout() {
  const navigate = useNavigate()
  const shop = useShop()
  const isReserve = shop.mode === 'reserve'

  const [cfg, setCfg] = useState(null)
  const [promotions, setPromotions] = useState([])
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pickupAt, setPickupAt] = useState('')
  const [note, setNote] = useState('')
  const [fulfillment, setFulfillment] = useState('pickup')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [newCustomer, setNewCustomer] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [qrError, setQrError] = useState(false)

  const localIdRef = useRef(newLocalId())
  const itemCount = shop.cart.reduce((sum, item) => sum + item.qty, 0)
  const canDeliver = itemCount >= DELIVERY_MIN_ITEMS && !isReserve
  const freeDelivery = fulfillment === 'delivery' && newCustomer
  const deliveryFee =
    fulfillment === 'delivery' && !freeDelivery ? DELIVERY_FEE : 0
  const grandTotal = shop.total + deliveryFee

  useEffect(() => {
    let mounted = true

    shopApi.config()
      .then((data) => {
        if (mounted) setCfg(data)
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'โหลดการตั้งค่าร้านไม่สำเร็จ')
      })

    shopApi.promotions(Number(shop.branchId))
      .then((data) => {
        if (mounted) setPromotions(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (mounted) setPromotions([])
      })

    return () => {
      mounted = false
    }
  }, [shop.branchId])

  useEffect(() => {
    if (!canDeliver && fulfillment === 'delivery') {
      setFulfillment('pickup')
    }
  }, [canDeliver, fulfillment])

  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, '')

    if (cleanPhone.length >= 9) {
      const known = localStorage.getItem(
        `poultryos_customer_seen_${cleanPhone}`
      )
      setNewCustomer(!known)
    }
  }, [phone])

  if (shop.cart.length === 0) {
    return <Navigate to="/" replace />
  }

  const deposit = cfg ? depositFor(grandTotal, cfg.depositPercent) : 0
  const payNow = isReserve ? deposit : grandTotal

  const minPickup = cfg
    ? toLocalInput(new Date(Date.now() + cfg.minLeadHours * 3600000))
    : ''

  const maxPickup = cfg
    ? toLocalInput(new Date(Date.now() + cfg.maxDaysAhead * 86400000))
    : ''

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        setLat(latitude)
        setLng(longitude)
        setAddress(`พิกัด ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
        setError('')
      },
      () => {
        setError('ไม่สามารถรับพิกัดได้ กรุณาอนุญาตตำแหน่งหรือกรอกที่อยู่เอง')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const submit = async () => {
    setError('')

    if (name.trim().length < 2) {
      setError('กรุณากรอกชื่อ')
      return
    }

    const cleanPhone = phone.replace(/\D/g, '')

    if (!/^0\d{8,9}$/.test(cleanPhone)) {
      setError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง')
      return
    }

    if (isReserve && !pickupAt) {
      setError('กรุณาเลือกวันและเวลารับสินค้า')
      return
    }

    if (
      fulfillment === 'delivery' &&
      (!canDeliver || !address.trim())
    ) {
      setError(
        `การจัดส่งต้องสั่งอย่างน้อย ${DELIVERY_MIN_ITEMS} ชิ้น และระบุที่อยู่`
      )
      return
    }

    if (!PROMPTPAY_ID) {
      setError('ร้านยังไม่ได้ตั้งค่า PromptPay ID จึงยังไม่สามารถแสดง QR สำหรับชำระเงินได้')
      return
    }

    setBusy(true)

    const items = shop.cart.map((item) => ({
      menuId: item.menuId,
      size: item.size,
      qty: item.qty,
    }))

    try {
      const common = {
        branchId: Number(shop.branchId),
        items,
        customerName: name.trim(),
        customerPhone: cleanPhone,
        localId: localIdRef.current,
        deliveryMethod: fulfillment,
        deliveryAddress:
          fulfillment === 'delivery' ? address.trim() : null,
        deliveryLat: lat,
        deliveryLng: lng,
        deliveryFee,
      }

      const result = isReserve
        ? await shopApi.createReservation({
            ...common,
            pickupAt: new Date(pickupAt).toISOString(),
            note,
          })
        : await shopApi.createOrder(common)

      if (!result?.receiptToken) {
        throw new Error('ระบบไม่ได้ส่งเลขอ้างอิงคำสั่งซื้อกลับมา กรุณาตรวจสอบกับร้านก่อนสั่งซ้ำ')
      }

      localStorage.setItem(
        `poultryos_customer_seen_${cleanPhone}`,
        '1'
      )

      shop.clear()
      navigate(`/receipt/${result.receiptToken}`, { replace: true })
    } catch (err) {
      setError(err.message || 'ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่')
      setBusy(false)
    }
  }

  const qrUrl = PROMPTPAY_ID
    ? `https://promptpay.io/${encodeURIComponent(PROMPTPAY_ID)}/${Math.max(1, Math.round(payNow))}.png`
    : ''

  const mapUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(import.meta.env.VITE_SHOP_ADDRESS || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')}`

  return (
    <ShopLayout
      title={isReserve ? 'จองล่วงหน้า' : 'ชำระเงิน'}
      back="/cart"
      footer={
        <button
          className="btn-primary"
          disabled={busy || !cfg}
          onClick={submit}
        >
          {busy
            ? 'กำลังดำเนินการ...'
            : isReserve
              ? `ดำเนินการจอง · ${baht(payNow)}`
              : `ส่งคำสั่งซื้อ · ${baht(payNow)}`}
        </button>
      }
    >
      <div className="receipt-box">
        <table className="sum">
          <tbody>
            {shop.cart.map((item) => (
              <tr key={`${item.menuId}-${item.size}`}>
                <td>
                  {item.name}{' '}
                  {item.hasHalfOption
                    ? `(${sizeLabel(item.size)})`
                    : ''}{' '}
                  × {item.qty}
                </td>
                <td>{baht(unitPrice(item) * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divider" />

        <div className="row">
          <b>ยอดสินค้า</b>
          <b>{baht(shop.total)}</b>
        </div>

        {fulfillment === 'delivery' && (
          <div className="row" style={{ marginTop: 8 }}>
            <span>ค่าจัดส่ง {freeDelivery ? '(ลูกค้าใหม่ ฟรี)' : ''}</span>
            <b>{deliveryFee ? baht(deliveryFee) : 'ฟรี'}</b>
          </div>
        )}

        <div className="divider" />

        <div className="row">
          <b>ยอดรวม</b>
          <b>{baht(grandTotal)}</b>
        </div>

        {isReserve && cfg && (
          <>
            <div className="row">
              <span>มัดจำ ({cfg.depositPercent}%)</span>
              <b>{baht(deposit)}</b>
            </div>
            <div className="row">
              <span>ยอดคงเหลือเมื่อรับสินค้า</span>
              <b>{baht(grandTotal - deposit)}</b>
            </div>
          </>
        )}
      </div>

      {/* โปรโมชั่นจากแอดมิน แสดงก่อนกรอกข้อมูลและชำระเงิน */}
      <section className="promotion-panel" aria-label="โปรโมชั่นร้าน">
        <h4>🎉 โปรโมชั่นและกิจกรรมของร้าน</h4>

        {promotions.length > 0 ? (
          <div className="promotion-list">
            {promotions.map((promotion) => (
              <article className="promotion-card" key={promotion.id}>
                <b>{promotion.name}</b>

                {promotion.description && (
                  <p>{promotion.description}</p>
                )}

                {promotion.minOrderAmount > 0 && (
                  <small>
                    เมื่อซื้อครบ {baht(promotion.minOrderAmount)}
                  </small>
                )}

                {promotion.type === 'giveaway' && (
                  <p>
                    🎁 กิจกรรมจับฉลาก ติดตามเงื่อนไขและไลฟ์ได้ที่ Facebook ร้าน
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">ขณะนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งาน</p>
        )}

        <p>
          <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
            ดูข่าวสารและกิจกรรมจับฉลากบน Facebook ร้าน
          </a>
        </p>

        {FACEBOOK_LIVE_URL && (
          <p>
            <a href={FACEBOOK_LIVE_URL} target="_blank" rel="noreferrer">
              🔴 เปิดดู Facebook Live
            </a>
          </p>
        )}
      </section>

      <h4>ข้อมูลผู้สั่ง</h4>

      <input
        placeholder="ชื่อ"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
      />

      <input
        placeholder="เบอร์โทรศัพท์"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        autoComplete="tel"
      />

      {!isReserve && (
        <>
          <h4>วิธีรับสินค้า</h4>

          <div className="seg">
            <button
              type="button"
              className={fulfillment === 'pickup' ? 'on' : ''}
              onClick={() => setFulfillment('pickup')}
            >
              <span className="fulfillment-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21V8l9-5 9 5v13" />
                  <path d="M7 21v-9h10v9" />
                  <path d="M3 8h18" />
                  <path d="M10 15h4" />
                </svg>
              </span>
              <span>รับที่ร้าน</span>
            </button>

            <button
              type="button"
              className={fulfillment === 'delivery' ? 'on' : ''}
              disabled={!canDeliver}
              onClick={() => setFulfillment('delivery')}
            >
              <span className="fulfillment-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5h12v12H2z" />
                  <path d="M14 9h4l4 4v4h-8z" />
                  <circle cx="6.5" cy="19" r="2" />
                  <circle cx="18" cy="19" r="2" />
                  <path d="M14 13h7" />
                </svg>
              </span>
              <span>
                ส่งถึงที่ {canDeliver ? '' : `(สั่ง ${DELIVERY_MIN_ITEMS} ชิ้นขึ้นไป)`}
              </span>
            </button>
          </div>

          {fulfillment === 'pickup' ? (
            <div className="note">
              รับสินค้าที่ร้านได้ตามเวลาทำการ{' '}
              <a href={mapUrl} target="_blank" rel="noreferrer">
                เปิดแผนที่ร้าน
              </a>
            </div>
          ) : (
            <>
              <div className="note">
                สั่งอย่างน้อย {DELIVERY_MIN_ITEMS} ชิ้น · ลูกค้าใหม่ส่งฟรี
                {newCustomer
                  ? ' (ตรวจจากเบอร์นี้ในอุปกรณ์นี้)'
                  : ` · ค่าจัดส่ง ${baht(DELIVERY_FEE)}`}
              </div>

              <textarea
                placeholder="บ้านเลขที่ ถนน ซอย จุดสังเกต"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={3}
              />

              <button
                type="button"
                className="btn-outline"
                style={{ width: '100%', marginBottom: 8 }}
                onClick={getLocation}
              >
                📍 ใช้ตำแหน่งปัจจุบัน / ปักหมุด
              </button>

              {lat != null && lng != null && (
                <a
                  className="btn-outline"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  เปิดพิกัดที่เลือกใน Google Maps
                </a>
              )}

              <div className="shop-map-frame">
                <iframe
                  title="แผนที่สำหรับเลือกพื้นที่จัดส่ง"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(
                    lat != null && lng != null
                      ? `${lat},${lng}`
                      : address || 'Hat Yai, Songkhla'
                  )}&output=embed`}
                  loading="lazy"
                  allowFullScreen
                />
              </div>

              <small className="muted">
                อนุญาตการเข้าถึงตำแหน่งเพื่อบันทึกพิกัด หรือกรอกที่อยู่และจุดสังเกตให้ครบถ้วน
              </small>
            </>
          )}
        </>
      )}

      {isReserve && (
        <>
          <h4>วันและเวลารับสินค้า</h4>

          <input
            type="datetime-local"
            value={pickupAt}
            min={minPickup}
            max={maxPickup}
            onChange={(event) => setPickupAt(event.target.value)}
          />

          {cfg && (
            <div className="muted">
              จองล่วงหน้าอย่างน้อย {cfg.minLeadHours} ชั่วโมง · รับสินค้า{' '}
              {cfg.openHour}:00–{cfg.closeHour}:00 น.
            </div>
          )}

          <input
            placeholder="หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={255}
          />
        </>
      )}

      <h4>ชำระเงิน</h4>

      {qrUrl && !qrError ? (
        <div className="payment-qr">
          <p>
            สแกน QR PromptPay เพื่อชำระ{' '}
            <b>{baht(payNow)}</b>
          </p>

          <img
            src={qrUrl}
            alt={`PromptPay QR ยอด ${payNow} บาท`}
            onError={() => setQrError(true)}
          />

          <small>
            ตรวจสอบชื่อบัญชีปลายทางและยอดเงินก่อนยืนยัน ระบบยังไม่ถือว่าชำระแล้วจนกว่าแอดมินจะตรวจสอบยอดเงินจริง
          </small>
        </div>
      ) : (
        <div className="note">
          {!PROMPTPAY_ID
            ? 'ร้านยังไม่ได้ตั้งค่า PromptPay ID จึงไม่สามารถสร้าง QR สำหรับบัญชีร้านได้'
            : 'โหลด QR ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตและ PromptPay ID'}
          <br />
          ตั้งค่า <code>VITE_PROMPTPAY_ID</code> ในไฟล์{' '}
          <code>customer-frontend/.env</code> แล้วเปิด Vite ใหม่
        </div>
      )}

      <div className="note">
        สถานะการชำระ: รอตรวจสอบโดยแอดมิน คำสั่งซื้อจะยังไม่ถือว่าชำระแล้วจนกว่าร้านจะตรวจสอบเงินเข้าบัญชีจริง
      </div>

      <div className="note">
        ติดตามกิจกรรมจับฉลากได้ที่{' '}
        <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
          Facebook ร้าน
        </a>
      </div>

      {error && <div className="err">{error}</div>}
    </ShopLayout>
  )
}
