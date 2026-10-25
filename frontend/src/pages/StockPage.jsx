import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Layout, { CATS, getStaff } from '../components/Layout'
import BranchSelector from '../components/BranchSelector'
import { api, getSelectedBranchId, onBranchChange } from '../api'
import { getActiveBranches } from '../branch'
import StockLots from '../components/StockLots'
import PrepBatches from '../components/PrepBatches'

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
  const [recipes, setRecipes] = useState([]), [usable, setUsable] = useState({})
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
    safe(api.getPrepRecipes()).then(r => setRecipes(Array.isArray(r) ? r : []))
    safe(api.getRawLotSummary(b)).then(r => setUsable(Object.fromEntries(((r && r.rows) || []).map(x => [x.materialId, Number(x.usableQty)]))))
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
  const tabs = ['1 ดิบ', '2 หมัก', '3 พร้อมขาย', '4 โอนสาขา', '5 ล็อต']

  // รอบ 15: สถานะการเก็บ + อายุมาตรฐาน -> บอกพนักงานว่าระบบจะตั้งวันหมดอายุให้เท่าไร
  const STORAGE_LABEL = { ambient: 'อุณหภูมิห้อง', chilled: 'แช่เย็น', frozen: 'แช่แข็ง' }
  const storage = f.storage || 'frozen' // ของทั้งหมดแช่แข็ง (ไก่/เป็ด CP)
  const today = new Date().toISOString().slice(0, 10)

  // หมักได้สูงสุดกี่ตัว = ต่ำสุดของ (วัตถุดิบที่ใช้ได้ ÷ ปริมาณต่อ 1 ตัว) ของทุกวัตถุดิบในสูตร
  const prepCapacity = prepItemId => {
    const rows = recipes.filter(r => r.prepItemId === Number(prepItemId))

    if (!rows.length) return { max: null, rows: [] }

    const lines = rows.map(r => ({
      name: r.material?.name || `วัตถุดิบ #${r.materialId}`,
      unit: r.material?.unit || '',
      per: r.qtyPerUnit,
      have: usable[r.materialId] || 0,
    }))
    const max = Math.max(0, Math.floor(Math.min(...lines.map(l => (l.per > 0 ? l.have / l.per + 1e-9 : Infinity)))))

    return { max, rows: lines }
  }
  const selCap = f.prepItemId ? prepCapacity(f.prepItemId) : null

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
          <input placeholder="เลขล็อต (เว้นว่าง = ระบบสร้างให้)" value={f.lotNo || ''} onChange={e => setF({ ...f, lotNo: e.target.value })} />
          <input placeholder="ซัพพลายเออร์ (ถ้ามี)" value={f.supplier || ''} onChange={e => setF({ ...f, supplier: e.target.value })} />
          <label><small>วันที่รับสินค้าเข้า (ระบบจะเบิกของที่รับเข้าก่อนออกก่อน)</small></label>
          <input type="date" max={today} value={f.receivedAt || today} onChange={e => setF({ ...f, receivedAt: e.target.value })} />
          <details style={{ margin: '6px 0' }}>
            <summary><small>ตั้งค่าเพิ่มเติม (ไม่บังคับ)</small></summary>
            <label><small>สถานะการเก็บ</small></label>
            <select value={storage} onChange={e => setF({ ...f, storage: e.target.value })}>
              {Object.entries(STORAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label><small>วันหมดอายุตามฉลาก (ถ้ามี — ไม่ใส่ก็ได้ ระบบไม่ใช้เรียงลำดับเบิก)</small></label>
            <input type="date" value={f.expiresAt || ''} onChange={e => setF({ ...f, expiresAt: e.target.value })} />
          </details>
          <button className="btn-primary" onClick={() => run(() => api.receiveRaw({
            branchId: Number(b),
            materialId: Number(f.materialId),
            qty: Number(f.qty),
            note: f.price ? `ราคา ${f.price} บาท` : undefined,
            lotNo: f.lotNo || undefined,
            receivedAt: new Date(`${f.receivedAt || today}T08:00:00`).toISOString(),
            storage,
            supplier: f.supplier || undefined,
            expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : undefined,
          }))}>รับเข้า (สร้างล็อตใหม่)</button>
        </div></>}

      {tab === 2 && <>
        <PrepBatches batches={batches} onChanged={load} />
        <div className="card gray"><b>วัตถุดิบที่ใช้หมักได้ตอนนี้</b>
          <small>นับเฉพาะของที่ยังไม่หมดอายุ</small>
          {preps.length === 0 && <small>ยังไม่มีสูตรหมัก</small>}
          {preps.map(p => {
            const cap = prepCapacity(p.id)

            return (
              <div key={p.id} style={{ borderTop: '1px solid #ccc', padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{p.name}</span>
                  <b style={{ color: cap.max === 0 ? '#c62828' : undefined }}>
                    {cap.max == null ? 'ยังไม่ได้ตั้งสูตร' : `หมักได้ ${cap.max} ${p.unit || 'ตัว'}`}
                  </b>
                </div>
                {cap.rows.map(l => (
                  <small key={l.name} style={{ display: 'block' }}>
                    {l.name}: ใช้ได้ {l.have} {l.unit} (ใช้ {l.per} ต่อ 1 {p.unit || 'ตัว'})
                  </small>
                ))}
              </div>
            )
          })}
        </div>
        <div className="card gray"><b>เริ่มหมัก (ตัดวัตถุดิบดิบตามสูตร)</b>
          <select value={f.prepItemId || ''} onChange={e => setF({ ...f, prepItemId: e.target.value })}>
            <option value="">เลือกสูตรหมัก</option>{preps.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {selCap && selCap.max != null && (
            <small style={{ display: 'block', color: Number(f.qty) > selCap.max ? '#c62828' : undefined }}>
              หมักได้สูงสุด {selCap.max} ตัว
              {Number(f.qty) > selCap.max ? ' — วัตถุดิบไม่พอสำหรับจำนวนที่ใส่ ต้องรับของเข้าเพิ่มก่อน' : ''}
              {selCap.max > 0 && (
                <button type="button" className="btn-outline" style={{ width: 'auto', padding: '2px 10px', marginLeft: 8 }} onClick={() => setF({ ...f, qty: String(selCap.max) })}>ใส่เท่าที่หมักได้</button>
              )}
            </small>
          )}
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

      {tab === 5 && <StockLots branchId={b} branchName={branchName} category={category} materials={mats} onChanged={load} />}
    </Layout>
  )
}
