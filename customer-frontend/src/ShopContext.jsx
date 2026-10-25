import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { unitPrice } from './shopApi'

// ตะกร้า + สาขา + โหมด (สั่งซื้อเลย / จองล่วงหน้า) เก็บในเครื่องลูกค้า
const KEY = 'poultryos_shop_v1'

const Ctx = createContext(null)

// วิธีรับสินค้า: pickup = รับที่ร้าน, delivery = ให้ส่ง (ที่อยู่ + พิกัดหมุด)
const DEFAULT_DELIVERY = { method: 'pickup', address: '', lat: null, lng: null }

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (v && Array.isArray(v.cart)) return v
  } catch {
    // ใช้ค่าเริ่มต้น
  }
  return { branchId: null, mode: 'order', cart: [], delivery: DEFAULT_DELIVERY }
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
      delivery: { ...DEFAULT_DELIVERY, ...(state.delivery || {}) },
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

      setDelivery: patch =>
        setState(s => ({ ...s, delivery: { ...DEFAULT_DELIVERY, ...(s.delivery || {}), ...patch } })),

      add: item =>
        setState(s => {
          // เมนูเดียวกัน ขนาดเดียวกัน หมายเหตุเดียวกัน = รวมเป็นบรรทัดเดียว
          const note = String(item.note || '').trim().slice(0, 200)
          item = { ...item, note }

          const i = s.cart.findIndex(
            c =>
              c.menuId === item.menuId &&
              c.size === item.size &&
              String(c.note || '') === note
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

      // แก้หมายเหตุรายเมนูในตะกร้า
      setNote: (index, note) =>
        setState(s => ({
          ...s,
          cart: s.cart.map((c, i) =>
            i === index ? { ...c, note: String(note || '').slice(0, 200) } : c
          ),
        })),

      remove: index =>
        setState(s => ({ ...s, cart: s.cart.filter((_, i) => i !== index) })),

      clear: () => setState(s => ({ ...s, cart: [] })),
    }
  }, [state])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useShop = () => useContext(Ctx)
