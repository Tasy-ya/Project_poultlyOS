import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import { api } from '../api'
import AdminBottomNav from '../components/AdminBottomNav'


// =====================================================
// ICONS (แถบนำทางเหมือนหน้าแก้ไขสินค้า)
// =====================================================

function HomeIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 10.5L12 3L21 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V20H19V9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 20V14H15V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ReceiptIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 3.5C4.9 3.5 4 4.4 4 5.5V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V8L15.5 3.5H6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 3.5V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 14.5H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 18H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function ShoppingBagIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 8H19L20 20H4L5 8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8V6C8 4.9 8.9 4 10 4H14C15.1 4 16 4.9 16 6V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12C8 14.2 9.8 16 12 16C14.2 16 16 14.2 16 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function GiftIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 10H20V20H4V10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 7H21V10H3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7V20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7H8.5C7.1 7 6 5.9 6 4.5C6 3.7 6.7 3 7.5 3C9.5 3 12 5.1 12 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7H15.5C16.9 7 18 5.9 18 4.5C18 3.7 17.3 3 16.5 3C14.5 3 12 5.1 12 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BuildingIcon({ size = 25 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 21V5L14 3V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9H20V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 12H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 16H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 13H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 17H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


// =====================================================
// FILLED ICONS (ไอคอนทึบ แทน emoji)
// =====================================================

function FilledSvg({ size = 20, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

function GiftFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <rect x="2" y="7" width="20" height="4" rx="1" />
      <path d="M4 12.5h7V21H6a2 2 0 0 1-2-2v-6.5zM13 12.5h7V19a2 2 0 0 1-2 2h-5v-8.5z" />
      <path d="M11.2 6.2C10.6 3.6 8.9 2 7.6 2.6 6.3 3.2 6.4 5.2 8 6.2h3.2zM12.8 6.2c.6-2.6 2.3-4.2 3.6-3.6 1.3.6 1.2 2.6-.4 3.6h-3.2z" />
    </FilledSvg>
  )
}

function BoxFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M12 2.2 3.6 6.4 12 10.6l8.4-4.2L12 2.2z" />
      <path d="M3 8.2v8.3c0 .4.2.7.6.9l7.4 3.7v-10L3 8.2z" />
      <path d="M21 8.2l-8 4.1v10l7.4-3.7c.4-.2.6-.5.6-.9V8.2z" />
    </FilledSvg>
  )
}

function BagFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M6 8V7a6 6 0 0 1 12 0v1h1.5a1 1 0 0 1 1 1.1l-1 11a1 1 0 0 1-1 .9H5.5a1 1 0 0 1-1-.9l-1-11a1 1 0 0 1 1-1.1H6zm2 0h8V7a4 4 0 0 0-8 0v1z"
      />
    </FilledSvg>
  )
}

function TagFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M3 4a1 1 0 0 1 1-1h7.6a1 1 0 0 1 .7.3l8.4 8.4a1 1 0 0 1 0 1.4l-7.6 7.6a1 1 0 0 1-1.4 0L3.3 12.3A1 1 0 0 1 3 11.6V4zm4.5 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
      />
    </FilledSvg>
  )
}

function StarFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
    </FilledSvg>
  )
}

function PartyFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M3 21l4.5-13 8.5 8.5L3 21z" />
      <circle cx="14.5" cy="5" r="1.6" />
      <circle cx="19.5" cy="9.5" r="1.6" />
      <circle cx="19.5" cy="3.8" r="1.1" />
      <circle cx="11" cy="2.8" r="1" />
    </FilledSvg>
  )
}

function SparkleFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2z" />
    </FilledSvg>
  )
}

function CalendarFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1zM5 10v10h14V10H5z"
      />
    </FilledSvg>
  )
}

function TrashFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M9 2a1 1 0 0 0-1 1v2H4a1 1 0 0 0 0 2h1l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13h1a1 1 0 1 0 0-2h-4V3a1 1 0 0 0-1-1H9zm1 3V4h4v1h-4z"
      />
    </FilledSvg>
  )
}

const TYPE_ICONS = {
  giveaway: GiftFilledIcon,
  bulk: BoxFilledIcon,
  bundle: BagFilledIcon,
  discount: TagFilledIcon,
  vip: StarFilledIcon,
  festival: PartyFilledIcon,
  other: SparkleFilledIcon,
}

function TypeIcon({ type, size = 20 }) {
  const Icon = TYPE_ICONS[type] || SparkleFilledIcon

  return <Icon size={size} />
}


// =====================================================
// PROMOTION DATA MODEL
// -----------------------------------------------------
// โครงสร้างเดียวใช้ร่วมกันทั้ง Admin / พนักงาน / ลูกค้า
//
// {
//   id, type, title, description, isActive,
//   startDate, endDate,           // 'YYYY-MM-DD' (ค.ศ.) หรือ '' = ไม่กำหนด
//   productId, productName,       // '' = ทุกสินค้า
//   showToStaff, showToCustomer,  // ควบคุมว่าแสดงฝั่งไหน
//   summary,                      // ข้อความสั้นสำหรับการ์ดพนักงาน/ลูกค้า
//   giveaway: { prizeCount, prizePerPerson, joinMethod, postUrl,
//               announceDate, announceMethod, claimMethod, note },
//   pricing:  { minQty, discountType, discountValue, bundleDetail,
//               bundlePrice, customerNote },
// }
// =====================================================

