import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout, { CATS, getStaff } from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import { api, getSelectedBranchId, onBranchChange } from '../api'
import { getActiveBranches } from '../branch'

export function StockCategoryPage() {
  return (
    <Layout title="Stock" back={false} right={<BranchSelector compact />}>
      <p>เลือกหมวดสต็อก</p>
      {Object.entries(CATS).map(([k, v]) => (
        <Link key={k} to={`/stock/${k}`} style={{ textDecoration: 'none' }}>
          <div className="card" style={{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#222' }}>{v}</div>
        </Link>
      ))}
    </Layout>
  )
}

// =====================================================
// หน้า Stock (ฝ่ายสต็อก)
//
// กล่องเลือกสาขาอยู่มุมขวาบน เหมือนหน้า Dashboard
// ทุกการทำรายการ (รับวัตถุดิบ / หมัก / ทำเสร็จพร้อมขาย)
// จะเข้าสต็อกของ "สาขาที่เลือก" -> ส่งสต็อกไปยังสาขาที่ต้องการได้
// =====================================================

export default function StockPage() {
  const params = useParams()
  const staff = getStaff()

  // หมวดสินค้า ('' = ทั้งหมด)
  const [category, setCategory] = useState(params.category || '')

  // สาขาที่เลือกอยู่ (เปลี่ยนจากกล่องมุมขวาบน)
  const [b, setB] = useState(getSelectedBranchId() || staff?.branchId || '')

  useEffect(() => {
    return onBranchChange(id => setB(id || ''))
  }, [])

  const branchName =
    getActiveBranches().find(x => String(x.id) === String(b))?.name || ''

  const [tab, setTab] = useState(1)
  const [raw, setRaw] = useState([]), [mats, setMats] = useState([])
  const [batches, setBatches] = useState([]), [preps, setPreps] = useState([])
  const [menus, setMenus] = useState([]), [ready, setReady] = useState({})
  const [f, setF] = useState({}), [msg, setMsg] = useState('')
  const [reorder, setReorder] = useState({})
  const [stockRows, setStockRows] = useState([])

  const load = () => {
    if (!b) return

    const safe = p => p.catch(e => { setMsg('❌ ' + e.message); return [] })

    safe(api.getRawStock(b, category)).then(setRaw)
    safe(api.getRawMaterials(category)).then(setMats)
    safe(api.getPrepBatches(b, category)).then(setBatches)
    safe(api.getPrepItems(category)).then(setPreps)
    safe(api.getMenus(category, b)).then(setMenus)
    safe(api.getStock(b)).then(s => {
      const list = Array.isArray(s) ? s : []

      setStockRows(list)
      setReady(Object.fromEntries(list.map(x => [x.menuId, x.qty])))
    })
  }

  // โหลดใหม่เมื่อเปลี่ยนสาขา / หมวด
  useEffect(() => {
    setF({})
    setMsg('')
    load()
  }, [b, category])

  async function run(fn) {
    try { await fn(); setMsg('✅ บันทึกแล้ว → ' + (branchName || 'สาขาที่เลือก')); setF({}); load() } catch (e) { setMsg('❌ ' + e.message) }
  }
  const tabs = ['1 ดิบ', '2 หมัก', '3 พร้อมขาย', '4 โอนสาขา']

  return (
    <Layout title="Stock" back={false} right={<BranchSelector compact />}>

      {/* สาขาที่กำลังทำรายการ */}
      <div className="card gray" style={{ padding: '8px 12px', marginBottom: 10 }}>
        <small>ทำรายการให้สาขา</small>
        <div style={{ fontWeight: 'bold', fontSize: 18 }}>{branchName || '-'}</div>
      </div>

      {/* หมวดสินค้า */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[['', 'ทั้งหมด'], ...Object.entries(CATS)].map(([k, v]) => (
          <button key={k || 'all'} className={category === k ? 'btn-primary' : 'btn-outline'} style={{ width: 'auto', padding: '6px 14px' }} onClick={() => setCategory(k)}>{v}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {tabs.map((t, i) => <button key={i} style={{ flex: 1, width: 'auto' }} className={tab === i + 1 ? 'btn-primary' : 'btn-outline'} onClick={() => { setTab(i + 1); setMsg('') }}>{t}</button>)}
      </div>
      {msg && <p>{msg}</p>}

      {tab === 1 && <>
        {raw.map(r => <div className="card" key={r.id}>{r.material.name}: <b>{Number(r.qty)} {r.material.unit}</b></div>)}
        <div className="card gray"><b>รับวัตถุดิบสด</b>
          <select value={f.materialId || ''} onChange={e => setF({ ...f, materialId: e.target.value })}>
            <option value="">เลือกวัตถุดิบ</option>{mats.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select>
          <input type="number" placeholder="จำนวน" value={f.qty || ''} onChange={e => setF({ ...f, qty: e.target.value })} />
          <input type="number" placeholder="ราคารวมที่ซื้อ (บาท)" value={f.price || ''} onChange={e => setF({ ...f, price: e.target.value })} />
          <button className="btn-primary" onClick={() => run(() => api.receiveRaw({ branchId: Number(b), materialId: Number(f.materialId), qty: Number(f.qty), note: f.price ? `ราคา ${f.price} บาท` : undefined }))}>รับเข้า</button>
        </div></>}

      {tab === 2 && <>
        {batches.map(x => <div className="card" key={x.id}>{x.prepItem.name} #{x.batchNo || x.id}: <b>เหลือ {Number(x.qtyRemaining)} / {Number(x.qtyProduced)}</b>
          {x.expiresAt && <div><small>หมดอายุ {new Date(x.expiresAt).toLocaleString('th-TH')}</small></div>}</div>)}
        <div className="card gray"><b>เริ่มหมัก (ตัดวัตถุดิบดิบตามสูตร)</b>
          <select value={f.prepItemId || ''} onChange={e => setF({ ...f, prepItemId: e.target.value })}>
            <option value="">เลือกสูตรหมัก</option>{preps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <input type="number" placeholder="จำนวนที่หมัก (ตัว)" value={f.qty || ''} onChange={e => setF({ ...f, qty: e.target.value })} />
          <button className="btn-primary" onClick={() => run(() => api.startPrep({ branchId: Number(b), prepItemId: Number(f.prepItemId), qtyProduced: Number(f.qty) }))}>เริ่มหมัก</button>
        </div></>}

      {tab === 3 && <>
        {menus.map(m => <div className="card" key={m.id}>{m.name}: <b>{Math.floor((ready[m.id] || 0) / 2)} ตัว{(ready[m.id] || 0) % 2 ? ' + ครึ่ง' : ''}</b> <small>({ready[m.id] || 0} หน่วยครึ่งตัว)</small></div>)}
        <div className="card gray"><b>ทำเสร็จ → พร้อมขาย (ส่งเข้า {branchName || 'สาขาที่เลือก'})</b>
          <select value={f.menuId || ''} onChange={e => setF({ ...f, menuId: e.target.value })}>
            <option value="">เลือกเมนู</option>{menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select value={f.batchId || ''} onChange={e => setF({ ...f, batchId: e.target.value })}>
            <option value="">ล็อตของหมัก (ถ้ามี)</option>{batches.map(x => <option key={x.id} value={x.id}>{x.prepItem.name} #{x.id} (เหลือ {Number(x.qtyRemaining)})</option>)}</select>
          <input type="number" placeholder="จำนวนตัวเต็มที่ทำเสร็จ" value={f.qty || ''} onChange={e => setF({ ...f, qty: e.target.value })} />
          <small>ระบบแปลงเป็นหน่วยครึ่งตัว (×2) ให้อัตโนมัติ</small>
          <button className="btn-primary" onClick={() => run(() => api.produceReady({ branchId: Number(b), menuId: Number(f.menuId), prepBatchId: f.batchId ? Number(f.batchId) : undefined, qtyWholeUnits: Number(f.qty) }))}>เข้าสต็อกพร้อมขาย</button>
        </div>

        <div className="card gray"><b>จุดแจ้งเตือนของใกล้หมด</b>
          <small>แจ้งเตือนที่หน้าแรกเมื่อเหลือไม่เกินจำนวนนี้ (หน่วยครึ่งตัว, 0 = แจ้งเมื่อหมด)</small>
          {menus.map(m => {
            const current = stockRows.find(x => Number(x.menuId) === Number(m.id))?.reorderPoint ?? 0
            return (
              <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <span style={{ flex: 1 }}>{m.name}</span>
                <input type="number" style={{ width: 90, margin: 0 }} placeholder={String(current)} value={reorder[m.id] ?? ''} onChange={e => setReorder({ ...reorder, [m.id]: e.target.value })} />
                <button className="btn-outline" style={{ width: 'auto', padding: '6px 12px' }} onClick={() => run(() => api.setReorderPoint({ branchId: Number(b), menuId: m.id, reorderPoint: Number(reorder[m.id] ?? current) }))}>บันทึก</button>
              </div>
            )
          })}
        </div></>}

      {tab === 4 && <>
        <div className="card gray"><b>โอนสต็อกจาก {branchName || 'สาขาที่เลือก'} ไปสาขาอื่น</b>
          <small>ตัดจากสาขานี้ แล้วเพิ่มให้สาขาปลายทาง (เปลี่ยนสาขาต้นทางที่กล่องมุมขวาบน)</small>
          <select value={f.toBranch || ''} onChange={e => setF({ ...f, toBranch: e.target.value })}>
            <option value="">สาขาปลายทาง</option>
            {getActiveBranches().filter(x => String(x.id) !== String(b)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={f.kind || 'ready'} onChange={e => setF({ ...f, kind: e.target.value, itemId: '' })}>
            <option value="ready">สินค้าพร้อมขาย</option>
            <option value="raw">วัตถุดิบดิบ</option>
          </select>
          {(f.kind || 'ready') === 'ready' ? (
            <select value={f.itemId || ''} onChange={e => setF({ ...f, itemId: e.target.value })}>
              <option value="">เลือกเมนู</option>
              {menus.map(m => <option key={m.id} value={m.id}>{m.name} (มี {Math.floor((ready[m.id] || 0) / 2)} ตัว)</option>)}
            </select>
          ) : (
            <select value={f.itemId || ''} onChange={e => setF({ ...f, itemId: e.target.value })}>
              <option value="">เลือกวัตถุดิบ</option>
              {raw.map(r => <option key={r.material.id} value={r.material.id}>{r.material.name} (มี {Number(r.qty)} {r.material.unit})</option>)}
            </select>
          )}
          <input type="number" placeholder={(f.kind || 'ready') === 'ready' ? 'จำนวนตัวเต็มที่โอน' : 'จำนวนที่โอน'} value={f.qty || ''} onChange={e => setF({ ...f, qty: e.target.value })} />
          <input placeholder="หมายเหตุ (ถ้ามี)" value={f.note || ''} onChange={e => setF({ ...f, note: e.target.value })} />
          <button className="btn-primary" onClick={() => run(() => {
            const kind = f.kind || 'ready'
            if (!f.toBranch || !f.itemId) throw new Error('เลือกสาขาปลายทางและรายการที่จะโอนก่อน')
            return api.transferStock({
              fromBranchId: Number(b),
              toBranchId: Number(f.toBranch),
              kind,
              ...(kind === 'ready' ? { menuId: Number(f.itemId) } : { materialId: Number(f.itemId) }),
              qty: Number(f.qty),
              note: f.note || undefined,
            })
          })}>โอนสต็อก</button>
        </div></>}
    </Layout>
  )
}
