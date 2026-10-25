import { Link, useLocation } from 'react-router-dom'

// =====================================================
// แถบเมนูล่างของ Admin (ใช้ร่วมกันทุกหน้า Admin)
//
// หน้าหลัก | ประวัติการขาย | ประวัติสต็อก | แก้ไขสินค้า | โปรโมชั่น | จัดการสาขา
//
// อยากสลับตำแหน่งปุ่ม ให้ย้ายลำดับในอาร์เรย์ ITEMS ด้านล่าง
// =====================================================

const SW = 1.8

function Svg({ size, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const P = {
  stroke: 'currentColor',
  strokeWidth: SW,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

function HomeIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M3 10.5L12 3L21 10.5" {...P} />
      <path d="M5 9.5V20H19V9.5" {...P} />
      <path d="M9 20V14H15V20" {...P} />
    </Svg>
  )
}

function ReceiptIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path
        d="M6 3.5C4.9 3.5 4 4.4 4 5.5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V8L15.5 3.5H6Z"
        {...P}
      />
      <path d="M15 3.5V8H20" {...P} />
      <path d="M8 11H16" {...P} />
      <path d="M8 14.5H16" {...P} />
      <path d="M8 18H13" {...P} />
    </Svg>
  )
}

// กล่องสต็อก + นาฬิกา = ประวัติสต็อก
function StockHistoryIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M3 7.5L10.5 4L18 7.5L10.5 11L3 7.5Z" {...P} />
      <path d="M3 7.5V16L10.5 19.5" {...P} />
      <path d="M10.5 11V19.5" {...P} />
      <path d="M18 7.5V10" {...P} />
      <circle cx="17.5" cy="16.5" r="4.5" {...P} />
      <path d="M17.5 14.3V16.6L19 17.6" {...P} />
    </Svg>
  )
}

function ShoppingBagIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M5 8H19L20 20H4L5 8Z" {...P} />
      <path d="M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8" {...P} />
      <path d="M8 12C8 14.2 9.8 16 12 16C14.2 16 16 14.2 16 12" {...P} />
    </Svg>
  )
}

function GiftIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M4 10H20V20H4V10Z" {...P} />
      <path d="M3 7H21V10H3V7Z" {...P} />
      <path d="M12 7V20" {...P} />
      <path d="M12 7H8.5C7.1 7 6 5.9 6 4.5C6 3.7 6.7 3 7.5 3C9.5 3 12 5.1 12 7Z" {...P} />
      <path d="M12 7H15.5C16.9 7 18 5.9 18 4.5C18 3.7 17.3 3 16.5 3C14.5 3 12 5.1 12 7Z" {...P} />
    </Svg>
  )
}

function BuildingIcon({ size = 26 }) {
  return (
    <Svg size={size}>
      <path d="M4 21V5L14 3V21" {...P} />
      <path d="M14 9H20V21" {...P} />
      <path d="M8 8H10" {...P} />
      <path d="M8 12H10" {...P} />
      <path d="M8 16H10" {...P} />
      <path d="M17 13H18" {...P} />
      <path d="M17 17H18" {...P} />
    </Svg>
  )
}

const ITEMS = [
  { to: '/admin', label: 'หน้าหลัก', Icon: HomeIcon, exact: true },
  { to: '/admin/sales', label: 'ประวัติการขาย', Icon: ReceiptIcon },
  { to: '/admin/stock-history', label: 'ประวัติสต็อก', Icon: StockHistoryIcon },
  { to: '/admin/products', label: 'แก้ไขสินค้า', Icon: ShoppingBagIcon },
  { to: '/admin/promotions', label: 'โปรโมชั่น', Icon: GiftIcon },
  { to: '/admin/branches', label: 'จัดการสาขา', Icon: BuildingIcon },
]

export const ADMIN_NAV_HEIGHT = 74

export default function AdminBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: ADMIN_NAV_HEIGHT,
        background: '#ff1111',
        display: 'flex',
        justifyContent: 'center',
        zIndex: 3000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxSizing: 'content-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 2000,
          display: 'grid',
          gridTemplateColumns: `repeat(${ITEMS.length}, minmax(0, 1fr))`,
          alignItems: 'stretch',
        }}
      >
        {ITEMS.map(({ to, label, Icon, exact }) => {
          const active = exact
            ? pathname === to
            : pathname === to || pathname.startsWith(`${to}/`)

          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              style={{
                textDecoration: 'none',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minWidth: 0,
                padding: '0 2px',
                fontSize: 'clamp(10px, 2.7vw, 12px)',
                lineHeight: 1.15,
                textAlign: 'center',
                fontWeight: active ? 700 : 600,
                background: active ? 'rgba(255,255,255,0.20)' : 'transparent',
                borderRadius: active ? '12px 12px 0 0' : 0,
                marginTop: active ? 4 : 0,
                transition: 'background 0.2s, margin-top 0.2s',
              }}
            >
              <Icon size={24} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
