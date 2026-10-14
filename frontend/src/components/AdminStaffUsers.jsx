import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { getActiveBranches } from '../branch'

// =====================================================
// ผู้ใช้งานระบบ (สำหรับหน้า Admin > จัดการสาขา)
//
// กดปุ่ม "ผู้ใช้งานระบบ" เพื่อดูรายชื่อผู้ลงทะเบียน
// ชื่อ / นามสกุล / เบอร์โทร / ไอดีไลน์ / รหัสพนักงาน / ตำแหน่ง / สาขา
// =====================================================

const POSITION_LABEL = {
  sales: 'ฝ่ายขาย',
  prep: 'ฝ่ายสต็อก',
  manager: 'แอดมิน',
  admin: 'แอดมิน',
  owner: 'แอดมิน',
}

const FILTERS = [
  ['all', 'ทั้งหมด'],
  ['sales', 'ฝ่ายขาย'],
  ['prep', 'ฝ่ายสต็อก'],
  ['admin', 'แอดมิน'],
]

function groupOf(position) {
  const p = String(position || '').toLowerCase()

  if (p === 'sales') return 'sales'
  if (p === 'prep' || p === 'stock') return 'prep'
  if (['manager', 'admin', 'owner'].includes(p)) return 'admin'

  return 'sales'
}

function UsersIcon({ size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="4" />
      <path d="M2 20c0-3.9 3.1-7 7-7s7 3.1 7 7v1H2v-1z" />
      <circle cx="17.5" cy="9" r="3" />
      <path d="M17 13.2c3 .3 5 2.6 5 5.3V20h-4.5v-1.2c0-2-.7-4-.5-5.6z" />
    </svg>
  )
}

const th = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 13,
  color: '#444',
  background: '#f4f4f4',
  whiteSpace: 'nowrap',
}

const td = {
  padding: '12px',
  fontSize: 14,
  borderTop: '1px solid #eee',
  whiteSpace: 'nowrap',
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  margin: '0 0 10px',
  border: '1px solid #ddd',
  borderRadius: 10,
  fontFamily: 'inherit',
  fontSize: 15,
  boxSizing: 'border-box',
}