export const PROMO_TYPES = {
  giveaway: { label: 'แจกฟรี / กิจกรรม' },
  bulk: { label: 'ซื้อจำนวนมาก' },
  bundle: { label: 'ซื้อคู่ / ซื้อเป็นชุด' },
  discount: { label: 'ลดราคา' },
  vip: { label: 'ลูกค้าพิเศษ' },
  festival: { label: 'เทศกาล' },
  other: { label: 'อื่น ๆ' },
}

const JOIN_METHODS = {
  comment_draw: 'จับฉลากจากความคิดเห็นในโพสต์',
  share_post: 'แชร์โพสต์ร่วมกิจกรรม',
  in_store: 'ซื้อสินค้าที่หน้าร้าน',
}

const ANNOUNCE_METHODS = {
  live: 'ไลฟ์สด',
  post: 'ประกาศในโพสต์',
  line: 'ทาง LINE',
}

const CLAIM_METHODS = {
  pickup: 'รับที่หน้าร้าน',
  delivery: 'จัดส่งให้',
}

const DISCOUNT_TYPES = {
  percent: 'ลดเป็น %',
  baht: 'ลดเป็นบาท',
  special_price: 'ราคาพิเศษต่อหน่วย',
}

const STATUS_META = {
  active: { label: 'กำลังใช้งาน', dot: '#2e9e4f', bg: '#e5f7e9', color: '#218838' },
  upcoming: { label: 'กำลังจะมา', dot: '#e0a100', bg: '#fff6dd', color: '#a06b00' },
  ended: { label: 'สิ้นสุดแล้ว', dot: '#aaaaaa', bg: '#eee', color: '#777' },
  off: { label: 'ยกเลิกแล้ว', dot: '#444444', bg: '#eee', color: '#777' },
}

const FILTER_TABS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'active', label: 'กำลังใช้งาน' },
  { key: 'upcoming', label: 'กำลังจะมา' },
  { key: 'ended', label: 'สิ้นสุด' },
]

function emptyGiveaway() {
  return {
    prizeCount: '',
    prizePerPerson: '1',
    joinMethod: 'comment_draw',
    postUrl: '',
    announceDate: '',
    announceMethod: 'live',
    claimMethod: 'pickup',
    note: '',
  }
}

function emptyPricing() {
  return {
    minQty: '',
    discountType: 'percent',
    discountValue: '',
    bundleDetail: '',
    bundlePrice: '',
    customerNote: '',
  }
}

function emptyPromo(type = 'giveaway') {
  return {
    id: null,
    type,
    title: '',
    description: '',
    isActive: true,
    startDate: '',
    endDate: '',
    productId: '',
    productName: '',
    showToStaff: true,
    showToCustomer: true,
    summary: '',
    giveaway: emptyGiveaway(),
    pricing: emptyPricing(),
  }
}

function normalizePromo(raw) {
  const base = emptyPromo(raw?.type || 'other')

  return {
    ...base,
    ...raw,
    giveaway: { ...base.giveaway, ...(raw?.giveaway || {}) },
    pricing: { ...base.pricing, ...(raw?.pricing || {}) },
    isActive: raw?.isActive ?? raw?.is_active ?? true,
  }
}


// =====================================================
// SHARED HELPERS (นำไปใช้ฝั่งพนักงาน/ลูกค้าได้ภายหลัง)
// =====================================================

function todayString() {
  return new Date().toLocaleDateString('en-CA')
}

export function promotionStatus(promo) {
  if (!promo?.isActive) {
    return 'off'
  }

  const today = todayString()

  if (promo.startDate && promo.startDate > today) {
    return 'upcoming'
  }

  if (promo.endDate && promo.endDate < today) {
    return 'ended'
  }

  return 'active'
}

// audience: 'staff' | 'customer'
// คืนเฉพาะโปรโมชั่นที่กำลังใช้งานและเปิดให้กลุ่มนั้นเห็น
export function getVisiblePromotions(promotions, audience) {
  return (promotions || []).filter(promo => {
    if (promotionStatus(promo) !== 'active') {
      return false
    }

    return audience === 'staff'
      ? promo.showToStaff !== false
      : promo.showToCustomer !== false
  })
}

export function promotionSummary(promo) {
  if (promo.summary) {
    return promo.summary
  }

  const g = promo.giveaway || {}
  const p = promo.pricing || {}

  if (promo.type === 'giveaway' && g.prizeCount) {
    return `แจก ${g.prizeCount} รางวัล คนละ ${g.prizePerPerson || 1} ตัว`
  }

  if (['bulk', 'discount'].includes(promo.type) && p.minQty) {
    return `ซื้อ ${p.minQty} ตัวขึ้นไป รับราคาพิเศษ`
  }

  return promo.description || ''
}

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const d = new Date(`${value}T00:00:00`)

  if (Number.isNaN(d.getTime())) {
    return '-'
  }

  return d.toLocaleDateString('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function dateRangeText(promo) {
  if (!promo.startDate && !promo.endDate) {
    return 'ไม่กำหนดช่วงเวลา'
  }

  return `${formatDate(promo.startDate)} - ${formatDate(promo.endDate)}`
}

function numberValue(value) {
  const n = Number(value)

  return Number.isFinite(n)
    ? n
    : 0
}


