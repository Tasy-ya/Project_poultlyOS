import { useEffect, useState } from 'react'
import { fetchSlipUrl } from '../api'

// =====================================================
// แสดงรูปสลิปที่ลูกค้าแนบ (พนักงานขาย / แอดมิน)
// - โหลดรูปผ่าน API ที่ตรวจสิทธิ์ แล้วแสดงภาพย่อ กดเพื่อดูภาพเต็ม
// =====================================================

export default function SlipViewer({ path }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    let made = ''

    setUrl('')
    setError('')

    fetchSlipUrl(path)
      .then(u => {
        made = u

        if (alive) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch(e => alive && setError(e.message || 'โหลดสลิปไม่สำเร็จ'))

    return () => {
      alive = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [path])

  if (error) {
    return (
      <div style={{ background: '#ffe8e8', color: '#b00000', borderRadius: 9, padding: 9, fontSize: 13, margin: '8px 0' }}>
        {error}
      </div>
    )
  }

  if (!url) {
    return <div style={{ color: '#888', fontSize: 13, margin: '8px 0' }}>กำลังโหลดสลิป...</div>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="ดูสลิปขนาดเต็ม"
        style={{
          display: 'block',
          width: '100%',
          border: '1px solid #ddd',
          borderRadius: 10,
          background: '#fafafa',
          padding: 6,
          margin: '8px 0',
          cursor: 'zoom-in',
        }}
      >
        <img
          src={url}
          alt="สลิปโอนเงินของลูกค้า"
          style={{ display: 'block', maxHeight: 220, maxWidth: '100%', margin: '0 auto', objectFit: 'contain' }}
        />
        <small style={{ display: 'block', textAlign: 'center', color: '#666', marginTop: 4 }}>
          แตะเพื่อดูสลิปขนาดเต็ม
        </small>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={url}
            alt="สลิปโอนเงินขนาดเต็ม"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: '#fff' }}
          />
        </div>
      )}
    </>
  )
}