const smallBtn = (color = '#222', bg = '#f3f3f3') => ({
  padding: '5px 10px',
  border: 'none',
  borderRadius: 8,
  background: bg,
  color,
  fontFamily: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

// หน้าต่างแก้ไขข้อมูล / รีเซ็ตรหัสผ่าน
function UserModal({ mode, user, onClose, onSaved }) {
  const [guessFirst = '', ...guessRest] = String(user.name || '').split(' ')

  const [form, setForm] = useState({
    firstName: user.firstName || guessFirst,
    lastName: user.lastName || guessRest.join(' '),
    phone: user.phone || '',
    lineId: user.lineId || '',
    position: groupOf(user.position) === 'prep' ? 'stock' : groupOf(user.position),
    branchId: user.branchId ?? '',
  })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setForm(cur => ({ ...cur, [k]: v }))

  async function save() {
    setErr('')

    try {
      setBusy(true)

      if (mode === 'edit') {
        await api.updateAdminStaff(user.id, form)
      } else {
        if (password.length < 4) {
          throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร')
        }

        if (password !== confirm) {
          throw new Error('รหัสและการยืนยันรหัสไม่ตรงกัน')
        }

        await api.resetAdminStaffPassword(user.id, password)
      }

      onSaved(
        mode === 'edit'
          ? 'บันทึกข้อมูลเรียบร้อย'
          : 'รีเซ็ตรหัสผ่านเรียบร้อย'
      )
    } catch (e) {
      setErr(e.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 20000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 14,
          padding: 18,
        }}
      >
        <h3 style={{ margin: '0 0 12px' }}>
          {mode === 'edit' ? 'แก้ไขข้อมูลพนักงาน' : 'รีเซ็ตรหัสผ่าน'} (รหัส {user.id})
        </h3>

        {mode === 'edit' ? (
          <>
            <input style={inputStyle} placeholder="ชื่อ" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
            <input style={inputStyle} placeholder="นามสกุล" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
            <input style={inputStyle} placeholder="เบอร์โทร" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            <input style={inputStyle} placeholder="ไอดีไลน์" value={form.lineId} onChange={e => set('lineId', e.target.value)} />

            <select style={inputStyle} value={form.position} onChange={e => set('position', e.target.value)}>
              <option value="sales">ฝ่ายขาย</option>
              <option value="stock">ฝ่ายสต็อก</option>
              <option value="admin">แอดมิน</option>
            </select>

            <select style={inputStyle} value={form.branchId} onChange={e => set('branchId', e.target.value)}>
              <option value="">ไม่ระบุสาขา</option>
              {getActiveBranches().map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 10, color: '#555' }}>
              ตั้งรหัสผ่านใหม่ให้ {user.name}
            </div>

            <input style={inputStyle} type="password" placeholder="รหัสผ่านใหม่" value={password} onChange={e => setPassword(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </>
        )}

        {err && <div style={{ color: '#c00', marginBottom: 10, fontSize: 14 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...smallBtn(), flex: 1, padding: 12, fontSize: 15 }} onClick={onClose}>
            ยกเลิก
          </button>

          <button style={{ ...smallBtn('#fff', '#ff1111'), flex: 1, padding: 12, fontSize: 15 }} disabled={busy} onClick={save}>
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminStaffUsers() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')

      const data = await api.getAdminStaff()

      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Load staff users:', err)

      setError(
        err?.message ||
          'ไม่สามารถโหลดรายชื่อผู้ใช้งานได้'
      )
    } finally {
      setLoading(false)
    }
  }

  async function toggleActive(u) {
    const next = !u.active

    const ok = window.confirm(
      next
        ? `เปิดใช้งานบัญชี ${u.name}?`
        : `ปิดใช้งานบัญชี ${u.name}? (จะเข้าสู่ระบบไม่ได้ทันที)`
    )

    if (!ok) return

    try {
      await api.setAdminStaffActive(u.id, next)

      setNotice(next ? 'เปิดใช้งานบัญชีแล้ว' : 'ปิดใช้งานบัญชีแล้ว')

      await load()
    } catch (e) {
      setNotice('❌ ' + (e.message || 'เปลี่ยนสถานะไม่สำเร็จ'))
    }
  }

  // โหลดตอนกดเปิดครั้งแรก
  useEffect(() => {
    if (open && users === null && !loading) {
      load()
    }
  }, [open])

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return (users || []).filter(u => {
      if (filter !== 'all' && groupOf(u.position) !== filter) {
        return false
      }

      if (!keyword) return true

      return [
        u.name,
        u.firstName,
        u.lastName,
        u.phone,
        u.lineId,
        u.id,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  }, [users, filter, search])

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 14,
        padding: 16,
        marginTop: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <UsersIcon />

          <h2 style={{ margin: 0, fontSize: 17 }}>
            ผู้ใช้งานระบบ
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 16px',
            border: 'none',
            borderRadius: 10,
            background: open ? '#f3f3f3' : '#ff1111',
            color: open ? '#222' : '#fff',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <UsersIcon size={17} />

          {open
            ? 'ซ่อนผู้ใช้งานระบบ'
            : users
              ? `ผู้ใช้งานระบบ (${users.length})`
              : 'ผู้ใช้งานระบบ'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 14 }}>

          {/* ค้นหา + กรองตำแหน่ง */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              placeholder="ค้นหา ชื่อ / เบอร์ / ไอดีไลน์ / รหัส"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                padding: '9px 12px',
                border: '1px solid #ddd',
                borderRadius: 10,
                fontFamily: 'inherit',
                fontSize: 14,
              }}
            />

            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                style={{
                  padding: '8px 14px',
                  border: '1px solid #ff1111',
                  borderRadius: 999,
                  background:
                    filter === key ? '#ff1111' : '#fff',
                  color:
                    filter === key ? '#fff' : '#ff1111',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {notice && (
            <div style={{ marginBottom: 10, fontSize: 14, color: notice.startsWith('❌') ? '#c00' : '#1a8f3c' }}>
              {notice}
            </div>
          )}

          {loading && (
            <div style={{ padding: 16, color: '#777' }}>
              กำลังโหลดรายชื่อผู้ใช้งาน...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: '#fff0f0',
                color: '#c00',
                fontSize: 14,
              }}
            >
              {error}

              <button
                type="button"
                onClick={load}
                style={{
                  marginLeft: 10,
                  padding: '4px 12px',
                  border: '1px solid #c00',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#c00',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                ลองใหม่
              </button>
            </div>
          )}

          {!loading && !error && users && (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>รหัส</th>
                    <th style={th}>ชื่อ</th>
                    <th style={th}>นามสกุล</th>
                    <th style={th}>เบอร์โทร</th>
                    <th style={th}>ไอดีไลน์</th>
                    <th style={th}>ตำแหน่ง</th>
                    <th style={th}>สาขา</th>
                    <th style={th}>สถานะ</th>
                    <th style={th}>จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          ...td,
                          textAlign: 'center',
                          color: '#888',
                        }}
                      >
                        ไม่พบผู้ใช้งาน
                      </td>
                    </tr>
                  )}

                  {rows.map(u => {
                    // บัญชีเก่าที่ไม่มีชื่อ/สกุลแยก ให้แยกจากชื่อเต็ม
                    const [firstGuess = '', ...rest] =
                      String(u.name || '').split(' ')

                    return (
                      <tr key={u.id}>
                        <td style={{ ...td, fontWeight: 700 }}>
                          {u.id}
                        </td>

                        <td style={td}>
                          {u.firstName || firstGuess || '-'}
                        </td>

                        <td style={td}>
                          {u.lastName || rest.join(' ') || '-'}
                        </td>

                        <td style={td}>{u.phone || '-'}</td>

                        <td style={td}>{u.lineId || '-'}</td>

                        <td style={td}>
                          {POSITION_LABEL[
                            String(u.position || '').toLowerCase()
                          ] ||
                            u.position ||
                            '-'}
                        </td>

                        <td style={td}>{u.branchName || '-'}</td>

                        <td style={td}>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: u.active
                                ? '#e6f6ea'
                                : '#eee',
                              color: u.active
                                ? '#1a8f3c'
                                : '#777',
                            }}
                          >
                            {u.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                        </td>

                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={smallBtn()} onClick={() => setModal({ mode: 'edit', user: u })}>
                              แก้ไข
                            </button>

                            <button style={smallBtn()} onClick={() => setModal({ mode: 'reset', user: u })}>
                              รีเซ็ตรหัส
                            </button>

                            <button
                              style={u.active ? smallBtn('#c00', '#fff0f0') : smallBtn('#1a8f3c', '#e6f6ea')}
                              onClick={() => toggleActive(u)}
                            >
                              {u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && (
        <UserModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={text => {
            setModal(null)
            setNotice(text)
            load()
          }}
        />
      )}
    </div>
  )
}