// =====================================================
// STORAGE
// -----------------------------------------------------
// api.getPromotions(branchId) เดิมเป็นของฝั่งพนักงาน (/promotions/active)
// หน้านี้จึงใช้ฟังก์ชันฝั่ง Admin แยกต่างหาก:
//   api.getAdminPromotions / createPromotion /
//   updatePromotion / deletePromotion
//
// USE_LOCAL_PROMOTIONS = true  -> เก็บใน localStorage ชั่วคราว
//                                 (ใช้ได้ทันทีโดยยังไม่มี backend)
// USE_LOCAL_PROMOTIONS = false -> เรียก backend จริง
// =====================================================

const STORAGE_KEY = 'poultryos_promotions'

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw) {
      const list = JSON.parse(raw)

      if (Array.isArray(list)) {
        return list
      }
    }
  } catch (err) {
    console.error('Read promotions:', err)
  }

  return null
}

function writeLocal(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('Write promotions:', err)
  }
}

function seedPromotions() {
  return [
    {
      ...emptyPromo('giveaway'),
      id: 'promo_seed_giveaway',
      title: 'แจกไก่ฟรีช่วงเทศกาล',
      description: 'แจกไก่คนละ 1 ตัว จำนวน 20 รางวัล\nกิจกรรมจับฉลากจากความคิดเห็นในโพสต์',
      productName: 'ไก่หมุนขมิ้น',
      startDate: '2026-12-01',
      endDate: '2026-12-15',
      giveaway: {
        prizeCount: '20',
        prizePerPerson: '1',
        joinMethod: 'comment_draw',
        postUrl: '',
        announceDate: '2026-12-16',
        announceMethod: 'live',
        claimMethod: 'pickup',
        note: 'ผู้ได้รับรางวัลจะประกาศผ่านไลฟ์สด และสามารถมารับรางวัลที่หน้าร้าน',
      },
    },
    {
      ...emptyPromo('bulk'),
      id: 'promo_seed_bulk',
      title: 'ซื้อจำนวนมาก ราคาพิเศษ',
      description: 'ซื้อไก่/เป็ดตามจำนวนที่กำหนด\nรับราคาพิเศษกว่าปกติ',
      pricing: {
        ...emptyPricing(),
        minQty: '10',
        discountType: 'special_price',
        discountValue: '',
      },
    },
  ]
}

const USE_LOCAL_PROMOTIONS = false

async function fetchPromotions() {
  if (!USE_LOCAL_PROMOTIONS) {
    const result = await api.getAdminPromotions()

    const rows =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.promotions)
          ? result.promotions
          : Array.isArray(result?.data)
            ? result.data
            : []

    return rows.map(normalizePromo)
  }

  const local = readLocal()

  if (local) {
    return local.map(normalizePromo)
  }

  const seeded = seedPromotions()

  writeLocal(seeded)

  return seeded.map(normalizePromo)
}

async function persistPromotion(promo) {
  const isNew = !promo.id

  if (!USE_LOCAL_PROMOTIONS) {
    return isNew
      ? api.createPromotion(promo)
      : api.updatePromotion(promo.id, promo)
  }

  const list = readLocal() || []

  if (isNew) {
    list.push({ ...promo, id: `promo_${Date.now()}` })
  } else {
    const index = list.findIndex(p => p.id === promo.id)

    if (index >= 0) {
      list[index] = promo
    } else {
      list.push(promo)
    }
  }

  writeLocal(list)

  return promo
}

async function removePromotion(id) {
  if (!USE_LOCAL_PROMOTIONS) {
    return api.deletePromotion(id)
  }

  writeLocal(
    (readLocal() || []).filter(p => p.id !== id)
  )

  return true
}


// =====================================================
// SHARED STYLES
// =====================================================

const labelStyle = {
  display: 'block',
  fontSize: 13,
  color: '#666',
  marginBottom: 5,
}

const inputStyle = (mb = 12, padding = '11px 12px') => ({
  width: '100%',
  boxSizing: 'border-box',
  padding,
  border: '1px solid #ddd',
  borderRadius: 9,
  marginBottom: mb,
  fontSize: 14,
  background: '#fff',
})

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 4000,
}

const modalStyle = (maxWidth = 500) => ({
  width: '100%',
  maxWidth,
  maxHeight: '90vh',
  overflowY: 'auto',
  background: '#fff',
  borderRadius: 16,
  padding: 20,
})

const errorBoxStyle = {
  background: '#ffe8e8',
  border: '1px solid #ffbcbc',
  color: '#b00000',
  borderRadius: 12,
  padding: 14,
  marginBottom: 14,
}

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 14,
  padding: 16,
}

const cancelBtnStyle = {
  border: '1px solid #ddd',
  background: '#fff',
  borderRadius: 9,
  padding: '11px',
  cursor: 'pointer',
}

const primaryBtnStyle = {
  border: 'none',
  background: '#ff1111',
  color: '#fff',
  borderRadius: 9,
  padding: '11px',
  cursor: 'pointer',
  fontWeight: 700,
}

const twoColStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
}

const sectionTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: '22px 0 10px',
  fontSize: 18,
  paddingBottom: 8,
  borderBottom: '1px solid #e5e5e5',
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
}


// =====================================================
// SMALL COMPONENTS
// =====================================================

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.off

  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 9px',
        borderRadius: 20,
        background: meta.bg,
        color: meta.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: meta.dot,
          marginRight: 6,
        }}
      />
      {meta.label}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <>
      <label style={labelStyle}>
        {label}
      </label>

      {children}
    </>
  )
}

