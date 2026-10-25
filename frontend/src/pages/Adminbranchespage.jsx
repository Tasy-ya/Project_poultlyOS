import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import { api } from '../api'

import { refreshBranches } from '../branch'

import AdminStaffUsers from '../components/AdminStaffUsers'
import AdminBottomNav from '../components/AdminBottomNav'


// =====================================================
// ICONS - แถบนำทาง (เหมือนหน้าอื่นของ Admin)
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
// ICONS - ไอคอนทึบสำหรับเนื้อหาในหน้า
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

function StoreFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M4 3h16l2 5.500H2L4 3z" />
      <circle cx="5.500" cy="8.500" r="3.200" />
      <circle cx="12" cy="8.500" r="3.200" />
      <circle cx="18.500" cy="8.500" r="3.200" />
      <path
        fillRule="evenodd"
        d="M4 13.500h16V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5.500zM9 16.500V21h6v-4.500H9z"
      />
    </FilledSvg>
  )
}

function PinFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M12 2a7 7 0 0 0-7 7c0 4.900 5.400 11.200 6.300 12.200a1 1 0 0 0 1.500 0C13.600 20.200 19 13.900 19 9a7 7 0 0 0-7-7zm0 9.500a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5z"
      />
    </FilledSvg>
  )
}

function CheckCircleFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.600 7.600-5.300 6a1 1 0 0 1-1.500.1l-2.500-2.500a1 1 0 1 1 1.400-1.400l1.700 1.700 4.600-5.200a1 1 0 1 1 1.600 1.300z"
      />
    </FilledSvg>
  )
}

function CrossCircleFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.700 12.300a1 1 0 0 1-1.400 1.400L12 13.400l-2.300 2.300a1 1 0 0 1-1.400-1.400l2.300-2.300-2.300-2.300a1 1 0 0 1 1.400-1.400l2.300 2.300 2.300-2.300a1 1 0 0 1 1.400 1.400L13.400 12l2.300 2.300z"
      />
    </FilledSvg>
  )
}

function ChartFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <rect x="3" y="12" width="4.500" height="9" rx="1" />
      <rect x="9.800" y="3" width="4.500" height="18" rx="1" />
      <rect x="16.500" y="8" width="4.500" height="13" rx="1" />
    </FilledSvg>
  )
}

function SearchFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M10.500 3a7.500 7.500 0 1 0 4.500 13.500l4.500 4.500a1.100 1.100 0 0 0 1.500-1.500L16.500 15A7.500 7.500 0 0 0 10.500 3zm0 2.200a5.300 5.300 0 1 1 0 10.600 5.300 5.300 0 0 1 0-10.600z"
      />
    </FilledSvg>
  )
}

function FilterFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M3 4.500A1 1 0 0 1 4 3.500h16a1 1 0 0 1 .8 1.600L14 13.500V20a1 1 0 0 1-1.500.9l-3-1.700a1 1 0 0 1-.5-.9v-4.800L3.200 5.100A1 1 0 0 1 3 4.500z" />
    </FilledSvg>
  )
}

function EditFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M3 17.250V21h3.750L17.800 9.940l-3.750-3.750L3 17.250zM20.700 7.050a1 1 0 0 0 0-1.400l-2.350-2.350a1 1 0 0 0-1.400 0l-1.830 1.830 3.750 3.750 1.830-1.830z" />
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

function InfoFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path
        fillRule="evenodd"
        d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4.500a1.300 1.300 0 1 1 0 2.600 1.300 1.300 0 0 1 0-2.600zM13.200 17a1 1 0 0 1-2.400 0v-5a1 1 0 0 1 2.400 0v5z"
      />
    </FilledSvg>
  )
}

function PlusFilledIcon({ size }) {
  return (
    <FilledSvg size={size}>
      <path d="M11 4a1 1 0 0 1 2 0v7h7a1 1 0 0 1 0 2h-7v7a1 1 0 0 1-2 0v-7H4a1 1 0 0 1 0-2h7V4z" />
    </FilledSvg>
  )
}

