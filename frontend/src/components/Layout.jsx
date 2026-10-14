import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  loadQueue,
  onQueueChange,
  startAutoSync,
} from '../offline'

export const CATS = {
  duck: 'เป็ด',
  chicken: 'ไก่',
  other: 'ข้าวเหนียว',
}

export function getStaff() {
  try {
    return JSON.parse(localStorage.getItem('staff') || 'null')
  } catch {
    return null
  }
}

/* =====================================================
   ICONS
===================================================== */

function HomeIcon() {
  return (
    <svg
      width="clamp(24px, 6vw, 30px)"
      height="clamp(24px, 6vw, 30px)"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M3 10.5L12 3L21 10.5V20H14V14H10V20H3V10.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OrderIcon() {
  return (
    <svg
      width="clamp(24px, 6vw, 30px)"
      height="clamp(24px, 6vw, 30px)"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 13L6.5 5H17.5L20 13V19H4V13Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M4 13H9L10 15H14L15 13H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg
      width="clamp(24px, 6vw, 30px)"
      height="clamp(24px, 6vw, 30px)"
      viewBox="0 0 24 24"
      fill="none"
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

function HistoryIcon() {
  return (
    <svg
      width="clamp(24px, 6vw, 30px)"
      height="clamp(24px, 6vw, 30px)"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M3 12A9 9 0 1 0 6 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M3 4V9H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12 7V12L15 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StockIcon() {
  return (
    <svg
      width="clamp(24px, 6vw, 30px)"
      height="clamp(24px, 6vw, 30px)"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4 7L12 3L20 7L12 11L4 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M4 7V17L12 21L20 17V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <path
        d="M12 11V21"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

/* =====================================================
   LAYOUT
===================================================== */

export default function Layout({
  title,
  children,
  back = true,
  right,
}) {
  const nav = useNavigate()

  // สถานะเน็ต + ออเดอร์ที่ค้างรอซิงค์ (ขายตอนออฟไลน์)
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  const [queue, setQueue] = useState(() => loadQueue())

  useEffect(() => {
    startAutoSync()

    const up = () => setOnline(true)
    const down = () => setOnline(false)

    window.addEventListener('online', up)
    window.addEventListener('offline', down)

    const off = onQueueChange(() => setQueue(loadQueue()))

    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      off()
    }
  }, [])

  const waiting = queue.filter(item => !item.failed).length
  const failed = queue.filter(item => item.failed).length

  // เมนูล่าง: หน้าแรก | รับออเดอร์ | ขาย | ประวัติ | Stock
  // แสดงครบทุกช่อง แต่ถ้ากดเข้าส่วนของอีกฝ่าย
  // ระบบจะให้ใส่รหัสของฝ่ายนั้นก่อน (ดู Guard ใน App.jsx)
  const items = [
    { to: '/', label: 'หน้าแรก', icon: <HomeIcon /> },
    { to: '/orders', label: 'รับออเดอร์', icon: <OrderIcon /> },
    { to: '/sell', label: 'ขาย', icon: <CartIcon /> },
    { to: '/history', label: 'ประวัติ', icon: <HistoryIcon /> },
    { to: '/stock', label: 'Stock', icon: <StockIcon /> },
  ]

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        minHeight: '100dvh',
        height: '100dvh',

        margin: 0,
        padding: 0,

        display: 'flex',
        flexDirection: 'column',

        background: '#ffffff',

        overflow: 'hidden',

        boxSizing: 'border-box',
      }}
    >

      {/* =================================================
          TOP BAR
      ================================================== */}

      <header
        style={{
          width: '100%',
          height: 'clamp(54px, 8vh, 68px)',
          minHeight: '54px',

          flexShrink: 0,

          background: '#f52a21',
          color: '#ffffff',

          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',

          alignItems: 'center',

          padding:
            '0 clamp(10px, 3vw, 28px)',

          boxSizing: 'border-box',

          position: 'relative',
          zIndex: 1000,
        }}
      >

        {/* ปุ่มย้อนกลับ */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          {back ? (
            <button
              onClick={() => nav(-1)}
              style={{
                width: 'clamp(38px, 9vw, 48px)',
                height: 'clamp(38px, 9vw, 48px)',

                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',

                border: 'none',
                background: 'transparent',

                color: '#ffffff',

                fontSize: 'clamp(28px, 7vw, 38px)',
                lineHeight: 1,

                cursor: 'pointer',

                padding: 0,
              }}
            >
              ‹
            </button>
          ) : (
            <span
              style={{
                width: 'clamp(38px, 9vw, 48px)',
              }}
            />
          )}
        </div>

        {/* ชื่อหน้า */}

        <div
          style={{
            color: '#ffffff',

            fontSize:
              'clamp(18px, 4vw, 25px)',

            fontWeight: 700,

            textAlign: 'center',

            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>

        {/* ด้านขวา */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',

            color: '#ffffff',
          }}
        >
          {right || (
            <span
              style={{
                width: 'clamp(38px, 9vw, 48px)',
              }}
            />
          )}
        </div>

      </header>


      {/* =================================================
          CONTENT
      ================================================== */}

      {(!online || waiting > 0 || failed > 0) && (
        <div
          onClick={() => nav('/offline-queue')}
          style={{
            background: failed > 0 ? '#b00020' : '#ff9800',
            color: '#ffffff',
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 700,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          {!online && 'ออฟไลน์ — ขายต่อได้ ระบบจะซิงค์เมื่อมีเน็ต'}
          {!online && (waiting > 0 || failed > 0) && ' | '}
          {waiting > 0 && `รอซิงค์ ${waiting} ออเดอร์`}
          {waiting > 0 && failed > 0 && ' | '}
          {failed > 0 && `ซิงค์ไม่สำเร็จ ${failed} ออเดอร์ (กดเพื่อตรวจ)`}
        </div>
      )}

      <main
        style={{
          width: '100%',
          minWidth: 0,

          flex: 1,

          overflowY: 'auto',
          overflowX: 'hidden',

          boxSizing: 'border-box',

          background: '#ffffff',

          paddingTop:
            'clamp(12px, 2vw, 24px)',

          paddingLeft:
            'clamp(12px, 4vw, 32px)',

          paddingRight:
            'clamp(12px, 4vw, 32px)',

          /*
            เว้นพื้นที่ให้ Bottom Navigation
          */

          paddingBottom:
            'calc(clamp(78px, 11vh, 92px) + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>


      {/* =================================================
          BOTTOM NAVIGATION

          ลำดับ: หน้าแรก | รับออเดอร์ | ขาย | ประวัติ | Stock

          - ฝ่ายขาย  เห็น: หน้าแรก, รับออเดอร์, ขาย, ประวัติ
          - ฝ่ายสต็อก เห็น: หน้าแรก, Stock
          - Admin    เห็นครบทุกช่อง
      ================================================== */}

      <nav
        style={{
          position: 'fixed',

          left: 0,
          right: 0,
          bottom: 0,

          width: '100%',

          height:
            'clamp(70px, 11vh, 88px)',

          minHeight: '70px',

          background: '#f52a21',

          color: '#ffffff',

          display: 'flex',

          alignItems: 'stretch',
          justifyContent: 'stretch',

          boxSizing: 'border-box',

          paddingBottom:
            'env(safe-area-inset-bottom)',

          zIndex: 9999,

          boxShadow:
            '0 -2px 8px rgba(0,0,0,0.15)',
        }}
      >
        {items.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              flex: '1 1 0',

              minWidth: 0,

              display: 'flex',

              flexDirection: 'column',

              alignItems: 'center',
              justifyContent: 'center',

              gap: 'clamp(3px, 1vw, 6px)',

              color: '#ffffff',

              textDecoration: 'none',

              fontSize:
                'clamp(11px, 2.8vw, 16px)',

              fontWeight: 700,

              background: isActive
                ? 'rgba(255,255,255,0.18)'
                : 'transparent',

              borderRight:
                index < items.length - 1
                  ? '1px solid rgba(255,255,255,0.35)'
                  : 'none',

              boxSizing: 'border-box',

              transition: '0.2s',
            })}
          >
            {item.icon}

            <span
              style={{
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

    </div>
    
  )
}