function DetailRow({ label, value, multiline = false }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 0',
        borderTop: '1px solid #f1f1f1',
        fontSize: 14,
      }}
    >
      <span style={{ color: '#777', flexShrink: 0 }}>
        {label}
      </span>

      <span
        style={{
          fontWeight: 600,
          textAlign: 'right',
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
        }}
      >
        {value || '-'}
      </span>
    </div>
  )
}

function PromoCard({ promo, onDetail, onEdit, onToggle, onDelete }) {
  const status = promotionStatus(promo)
  const type = PROMO_TYPES[promo.type] || PROMO_TYPES.other

  return (
    <div style={cardStyle}>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <TypeIcon type={promo.type} size={20} />
            <span>{promo.title || 'ไม่ระบุชื่อ'}</span>
          </div>

          <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
            {type.label}
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      {promo.description && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: '#555',
            whiteSpace: 'pre-wrap',
          }}
        >
          {promo.description}
        </div>
      )}

      <div
        style={{
          marginTop: 12,
          fontSize: 13,
          color: '#666',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <CalendarFilledIcon size={15} />
        {dateRangeText(promo)}
      </div>

      <div style={{ ...twoColStyle, marginTop: 14 }}>
        <button
          type="button"
          onClick={() => onDetail(promo)}
          style={{ ...cancelBtnStyle, fontWeight: 600 }}
        >
          รายละเอียด
        </button>

        <button
          type="button"
          onClick={() => onEdit(promo)}
          style={{ ...cancelBtnStyle, fontWeight: 600 }}
        >
          แก้ไข
        </button>
      </div>

      <div style={{ ...twoColStyle, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => onToggle(promo)}
          style={{
            ...cancelBtnStyle,
            fontWeight: 600,
            background: promo.isActive ? '#fff' : '#e8f5e9',
            color: promo.isActive ? '#555' : '#2e7d32',
          }}
        >
          {promo.isActive
            ? 'ยกเลิกโปรโมชั่น'
            : 'เปิดใช้งานอีกครั้ง'}
        </button>

        <button
          type="button"
          onClick={() => onDelete(promo)}
          style={{
            ...cancelBtnStyle,
            border: 'none',
            background: '#fff0f0',
            color: '#c62828',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <TrashFilledIcon size={16} />
          ลบโปรโมชั่น
        </button>
      </div>

    </div>
  )
}

function EmptyTypeCard({ type, onAdd }) {
  const meta = PROMO_TYPES[type]

  return (
    <div
      style={{
        ...cardStyle,
        background: '#fafafa',
        borderStyle: 'dashed',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <TypeIcon type={type} size={19} />
        {meta.label}
      </div>

      <div style={{ fontSize: 12, color: '#999', margin: '4px 0 12px' }}>
        ยังไม่เปิดใช้งาน
      </div>

      <button
        type="button"
        onClick={() => onAdd(type)}
        style={{ ...cancelBtnStyle, width: '100%', fontWeight: 600 }}
      >
        เพิ่มโปรโมชั่น
      </button>
    </div>
  )
}


// =====================================================
// ADMIN PROMOTIONS PAGE
// =====================================================

export default function AdminPromotionsPage() {

  // ===================================================
  // DATA
  // ===================================================

  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [products, setProducts] = useState([])


  // ===================================================
  // UI STATE
  // ===================================================

  const [filter, setFilter] = useState('all')

  const [showTypePicker, setShowTypePicker] = useState(false)

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [detailPromo, setDetailPromo] = useState(null)


  // ===================================================
  // LOAD
  // ===================================================

  async function loadPromotions() {
    try {
      setLoading(true)
      setLoadError('')

      setPromotions(await fetchPromotions())

    } catch (err) {
      console.error('Promotions:', err)

      setLoadError(
        err?.message ||
          'ไม่สามารถโหลดโปรโมชั่นได้'
      )

      setPromotions([])

    } finally {
      setLoading(false)
    }
  }

  async function loadProducts() {
    try {
      const result = await api.getMenus()

      const rows =
        Array.isArray(result)
          ? result
          : Array.isArray(result?.menus)
            ? result.menus
            : Array.isArray(result?.data)
              ? result.data
              : []

      setProducts(
        rows.map(menu => ({
          id: String(
            menu.id ||
            menu.menuId ||
            menu.menu_id ||
            ''
          ),
          name:
            menu.name ||
            menu.menu_name ||
            '',
        }))
      )

    } catch (err) {
      console.error('Promotion products:', err)

      setProducts([])
    }
  }

  useEffect(() => {
    loadPromotions()
    loadProducts()
  }, [])


  // ===================================================
  // FILTER / GROUP
  // ===================================================

  const filtered = useMemo(() => {
    return promotions.filter(promo => {
      const status = promotionStatus(promo)

      if (filter === 'all') {
        return true
      }

      if (filter === 'ended') {
        return status === 'ended' || status === 'off'
      }

      return status === filter
    })
  }, [promotions, filter])

  const giveaways = filtered.filter(p => p.type === 'giveaway')
  const bulks = filtered.filter(p => p.type === 'bulk')
  const others = filtered.filter(
    p => p.type !== 'giveaway' && p.type !== 'bulk'
  )

  // ประเภทที่ยังไม่มีโปรโมชั่นเลย (ใช้แสดงการ์ด "ยังไม่เปิดใช้งาน")
  const emptyTypes = ['bundle', 'discount', 'vip', 'festival', 'other']
    .filter(type => !promotions.some(p => p.type === type))

  const productOptions =
    products.length > 0
      ? products
      : [
          { id: 'chicken', name: 'ไก่หมุนขมิ้น' },
          { id: 'duck', name: 'เป็ดย่างเกลือ' },
        ]


  // ===================================================
  // ACTIONS
  // ===================================================

  function startAdd(type) {
    setShowTypePicker(false)

    setForm(emptyPromo(type))
  }

  function startEdit(promo) {
    setDetailPromo(null)

    setForm(normalizePromo(promo))
  }

  function updateForm(patch) {
    setForm(current => ({ ...current, ...patch }))
  }

  function updateGiveaway(patch) {
    setForm(current => ({
      ...current,
      giveaway: { ...current.giveaway, ...patch },
    }))
  }

  function updatePricing(patch) {
    setForm(current => ({
      ...current,
      pricing: { ...current.pricing, ...patch },
    }))
  }

  function selectProduct(productId) {
    const found = productOptions.find(p => p.id === productId)

    updateForm({
      productId,
      productName: found?.name || '',
    })
  }

  async function savePromotion() {
    if (!form) {
      return
    }

    if (!form.title.trim()) {
      alert('กรุณากรอกชื่อโปรโมชั่น')

      return
    }

    if (
      form.startDate &&
      form.endDate &&
      form.endDate < form.startDate
    ) {
      alert('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม')

      return
    }

    if (form.type === 'giveaway') {
      if (numberValue(form.giveaway.prizeCount) <= 0) {
        alert('กรุณาระบุจำนวนรางวัล')

        return
      }
    }

    if (form.type === 'bulk') {
      if (numberValue(form.pricing.minQty) <= 0) {
        alert('กรุณาระบุจำนวนขั้นต่ำที่ซื้อ')

        return
      }
    }

    try {
      setSaving(true)

      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        is_active: form.isActive,
      }

      await persistPromotion(payload)

      setForm(null)

      await loadPromotions()

      alert('บันทึกโปรโมชั่นเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Save Promotion:', err)

      alert(
        err?.message ||
          'ไม่สามารถบันทึกโปรโมชั่นได้'
      )

    } finally {
      setSaving(false)
    }
  }

  async function togglePromotion(promo) {
    if (promo.isActive) {
      const confirmed =
        window.confirm(
          `ต้องการยกเลิก "${promo.title}" ใช่หรือไม่?\n(เปิดใช้งานอีกครั้งได้ภายหลัง)`
        )

      if (!confirmed) {
        return
      }
    }

    try {
      await persistPromotion({
        ...promo,
        isActive: !promo.isActive,
        is_active: !promo.isActive,
      })

      setDetailPromo(null)

      await loadPromotions()

    } catch (err) {
      console.error('Toggle Promotion:', err)

      alert(
        err?.message ||
          'ไม่สามารถเปลี่ยนสถานะโปรโมชั่นได้'
      )
    }
  }

  async function deletePromotion(promo) {
    const confirmed =
      window.confirm(
        `ต้องการลบ "${promo.title}" ใช่หรือไม่?`
      )

    if (!confirmed) {
      return
    }

    try {
      await removePromotion(promo.id)

      setForm(null)
      setDetailPromo(null)

      await loadPromotions()

      alert('ลบโปรโมชั่นเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Delete Promotion:', err)

      alert(
        err?.message ||
          'ไม่สามารถลบโปรโมชั่นได้'
      )
    }
  }


  // ===================================================
  // RENDER HELPERS
  // ===================================================

  function renderCards(list) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {list.map(promo => (
          <PromoCard
            key={promo.id}
            promo={promo}
            onDetail={setDetailPromo}
            onEdit={startEdit}
            onToggle={togglePromotion}
            onDelete={deletePromotion}
          />
        ))}
      </div>
    )
  }

  function renderTypeFields() {
    if (!form) {
      return null
    }

    const g = form.giveaway
    const p = form.pricing

    if (form.type === 'giveaway') {
      return (
        <>
          <div style={twoColStyle}>
            <div>
              <Field label="จำนวนรางวัล">
                <input
                  type="number"
                  min="0"
                  value={g.prizeCount}
                  onChange={e => updateGiveaway({ prizeCount: e.target.value })}
                  style={inputStyle(12)}
                />
              </Field>
            </div>

            <div>
              <Field label="ของรางวัลต่อคน (ตัว)">
                <input
                  type="number"
                  min="0"
                  value={g.prizePerPerson}
                  onChange={e => updateGiveaway({ prizePerPerson: e.target.value })}
                  style={inputStyle(12)}
                />
              </Field>
            </div>
          </div>

          <Field label="วิธีเข้าร่วม">
            <select
              value={g.joinMethod}
              onChange={e => updateGiveaway({ joinMethod: e.target.value })}
              style={inputStyle(12)}
            >
              {Object.entries(JOIN_METHODS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="ลิงก์โพสต์">
            <input
              type="url"
              placeholder="https://"
              value={g.postUrl}
              onChange={e => updateGiveaway({ postUrl: e.target.value })}
              style={inputStyle(12)}
            />
          </Field>

          <Field label="วันประกาศผล">
            <input
              type="date"
              value={g.announceDate}
              onChange={e => updateGiveaway({ announceDate: e.target.value })}
              style={inputStyle(12)}
            />
          </Field>

          <Field label="วิธีประกาศผล">
            <select
              value={g.announceMethod}
              onChange={e => updateGiveaway({ announceMethod: e.target.value })}
              style={inputStyle(12)}
            >
              {Object.entries(ANNOUNCE_METHODS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="วิธีรับรางวัล">
            <select
              value={g.claimMethod}
              onChange={e => updateGiveaway({ claimMethod: e.target.value })}
              style={inputStyle(12)}
            >
              {Object.entries(CLAIM_METHODS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>

          <Field label="รายละเอียดเพิ่มเติม">
            <textarea
              rows={3}
              value={g.note}
              onChange={e => updateGiveaway({ note: e.target.value })}
              style={{ ...inputStyle(12), resize: 'vertical' }}
            />
          </Field>
        </>
      )
    }

    if (form.type === 'bundle') {
      return (
        <>
          <Field label="รายการในชุด">
            <textarea
              rows={2}
              placeholder="เช่น ไก่หมุน 1 ตัว + ข้าวเหนียว 1 ถุง"
              value={p.bundleDetail}
              onChange={e => updatePricing({ bundleDetail: e.target.value })}
              style={{ ...inputStyle(12), resize: 'vertical' }}
            />
          </Field>

          <Field label="ราคาชุด (บาท)">
            <input
              type="number"
              min="0"
              value={p.bundlePrice}
              onChange={e => updatePricing({ bundlePrice: e.target.value })}
              style={inputStyle(12)}
            />
          </Field>
        </>
      )
    }

    if (
      form.type === 'bulk' ||
      form.type === 'discount' ||
      form.type === 'vip' ||
      form.type === 'festival' ||
      form.type === 'other'
    ) {
      return (
        <>
          {(form.type === 'festival' || form.type === 'other') && (
            <small style={{ display: 'block', marginBottom: 8, color: '#777' }}>
              ถ้าต้องการให้ระบบลดราคาให้ลูกค้าอัตโนมัติ ให้กรอก “ส่วนลด” ด้านล่าง (เว้นว่าง = เป็นแค่ประกาศ ไม่ลดราคา)
            </small>
          )}

          {(form.type === 'bulk' || form.type === 'discount' || form.type === 'festival' || form.type === 'other') && (
            <Field label="ซื้อตั้งแต่ (ตัว) — ไม่ถึงจำนวนนี้จะไม่ลด">
              <input
                type="number"
                min="0"
                value={p.minQty}
                onChange={e => updatePricing({ minQty: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>
          )}

          <Field label="รูปแบบราคา">
            <select
              value={p.discountType}
              onChange={e => updatePricing({ discountType: e.target.value })}
              style={inputStyle(12)}
            >
              {Object.entries(DISCOUNT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </Field>

          <Field
            label={
              p.discountType === 'percent'
                ? 'ส่วนลด (%)'
                : p.discountType === 'baht'
                  ? 'ส่วนลด (บาท)'
                  : 'ราคาพิเศษ (บาท/ตัว)'
            }
          >
            <input
              type="number"
              min="0"
              value={p.discountValue}
              onChange={e => updatePricing({ discountValue: e.target.value })}
              style={inputStyle(12)}
            />
          </Field>

          {form.type === 'vip' && (
            <Field label="เงื่อนไขลูกค้า">
              <input
                placeholder="เช่น ลูกค้าประจำ / สมาชิก"
                value={p.customerNote}
                onChange={e => updatePricing({ customerNote: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>
          )}
        </>
      )
    }

    return null
  }

  function renderDetailRows(promo) {
    const g = promo.giveaway
    const p = promo.pricing
    const rows = []

    rows.push(
      <DetailRow
        key="type"
        label="ประเภท"
        value={(PROMO_TYPES[promo.type] || PROMO_TYPES.other).label}
      />,
      <DetailRow
        key="product"
        label="สินค้า"
        value={promo.productName || 'ทุกสินค้า'}
      />
    )

    if (promo.type === 'giveaway') {
      rows.push(
        <DetailRow key="count" label="จำนวน" value={g.prizeCount ? `${g.prizeCount} รางวัล` : ''} />,
        <DetailRow key="per" label="รางวัล/คน" value={g.prizePerPerson ? `${g.prizePerPerson} ตัว` : ''} />
      )
    }

    if (['bulk', 'discount', 'festival', 'other'].includes(promo.type) && p.minQty) {
      rows.push(
        <DetailRow key="min" label="ซื้อตั้งแต่" value={`${p.minQty} ตัวขึ้นไป`} />
      )
    }

    if (
      ['bulk', 'discount', 'vip', 'festival', 'other'].includes(promo.type) &&
      p.discountValue
    ) {
      const unit =
        p.discountType === 'percent'
          ? '%'
          : p.discountType === 'baht'
            ? ' บาท'
            : ' บาท/ตัว'

      rows.push(
        <DetailRow
          key="price"
          label={DISCOUNT_TYPES[p.discountType]}
          value={`${p.discountValue}${unit}`}
        />
      )
    }

    if (promo.type === 'bundle') {
      rows.push(
        <DetailRow key="bundle" label="รายการในชุด" value={p.bundleDetail} multiline />,
        <DetailRow key="bundlePrice" label="ราคาชุด" value={p.bundlePrice ? `${p.bundlePrice} บาท` : ''} />
      )
    }

    if (promo.type === 'vip' && p.customerNote) {
      rows.push(
        <DetailRow key="vip" label="เงื่อนไขลูกค้า" value={p.customerNote} />
      )
    }

    rows.push(
      <DetailRow key="start" label="วันที่เริ่ม" value={formatDate(promo.startDate)} />,
      <DetailRow key="end" label="วันที่สิ้นสุด" value={formatDate(promo.endDate)} />
    )

    if (promo.type === 'giveaway') {
      rows.push(
        <DetailRow key="join" label="วิธีเข้าร่วม" value={JOIN_METHODS[g.joinMethod]} />,
        <DetailRow key="post" label="ลิงก์โพสต์" value={g.postUrl} />,
        <DetailRow key="announceDate" label="วันประกาศผล" value={formatDate(g.announceDate)} />,
        <DetailRow key="announce" label="การประกาศผล" value={ANNOUNCE_METHODS[g.announceMethod]} />,
        <DetailRow key="claim" label="การรับรางวัล" value={CLAIM_METHODS[g.claimMethod]} />,
        <DetailRow key="note" label="หมายเหตุ" value={g.note} multiline />
      )
    }

    rows.push(
      <DetailRow
        key="audience"
        label="แสดงให้"
        value={
          [
            promo.showToStaff !== false ? 'พนักงาน' : null,
            promo.showToCustomer !== false ? 'ลูกค้า' : null,
          ]
            .filter(Boolean)
            .join(', ') || 'ไม่แสดง'
        }
      />
    )

    return rows
  }


  // ===================================================
  // RENDER
  // ===================================================

  const formIsNew = form && !form.id

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f7f7',
        paddingTop: 20,
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 110,
        boxSizing: 'border-box',
      }}
    >

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* =================================================
            HEADER
        ================================================= */}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: '#777', marginBottom: 4 }}>
              PoultryOS Admin
            </div>

            <h1 style={{ margin: 0, fontSize: 28 }}>
              โปรโมชั่น
            </h1>

            <div style={{ marginTop: 5, color: '#666', fontSize: 14 }}>
              จัดการโปรโมชั่นและกิจกรรมส่งเสริมการขาย
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTypePicker(true)}
            style={{
              border: 'none',
              borderRadius: 9,
              background: '#222',
              color: '#fff',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            ＋ เพิ่มโปรโมชั่น
          </button>
        </div>


        {/* =================================================
            FILTER TABS
        ================================================= */}

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 14,
            padding: 5,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 5,
            marginBottom: 8,
          }}
        >
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '11px 4px',
                background: filter === tab.key ? '#ff1111' : '#fff',
                color: filter === tab.key ? '#fff' : '#555',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>


        {loadError && (
          <div style={{ ...errorBoxStyle, marginTop: 12 }}>
            {loadError}
          </div>
        )}


        {loading ? (

          <div
            style={{
              background: '#fff',
              borderRadius: 14,
              padding: 35,
              textAlign: 'center',
              color: '#777',
              marginTop: 14,
            }}
          >
            กำลังโหลดโปรโมชั่น...
          </div>

        ) : (

          <>

            {/* =============================================
                GIVEAWAY
            ============================================= */}

            <h2 style={sectionTitleStyle}>
              <TypeIcon type="giveaway" size={21} />
              แจกฟรี / กิจกรรม
            </h2>

            {giveaways.length > 0 ? (
              renderCards(giveaways)
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#999' }}>
                ไม่มีโปรโมชั่นในหมวดนี้
              </div>
            )}


            {/* =============================================
                BULK
            ============================================= */}

            <h2 style={sectionTitleStyle}>
              <TypeIcon type="bulk" size={21} />
              ซื้อจำนวนมาก
            </h2>

            {bulks.length > 0 ? (
              renderCards(bulks)
            ) : (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#999' }}>
                ไม่มีโปรโมชั่นในหมวดนี้
              </div>
            )}


            {/* =============================================
                OTHERS
            ============================================= */}

            <h2 style={sectionTitleStyle}>
              โปรโมชั่นอื่น ๆ
            </h2>

            {others.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {renderCards(others)}
              </div>
            )}

            {filter === 'all' && emptyTypes.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                {emptyTypes.map(type => (
                  <EmptyTypeCard
                    key={type}
                    type={type}
                    onAdd={startAdd}
                  />
                ))}
              </div>
            )}

            {filter !== 'all' && others.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', color: '#999' }}>
                ไม่มีโปรโมชั่นในหมวดนี้
              </div>
            )}

          </>
        )}

      </div>


      {/* =================================================
          TYPE PICKER MODAL
      ================================================= */}

      {showTypePicker && (
        <div style={overlayStyle}>
          <div style={modalStyle(420)}>

            <h2 style={{ margin: '0 0 14px', fontSize: 21 }}>
              เลือกประเภทโปรโมชั่น
            </h2>

            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {Object.entries(PROMO_TYPES).map(([key, meta]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => startAdd(key)}
                  style={{
                    ...cancelBtnStyle,
                    textAlign: 'left',
                    padding: '13px 14px',
                    fontWeight: 600,
                    fontSize: 15,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <TypeIcon type={key} size={20} />
                  {meta.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowTypePicker(false)}
              style={{ ...cancelBtnStyle, width: '100%' }}
            >
              ยกเลิก
            </button>

          </div>
        </div>
      )}


      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {form && (
        <div style={overlayStyle}>
          <div style={modalStyle(520)}>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 21 }}>
                  {formIsNew ? 'เพิ่มโปรโมชั่น' : 'แก้ไขโปรโมชั่น'}
                </h2>

                <div
                  style={{
                    fontSize: 13,
                    color: '#777',
                    marginTop: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <TypeIcon type={form.type} size={15} />
                  {(PROMO_TYPES[form.type] || PROMO_TYPES.other).label}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForm(null)}
                style={{
                  border: 'none',
                  background: '#eee',
                  borderRadius: 50,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>

            <Field label="ชื่อโปรโมชั่น">
              <input
                value={form.title}
                onChange={e => updateForm({ title: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>

            <Field label="รายละเอียด">
              <textarea
                rows={3}
                value={form.description}
                onChange={e => updateForm({ description: e.target.value })}
                style={{ ...inputStyle(12), resize: 'vertical' }}
              />
            </Field>

            <Field label="สินค้า">
              <select
                value={form.productId}
                onChange={e => selectProduct(e.target.value)}
                style={inputStyle(12)}
              >
                <option value="">ทุกสินค้า</option>

                {productOptions.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </Field>

            {renderTypeFields()}

            <div style={twoColStyle}>
              <div>
                <Field label={form.type === 'giveaway' ? 'วันเริ่มกิจกรรม' : 'วันเริ่ม'}>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => updateForm({ startDate: e.target.value })}
                    style={inputStyle(12)}
                  />
                </Field>
              </div>

              <div>
                <Field label={form.type === 'giveaway' ? 'วันสิ้นสุดกิจกรรม' : 'วันสิ้นสุด'}>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => updateForm({ endDate: e.target.value })}
                    style={inputStyle(12)}
                  />
                </Field>
              </div>
            </div>

            <Field label="ข้อความสั้นสำหรับพนักงาน/ลูกค้า (ไม่บังคับ)">
              <input
                placeholder="เช่น ซื้อ 10 ตัวขึ้นไป รับราคาพิเศษ"
                value={form.summary}
                onChange={e => updateForm({ summary: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>

            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
              แสดงให้ใครเห็น
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              <input
                type="checkbox"
                checked={form.showToStaff}
                onChange={e => updateForm({ showToStaff: e.target.checked })}
              />
              พนักงาน (การ์ดในหน้า Dashboard)
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                marginBottom: 14,
              }}
            >
              <input
                type="checkbox"
                checked={form.showToCustomer}
                onChange={e => updateForm({ showToCustomer: e.target.checked })}
              />
              ลูกค้า (หน้าโปรโมชั่นของร้าน)
            </label>

            <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
              สถานะ
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                marginBottom: 18,
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => updateForm({ isActive: e.target.checked })}
              />
              เปิดใช้งาน
            </label>

            <div style={twoColStyle}>
              <button
                type="button"
                onClick={() => setForm(null)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={savePromotion}
                disabled={saving}
                style={primaryBtnStyle}
              >
                {saving
                  ? 'กำลังบันทึก...'
                  : 'บันทึกโปรโมชั่น'}
              </button>
            </div>

            {!formIsNew && (
              <button
                type="button"
                onClick={() => deletePromotion(form)}
                style={{
                  width: '100%',
                  marginTop: 8,
                  border: 'none',
                  background: '#fff0f0',
                  color: '#c62828',
                  borderRadius: 9,
                  padding: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <TrashFilledIcon size={16} />
                ลบโปรโมชั่น
              </button>
            )}

          </div>
        </div>
      )}


      {/* =================================================
          DETAIL MODAL
      ================================================= */}

      {detailPromo && (
        <div style={overlayStyle}>
          <div style={modalStyle(460)}>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 21,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <TypeIcon type={detailPromo.type} size={22} />
                {detailPromo.title}
              </h2>

              <button
                type="button"
                onClick={() => setDetailPromo(null)}
                style={{
                  border: 'none',
                  background: '#eee',
                  borderRadius: 50,
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <StatusBadge status={promotionStatus(detailPromo)} />
            </div>

            {detailPromo.description && (
              <div
                style={{
                  fontSize: 14,
                  color: '#555',
                  whiteSpace: 'pre-wrap',
                  marginBottom: 8,
                }}
              >
                {detailPromo.description}
              </div>
            )}

            {renderDetailRows(detailPromo)}

            <div style={{ ...twoColStyle, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => startEdit(detailPromo)}
                style={{ ...cancelBtnStyle, fontWeight: 600 }}
              >
                แก้ไขโปรโมชั่น
              </button>

              <button
                type="button"
                onClick={() => togglePromotion(detailPromo)}
                style={{
                  ...cancelBtnStyle,
                  fontWeight: 600,
                  background: detailPromo.isActive ? '#fff0f0' : '#e8f5e9',
                  color: detailPromo.isActive ? '#c62828' : '#2e7d32',
                  border: 'none',
                }}
              >
                {detailPromo.isActive
                  ? 'ยกเลิกโปรโมชั่น'
                  : 'เปิดใช้งานอีกครั้ง'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => deletePromotion(detailPromo)}
              style={{
                width: '100%',
                marginTop: 8,
                border: 'none',
                background: '#fff0f0',
                color: '#c62828',
                borderRadius: 9,
                padding: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <TrashFilledIcon size={16} />
              ลบโปรโมชั่น
            </button>

          </div>
        </div>
      )}


      {/* แถบเมนูล่างของ Admin (ใช้ร่วมกันทุกหน้า) */}
      <AdminBottomNav />
    </div>
  )

}