function ChevronIcon({ size = 16, direction = 'right' }) {
  const rotate = direction === 'left' ? 180 : direction === 'down' ? 90 : 0

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)`, flexShrink: 0 }}
    >
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}


// =====================================================
// BRANCH DATA MODEL
// -----------------------------------------------------
// {
//   id, code, name, province, address, phone, isActive,
//   copyFromBranchId   // ใช้ตอนสร้างสาขาใหม่ ให้ backend คัดลอก
//                      // สินค้า / โปรโมชั่น / การตั้งค่า จากสาขาต้นแบบ
// }
//
// ข้อมูลอื่นของสาขา (สินค้า, โปรโมชั่น, ประวัติการขาย)
// แยกกันด้วย branchId ฝั่ง backend
// =====================================================

const PAGE_SIZE = 5

function emptyBranch() {
  return {
    id: null,
    code: '',
    name: '',
    province: '',
    address: '',
    phone: '',
    isActive: true,
    copyFromBranchId: '',
  }
}

function normalizeBranch(raw) {
  const base = emptyBranch()

  return {
    ...base,
    ...raw,
    id:
      raw?.id ??
      raw?.branchId ??
      raw?.branch_id ??
      null,
    name:
      raw?.name ||
      raw?.branch_name ||
      '',
    code:
      raw?.code ||
      raw?.branch_code ||
      '',
    isActive:
      raw?.isActive ??
      raw?.is_active ??
      true,
  }
}


// =====================================================
// STORAGE
// -----------------------------------------------------
// USE_LOCAL_BRANCHES = true  -> เก็บใน localStorage ชั่วคราว
//                               (ใช้ได้ทันทีโดยยังไม่มี backend)
// USE_LOCAL_BRANCHES = false -> เรียก backend จริง
//   api.getBranches / createBranch / updateBranch / deleteBranch
// =====================================================

const USE_LOCAL_BRANCHES = false

const STORAGE_KEY = 'poultryos_branches'

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
    console.error('Read branches:', err)
  }

  return null
}

function writeLocal(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('Write branches:', err)
  }
}

function seedBranches() {
  return [
    {
      id: 1,
      code: 'BR001',
      name: 'สาขา สำนักงานใหญ่',
      province: 'กรุงเทพฯ',
      address: '123 ถ.หลักเมือง อ.เมือง จ.กรุงเทพฯ',
      phone: '02-123-4567',
      isActive: true,
    },
    {
      id: 2,
      code: 'BR002',
      name: 'สาขา มหาวิทยาลัย',
      province: 'นครราชสีมา',
      address: '456 ถ.มหาวิทยาลัย ต.สุรนารี อ.เมือง จ.นครราชสีมา',
      phone: '044-765-4321',
      isActive: true,
    },
    {
      id: 3,
      code: 'BR003',
      name: 'สาขา หาดใหญ่',
      province: 'สงขลา',
      address: '789 ถ.กาญจนวนิช ต.หาดใหญ่ อ.หาดใหญ่ จ.สงขลา',
      phone: '074-321-9876',
      isActive: true,
    },
  ]
}

async function fetchBranches() {
  if (!USE_LOCAL_BRANCHES) {
    const result = await api.getBranches()

    const rows =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.branches)
          ? result.branches
          : Array.isArray(result?.data)
            ? result.data
            : []

    return rows.map(normalizeBranch)
  }

  const local = readLocal()

  if (local) {
    return local.map(normalizeBranch)
  }

  const seeded = seedBranches()

  writeLocal(seeded)

  return seeded.map(normalizeBranch)
}

async function persistBranch(branch) {
  const isNew =
    branch.id === null ||
    branch.id === undefined ||
    branch.id === ''

  if (!USE_LOCAL_BRANCHES) {
    return isNew
      ? api.createBranch(branch)
      : api.updateBranch(branch.id, branch)
  }

  const list = readLocal() || []

  if (isNew) {
    const nextId =
      list.reduce(
        (max, b) => Math.max(max, Number(b.id) || 0),
        0
      ) + 1

    list.push({ ...branch, id: nextId })

  } else {
    const index = list.findIndex(b => String(b.id) === String(branch.id))

    if (index >= 0) {
      list[index] = branch
    } else {
      list.push(branch)
    }
  }

  writeLocal(list)

  return branch
}

async function removeBranch(id) {
  if (!USE_LOCAL_BRANCHES) {
    return api.deleteBranch(id)
  }

  writeLocal(
    (readLocal() || []).filter(b => String(b.id) !== String(id))
  )

  return true
}


// =====================================================
// SHARED STYLES
// =====================================================

const RED = '#ff1111'

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
  background: RED,
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

const TABLE_COLUMNS = '56px minmax(160px, 1.3fr) minmax(220px, 2fr) 120px 110px 100px'

const VIEW_TABS = [
  { key: 'all', label: 'สาขาทั้งหมด', Icon: StoreFilledIcon },
  { key: 'active', label: 'สาขาที่เปิดใช้งาน', Icon: PinFilledIcon },
  { key: 'inactive', label: 'สาขาที่ปิดใช้งาน', Icon: CrossCircleFilledIcon },
  { key: 'stats', label: 'สถิติ', Icon: ChartFilledIcon },
]


// =====================================================
// SMALL COMPONENTS
// =====================================================

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

function StatusPill({ isActive }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        padding: '5px 10px',
        borderRadius: 20,
        background: isActive ? '#e5f7e9' : '#eee',
        color: isActive ? '#218838' : '#777',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: isActive ? '#2e9e4f' : '#999',
        }}
      />
      {isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
    </span>
  )
}

function SummaryCard({ Icon, label, value, bg, iconBg, color }) {
  return (
    <div
      style={{
        background: bg,
        border: '1px solid #eee',
        borderRadius: 14,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 14,
          background: iconBg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={28} />
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>
          {label}
        </div>

        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.2 }}>
          {value}
        </div>

        <div style={{ fontSize: 12, color: '#888' }}>
          สาขา
        </div>
      </div>
    </div>
  )
}

function IconButton({ onClick, color, bg, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 36,
        height: 36,
        border: 'none',
        borderRadius: 9,
        background: bg,
        color,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}


// =====================================================
// ADMIN BRANCHES PAGE
// =====================================================

export default function AdminBranchesPage() {

  // ===================================================
  // DATA
  // ===================================================

  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')


  // ===================================================
  // UI STATE
  // ===================================================

  const [view, setView] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)


  // ===================================================
  // LOAD
  // ===================================================

  async function loadBranches() {
    try {
      setLoading(true)
      setLoadError('')

      setBranches(await fetchBranches())

    } catch (err) {
      console.error('Branches:', err)

      setLoadError(
        err?.message ||
          'ไม่สามารถโหลดข้อมูลสาขาได้'
      )

      setBranches([])

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBranches()
  }, [])


  // ===================================================
  // SUMMARY / FILTER
  // ===================================================

  const summary = useMemo(() => {
    const total = branches.length
    const active = branches.filter(b => b.isActive).length

    return {
      total,
      active,
      inactive: total - active,
    }
  }, [branches])

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return branches.filter(branch => {
      if (view === 'active' && !branch.isActive) {
        return false
      }

      if (view === 'inactive' && branch.isActive) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [
        branch.name,
        branch.province,
        branch.code,
        branch.address,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [branches, view, search])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  const currentPage = Math.min(page, pageCount)

  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const fromIndex = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const toIndex = Math.min(currentPage * PAGE_SIZE, filtered.length)

  const provinceStats = useMemo(() => {
    const map = new Map()

    branches.forEach(branch => {
      const key = branch.province || 'ไม่ระบุจังหวัด'

      map.set(key, (map.get(key) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([province, count]) => ({ province, count }))
      .sort((a, b) => b.count - a.count)
  }, [branches])

  function changeView(next) {
    setView(next)
    setPage(1)
  }


  // ===================================================
  // FORM ACTIONS
  // ===================================================

  function startAdd() {
    setForm({
      ...emptyBranch(),
      copyFromBranchId: branches[0] ? String(branches[0].id) : '',
    })
  }

  function startEdit(branch) {
    setForm({ ...normalizeBranch(branch) })
  }

  function updateForm(patch) {
    setForm(current => ({ ...current, ...patch }))
  }

  async function saveBranch() {
    if (!form) {
      return
    }

    const name = form.name.trim()
    const code = form.code.trim().toUpperCase()
    const phone = form.phone.trim()

    if (!name) {
      alert('กรุณากรอกชื่อสาขา')

      return
    }

    if (!form.address.trim()) {
      alert('กรุณากรอกที่อยู่สาขา')

      return
    }

    if (phone && !/^[0-9+\-\s]{8,15}$/.test(phone)) {
      alert('เบอร์โทรศัพท์ไม่ถูกต้อง')

      return
    }

    const duplicateCode =
      code &&
      branches.some(
        b =>
          String(b.id) !== String(form.id) &&
          String(b.code).toUpperCase() === code
      )

    if (duplicateCode) {
      alert('รหัสสาขานี้ถูกใช้แล้ว')

      return
    }

    const isNew = form.id === null || form.id === undefined

    try {
      setSaving(true)

      await persistBranch({
        ...form,
        name,
        code,
        province: form.province.trim(),
        address: form.address.trim(),
        phone,
        is_active: form.isActive,
        copyFromBranchId: isNew ? form.copyFromBranchId : '',
      })

      setForm(null)

      await loadBranches()

      await refreshBranches()

      alert(
        isNew
          ? 'เพิ่มสาขาใหม่เรียบร้อยแล้ว'
          : 'บันทึกข้อมูลสาขาเรียบร้อยแล้ว'
      )

    } catch (err) {
      console.error('Save Branch:', err)

      alert(
        err?.message ||
          'ไม่สามารถบันทึกข้อมูลสาขาได้'
      )

    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    try {
      setDeleting(true)

      await removeBranch(deleteTarget.id)

      setDeleteTarget(null)

      await loadBranches()

      await refreshBranches()

      alert('ลบสาขาเรียบร้อยแล้ว')

    } catch (err) {
      console.error('Delete Branch:', err)

      alert(
        err?.message ||
          'ไม่สามารถลบสาขาได้'
      )

    } finally {
      setDeleting(false)
    }
  }

  const formIsNew =
    form &&
    (form.id === null || form.id === undefined)

  const isLastBranch = branches.length <= 1


  // ===================================================
  // RENDER
  // ===================================================

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
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: '#777', marginBottom: 4 }}>
              PoultryOS Admin
            </div>

            <h1 style={{ margin: 0, fontSize: 28 }}>
              จัดการสาขา
            </h1>

            <div style={{ marginTop: 5, color: '#666', fontSize: 14 }}>
              จัดการข้อมูลสาขาทั้งหมดของร้าน
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link
              to="/admin/closures"
              style={{
                border: `1px solid ${RED}`,
                borderRadius: 10,
                background: '#fff',
                color: RED,
                padding: '12px 16px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                textDecoration: 'none',
              }}
            >
              ตั้งวันหยุดร้าน
            </Link>

          <button
            type="button"
            onClick={startAdd}
            style={{
              border: 'none',
              borderRadius: 10,
              background: RED,
              color: '#fff',
              padding: '12px 16px',
              cursor: 'pointer',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <PlusFilledIcon size={16} />
            เพิ่มสาขาใหม่
          </button>
          </div>
        </div>


        {/* =================================================
            VIEW TABS
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
            marginBottom: 14,
          }}
        >
          {VIEW_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeView(key)}
              style={{
                border: 'none',
                borderRadius: 10,
                padding: '11px 6px',
                background: view === key ? RED : '#fff',
                color: view === key ? '#fff' : '#555',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
              }}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>


        {loadError && (
          <div style={errorBoxStyle}>
            {loadError}
          </div>
        )}


        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <SummaryCard
            Icon={StoreFilledIcon}
            label="จำนวนสาขาทั้งหมด"
            value={summary.total}
            bg="#fff5f5"
            iconBg="#ffe3e3"
            color="#b71c1c"
          />

          <SummaryCard
            Icon={CheckCircleFilledIcon}
            label="สาขาที่เปิดใช้งาน"
            value={summary.active}
            bg="#f1fbf3"
            iconBg="#d9f3df"
            color="#1b7a34"
          />

          <SummaryCard
            Icon={CrossCircleFilledIcon}
            label="สาขาที่ปิดใช้งาน"
            value={summary.inactive}
            bg="#fff5f5"
            iconBg="#ffe3e3"
            color="#b71c1c"
          />
        </div>


        {view === 'stats' ? (

          /* ===============================================
              STATS VIEW
          =============================================== */

          <div style={cardStyle}>

            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>
              สถิติสาขา
            </h2>

            <div style={{ fontSize: 13, color: '#777', marginBottom: 16 }}>
              สัดส่วนสาขาที่เปิดใช้งาน และจำนวนสาขาแยกตามจังหวัด
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  marginBottom: 6,
                }}
              >
                <span>สาขาที่เปิดใช้งาน</span>

                <strong>
                  {summary.total === 0
                    ? '0%'
                    : `${Math.round((summary.active / summary.total) * 100)}%`}
                </strong>
              </div>

              <div style={{ height: 10, borderRadius: 6, background: '#eee' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 6,
                    background: '#2e9e4f',
                    width:
                      summary.total === 0
                        ? '0%'
                        : `${(summary.active / summary.total) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              จำนวนสาขาแยกตามจังหวัด
            </div>

            {provinceStats.length === 0 ? (
              <div style={{ color: '#999', fontSize: 14 }}>
                ยังไม่มีข้อมูลสาขา
              </div>
            ) : (
              provinceStats.map(item => (
                <div key={item.province} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    <span>{item.province}</span>
                    <strong>{item.count} สาขา</strong>
                  </div>

                  <div style={{ height: 8, borderRadius: 6, background: '#f0f0f0' }}>
                    <div
                      style={{
                        height: '100%',
                        borderRadius: 6,
                        background: RED,
                        width: `${(item.count / summary.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}

          </div>

        ) : (

          <>

            {/* ===========================================
                SEARCH + FILTER
            =========================================== */}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 170px',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  color: '#888',
                }}
              >
                <SearchFilledIcon size={18} />

                <input
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="ค้นหาชื่อสาขา, จังหวัด หรือรหัสสาขา..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    padding: '14px 0',
                    fontSize: 14,
                    background: 'transparent',
                    minWidth: 0,
                  }}
                />
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e5e5',
                  borderRadius: 12,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: '#666',
                }}
              >
                <FilterFilledIcon size={17} />

                <select
                  value={view}
                  onChange={e => changeView(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: '14px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    minWidth: 0,
                  }}
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="active">เปิดใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </select>
              </div>
            </div>


            {/* ===========================================
                BRANCH TABLE
            =========================================== */}

            <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '16px 18px 12px',
                }}
              >
                <StoreFilledIcon size={20} />

                <h2 style={{ margin: 0, fontSize: 18 }}>
                  รายการสาขา
                </h2>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>

                  {/* header row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: TABLE_COLUMNS,
                      gap: 10,
                      padding: '11px 18px',
                      background: '#f5f5f5',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#555',
                    }}
                  >
                    <div>ลำดับ</div>
                    <div>ชื่อสาขา</div>
                    <div>ที่อยู่</div>
                    <div>เบอร์โทรศัพท์</div>
                    <div>สถานะ</div>
                    <div>จัดการ</div>
                  </div>

                  {loading ? (

                    <div style={{ padding: 35, textAlign: 'center', color: '#777' }}>
                      กำลังโหลดสาขา...
                    </div>

                  ) : pageRows.length === 0 ? (

                    <div style={{ padding: 35, textAlign: 'center', color: '#999' }}>
                      {branches.length === 0
                        ? 'ยังไม่มีสาขา กด "เพิ่มสาขาใหม่" เพื่อเริ่มต้น'
                        : 'ไม่พบสาขาที่ตรงกับเงื่อนไข'}
                    </div>

                  ) : (

                    pageRows.map((branch, index) => (
                      <div
                        key={branch.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: TABLE_COLUMNS,
                          gap: 10,
                          alignItems: 'center',
                          padding: '12px 18px',
                          borderTop: '1px solid #f0f0f0',
                          fontSize: 14,
                        }}
                      >
                        <div>
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 10,
                              background: '#fff0f0',
                              color: '#c62828',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <StoreFilledIcon size={20} />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>
                              {branch.name}
                            </div>

                            {branch.code && (
                              <div style={{ fontSize: 12, color: '#999' }}>
                                {branch.code}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ color: '#444' }}>
                          {branch.address || '-'}
                        </div>

                        <div style={{ color: '#444' }}>
                          {branch.phone || '-'}
                        </div>

                        <div>
                          <StatusPill isActive={branch.isActive} />
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <IconButton
                            label="แก้ไขสาขา"
                            bg="#f3f3f3"
                            color="#333"
                            onClick={() => startEdit(branch)}
                          >
                            <EditFilledIcon size={17} />
                          </IconButton>

                          <IconButton
                            label="ลบสาขา"
                            bg="#fff0f0"
                            color="#c62828"
                            onClick={() => setDeleteTarget(branch)}
                          >
                            <TrashFilledIcon size={17} />
                          </IconButton>
                        </div>
                      </div>
                    ))
                  )}

                </div>
              </div>

              {/* footer: count + pagination */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '12px 18px',
                  borderTop: '1px solid #f0f0f0',
                  fontSize: 13,
                  color: '#777',
                }}
              >
                <div>
                  แสดง {fromIndex} - {toIndex} จาก {filtered.length} รายการ
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="หน้าก่อนหน้า"
                    style={{
                      ...cancelBtnStyle,
                      width: 32,
                      height: 32,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: currentPage <= 1 ? 0.4 : 1,
                    }}
                  >
                    <ChevronIcon direction="left" size={14} />
                  </button>

                  {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        border: n === currentPage ? 'none' : '1px solid #ddd',
                        background: n === currentPage ? RED : '#fff',
                        color: n === currentPage ? '#fff' : '#444',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="หน้าถัดไป"
                    style={{
                      ...cancelBtnStyle,
                      width: 32,
                      height: 32,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: currentPage >= pageCount ? 0.4 : 1,
                    }}
                  >
                    <ChevronIcon direction="right" size={14} />
                  </button>
                </div>
              </div>

            </div>

          </>
        )}


        {/* =================================================
            EXTRA INFO
        ================================================= */}

        <div style={{ ...cardStyle, marginTop: 14 }}>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <PinFilledIcon size={19} />

            <h2 style={{ margin: 0, fontSize: 17 }}>
              ข้อมูลสาขาเพิ่มเติม
            </h2>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: '#f7f7f7',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 13,
              color: '#555',
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: '#c62828', marginTop: 2 }}>
              <InfoFilledIcon size={16} />
            </span>

            <span>
              เมื่อเพิ่มสาขาใหม่ ระบบจะสร้างข้อมูลสาขาให้มีโครงสร้างเหมือนสาขาเดิมทั้งหมด
              เช่น สินค้า โปรโมชั่น และการตั้งค่า โดยข้อมูลของแต่ละสาขาจะแยกกันตามรหัสสาขา
              ทำให้จัดการหลายสาขาได้จากระบบเดียว
            </span>
          </div>

        </div>


        {/* =================================================
            ผู้ใช้งานระบบ (พนักงาน)
        ================================================= */}

        <AdminStaffUsers />

      </div>


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
              <h2 style={{ margin: 0, fontSize: 21 }}>
                {formIsNew ? 'เพิ่มสาขาใหม่' : 'แก้ไขข้อมูลสาขา'}
              </h2>

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

            <Field label="ชื่อสาขา">
              <input
                placeholder="เช่น สาขา หาดใหญ่"
                value={form.name}
                onChange={e => updateForm({ name: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>

            <div style={twoColStyle}>
              <div>
                <Field label="รหัสสาขา (ไม่บังคับ)">
                  <input
                    placeholder="เช่น BR004"
                    value={form.code}
                    onChange={e => updateForm({ code: e.target.value })}
                    style={inputStyle(12)}
                  />
                </Field>
              </div>

              <div>
                <Field label="จังหวัด">
                  <input
                    placeholder="เช่น สงขลา"
                    value={form.province}
                    onChange={e => updateForm({ province: e.target.value })}
                    style={inputStyle(12)}
                  />
                </Field>
              </div>
            </div>

            <Field label="ที่อยู่">
              <textarea
                rows={3}
                value={form.address}
                onChange={e => updateForm({ address: e.target.value })}
                style={{ ...inputStyle(12), resize: 'vertical' }}
              />
            </Field>

            <Field label="เบอร์โทรศัพท์">
              <input
                type="tel"
                placeholder="เช่น 074-321-9876"
                value={form.phone}
                onChange={e => updateForm({ phone: e.target.value })}
                style={inputStyle(12)}
              />
            </Field>

            {formIsNew && branches.length > 0 && (
              <>
                <Field label="สร้างระบบจากสาขาต้นแบบ">
                  <select
                    value={form.copyFromBranchId}
                    onChange={e => updateForm({ copyFromBranchId: e.target.value })}
                    style={inputStyle(6)}
                  >
                    <option value="">ไม่คัดลอก (เริ่มจากว่าง)</option>

                    {branches.map(branch => (
                      <option key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  คัดลอกสินค้า โปรโมชั่น และการตั้งค่าไปยังสาขาใหม่ ส่วนประวัติการขายและสต็อกจะเริ่มใหม่
                </div>
              </>
            )}

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
              เปิดใช้งานสาขา
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
                onClick={saveBranch}
                disabled={saving}
                style={primaryBtnStyle}
              >
                {saving
                  ? 'กำลังบันทึก...'
                  : formIsNew
                    ? 'เพิ่มสาขา'
                    : 'บันทึก'}
              </button>
            </div>

          </div>
        </div>
      )}


      {/* =================================================
          DELETE CONFIRM MODAL
      ================================================= */}

      {deleteTarget && (
        <div style={overlayStyle}>
          <div style={modalStyle(420)}>

            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#fff0f0',
                color: '#c62828',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <TrashFilledIcon size={24} />
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: 21 }}>
              ยืนยันการลบสาขา
            </h2>

            <div style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 6 }}>
              ต้องการลบ <strong>{deleteTarget.name}</strong> ออกจากระบบใช่หรือไม่?
            </div>

            <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 16 }}>
              ถ้าแค่ต้องการหยุดใช้งานชั่วคราว แนะนำให้แก้ไขสาขาแล้วปิดการใช้งานแทน
              เพราะการลบอาจทำให้ข้อมูลของสาขานี้หายไปและเรียกคืนไม่ได้
            </div>

            {isLastBranch && (
              <div style={errorBoxStyle}>
                นี่คือสาขาสุดท้ายในระบบ ไม่สามารถลบได้
              </div>
            )}

            <div style={twoColStyle}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={cancelBtnStyle}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting || isLastBranch}
                style={{
                  ...primaryBtnStyle,
                  opacity: isLastBranch ? 0.5 : 1,
                  cursor: isLastBranch ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'กำลังลบ...' : 'ลบสาขา'}
              </button>
            </div>

          </div>
        </div>
      )}


      {/* แถบเมนูล่างของ Admin (ใช้ร่วมกันทุกหน้า) */}
      <AdminBottomNav />
    </div>
  )

}