import { useEffect, useState } from 'react'
import Layout, { CATS } from '../components/Layout'
import { api } from '../api'

export default function ProductEditPage() {
  const [menus, setMenus] = useState([])
  const [n, setN] = useState({ name: '', price: '', category: 'duck', hasHalfOption: true })
  const load = () => api.getMenus().then(setMenus)
  useEffect(() => { load() }, [])

  const edit = (id, k, v) => setMenus(ms => ms.map(m => m.id === id ? { ...m, [k]: v } : m))
  const save = m => api.updateMenu(m.id, { name: m.name, price: Number(m.price) })
  async function del(m) { if (confirm(`ลบ ${m.name}?`)) { await api.deleteMenu(m.id); load() } }
  async function add() {
    if (!n.name || !n.price) return
    await api.createMenu({ ...n, price: Number(n.price) })
    setN({ ...n, name: '', price: '' }); load()
  }

  return (
    <Layout title="Product Edit" back={false}>
      {menus.map(m => (
        <div className="card" key={m.id}>
          <input value={m.name} onChange={e => edit(m.id, 'name', e.target.value)} onBlur={() => save(m)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" value={m.price} onChange={e => edit(m.id, 'price', e.target.value)} onBlur={() => save(m)} />
            <button className="btn-outline" onClick={() => del(m)}>🗑️</button>
          </div>
          <small>หมวด: {CATS[m.category] || '-'}</small>
        </div>
      ))}
      <div className="card gray">
        <b>+ เพิ่มเมนูสินค้า</b>
        <input placeholder="ชื่อเมนู" value={n.name} onChange={e => setN({ ...n, name: e.target.value })} />
        <input type="number" placeholder="ราคา (ต่อตัวเต็ม)" value={n.price} onChange={e => setN({ ...n, price: e.target.value })} />
        <select value={n.category} onChange={e => setN({ ...n, category: e.target.value })}>
          {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={n.hasHalfOption} onChange={e => setN({ ...n, hasHalfOption: e.target.checked })} /> ขายครึ่งตัวได้</label>
        <button className="btn-primary" onClick={add}>เพิ่มเมนู</button>
      </div>
    </Layout>
  )
}
