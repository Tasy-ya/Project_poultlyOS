// ไอคอนเส้นสีเดียว (ใช้สีตามตัวอักษร currentColor) แทนอีโมจิสี
// สไตล์เดียวกับไอคอนเอกสาร: เส้นหนา ปลายมน
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
}

// เอกสาร / สลิป
export function IconSlip({ size = 22, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 12h7M8.5 15h7M8.5 18h4" />
    </svg>
  )
}

// รับออเดอร์แล้ว (ถาดรับ)
export function IconReceived({ size = 22, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M4 13l2.2-7h11.6L20 13" />
      <path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6" />
      <path d="M4 13h4.5l1 2.5h5l1-2.5H20" />
    </svg>
  )
}

// กำลังเตรียม (หม้อมีไอน้ำ)
export function IconPrep({ size = 22, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M5 11h14v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6z" />
      <path d="M5 14H3M19 14h2" />
      <path d="M9 3.5c-1 1.4 1 2.4 0 3.8M14 3.5c-1 1.4 1 2.4 0 3.8" />
    </svg>
  )
}

// พร้อมรับออเดอร์ (ถุงมีเครื่องหมายถูก)
export function IconReady({ size = 22, ...rest }) {
  return (
    <svg {...base} width={size} height={size} {...rest}>
      <path d="M5 8h14l-1 12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 8z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      <path d="M9.5 14.5l2 2 3.5-3.5" />
    </svg>
  )
}

// เครื่องหมายถูก
export function IconCheck({ size = 22, ...rest }) {
  return (
    <svg {...base} strokeWidth={3} width={size} height={size} {...rest}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
