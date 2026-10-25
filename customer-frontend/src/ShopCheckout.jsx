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
import DeliveryBox from './DeliveryBox'
import { rememberOrder } from './myOrders'
import { loadBuyer, rememberPlace, saveBuyer } from './savedPlaces'
import { problemText, stockProblems } from './stock'
import { ClosuresNote, thaiDay, useClosures } from './Closures'

const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ค่าสำรองกรณี backend ไม่ส่งค่ามา (ค่าจริงตั้งที่ backend/.env แล้วส่งผ่าน /api/public/config)
const ENV_MIN_ITEMS = Number(import.meta.env.VITE_DELIVERY_MIN_ITEMS || 5)
const ENV_DELIVERY_FEE = Number(import.meta.env.VITE_DELIVERY_FEE || 30)

export default function ShopCheckout() {
  const navigate = useNavigate()
  const shop = useShop()
  const isReserve = shop.mode === 'reserve'

  // วิธีรับสินค้า/ที่อยู่/พิกัด เก็บร่วมกับหน้าตะกร้า (ใช้ได้ทั้งสั่งซื้อเลยและจองล่วงหน้า)
  const { address, lat, lng } = shop.delivery
  const fulfillment = shop.delivery.method

  const [cfg, setCfg] = useState(null)
  const [promotions, setPromotions] = useState([])
  // จำชื่อ/เบอร์จากการสั่งครั้งก่อน ไม่ต้องกรอกใหม่ (แก้ไขได้)
  const [name, setName] = useState(() => loadBuyer().name)
  const [phone, setPhone] = useState(() => loadBuyer().phone)
  const [pickupAt, setPickupAt] = useState('')
  const [note, setNote] = useState('')
  const [newCustomer, setNewCustomer] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // วันหยุดร้าน: วันนี้หยุด = สั่งซื้อเลยไม่ได้ / จองวันที่ร้านหยุดไม่ได้
  const closures = useClosures(shop.branchId)
  const pickupDay = pickupAt ? pickupAt.slice(0, 10) : ''
  const pickupClosed = isReserve && pickupDay ? closures.reasonOn(pickupDay) : null
  const orderBlocked = !isReserve && closures.closedToday
  const closedBlock = orderBlocked || Boolean(pickupClosed)

  const localIdRef = useRef(newLocalId())
  const minItems = cfg?.deliveryMinItems ?? ENV_MIN_ITEMS
  const baseFee = cfg?.deliveryFee ?? ENV_DELIVERY_FEE
  const itemCount = shop.cart.reduce((sum, item) => sum + item.qty, 0)
  // ส่งถึงที่เลือกได้ทุกออเดอร์ (รวมการจองล่วงหน้า) — ค่าส่งฟรีเมื่อสั่งครบจำนวนที่ร้านกำหนดหรือเป็นลูกค้าใหม่
  const freeDelivery =
    fulfillment === 'delivery' && (itemCount >= minItems || newCustomer)
  const deliveryFee =
    fulfillment === 'delivery' && !freeDelivery ? baseFee : 0

  // แสดงส่วนลดโปรโมชั่นที่แอดมินเปิดให้ลูกค้า โดยยอดจริงจะคำนวณซ้ำที่เซิร์ฟเวอร์
  const applicablePromotion = promotions.find((promo) => {
    if (!['discount', 'bulk', 'vip', 'festival', 'other'].includes(String(promo.type || '').toLowerCase())) return false
    const pricing = promo.pricing || {}
    const productName = String(promo.productName || '').trim().toLocaleLowerCase('th')
    const eligible = productName
      ? shop.cart.filter((item) => String(item.name || '').trim().toLocaleLowerCase('th') === productName)
      : shop.cart
    if (!eligible.length) return false
    const qty = eligible.reduce((sum, item) => sum + Number(item.qty || 0), 0)
    if (Number(pricing.minQty || 0) > qty) return false
    return Number(pricing.discountValue || 0) > 0
  })
  const promoEligibleItems = applicablePromotion
    ? (applicablePromotion.productName
        ? shop.cart.filter((item) => String(item.name || '').trim().toLocaleLowerCase('th') === String(applicablePromotion.productName).trim().toLocaleLowerCase('th'))
        : shop.cart)
    : []
  const promoEligibleSubtotal = promoEligibleItems.reduce((sum, item) => sum + unitPrice(item) * item.qty, 0)
  const promoValue = Number(applicablePromotion?.pricing?.discountValue || 0)
  const previewDiscount = !applicablePromotion ? 0
    : applicablePromotion.pricing?.discountType === 'percent'
      ? Math.round(promoEligibleSubtotal * Math.min(promoValue, 100)) / 100
      : applicablePromotion.pricing?.discountType === 'baht'
        ? Math.min(promoValue, promoEligibleSubtotal)
        : applicablePromotion.pricing?.discountType === 'special_price'
          ? promoEligibleItems.reduce((sum, item) => sum + Math.max(unitPrice(item) - promoValue, 0) * item.qty, 0)
          : 0
  const grandTotal = Math.max(0, shop.total - previewDiscount) + deliveryFee

  useEffect(() => {
    let mounted = true

    shopApi.config()
      .then((data) => {
        if (mounted) setCfg(data)
      })
      .catch((err) => {
        if (mounted) setError(err.message || 'โหลดการตั้งค่าร้านไม่สำเร็จ')
      })

    shopApi.promotions(shop.branchId)
      .then((rows) => {
        if (mounted) setPromotions(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (mounted) setPromotions([])
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const cleanPhone = phone.replace(/\D/g, '')

    if (!/^0\d{8,9}$/.test(cleanPhone)) {
      setNewCustomer(true)
      return undefined
    }

    let alive = true

    shopApi
      .customerStatus(cleanPhone)
      .then((r) => alive && setNewCustomer(r?.isNew !== false))
      .catch(() => alive && setNewCustomer(true))

    return () => {
      alive = false
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

    if (orderBlocked) {
      setError('วันนี้ร้านหยุดทำการ สั่งซื้อเลยไม่ได้ — กรุณาจองล่วงหน้าในวันที่ร้านเปิด')
      return
    }

    if (isReserve && !pickupAt) {
      setError('กรุณาเลือกวันและเวลารับสินค้า')
      return
    }

    if (pickupClosed) {
      setError(`ร้านหยุดทำการ${thaiDay(pickupDay, true)} (${pickupClosed}) จองวันหยุดไม่ได้ กรุณาเลือกวันอื่น`)
      return
    }

    if (fulfillment === 'delivery' && !address.trim()) {
      setError('กรุณาระบุที่อยู่จัดส่ง หรือปักหมุดบนแผนที่')
      return
    }

    setBusy(true)

    // สั่งซื้อเลย: เช็กสต็อกล่าสุดอีกครั้งก่อนส่ง (อาจมีคนสั่งตัดหน้าไปแล้ว)
    if (!isReserve) {
      try {
        const fresh = await shopApi.menus(shop.branchId)
        const problems = stockProblems(shop.cart, fresh)

        if (problems.length > 0) {
          setError(`สต็อกไม่พอ: ${problems.map(problemText).join(' · ')} — กรุณากลับไปแก้ตะกร้า`)
          setBusy(false)
          return
        }
      } catch {
        // เช็กไม่ได้ก็ให้เซิร์ฟเวอร์ตรวจแทน (เซิร์ฟเวอร์ตรวจสต็อกทุกครั้งอยู่แล้ว)
      }
    }

    const items = shop.cart.map((item) => ({
      menuId: item.menuId,
      size: item.size,
      qty: item.qty,
      note: item.note || '',
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

      rememberOrder(result.receiptToken)

      // จำข้อมูลผู้สั่งและที่อยู่จัดส่งไว้ใช้ครั้งหน้า
      saveBuyer({ name, phone: cleanPhone })
      if (fulfillment === 'delivery' && lat != null && lng != null && address.trim()) {
        rememberPlace({ address, lat, lng })
      }
      shop.clear()

      // ไปหน้าสแกน QR ชำระเงิน (ยอดถูกกำหนดจากเซิร์ฟเวอร์)
      navigate(`/pay/${result.receiptToken}`, { replace: true })
    } catch (err) {
      setError(err.message || 'ส่งคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่')
      setBusy(false)
    }
  }

  const mapUrl = lat != null && lng != null
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cfg?.shopAddress || import.meta.env.VITE_SHOP_ADDRESS || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')}`

  return (
    <ShopLayout
      title={isReserve ? 'จองล่วงหน้า' : 'ชำระเงิน'}
      back="/cart"
      footer={
        <button
          className="btn-primary"
          disabled={busy || !cfg || closedBlock}
          onClick={submit}
        >
          {busy
            ? 'กำลังดำเนินการ...'
            : isReserve
              ? `ไปชำระมัดจำ · ${baht(payNow)}`
              : `ไปชำระเงิน · ${baht(payNow)}`}
        </button>
      }
    >
      {orderBlocked && (
        <div className="closed-banner" role="alert">
          <b>วันนี้ร้านหยุดทำการ{closures.todayReason ? ` (${closures.todayReason})` : ''}</b>
          สั่งซื้อเลยไม่ได้ในวันนี้ แต่จองล่วงหน้าในวันที่ร้านเปิดได้
          <button
            type="button"
            className="btn-outline"
            style={{ marginTop: 8 }}
            onClick={() => shop.setMode('reserve')}
          >
            เปลี่ยนเป็นจองล่วงหน้า
          </button>
        </div>
      )}

      <div className="receipt-box">
        <table className="sum">
          <tbody>
            {shop.cart.map((item, idx) => (
              <tr key={`${item.menuId}-${item.size}-${idx}`}>
                <td>
                  {item.name}{' '}
                  {item.hasHalfOption
                    ? `(${sizeLabel(item.size)})`
                    : ''}{' '}
                  × {item.qty}
                  {item.note && <div className="muted">📝 {item.note}</div>}
                </td>
                <td>{baht(unitPrice(item) * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divider" />

        <div className="row">
          <span>ยอดสินค้า</span>
          <b>{baht(shop.total)}</b>
        </div>

        {previewDiscount > 0 && applicablePromotion && (
          <div className="row" style={{ marginTop: 8, color: '#d92323' }}>
            <span>ส่วนลด · {applicablePromotion.name || 'โปรโมชั่น'}</span>
            <b>-{baht(previewDiscount)}</b>
          </div>
        )}

        {fulfillment === 'delivery' && (
          <div className="row" style={{ marginTop: 8 }}>
            <span>ค่าจัดส่ง {freeDelivery ? '(ส่งฟรี)' : ''}</span>
            <b>{deliveryFee ? baht(deliveryFee) : 'ฟรี'}</b>
          </div>
        )}

        <div className="divider" />

        <div className="row total-row">
          <span>ยอดรวม</span>
          <b className="total-amount">{baht(grandTotal)}</b>
        </div>

        {isReserve && cfg && (
          <>
            <div className="row" style={{ marginTop: 8 }}>
              <span>มัดจำ ({cfg.depositPercent}%) — ชำระตอนนี้</span>
              <b className="pay-now-amount">{baht(deposit)}</b>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <span>ยอดคงเหลือเมื่อรับสินค้า</span>
              <b>{baht(grandTotal - deposit)}</b>
            </div>
          </>
        )}
      </div>

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

      <DeliveryBox cfg={cfg} newCustomer={newCustomer} itemCount={itemCount} />

      {isReserve && (
        <>
          <h4>{fulfillment === 'delivery' ? 'วันและเวลาจัดส่ง' : 'วันและเวลารับสินค้า'}</h4>

          <input
            type="datetime-local"
            value={pickupAt}
            min={minPickup}
            max={maxPickup}
            onChange={(event) => setPickupAt(event.target.value)}
          />

          {pickupClosed && (
            <div className="closed-banner" role="alert">
              <b>ร้านหยุดทำการ{thaiDay(pickupDay, true)}</b>
              {pickupClosed !== 'ร้านหยุดทำการ' ? `${pickupClosed} · ` : ''}จองวันหยุดไม่ได้ กรุณาเลือกวันรับสินค้าอื่น
            </div>
          )}

          {cfg && (
            <div className="muted">
              จองล่วงหน้าอย่างน้อย {cfg.minLeadHours} ชั่วโมง · รับสินค้า{' '}
              {cfg.openHour}:00–{cfg.closeHour}:00 น.
            </div>
          )}

          <ClosuresNote closures={closures} title="วันหยุดร้าน (จองวันเหล่านี้ไม่ได้)" />

          <input
            placeholder="หมายเหตุ (ไม่บังคับ)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={255}
          />
        </>
      )}

      <h4>ชำระเงิน</h4>

      <div className="pay-info">
        <div className="pay-info-line">
          <span className="pay-info-badge">PromptPay</span>
          <span>
            {isReserve ? 'ชำระมัดจำ' : 'ชำระเต็มจำนวน'} ด้วย QR ที่กำหนดยอดให้อัตโนมัติ
          </span>
        </div>
        <div className="pay-info-amount">{baht(payNow)}</div>
        <small>กดปุ่มด้านล่างเพื่อไปหน้าสแกน QR — ร้านจะยืนยันหลังตรวจพบเงินเข้าบัญชี</small>
      </div>

      {error && <div className="err">{error}</div>}
    </ShopLayout>
  )
}
