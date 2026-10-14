import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { unitPrice } from './shopApi'

// ตะกร้า + สาขา + โหมด (สั่งซื้อเลย / จองล่วงหน้า) เก็บในเครื่องลูกค้า
const KEY = 'poultryos_shop_v1'

const Ctx = createContext(null)

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && Array.isArray(v.cart)) return v
  } catch {
    // ใช้ค่าเริ่มต้น
  }
  return { branchId: null, mode: 'order', cart: [] }
}

export function ShopProvider({ children }) {
  const [state, setState] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // พื้นที่เก็บข้อมูลเต็ม/ปิดไว้ — ใช้งานต่อได้ แค่ไม่จำตะกร้า
    }
  }, [state])

  const value = useMemo(() => {
    const cart = state.cart

    return {
      branchId: state.branchId,
      mode: state.mode,
      cart,
      count: cart.reduce((s, i) => s + i.qty, 0),
      total: cart.reduce((s, i) => s + unitPrice(i) * i.qty, 0),

      // เปลี่ยนสาขา = ล้างตะกร้า (สต็อกและราคาแยกตามสาขา)
      setBranch: branchId =>
        setState(s =>
          String(s.branchId) === String(branchId)
            ? s
            : { ...s, branchId, cart: [] }
        ),

      setMode: mode => setState(s => ({ ...s, mode })),

      add: item =>
        setState(s => {
          const i = s.cart.findIndex(
            c => c.menuId === item.menuId && c.size === item.size
          )

          const cart = [...s.cart]

          if (i >= 0) {
            cart[i] = { ...cart[i], qty: Math.min(cart[i].qty + item.qty, 50) }
          } else {
            cart.push(item)
          }

          return { ...s, cart }
        }),

      setQty: (index, qty) =>
        setState(s => ({
          ...s,
          cart: s.cart
            .map((c, i) => (i === index ? { ...c, qty: Math.min(qty, 50) } : c))
            .filter(c => c.qty > 0),
        })),

      remove: index =>
        setState(s => ({ ...s, cart: s.cart.filter((_, i) => i !== index) })),

      clear: () => setState(s => ({ ...s, cart: [] })),
    }
  }, [state])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useShop = () => useContext(Ctx)
