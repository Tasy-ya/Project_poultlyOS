import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { baht } from '../api'
import {
  loadQueue,
  onQueueChange,
  removeFromQueue,
  resetFailed,
  syncQueue,
} from '../offline'

// =====================================================
// คิวออเดอร์ที่ขายตอนออฟไลน์
// - รอซิงค์     : จะส่งขึ้นระบบอัตโนมัติเมื่อมีเน็ต
// - ซิงค์ไม่สำเร็จ : ระบบปฏิเสธ (เช่น สต็อกไม่พอ) ให้ตรวจแล้วเลือก ลองใหม่ / ลบ
// =====================================================
export default function OfflineQueuePage() {
  const [queue, setQueue] = useState(() => loadQueue())

  useEffect(() => onQueueChange(() => setQueue(loadQueue())), [])

  function discard(item) {
    const ok = window.confirm(
      'ลบรายการนี้ออกจากคิว? ออเดอร์นี้จะไม่ถูกบันทึกลงระบบ (ถ้าลูกค้าจ่ายเงินไปแล้ว ให้บันทึกยอดด้วยวิธีอื่น)'
    )

    if (ok) removeFromQueue(item.localId)
  }

  function retry(item) {
    resetFailed(item.localId)
    syncQueue()
  }

  const totalOf = item =>
    (item.body?.payments || []).reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0
    )

  return (
    <Layout title="คิวออฟไลน์" back={false}>
      {queue.length === 0 && (
        <div className="card">ไม่มีออเดอร์ค้างในคิว</div>
      )}

      {queue.length > 0 && (
        <button
          className="btn-primary"
          style={{ marginBottom: 12 }}
          onClick={() => syncQueue()}
        >
          ซิงค์ตอนนี้
        </button>
      )}

      {queue.map(item => (
        <div className="card" key={item.localId}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{baht(totalOf(item))}</b>

            <span style={{ color: item.failed ? '#b00020' : '#e08600', fontWeight: 700 }}>
              {item.failed ? 'ซิงค์ไม่สำเร็จ' : 'รอซิงค์'}
            </span>
          </div>

          <small>
            ขายเมื่อ {new Date(item.body?.clientCreatedAt || item.queuedAt).toLocaleString('th-TH')}
            {' · '}
            {(item.body?.items || []).length} รายการ
          </small>

          {item.failed && (
            <div style={{ color: '#b00020', marginTop: 6, fontSize: 14 }}>
              {item.error}
            </div>
          )}

          {item.failed && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-outline" onClick={() => retry(item)}>
                ลองใหม่
              </button>

              <button className="btn-outline" onClick={() => discard(item)}>
                ลบออกจากคิว
              </button>
            </div>
          )}
        </div>
      ))}
    </Layout>
  )
}
