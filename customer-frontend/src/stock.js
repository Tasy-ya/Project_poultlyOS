import { useCallback, useEffect, useState } from 'react'
import { shopApi } from './shopApi'

// =====================================================
// ตัวช่วยเรื่องสต็อกฝั่งลูกค้า
// -----------------------------------------------------
// สต็อกพร้อมขายเก็บเป็น "หน่วยครึ่งตัว" (stockUnits)
//   - เมนูที่มีครึ่งตัว (hasHalfOption): เต็มตัว = 2 หน่วย, ครึ่งตัว = 1 หน่วย
//   - เมนูอื่น: 1 ชิ้น = 1 หน่วย
// =====================================================

// จำนวนหน่วยที่รายการในตะกร้ากินสต็อก
const unitsOf = item =>
  item.hasHalfOption && item.size === 'full' ? item.qty * 2 : item.qty

// รวมหน่วยในตะกร้าแยกตามเมนู -> Map(menuId -> หน่วย)
export function cartUnitsByMenu(cart) {
  const map = new Map()

  for (const item of cart || []) {
    map.set(item.menuId, (map.get(item.menuId) || 0) + unitsOf(item))
  }

  return map
}

// แสดงจำนวนคงเหลือเป็นข้อความ
export function stockText(hasHalf, units) {
  const n = Math.max(0, Math.floor(units))

  if (!hasHalf) return `${n} ชิ้น`

  const whole = Math.floor(n / 2)
  const half = n % 2

  if (whole > 0 && half) return `${whole} ตัว กับอีกครึ่งตัว`
  if (whole > 0) return `${whole} ตัว`
  if (half) return 'ครึ่งตัว'

  return '0'
}

// เหลือน้อย: มีของแต่ไม่เกิน 6 หน่วย (3 ตัว) สำหรับเมนูครึ่งตัว / ไม่เกิน 3 ชิ้นสำหรับเมนูอื่น
export const isLowStock = (hasHalf, units) =>
  units > 0 && units <= (hasHalf ? 6 : 3)

// ตรวจตะกร้ากับสต็อกล่าสุด -> รายการที่สต็อกไม่พอ
export function stockProblems(cart, menus) {
  if (!Array.isArray(menus)) return []

  const byId = new Map(menus.map(m => [m.menuId, m]))
  const problems = []

  for (const [menuId, need] of cartUnitsByMenu(cart)) {
    const menu = byId.get(menuId)
    const have = menu ? menu.stockUnits : 0

    if (need > have) {
      const inCart = cart.find(c => c.menuId === menuId)

      problems.push({
        menuId,
        name: inCart?.name || menu?.name || 'สินค้า',
        hasHalf: !!(inCart?.hasHalfOption ?? menu?.hasHalfOption),
        need,
        have,
      })
    }
  }

  return problems
}

// ข้อความอธิบายปัญหาสต็อกของแต่ละรายการ
export const problemText = p =>
  p.have <= 0
    ? `"${p.name}" หมดแล้ว`
    : `"${p.name}" เหลือเพียง ${stockText(p.hasHalf, p.have)}`

// โหลดเมนู + สต็อกของสาขา และรีเฟรชอัตโนมัติ (ทุก 15 วินาที และเมื่อกลับมาที่หน้าต่าง)
// menus = null ระหว่างโหลดครั้งแรก
export function useMenus(branchId, intervalMs = 15000) {
  const [menus, setMenus] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(
    () =>
      branchId
        ? shopApi
            .menus(branchId)
            .then(data => {
              setMenus(data)
              setError('')
              return data
            })
            .catch(err => {
              setError(err.message)
              return null
            })
        : Promise.resolve(null),
    [branchId]
  )

  useEffect(() => {
    setMenus(null)

    if (!branchId) return undefined

    reload()

    const timer = setInterval(reload, intervalMs)
    const onFocus = () => reload()

    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [branchId, intervalMs, reload])

  return { menus, error, reload }
}