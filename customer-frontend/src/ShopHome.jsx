import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { useShop } from './ShopContext'
import { shopApi, baht } from './shopApi'
import NoteBox from './NoteBox'
import { ClosuresNote, useClosures } from './Closures'
import { cartUnitsByMenu, isLowStock, stockText, useMenus } from './stock'
import duckImage from './assets/duck.jpg'
import chickenImage from './assets/chicken.jpg'
import stickyRiceImage from './assets/sticky-rice.jpg'

const imageFor = m =>
  m.category === 'duck'
    ? duckImage
    : m.category === 'chicken'
      ? chickenImage
      : /ข้าวเหนียว/.test(m.name)
        ? stickyRiceImage
        : null

function MenuCard({ menu, mode, onAdd, inCartUnits }) {
  const [size, setSize] = useState('full')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')

  const price = size === 'half' ? menu.price / 2 : menu.price
  const isOrder = mode === 'order'

  // สต็อกนับเป็นครึ่งตัว: เต็มตัวใช้ 2 หน่วย (เฉพาะสินค้าที่มีครึ่งตัว)
  const perUnit = menu.hasHalfOption && size === 'full' ? 2 : 1

  // สต็อกที่เหลือจริง = สต็อกของร้าน − ที่อยู่ในตะกร้าแล้ว
  const remaining = Math.max(menu.stockUnits - (inCartUnits || 0), 0)
  const maxQty = Math.floor(remaining / perUnit)

  const outOfStock = menu.stockUnits <= 0
  const cartFull = !outOfStock && remaining <= 0

  // สั่งซื้อเลย: หมดแล้วกดสั่งไม่ได้ / จองล่วงหน้าไม่จำกัดตามสต็อกวันนี้
  const blocked = isOrder && (outOfStock || cartFull)
  const cannotAddThisSize = isOrder && !blocked && maxQty < 1
  const limit = isOrder ? Math.min(maxQty, 50) : 50
  const low = isLowStock(menu.hasHalfOption, menu.stockUnits)
  const img = imageFor(menu)

  // เหลือแค่ครึ่งตัว -> สลับไปครึ่งตัวให้อัตโนมัติ / ลดจำนวนไม่ให้เกินที่เหลือ
  useEffect(() => {
    if (isOrder && menu.hasHalfOption && size === 'full' && remaining === 1) setSize('half')
  }, [isOrder, menu.hasHalfOption, size, remaining])

  useEffect(() => {
    if (isOrder && limit >= 1 && qty > limit) setQty(limit)
  }, [isOrder, limit, qty])

  const stockClass = outOfStock ? 'out' : low ? 'low' : 'ok'

  return (
    <div className={`menu-row ${blocked ? 'sold-out' : ''}`} style={{ alignItems: 'flex-start' }}>
      {img ? <img src={img} alt="" /> : <div style={{ width: 64, height: 64 }} />}

      <div className="info">
        <b>{menu.name}</b>

        <div className={`stock-badge ${stockClass}`} role="status">
          {outOfStock ? (
            <>
              <span className="stock-dot" aria-hidden="true" />
              สินค้าหมด{isOrder ? '' : ' (จองล่วงหน้าได้)'}
            </>
          ) : (
            <>
              <span className="stock-dot" aria-hidden="true" />
              {low ? 'เหลือน้อย ' : 'พร้อมขาย '}เหลือ {stockText(menu.hasHalfOption, menu.stockUnits)}
            </>
          )}
        </div>

        <div className="price-tag">
          <span className="price-amount">{baht(price)}</span>
          <span className="price-unit">
            {menu.hasHalfOption ? (size === 'half' ? '/ ครึ่งตัว' : '/ ตัว') : ''}
          </span>
        </div>

        {menu.hasHalfOption && !blocked && (
          <div className="size-pick">
            <button
              className={size === 'half' ? 'on' : ''}
              onClick={() => {
                setSize('half')
                setQty(1)
              }}
            >
              ครึ่งตัว
            </button>
            <button
              className={size === 'full' ? 'on' : ''}
              disabled={isOrder && remaining < 2}
              onClick={() => {
                setSize('full')
                setQty(1)
              }}
            >
              เต็มตัว
            </button>
          </div>
        )}

        {!blocked && <NoteBox value={note} onChange={setNote} category={menu.category} compact />}

        {blocked ? (
          <button className="btn-disabled" disabled aria-disabled="true">
            {outOfStock ? 'สินค้าหมด สั่งไม่ได้' : 'ในตะกร้าครบจำนวนที่เหลือแล้ว'}
          </button>
        ) : (
          <div className="row" style={{ marginTop: 6 }}>
            <div className="qty-mini">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <b>{qty}</b>
              <button disabled={qty >= limit} onClick={() => setQty(q => Math.min(limit, q + 1))}>+</button>
            </div>

            <button
              className="btn-outline"
              style={{ padding: '8px 14px' }}
              disabled={cannotAddThisSize}
              onClick={() => {
                onAdd({
                  menuId: menu.menuId,
                  name: menu.name,
                  category: menu.category,
                  price: menu.price,
                  hasHalfOption: menu.hasHalfOption,
                  size: menu.hasHalfOption ? size : 'full',
                  qty,
                  note,
                })
                setQty(1)
                setNote('')
              }}
            >
              เพิ่ม
            </button>
          </div>
        )}

        {isOrder && !blocked && qty >= limit && limit > 0 && (
          <div className="stock-hint">สั่งได้สูงสุดเท่าที่เหลือในสต็อก ({limit} {menu.hasHalfOption ? (size === 'half' ? 'ครึ่งตัว' : 'ตัว') : 'ชิ้น'})</div>
        )}
      </div>
    </div>
  )
}

