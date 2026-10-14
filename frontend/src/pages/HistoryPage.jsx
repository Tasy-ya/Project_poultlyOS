import { useEffect, useState } from 'react'
import Layout, { getStaff } from '../components/Layout'
import { api, getSelectedBranchId, onBranchChange } from '../api'
import { getActiveBranches } from '../branch'

// วันนี้ ในรูป YYYY-MM-DD (ตามเวลาเครื่อง)
function todayString() {
  const d = new Date()

  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${d.getFullYear()}-${month}-${day}`
}

const METHOD = {
  cash: 'เงินสด',
  qr: 'QR',
  transfer: 'โอน',
  card: 'บัตร',
  other: 'อื่นๆ',
}

export default function HistoryPage() {
  const staff = getStaff()

  // สาขาที่เลือกอยู่ (เปลี่ยนที่หน้าแรก / สต็อก แล้วประวัติเปลี่ยนตาม)
  const [branchId, setBranchId] = useState(
    getSelectedBranchId() || staff?.branchId || ''
  )

  useEffect(() => {
    return onBranchChange(id => setBranchId(id || ''))
  }, [])

  const branchName =
    getActiveBranches().find(
      b => String(b.id) === String(branchId)
    )?.name || ''

  // วันที่ที่ดู (ค่าเริ่มต้น = วันนี้ -> ยอดเริ่มที่ 0 ใหม่ทุกวัน)
  const [date, setDate] = useState(todayString())
  const isToday = date === todayString()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    if (!branchId) {
      setError('ไม่พบข้อมูลสาขา')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const data =
        await api.getHistory(branchId, date)

      console.log(
        'ประวัติออเดอร์จาก Database:',
        data
      )

      setOrders(
        Array.isArray(data)
          ? data
          : []
      )

    } catch (e) {
      console.error(
        'โหลดประวัติออเดอร์ไม่สำเร็จ:',
        e
      )

      setError(
        e?.message ||
        'ไม่สามารถโหลดประวัติการสั่งซื้อได้'
      )

      setOrders([])

    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [branchId, date])

  async function cancel(o) {
    const reason = prompt(
      'เหตุผลที่ยกเลิก?'
    )

    if (reason === null) return

    try {
      await api.cancelOrder(
        o.id,
        reason
      )

      await load()

    } catch (e) {
      console.error(
        'ยกเลิกออเดอร์ไม่สำเร็จ:',
        e
      )

      alert(
        e?.message ||
        'ไม่สามารถยกเลิกออเดอร์ได้'
      )
    }
  }

  const total = orders
    .filter(
      o => o.status === 'completed'
    )
    .reduce(
      (sum, o) =>
        sum +
        Number(o.totalAmount || 0),
      0
    )

  return (
    <Layout
      title="ประวัติการสั่งซื้อ"
      back={false}
    >

      {/* เลือกวันที่ (ปฏิทิน) */}
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#777' }}>
            {branchName ? `สาขา: ${branchName}` : 'ประวัติการขาย'}
          </div>

          <b>
            {isToday ? 'วันนี้' : 'ย้อนหลัง'}
          </b>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={e =>
              setDate(e.target.value || todayString())
            }
            style={{
              padding: '8px 10px',
              border: '1px solid #ccc',
              borderRadius: 8,
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />

          {!isToday && (
            <button
              className="btn-outline"
              style={{ padding: '6px 12px' }}
              onClick={() => setDate(todayString())}
            >
              วันนี้
            </button>
          )}
        </div>
      </div>

      {/* กำลังโหลด */}
      {loading && (
        <div
          className="card"
          style={{
            textAlign: 'center',
          }}
        >
          กำลังโหลดประวัติการสั่งซื้อ...
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="card"
          style={{
            color: '#c00',
            background: '#fff0f0',
          }}
        >
          ❌ {error}

          <button
            className="btn-outline"
            style={{
              width: '100%',
              marginTop: 10,
            }}
            onClick={load}
          >
            ลองใหม่
          </button>
        </div>
      )}

      {/* ไม่มีออเดอร์ */}
      {!loading &&
        !error &&
        orders.length === 0 && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              color: '#666',
            }}
          >
            {isToday
              ? 'วันนี้ยังไม่มีออเดอร์'
              : 'วันที่เลือกไม่มีออเดอร์'}
          </div>
        )}

      {/* รายการออเดอร์ */}
      {!loading &&
        orders.map(o => (
          <div
            className="card"
            key={o.id}
            style={{
              opacity:
                o.status === 'cancelled'
                  ? 0.5
                  : 1,
            }}
          >

            {/* เลขใบเสร็จ + เวลา */}
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              <b>
                {o.receiptNo}
              </b>

              <span>
                {o.createdAt
                  ? new Date(
                      o.createdAt
                    ).toLocaleString(
                      'th-TH'
                    )
                  : '-'}
              </span>
            </div>

            {/* รายการสินค้า */}
            {Array.isArray(o.items) &&
              o.items.map(i => (
                <div
                  key={i.id}
                  style={{
                    marginBottom: 4,
                  }}
                >
                  {i.menu?.name ||
                    `เมนู #${i.menuId}`}

                  {' '}

                  (
                  {i.size === 'half'
                    ? 'ครึ่ง'
                    : 'เต็ม'}
                  )

                  {' ×'}
                  {i.qty}
                </div>
              ))}

            {/* ราคา + วิธีชำระ */}
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                marginTop: 10,
              }}
            >

              <span>
                {
                  METHOD[
                    o.payments?.[0]
                      ?.method
                  ] || '-'
                }

                {' · ฿'}

                {Number(
                  o.totalAmount || 0
                ).toLocaleString(
                  'th-TH'
                )}
              </span>

              {o.status === 'completed' ? (
                <button
                  className="btn-outline"
                  style={{
                    padding:
                      '2px 10px',
                  }}
                  onClick={() =>
                    cancel(o)
                  }
                >
                  ยกเลิก
                </button>
              ) : (
                <span
                  style={{
                    color: 'red',
                  }}
                >
                  ยกเลิกแล้ว
                </span>
              )}

            </div>

          </div>
        ))}

      {/* รวมยอด */}
      <div
        className="card gray"
        style={{
          textAlign: 'center',
          fontWeight: 'bold',
        }}
      >
        {isToday ? 'ยอดขายวันนี้' : 'ยอดขายวันที่เลือก'} ฿
        {total.toLocaleString('th-TH')}
      </div>

    </Layout>
  )
}