import {
  useEffect,
  useState,
} from 'react'

import {
  getActiveBranches,
  getSelectedBranchId,
  setSelectedBranchId,
  ensureSelectedBranch,
  onBranchChange,
} from '../branch'


function StoreIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 3h16l2 6H2l2-6z" />
      <path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
      <path
        d="M9 21v-6h6v6"
        fill="#fff"
      />
    </svg>
  )
}


// beforeChange (ไม่บังคับ): ฟังก์ชันที่รับ id สาขาใหม่
//   ถ้าคืนค่า false จะไม่สลับสาขา (ใช้ถามยืนยันก่อนสลับ)
// compact (ไม่บังคับ): แบบเล็ก ใช้ใส่ในแถบหัวสีแดงของ Layout (ช่อง right)
export default function BranchSelector({ beforeChange, compact = false }) {

  const [branches, setBranches] = useState([])
  const [selectedId, setSelectedId] = useState(null)


  function load() {

    const list = getActiveBranches()

    setBranches(list)

    const id = ensureSelectedBranch()

    setSelectedId(id)
  }


  useEffect(() => {

    load()

    return onBranchChange(() => {
      load()
    })

  }, [])


  function handleChange(event) {

    const id = event.target.value

    if (beforeChange && beforeChange(id) === false) {
      return
    }

    setSelectedId(id)

    setSelectedBranchId(id)
  }


  if (branches.length === 0) {
    return null
  }


  // ---------------------------------------------------
  // แบบเล็ก: อยู่ในแถบหัวสีแดง ข้างชื่อหน้า
  // กว้างตามช่องด้านขวาของ Layout ชื่อสาขายาวจะถูกตัดด้วย ...
  // ---------------------------------------------------
  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: '#fff',
          color: '#e21b1b',
          borderRadius: 10,
          padding: '6px 8px',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <StoreIcon size={16} />

        <select
          value={selectedId || ''}
          onChange={handleChange}
          aria-label="สาขาที่กำลังใช้งาน"
          title="สาขาที่กำลังใช้งาน"
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            color: '#222',
            minWidth: 0,
            width: '100%',
            maxWidth: 170,
            cursor: 'pointer',
            textOverflow: 'ellipsis',
          }}
        >
          {branches.map(branch => (
            <option
              key={branch.id}
              value={branch.id}
            >
              {branch.name}
            </option>
          ))}
        </select>
      </div>
    )
  }


  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#fff',
        border: '1px solid #e5e5e5',
        borderRadius: 10,
        padding: '7px 10px',
        minWidth: 190,
      }}
    >

      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: '#fff0f0',
          color: '#e21b1b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <StoreIcon size={17} />
      </div>


      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          flex: 1,
        }}
      >

        <span
          style={{
            fontSize: 10,
            color: '#888',
            lineHeight: 1.2,
          }}
        >
          สาขาที่กำลังใช้งาน
        </span>


        <select
          value={selectedId || ''}
          onChange={handleChange}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            fontWeight: 700,
            color: '#222',
            width: '100%',
            cursor: 'pointer',
          }}
        >

          {branches.map(branch => (

            <option
              key={branch.id}
              value={branch.id}
            >
              {branch.name}
            </option>

          ))}

        </select>

      </div>

    </div>
  )
}