export default function ShopHome() {
  const navigate = useNavigate()
  const shop = useShop()

  const [branches, setBranches] = useState(null)
  const [error, setError] = useState('')
  const [promotions, setPromotions] = useState([])
  const [cfg, setCfg] = useState(null)

  useEffect(() => {
    shopApi.config().then(setCfg).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    shopApi.promotions(shop.branchId ? Number(shop.branchId) : undefined)
      .then(rows => alive && setPromotions(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setPromotions([]))
    return () => { alive = false }
  }, [shop.branchId])

  useEffect(() => {
    shopApi
      .branches()
      .then(list => {
        setBranches(list)

        // มีสาขาเดียว หรือสาขาที่เคยเลือกไว้ไม่เปิดแล้ว
        if (list.length === 1) shop.setBranch(list[0].id)
        else if (shop.branchId && !list.some(b => String(b.id) === String(shop.branchId))) {
          shop.setBranch(null)
        }
      })
      .catch(e => setError(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // โหลดสินค้า + สต็อกของสาขา และอัปเดตเองทุก 15 วินาที (สต็อกเปลี่ยนเมื่อมีคนสั่ง/ร้านเติมของ)
  const { menus, error: menuError } = useMenus(shop.branchId)

  // วันหยุดร้าน: วันนี้หยุด = สั่งซื้อเลยไม่ได้ (สลับไปโหมดจองล่วงหน้าให้เอง)
  const closures = useClosures(shop.branchId)

  useEffect(() => {
    if (closures.closedToday && shop.mode === 'order') shop.setMode('reserve')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closures.closedToday, shop.mode])
  const cartUnits = cartUnitsByMenu(shop.cart)

  const branch = branches?.find(b => String(b.id) === String(shop.branchId))

  const facebookUrl =
    cfg?.facebookUrl ||
    import.meta.env.VITE_SHOP_FACEBOOK_URL ||
    'https://www.facebook.com/profile.php?id=100090386508496'

  const liveUrl =
    cfg?.facebookLiveUrl || import.meta.env.VITE_SHOP_FACEBOOK_LIVE_URL || ''

  return (
    <ShopLayout
      title="สั่งซื้อ / จองสินค้า"
      footer={
        shop.count > 0 && (
          <button className="btn-primary" onClick={() => navigate('/cart')}>
            ดูตะกร้า · {shop.count} ชิ้น · {baht(shop.total)}
          </button>
        )
      }
    >
      {(error || menuError) && <div className="err">{error || menuError}</div>}

      <section className="promotion-panel" aria-label="โปรโมชั่นจากทางร้าน">
        <h3 className="promotion-heading">
          <span className="promotion-heading-emoji" aria-hidden="true">🎉</span>
          โปรโมชั่นและกิจกรรมของร้าน
        </h3>
        {promotions.length > 0 ? (
          promotions.map(p => (
            <article className="promotion-card" key={p.id}>
              <b>{p.name}</b>
              {p.description && <p>{p.description}</p>}
              <small>
                {p.startDate ? `เริ่ม ${new Date(p.startDate).toLocaleDateString('th-TH')}` : 'โปรโมชั่นพิเศษ'}
                {p.endDate ? ` · ถึง ${new Date(p.endDate).toLocaleDateString('th-TH')}` : ''}
              </small>
              {Number(p.minOrderAmount || 0) > 0 && (
                <small>เมื่อซื้อครบ ฿{Number(p.minOrderAmount).toLocaleString('th-TH')}</small>
              )}
              {/จับฉลาก|ไลฟ์|แจกไก่/i.test(`${p.name} ${p.description || ''}`) && (
                <a href={liveUrl || facebookUrl} target="_blank" rel="noreferrer" className="btn-outline promotion-live">
                  ดูไลฟ์และกติกาจับฉลากบน Facebook
                </a>
              )}
            </article>
          ))
        ) : (
          <p className="promotion-empty">ขณะนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งาน</p>
        )}

        <div className="promotion-links">
          <a href={facebookUrl} target="_blank" rel="noreferrer">
            ติดตามข่าวสารและกิจกรรมจับฉลากบน Facebook ร้าน
          </a>

          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noreferrer">
              🔴 เปิดดู Facebook Live
            </a>
          )}
        </div>
      </section>

      {!branches && !error && <p className="muted">กำลังโหลด...</p>}

      {branches && branches.length === 0 && (
        <div className="card">ขณะนี้ยังไม่เปิดให้สั่งออนไลน์</div>
      )}

      {branches && branches.length > 1 && (
        <select
          value={shop.branchId || ''}
          onChange={e => shop.setBranch(e.target.value || null)}
        >
          <option value="">เลือกสาขา</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      )}

      {branch && (
        <div className="muted" style={{ marginBottom: 10 }}>
          {[branch.address, branch.phone && `โทร ${branch.phone}`].filter(Boolean).join(' · ')}
        </div>
      )}

      {shop.branchId && (
        <>
          <div className="seg">
            <button
              className={shop.mode === 'order' ? 'on' : ''}
              disabled={closures.closedToday}
              onClick={() => shop.setMode('order')}
            >
              {closures.closedToday ? 'สั่งซื้อเลย (วันนี้ร้านหยุด)' : 'สั่งซื้อเลย'}
            </button>
            <button className={shop.mode === 'reserve' ? 'on' : ''} onClick={() => shop.setMode('reserve')}>
              จองล่วงหน้า
            </button>
          </div>

          {closures.closedToday && (
            <div className="closed-banner" role="alert">
              <b>วันนี้ร้านหยุดทำการ{closures.todayReason ? ` (${closures.todayReason})` : ''}</b>
              สั่งซื้อเลยไม่ได้ในวันนี้ — เลือก "จองล่วงหน้า" แล้วเลือกวันรับสินค้าที่ร้านเปิดได้เลย
            </div>
          )}

          <ClosuresNote closures={closures} title="วันหยุดร้าน (สั่งซื้อและจองวันเหล่านี้ไม่ได้)" />

          <div className="note">
            {shop.mode === 'order'
              ? 'สั่งซื้อเลย: ชำระเต็มจำนวนตอนนี้ และได้รับใบเสร็จอิเล็กทรอนิกส์ทันที'
              : 'จองล่วงหน้า: ชำระมัดจำตอนนี้ แล้วชำระส่วนที่เหลือเมื่อมารับสินค้า (เลือกวันรับสินค้าที่ร้านเปิด)'}
          </div>

          {!menus && !error && !menuError && <p className="muted">กำลังโหลดสินค้า...</p>}

          {menus?.map(m => (
            <MenuCard
              key={m.menuId}
              menu={m}
              mode={shop.mode}
              onAdd={shop.add}
              inCartUnits={cartUnits.get(m.menuId) || 0}
            />
          ))}

          {menus?.length === 0 && <div className="card">สาขานี้ยังไม่มีสินค้า</div>}
        </>
      )}
    </ShopLayout>
  )
}
