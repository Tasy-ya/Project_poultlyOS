import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useShop } from './ShopContext'
import { API_BASE, SHOP_PHONE, formatPhone } from './shopApi'
import logo from './assets/logo.jpg'
import './theme.css'
import './shop.css'

const facebookUrl = import.meta.env.VITE_SHOP_FACEBOOK_URL || 'https://www.facebook.com/profile.php?id=100090386508496'
const storeAddress = import.meta.env.VITE_SHOP_ADDRESS || ''
const mapQuery = encodeURIComponent(storeAddress || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`

function CartIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
}

function OrdersIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
}

export default function ShopLayout({ title, back, children, footer }) {
  const navigate = useNavigate()
  const { count } = useShop()
  const [infoOpen, setInfoOpen] = useState(false)
  const [branch, setBranch] = useState(null)
  useEffect(() => {
    fetch(`${API_BASE}/public/branches`)
      .then(r => r.ok ? r.json() : [])
      .then(list => setBranch(list?.[0] || null)).catch(() => {})
  }, [])
  const address = storeAddress || branch?.address || ''
  // เบอร์โทรร้าน (แสดงเมื่อกดโลโก้เป็ดมุมซ้ายบน)
  const tel = SHOP_PHONE
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')}`
  return (
    <div className="screen shop" style={{ paddingBottom: footer ? 96 : 24 }}>
      <div className="topbar">
        {back ? <button className="icon-btn" aria-label="ย้อนกลับ" onClick={() => navigate(back === true ? -1 : back)}>‹</button> : <button className="shop-logo-button" aria-label="ข้อมูลร้าน" onClick={() => setInfoOpen(true)}><img src={logo} alt="ข้อมูลร้าน" width="34" height="34" style={{ borderRadius: 50, objectFit: 'cover' }} /></button>}
        <span style={{ flex: 1, textAlign: 'center' }}>{title}</span>
        <button className="cart-icon-button" aria-label="ออเดอร์ของฉัน" onClick={() => navigate('/orders')}><OrdersIcon /></button>
        <button className="cart-icon-button" aria-label="เปิดตะกร้าสินค้า" onClick={() => navigate('/cart')}><CartIcon /><span className="cart-count">{count}</span></button>
      </div>
      <div className="content">{children}</div>
      {footer && <div className="cart-bar">{footer}</div>}
      {infoOpen && <div className="shop-modal-backdrop" role="presentation" onClick={() => setInfoOpen(false)}><section className="shop-modal" role="dialog" aria-modal="true" aria-label="ข้อมูลร้าน" onClick={e => e.stopPropagation()}>
        <button className="shop-modal-close" onClick={() => setInfoOpen(false)} aria-label="ปิด">×</button>
        <img src={logo} alt="โลโก้ร้าน" className="shop-modal-logo" />
        <h3>เป็ดย่างเกลือ ไก่หมุนขมิ้นฮาลาล</h3>
        <p>{address || 'กรุณาตั้งค่าที่อยู่ร้านในไฟล์ .env ของ customer-frontend'}</p>
        <p className="shop-modal-phone">📞 เบอร์โทรร้าน <b>{formatPhone(tel)}</b></p>
        <a className="btn-primary shop-modal-link" href={`tel:${tel}`}>โทรหาร้าน {formatPhone(tel)}</a>
        <a className="btn-outline shop-modal-link" href={maps} target="_blank" rel="noreferrer">เปิดแผนที่ร้านใน Google Maps</a>
        <a className="btn-outline shop-modal-link" href={facebookUrl} target="_blank" rel="noreferrer">Facebook ร้าน</a>
        <div className="shop-map-frame"><iframe title="แผนที่ร้าน" src={`https://maps.google.com/maps?q=${encodeURIComponent(address || 'ร้านเป็ดย่างเกลือไก่หมุนขมิ้น ฮาลาล หาดใหญ่')}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
      </section></div>}
    </div>
  )
}
