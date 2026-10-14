import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout, { CATS, getStaff } from '../components/Layout'
import {
  api,
  baht,
  loadCart,
  saveCart,
  cartTotal,
  savePendingOrder,
} from '../api'

const icons = {
  duck: '🦆',
  chicken: '🐔',
  other: '🍚',
}

// -----------------------------------------------------
// แปลงหน่วยครึ่งตัวเป็นข้อความที่เข้าใจง่าย
//
// 1 ตัว = 2 หน่วย
// 1/2 ตัว = 1 หน่วย
// -----------------------------------------------------
function stockText(halfUnits) {

  const units = Number(halfUnits || 0)

  const whole = Math.floor(units / 2)
  const half = units % 2

  if (whole === 0 && half === 0) {
    return '0 ตัว'
  }

  if (half === 1) {
    return `${whole} ตัว + ครึ่ง`
  }

  return `${whole} ตัว`
}

export default function SellPage() {

  const { category } = useParams()

  const staff = getStaff()

  const nav = useNavigate()

  const [menus, setMenus] = useState([])

  // stock เก็บเป็น "หน่วยครึ่งตัว"
  const [stock, setStock] = useState({})

  const [q, setQ] = useState('')

  const [size, setSize] =
    useState('full')

  const [qty, setQty] =
    useState(1)

  const [cart, setCart] =
    useState(loadCart())

  const [err, setErr] =
    useState('')

  // -----------------------------------------------------
  // โหลดเมนู + สต็อก
  // -----------------------------------------------------
  useEffect(() => {

    api.getMenus(category)
      .then(setMenus)
      .catch((e) =>
        setErr(e.message)
      )

    if (staff?.branchId) {

      api.getStock(staff.branchId)
        .then((rows) => {

          const stockMap =
            Object.fromEntries(
              rows.map((x) => [
                x.menuId,
                Number(x.qty),
              ])
            )

          setStock(stockMap)
        })
        .catch((e) =>
          setErr(e.message)
        )
    }

  }, [
    category,
    staff?.branchId,
  ])

  // -----------------------------------------------------
  // ค้นหาสินค้า
  // -----------------------------------------------------
  const filtered = useMemo(
    () =>
      menus.filter((m) =>
        m.name.includes(q)
      ),
    [menus, q]
  )

  // -----------------------------------------------------
  // ราคาต่อหน่วย
  // -----------------------------------------------------
  const unitPrice = (
    menu,
    itemSize
  ) => {

    if (
      itemSize === 'half' &&
      menu.hasHalfOption
    ) {
      return Number(menu.price) / 2
    }

    return Number(menu.price)
  }

  const subtotal =
    cartTotal(cart)

  // -----------------------------------------------------
  // เพิ่มสินค้าเข้าตะกร้า
  // -----------------------------------------------------
  function add(menu) {

    const chosenSize =
      menu.hasHalfOption &&
      size === 'half'
        ? 'half'
        : 'full'

    const key =
      `${menu.id}-${chosenSize}`

    const existing =
      cart.find(
        (item) =>
          item.id === key
      )

    const next =
      existing

        ? cart.map(
            (item) =>
              item.id === key
                ? {
                    ...item,
                    qty:
                      Number(item.qty) +
                      qty,
                  }
                : item
          )

        : [
            ...cart,

            {
              id: key,

              menuId:
                Number(menu.id),

              name:
                menu.name,

              price:
                Number(menu.price),

              hasHalfOption:
                Boolean(
                  menu.hasHalfOption
                ),

              category,

              size:
                chosenSize,

              qty,
            },
          ]

    setCart(next)

    saveCart(next)

    setQty(1)
  }

  // -----------------------------------------------------
  // เพิ่ม / ลดจำนวนในตะกร้า
  // -----------------------------------------------------
  function changeQty(
    index,
    amount
  ) {

    const next =
      cart
        .map(
          (item, i) =>
            i === index
              ? {
                  ...item,
                  qty:
                    Number(item.qty) +
                    amount,
                }
              : item
        )
        .filter(
          (item) =>
            Number(item.qty) > 0
        )

    setCart(next)

    saveCart(next)
  }

  // -----------------------------------------------------
  // ยืนยันออเดอร์
  // -----------------------------------------------------
  function confirm() {

    if (!cart.length) return

    const order = {
      cart,
      total: subtotal,
    }

    savePendingOrder(order)

    nav(
      '/order-confirm',
      {
        state: order,
      }
    )
  }

  // -----------------------------------------------------
  // หน้า Sell
  // -----------------------------------------------------
  return (

    <Layout
      title={`Sell · ${CATS[category] || ''}`}
    >

      <input
        placeholder="🔍 ค้นหาสินค้า"
        value={q}
        onChange={(e) =>
          setQ(e.target.value)
        }
      />

      {/* -------------------------------------------------
          เลือกเต็มตัว / ครึ่งตัว
      -------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >

        <button
          className={
            size === 'full'
              ? 'btn-primary'
              : 'btn-outline'
          }
          style={{
            width: 'auto',
          }}
          onClick={() =>
            setSize('full')
          }
        >
          เต็มตัว
        </button>

        <button
          className={
            size === 'half'
              ? 'btn-primary'
              : 'btn-outline'
          }
          style={{
            width: 'auto',
          }}
          onClick={() =>
            setSize('half')
          }
        >
          ครึ่งตัว
        </button>

      </div>

      {/* -------------------------------------------------
          จำนวนที่จะเพิ่ม
      -------------------------------------------------- */}
      <div className="qty-control">

        <button
          onClick={() =>
            setQty(
              Math.max(
                1,
                qty - 1
              )
            )
          }
        >
          −
        </button>

        <b>{qty}</b>

        <button
          onClick={() =>
            setQty(qty + 1)
          }
        >
          +
        </button>

      </div>

      {/* -------------------------------------------------
          รายการสินค้า
      -------------------------------------------------- */}
      {filtered.map(
        (menu) => (

          <div
            className="menu-row"
            key={menu.id}
          >

            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
              }}
            >
              {
                icons[category] ||
                icons.other
              }
            </div>

            <div className="info">

              <b>
                {menu.name}
              </b>

              <br />

              <small>

                เต็มตัว{' '}
                {baht(menu.price)}

                {menu.hasHalfOption
                  ? ` · ครึ่งตัว ${baht(
                      menu.price / 2
                    )}`
                  : ''}

                {staff?.branchId
                  ? ` · สต็อก ${stockText(
                      stock[menu.id]
                    )}`
                  : ''}

              </small>

            </div>

            <button
              className="btn-primary"
              style={{
                width: 'auto',
              }}
              onClick={() =>
                add(menu)
              }
            >
              🛒 ซื้อเลย
            </button>

          </div>

        )
      )}

      {/* -------------------------------------------------
          ตะกร้า
      -------------------------------------------------- */}
      {cart.map(
        (item, index) => (

          <div
            key={`${item.id}-${index}`}
            className="card"
          >

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >

              <div>

                <b>
                  {item.name}
                </b>

                <div>
                  {
                    item.size === 'half'
                      ? 'ครึ่งตัว'
                      : 'เต็มตัว'
                  }

                  {' × '}

                  {item.qty}
                </div>

                <b>
                  {
                    baht(
                      unitPrice(
                        item,
                        item.size
                      ) *
                      item.qty
                    )
                  }
                </b>

              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >

                <button
                  className="btn-secondary"
                  onClick={() =>
                    changeQty(
                      index,
                      -1
                    )
                  }
                >
                  −
                </button>

                <b>
                  {item.qty}
                </b>

                <button
                  className="btn-secondary"
                  onClick={() =>
                    changeQty(
                      index,
                      1
                    )
                  }
                >
                  +
                </button>

              </div>

            </div>

          </div>

        )
      )}

      {/* -------------------------------------------------
          ยอดรวม
      -------------------------------------------------- */}
      <div
        className="receipt-box"
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          fontWeight: 'bold',
          fontSize: 18,
        }}
      >

        <span>
          ยอดรวม
        </span>

        <span>
          {baht(subtotal)}
        </span>

      </div>

      {err && (
        <p
          style={{
            color: 'red',
          }}
        >
          ❌ {err}
        </p>
      )}

      <button
        className="btn-primary"
        disabled={!cart.length}
        onClick={confirm}
      >
        ยืนยันออเดอร์
      </button>

    </Layout>
  )
}