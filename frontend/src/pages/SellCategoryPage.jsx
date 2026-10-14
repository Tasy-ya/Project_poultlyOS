import { cacheGet, cacheSet } from '../offline'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import {
  api,
  loadCart,
  saveCart,
  baht,
  linePrice,
  cartTotal,
  cartQty,
  savePendingOrder,
  getStaff,
  getSelectedBranchId,
  onBranchChange,
} from '../api'


import duckImage from '../assets/duck.jpg'
import chickenImage from '../assets/chicken.jpg'
import stickyRiceImage from '../assets/sticky-rice.jpg'

// =====================================================
// รูปภาพสินค้า
// =====================================================
const imageByCategory = {
  duck: duckImage,
  chicken: chickenImage,
  other: stickyRiceImage,
}

// =====================================================
// สินค้าสำรอง
// =====================================================
const fallbackProducts = [
  {
    id: 4,
    menuId: 4,
    name: 'เป็ดย่างเกลือ',
    category: 'duck',
    price: 360,
    hasHalfOption: true,
    image: duckImage,
    stockQty: 0,
  },
  {
    id: 5,
    menuId: 5,
    name: 'ไก่หมุนขมิ้น',
    category: 'chicken',
    price: 180,
    hasHalfOption: true,
    image: chickenImage,
    stockQty: 0,
  },
  {
    id: 6,
    menuId: 6,
    name: 'ข้าวเหนียว',
    category: 'other',
    price: 15,
    hasHalfOption: false,
    image: stickyRiceImage,
    stockQty: 0,
  },
]

// =====================================================
// ไอคอนรถเข็น
// =====================================================
function CartIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 4H5L7.2 14.4C7.4 15.3 8.2 16 9.2 16H18.5C19.4 16 20.2 15.4 20.5 14.5L22 8H6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="9.5"
        cy="20"
        r="1.8"
        fill="currentColor"
      />

      <circle
        cx="18"
        cy="20"
        r="1.8"
        fill="currentColor"
      />
    </svg>
  )
}

// =====================================================
// แปลงข้อมูลเมนูจาก Database
// =====================================================
function normalizeMenu(m) {
  const id = Number(m.id)

  let category = m.category

  if (!category) {
    if (m.name?.includes('เป็ด')) {
      category = 'duck'
    } else if (m.name?.includes('ไก่')) {
      category = 'chicken'
    } else if (m.name?.includes('ข้าวเหนียว')) {
      category = 'other'
    } else {
      category = 'other'
    }
  }

  return {
    id,
    menuId: id,
    name: m.name || 'สินค้า',
    category,
    price: Number(m.price || 0),
    hasHalfOption: Boolean(m.hasHalfOption),
    image:
      imageByCategory[category] ||
      stickyRiceImage,
    stockQty: 0,
  }
}

// =====================================================
// เอาเฉพาะเมนูที่ใช้ขายจริง
// ปัจจุบันคือ menuId 4, 5, 6
// =====================================================
function removeDuplicateMenus(menus) {
  const result = []

  const categories = [
    'duck',
    'chicken',
    'other',
  ]

  for (const category of categories) {
    const categoryItems = menus.filter(
      (item) =>
        item.category === category
    )

    if (categoryItems.length > 0) {
      // เอาตัวที่ id สูงสุด
      const latest =
        categoryItems.reduce(
          (latest, item) =>
            Number(item.id) >
            Number(latest.id)
              ? item
              : latest,
          categoryItems[0]
        )

      result.push(latest)
    }
  }

  return result
}

