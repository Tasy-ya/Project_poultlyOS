import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ShopLayout from './ShopLayout'
import { useShop } from './ShopContext'
import { shopApi, baht } from './shopApi'
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

function MenuCard({ menu, mode, onAdd }) {
  const [size, setSize] = useState('full')
  const [qty, setQty] = useState(1)

  const price = size === 'half' ? menu.price / 2 : menu.price

  // สต็อกนับเป็นครึ่งตัว: เต็มตัวใช้ 2 หน่วย (เฉพาะสินค้าที่มีครึ่งตัว)
  const perUnit = menu.hasHalfOption && size === 'full' ? 2 : 1
  const maxQty = Math.floor(menu.stockUnits / perUnit)

  // สั่งซื้อเลยต้องมีของพร้อม / จองล่วงหน้าไม่จำกัดตามสต็อกวันนี้
  const soldOut = mode === 'order' && maxQty < 1
  const limit = mode === 'order' ? Math.min(maxQty, 50) : 50
  const img = imageFor(menu)

  return (
    <div className={`menu-row ${soldOut ? 'sold-out' : ''}`} style={{ alignItems: 'flex-start' }}>
      {img ? <img src={img} alt="" /> : <div style={{ width: 64, height: 64 }} />}

      <div className="info">
        <b>{menu.name}</b>

        <div className="muted">
          {baht(price)}
          {menu.hasHalfOption ? (size === 'half' ? ' / ครึ่งตัว' : ' / ตัว') : ''}
        </div>

        {menu.hasHalfOption && (
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
              onClick={() => {
                setSize('full')
                setQty(1)
              }}
            >
              เต็มตัว
            </button>
          </div>
        )}

        {soldOut ? (
          <span className="pill bad">หมดแล้ว</span>
        ) : (
          <div className="row" style={{ marginTop: 6 }}>
            <div className="qty-mini">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <b>{qty}</b>
              <button onClick={() => setQty(q => Math.min(limit, q + 1))}>+</button>
            </div>

            <button
              className="btn-outline"
              style={{ padding: '8px 14px' }}
              onClick={() => {
                onAdd({
                  menuId: menu.menuId,
                  name: menu.name,
                  category: menu.category,
                  price: menu.price,
                  hasHalfOption: menu.hasHalfOption,
                  size: menu.hasHalfOption ? size : 'full',
                  qty,
                })
                setQty(1)
              }}
            >
              เพิ่ม
            </button>
          </div>
        )}

        {mode === 'order' && !soldOut && maxQty <= 3 && (
          <div className="muted" style={{ marginTop: 4 }}>
            เหลือสั่งได้อีก {maxQty} {menu.hasHalfOption ? (size === 'half' ? 'ครึ่งตัว' : 'ตัว') : 'ชิ้น'}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ShopHome() {
  const navigate = useNavigate()
  const shop = useShop()

  const [branches, setBranches] = useState(null)
  const [menus, setMenus] = useState(null)
  const [error, setError] = useState('')
  const [promotions, setPromotions] = useState([])

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

  useEffect(() => {
    if (!shop.branchId) {
      setMenus(null)
      return
    }

    let alive = true
    setMenus(null)

    shopApi
      .menus(shop.branchId)
      .then(list => alive && setMenus(list))
      .catch(e => alive && setError(e.message))

    return () => {
      alive = false
    }
  }, [shop.branchId])

  const branch = branches?.find(b => String(b.id) === String(shop.branchId))

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
      {error && <div className="err">{error}</div>}

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
                <a href={import.meta.env.VITE_SHOP_FACEBOOK_LIVE_URL || import.meta.env.VITE_SHOP_FACEBOOK_URL || 'https://www.facebook.com/profile.php?id=100090386508496'} target="_blank" rel="noreferrer" className="btn-outline promotion-live">
                  ดูไลฟ์และกติกาจับฉลากบน Facebook
                </a>
              )}
            </article>
          ))
        ) : (
          <p className="promotion-empty">ขณะนี้ยังไม่มีโปรโมชั่นที่เปิดใช้งาน</p>
        )}
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
            <button className={shop.mode === 'order' ? 'on' : ''} onClick={() => shop.setMode('order')}>
              สั่งซื้อเลย
            </button>
            <button className={shop.mode === 'reserve' ? 'on' : ''} onClick={() => shop.setMode('reserve')}>
              จองล่วงหน้า
            </button>
          </div>

          <div className="note">
            {shop.mode === 'order'
              ? 'สั่งซื้อเลย: ชำระเต็มจำนวนตอนนี้ และได้รับใบเสร็จอิเล็กทรอนิกส์ทันที'
              : 'จองล่วงหน้า: ชำระมัดจำตอนนี้ แล้วชำระส่วนที่เหลือเมื่อมารับสินค้า'}
          </div>

          {!menus && !error && <p className="muted">กำลังโหลดสินค้า...</p>}

          {menus?.map(m => (
            <MenuCard key={m.menuId} menu={m} mode={shop.mode} onAdd={shop.add} />
          ))}

          {menus?.length === 0 && <div className="card">สาขานี้ยังไม่มีสินค้า</div>}
        </>
      )}
    </ShopLayout>
  )
}
