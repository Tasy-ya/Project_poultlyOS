import {
  api,
  getStaff,
  getSelectedBranchId,
  setSelectedBranchId,
  onBranchChange as onSelectedBranchChange,
} from './api'

// =====================================================
// ไฟล์นี้เป็นตัวกลางของระบบสาขาฝั่งหน้าเว็บ
// -----------------------------------------------------
// - รายการสาขา: ดึงจาก backend (api.getBranches) แล้วเก็บแคชไว้
//   เพื่อให้ BranchSelector อ่านแบบ sync ได้เหมือนเดิม
// - สาขาที่เลือก: ใช้ของ api.js ตัวเดียว (key เดียว) ไม่เก็บซ้ำ
// =====================================================

export { getSelectedBranchId, setSelectedBranchId }

const LIST_KEY = 'poultryos_branches_cache'
const LIST_EVENT = 'poultryos:branches-updated'

let branches = readCache()
let attempted = false


// =====================================================
// HELPERS
// =====================================================

function normalize(raw) {
  return {
    ...raw,
    id: raw?.id ?? raw?.branchId ?? raw?.branch_id ?? null,
    name: raw?.name || raw?.branch_name || '',
    code: raw?.code || raw?.branch_code || '',
    isActive: raw?.isActive ?? raw?.is_active ?? true,
  }
}

function readCache() {
  try {
    const list = JSON.parse(localStorage.getItem(LIST_KEY) || 'null')

    return Array.isArray(list) ? list.map(normalize) : []
  } catch {
    return []
  }
}

function writeCache(list) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch (err) {
    console.error('Write branch cache:', err)
  }
}


// =====================================================
// โหลดรายการสาขาจาก backend
// เรียกหลังแอดมินเพิ่ม / แก้ / ลบสาขา เพื่อให้กล่องเลือกอัปเดตทันที
// =====================================================

export async function refreshBranches() {
  attempted = true

  try {
    const result = await api.getBranches()

    const rows = Array.isArray(result)
      ? result
      : Array.isArray(result?.branches)
        ? result.branches
        : Array.isArray(result?.data)
          ? result.data
          : []

    branches = rows.map(normalize)

    writeCache(branches)

    // ถ้าสาขาที่เลือกถูกลบ / ปิดใช้งาน ให้ย้ายไปสาขาแรกที่เปิดอยู่
    ensureSelectedBranch()

    window.dispatchEvent(new CustomEvent(LIST_EVENT))
  } catch (err) {
    // เช่น ยังไม่ได้ล็อกอิน ใช้แคชเดิมต่อไป
    console.error('Refresh branches:', err)
  }

  return branches
}

function loadOnce() {
  if (!attempted) {
    refreshBranches()
  }
}


// =====================================================
// ฟังก์ชันที่ BranchSelector ใช้
// =====================================================

export function getBranches() {
  loadOnce()

  return branches
}

export function getActiveBranches() {
  loadOnce()

  return branches.filter(branch => branch.isActive)
}

export function ensureSelectedBranch() {
  const active = branches.filter(branch => branch.isActive)
  const current = getSelectedBranchId()

  // ยังไม่มีรายการสาขา (ยังโหลดไม่เสร็จ) อย่าเพิ่งล้างสาขาที่เลือกไว้
  if (active.length === 0) {
    return current
  }

  const valid = active.some(
    branch => String(branch.id) === String(current)
  )

  if (valid) {
    return current
  }

  // ครั้งแรกหลังล็อกอิน เริ่มที่สาขาของพนักงานก่อน
  // ถ้าไม่มี (หรือสาขานั้นปิดอยู่) ค่อยใช้สาขาแรกที่เปิดอยู่
  const staffBranchId = getStaff()?.branchId

  const preferred =
    active.find(
      branch => String(branch.id) === String(staffBranchId)
    ) || active[0]

  const first = String(preferred.id)

  setSelectedBranchId(first)

  return first
}

// ฟังทั้ง "เปลี่ยนสาขาที่เลือก" และ "รายการสาขาเปลี่ยน"
// หน้าที่แค่ต้องโหลดข้อมูลใหม่เมื่อเปลี่ยนสาขา
// ให้ใช้ onBranchChange จาก api.js แทน จะไม่ถูกเรียกตอนรายการสาขาอัปเดต
export function onBranchChange(callback) {
  loadOnce()

  const offSelected = onSelectedBranchChange(callback)

  const handleList = () => {
    callback(getSelectedBranchId())
  }

  const handleStorage = event => {
    if (event.key === LIST_KEY) {
      branches = readCache()

      callback(getSelectedBranchId())
    }
  }

  window.addEventListener(LIST_EVENT, handleList)
  window.addEventListener('storage', handleStorage)

  return () => {
    offSelected()

    window.removeEventListener(LIST_EVENT, handleList)
    window.removeEventListener('storage', handleStorage)
  }
}