// =====================================================
// หน้าขาย
// =====================================================
export default function SellCategoryPage() {

  // =====================================================
  // สาขาที่กำลังใช้งาน (เปลี่ยนได้จากกล่องเลือกสาขาที่หัวหน้า)
  // เริ่มต้นที่สาขาของพนักงาน ถ้ายังไม่เคยเลือก
  // =====================================================
  const [branchId, setBranchId] = useState(
    getSelectedBranchId() || getStaff()?.branchId || ''
  )

  useEffect(() => {
    return onBranchChange((id) => setBranchId(id || ''))
  }, [])

  const navigate = useNavigate()

  const [search, setSearch] = useState('')

  const [products, setProducts] =
    useState(fallbackProducts)

  const [cart, setCart] = useState(
    () => loadCart()
  )

  const [selectedProduct, setSelectedProduct] =
    useState(null)

  const [error, setError] = useState('')

  const [loading, setLoading] =
    useState(true)

  // =====================================================
  // โหลดสินค้า + สต็อกของสาขาปัจจุบัน
  // =====================================================
  useEffect(() => {
    let alive = true

    async function loadProducts() {
      try {
        setLoading(true)
        setError('')

        // -------------------------------
        // 1. โหลดเมนู
        // -------------------------------
        let menus
        let offlineNotice = ''

        try {
          menus = await api.getMenus()

          cacheSet('menus', menus)
        } catch (menuError) {
          // เน็ตหลุด: ใช้เมนูที่โหลดไว้ล่าสุด (ขายต่อได้ ซิงค์ทีหลัง)
          menus = cacheGet('menus')

          if (!menus) {
            throw menuError
          }

          offlineNotice =
            'ออฟไลน์: ใช้เมนูและสต็อกที่บันทึกไว้ล่าสุด (ยอดขายจะซิงค์เมื่อมีเน็ต)'
        }

        if (!alive) return

        const normalized =
          (menus || [])
            .map(normalizeMenu)
            .filter(
              (product) =>
                product.id > 0
            )

        const uniqueMenus =
          removeDuplicateMenus(
            normalized
          )

        // -------------------------------
        // 2. โหลด Stock ของสาขาที่เลือก
        // -------------------------------
        let stockList = []

        try {
          stockList = await api.getMenuStock(branchId)

          cacheSet(`stock_${branchId}`, stockList)
        } catch (stockError) {
          console.error(
            'โหลดสต็อกไม่สำเร็จ:',
            stockError
          )

          stockList =
            cacheGet(`stock_${branchId}`) || []

          if (!offlineNotice) {
            offlineNotice =
              'โหลดสต็อกล่าสุดไม่ได้ ใช้ค่าที่บันทึกไว้'
          }
        }

        if (offlineNotice && alive) {
          setError(offlineNotice)
        }

        if (!alive) return

        // -------------------------------
        // 3. เอา stock มาจับคู่กับ menu
        // -------------------------------
        const productsWithStock =
          uniqueMenus.map(
            (product) => {
              const stock =
                stockList.find(
                  (item) =>
                    Number(
                      item.menuId
                    ) ===
                    Number(
                      product.id
                    )
                )

              return {
                ...product,
                stockQty: stock
                  ? Number(
                      stock.qty || 0
                    )
                  : 0,
              }
            }
          )

        // -------------------------------
        // 4. ถ้า DB มีข้อมูล
        // -------------------------------
        if (
          productsWithStock.length >
          0
        ) {
          setProducts(
            productsWithStock
          )
        } else {
          setProducts(
            fallbackProducts
          )
        }
      } catch (e) {
        console.error(
          'โหลดสินค้าไม่สำเร็จ:',
          e
        )

        if (alive) {
          setProducts(
            fallbackProducts
          )

          setError(
            'ไม่สามารถโหลดข้อมูลสินค้าได้'
          )
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    loadProducts()

    return () => {
      alive = false
    }
  }, [branchId])

  // =====================================================
  // ซ่อมข้อมูลตะกร้า
  // =====================================================
  useEffect(() => {
    if (!products.length) return

    const current = loadCart()

    const fixed = current
      .map((item) => {
        const menuId = Number(
          item.menuId || item.id
        )

        const product =
          products.find(
            (p) =>
              Number(p.id) ===
              menuId
          )

        if (!product) {
          return null
        }

        const size =
          item.size === 'half' &&
          product.hasHalfOption
            ? 'half'
            : 'full'

        return {
          ...item,

          id: `${product.id}-${size}`,

          menuId: product.id,

          name: product.name,

          price: product.price,

          category:
            product.category,

          hasHalfOption:
            product.hasHalfOption,

          image: product.image,

          size,

          qty: Math.max(
            1,
            Number(
              item.qty || 1
            )
          ),
        }
      })
      .filter(Boolean)

    setCart(fixed)
    saveCart(fixed)
  }, [products])

  // =====================================================
  // ค้นหา
  // =====================================================
  const filteredProducts =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLowerCase()

      if (!keyword) {
        return products
      }

      return products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(keyword)
      )
    }, [products, search])

  // =====================================================
  // อัปเดตตะกร้า
  // =====================================================
  const updateCart = (
    nextCart
  ) => {
    setCart(nextCart)
    saveCart(nextCart)
  }

  // =====================================================
  // เช็กสต็อกก่อนเพิ่มสินค้า
  //
  // เป็ด/ไก่:
  // 1 ตัว = 2 ครึ่งตัว
  //
  // เช่น stock 22 ตัว
  // ขายเต็ม 1 = ใช้ 2 ครึ่งหน่วย
  // ขายครึ่ง 1 = ใช้ 1 ครึ่งหน่วย
  // =====================================================
  const getUsedStockUnits =
    (product) => {
      return cart
        .filter(
          (item) =>
            Number(
              item.menuId
            ) ===
            Number(
              product.id
            )
        )
        .reduce(
          (sum, item) => {
            const qty =
              Number(
                item.qty || 0
              )

            if (
              product.hasHalfOption
            ) {
              return (
                sum +
                qty *
                  (item.size ===
                  'half'
                    ? 1
                    : 2)
              )
            }

            return sum + qty
          },
          0
        )
    }

  const canAddToCart = (
    product,
    size
  ) => {
    const stock =
      Number(
        product.stockQty || 0
      )

    // ข้าวเหนียว / สินค้าที่ไม่มีครึ่ง
    if (
      !product.hasHalfOption
    ) {
      const used =
        getUsedStockUnits(
          product
        )

      return (
        used + 1 <= stock
      )
    }

    // เป็ด / ไก่
    const requiredUnits =
      size === 'half'
        ? 1
        : 2

    const used =
      getUsedStockUnits(
        product
      )

    return (
      used +
        requiredUnits <=
      stock * 2
    )
  }

  // =====================================================
  // เพิ่มสินค้า
  // =====================================================
  const addToCart = (
    product,
    chosenSize = 'full'
  ) => {
    const size =
      product.hasHalfOption &&
      chosenSize === 'half'
        ? 'half'
        : 'full'

    // เช็ก Stock
    if (
      !canAddToCart(
        product,
        size
      )
    ) {
      alert(
        `สินค้า ${product.name} มีไม่เพียงพอ`
      )
      return
    }

    const existing =
      cart.find(
        (item) =>
          Number(
            item.menuId
          ) ===
            Number(
              product.id
            ) &&
          item.size === size
      )

    let nextCart

    if (existing) {
      nextCart =
        cart.map(
          (item) =>
            Number(
              item.menuId
            ) ===
              Number(
                product.id
              ) &&
            item.size === size
              ? {
                  ...item,
                  qty:
                    Number(
                      item.qty ||
                        0
                    ) + 1,
                }
              : item
        )
    } else {
      nextCart = [
        ...cart,
        {
          id: `${product.id}-${size}`,

          menuId:
            product.id,

          name:
            product.name,

          price:
            product.price,

          category:
            product.category,

          hasHalfOption:
            product.hasHalfOption,

          image:
            product.image,

          size,

          qty: 1,
        },
      ]
    }

    updateCart(nextCart)

    setSelectedProduct(null)
  }

  // =====================================================
  // กดซื้อ
  // =====================================================
  const handleBuyClick = (
    product
  ) => {
    if (
      Number(
        product.stockQty || 0
      ) <= 0
    ) {
      alert(
        `สินค้า ${product.name} หมด`
      )
      return
    }

    if (
      product.hasHalfOption
    ) {
      setSelectedProduct(
        selectedProduct?.id ===
          product.id
          ? null
          : product
      )

      return
    }

    addToCart(
      product,
      'full'
    )
  }

  // =====================================================
  // เพิ่ม / ลดจำนวน
  // =====================================================
  const changeQty = (
    index,
    amount
  ) => {
    const item =
      cart[index]

    if (!item) return

    // ถ้าเพิ่ม ต้องเช็ก stock
    if (
      amount > 0
    ) {
      const product =
        products.find(
          (p) =>
            Number(
              p.id
            ) ===
            Number(
              item.menuId
            )
        )

      if (
        product &&
        !canAddToCart(
          product,
          item.size
        )
      ) {
        alert(
          `สินค้า ${product.name} มีไม่เพียงพอ`
        )
        return
      }
    }

    const nextCart =
      cart
        .map(
          (cartItem, i) => {
            if (
              i !== index
            ) {
              return cartItem
            }

            return {
              ...cartItem,
              qty:
                Number(
                  cartItem.qty ||
                    0
                ) + amount,
            }
          }
        )
        .filter(
          (cartItem) =>
            Number(
              cartItem.qty
            ) > 0
        )

    updateCart(
      nextCart
    )
  }

  // =====================================================
  // ลบสินค้า
  // =====================================================
  const removeItem = (
    index
  ) => {
    updateCart(
      cart.filter(
        (_, i) =>
          i !== index
      )
    )
  }

  // =====================================================
  // ยอดรวม
  // =====================================================
  const total =
    cartTotal(cart)

  const totalQty =
    cartQty(cart)

  // =====================================================
  // ยืนยันออเดอร์
  // =====================================================
  const confirmOrder =
    () => {
      if (
        cart.length ===
        0
      ) {
        return
      }

      const order = {
        cart,
        total,
        totalQty,
      }

      savePendingOrder(
        order
      )

      navigate(
        '/order-confirm',
        {
          state: order,
        }
      )
    }

  // =====================================================
  // UI
  // =====================================================
  return (
    <Layout
      title="Sell"
      back={false}
    >

      {/* ค้นหา */}
      <div
        style={{
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          placeholder="⌕   ค้นหาสินค้า"
          value={search}
          onChange={(e) =>
            setSearch(
              e.target.value
            )
          }
          style={{
            width: '100%',
            height: 44,
            borderRadius: 24,
            border:
              '1px solid #bbb',
            padding:
              '0 18px',
            fontSize: 15,
            boxSizing:
              'border-box',
          }}
        />
      </div>

      {/* แจ้งเตือน */}
      {error && (
        <div
          style={{
            background:
              '#fff8e8',
            color:
              '#8a5a00',
            padding: 10,
            borderRadius: 10,
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="receipt-box">
          <p
            style={{
              textAlign:
                'center',
            }}
          >
            กำลังโหลดสินค้า...
          </p>
        </div>
      ) : filteredProducts.length ===
        0 ? (
        <div className="receipt-box">
          <p
            style={{
              textAlign:
                'center',
            }}
          >
            ไม่พบสินค้า
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 12,
          }}
        >

          {filteredProducts.map(
            (product) => {

              const stock =
                Number(
                  product.stockQty ||
                    0
                )

              return (
                <div
                  key={
                    product.id
                  }
                >

                  {/* สินค้า */}
                  <div
                    className="menu-row"
                    style={{
                      alignItems:
                        'center',
                      minHeight:
                        108,
                      padding: 10,
                    }}
                  >

                    {/* รูป */}
                    <img
                      src={
                        product.image
                      }
                      alt={
                        product.name
                      }
                      style={{
                        width: 96,
                        height: 82,
                        objectFit:
                          'cover',
                        borderRadius:
                          14,
                        background:
                          '#fff',
                        flexShrink: 0,
                      }}
                    />

                    {/* ข้อมูล */}
                    <div
                      className="info"
                      style={{
                        minWidth:
                          0,
                        flex: 1,
                      }}
                    >

                      <div
                        style={{
                          fontSize:
                            17,
                          fontWeight:
                            'bold',
                          marginBottom:
                            3,
                        }}
                      >
                        {
                          product.name
                        }
                      </div>

                      <div
                        style={{
                          fontSize:
                            14,
                          color:
                            '#555',
                        }}
                      >
                        {product.hasHalfOption
                          ? `เริ่มต้น ${baht(
                              product.price /
                                2
                            )}`
                          : baht(
                              product.price
                            )}
                      </div>

                      {/* Stock */}
                      <div
                        style={{
                          marginTop:
                            5,
                          fontSize:
                            13,
                          color:
                            stock >
                            0
                              ? '#267a3e'
                              : '#c00',
                          fontWeight:
                            'bold',
                        }}
                      >
                        คงเหลือ:{' '}
                        {stock}{' '}
                        {product.hasHalfOption
                          ? 'ตัว'
                          : 'ชิ้น'}
                      </div>

                    </div>

                    {/* ซื้อ */}
                    <button
                      onClick={() =>
                        handleBuyClick(
                          product
                        )
                      }
                      disabled={
                        stock <=
                        0
                      }
                      style={{
                        border:
                          'none',
                        background:
                          stock >
                          0
                            ? '#ff1111'
                            : '#aaa',
                        color:
                          '#fff',
                        borderRadius:
                          22,
                        padding:
                          '8px 13px',
                        fontWeight:
                          'bold',
                        cursor:
                          stock >
                          0
                            ? 'pointer'
                            : 'not-allowed',
                        display:
                          'flex',
                        alignItems:
                          'center',
                        gap: 5,
                        flexShrink:
                          0,
                      }}
                    >
                      <CartIcon />
                      {stock >
                      0
                        ? 'ซื้อ'
                        : 'หมด'}
                    </button>

                  </div>

                  {/* เลือกเต็ม / ครึ่ง */}
                  {selectedProduct?.id ===
                    product.id && (
                    <div
                      style={{
                        marginTop:
                          -4,
                        background:
                          '#fff',
                        borderRadius:
                          14,
                        padding:
                          12,
                        boxShadow:
                          '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                    >

                      <div
                        style={{
                          fontWeight:
                            'bold',
                          marginBottom:
                            8,
                          fontSize:
                            14,
                        }}
                      >
                        เลือกขนาด
                      </div>

                      <div
                        style={{
                          display:
                            'flex',
                          gap: 8,
                        }}
                      >

                        {/* เต็มตัว */}
                        <button
                          className="btn-primary"
                          style={{
                            flex: 1,
                            margin: 0,
                          }}
                          disabled={
                            !canAddToCart(
                              product,
                              'full'
                            )
                          }
                          onClick={() =>
                            addToCart(
                              product,
                              'full'
                            )
                          }
                        >
                          เต็มตัว
                          <br />
                          <small>
                            {baht(
                              product.price
                            )}
                          </small>
                        </button>

                        {/* ครึ่งตัว */}
                        <button
                          className="btn-outline"
                          style={{
                            flex: 1,
                            margin: 0,
                          }}
                          disabled={
                            !canAddToCart(
                              product,
                              'half'
                            )
                          }
                          onClick={() =>
                            addToCart(
                              product,
                              'half'
                            )
                          }
                        >
                          ครึ่งตัว
                          <br />
                          <small>
                            {baht(
                              product.price /
                                2
                            )}
                          </small>
                        </button>

                      </div>

                    </div>
                  )}

                </div>
              )
            }
          )}

        </div>
      )}

      {/* ตะกร้า */}
      {cart.length >
        0 && (
        <div
          style={{
            marginTop: 20,
          }}
        >

          <h3
            style={{
              marginBottom:
                10,
            }}
          >
            รายการที่เลือก
          </h3>

          {cart.map(
            (
              item,
              index
            ) => (
              <div
                key={`${item.id}-${index}`}
                style={{
                  background:
                    '#fff',
                  borderRadius:
                    15,
                  padding: 12,
                  marginBottom:
                    8,
                  boxShadow:
                    '0 1px 5px #ddd',
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    gap: 10,
                  }}
                >

                  <div
                    style={{
                      flex: 1,
                    }}
                  >
                    <b>
                      {
                        item.name
                      }
                    </b>

                    <div
                      style={{
                        fontSize:
                          13,
                      }}
                    >
                      {item.size ===
                      'half'
                        ? 'ครึ่งตัว'
                        : 'เต็มตัว'}{' '}
                      ×{' '}
                      {
                        item.qty
                      }
                    </div>

                    <div
                      style={{
                        fontWeight:
                          'bold',
                        marginTop:
                          4,
                        fontSize:
                          17,
                      }}
                    >
                      {baht(
                        linePrice(
                          item
                        )
                      )}
                    </div>
                  </div>

                  {/* +/- */}
                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
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
                      {
                        item.qty
                      }
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

                {/* ลบ */}
                <button
                  className="btn-outline"
                  style={{
                    width:
                      '100%',
                    marginTop:
                      8,
                    padding:
                      '6px 10px',
                  }}
                  onClick={() =>
                    removeItem(
                      index
                    )
                  }
                >
                  ลบรายการ
                </button>

              </div>
            )
          )}

          {/* ยอดรวม */}
          <div
            className="receipt-box"
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              fontWeight:
                'bold',
              fontSize:
                20,
            }}
          >
            <span>
              ยอดรวม
            </span>

            <span>
              {baht(total)}
            </span>
          </div>

          {/* ยืนยัน */}
          <button
            className="btn-primary"
            onClick={
              confirmOrder
            }
            style={{
              marginTop:
                8,
              width:
                '100%',
            }}
          >
            ยืนยันออเดอร์
          </button>

        </div>
      )}

    </Layout>
  )
}