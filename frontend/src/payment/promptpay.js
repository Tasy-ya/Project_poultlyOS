// สร้างข้อความ PromptPay (Thai QR Payment / EMVCo) ที่ "กำหนดยอดเงินไว้แล้ว"
// ลูกค้าสแกนแล้วแอปธนาคารจะขึ้นยอดและชื่อบัญชีร้านให้เอง ไม่ต้องกรอก (เหมือนแอปส่งอาหาร)

const crc16 = str => {
  let crc = 0xffff

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8

    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value

// target: เบอร์มือถือ 10 หลัก | เลขบัตรประชาชน/ภาษี 13 หลัก | e-Wallet 15 หลัก
export function promptPayPayload(target, amount) {
  const digits = String(target || '').replace(/\D/g, '')

  let sub
  let value

  if (digits.length === 10 && digits.startsWith('0')) {
    sub = '01'
    value = '0066' + digits.slice(1)
  } else if (digits.length === 13) {
    sub = '02'
    value = digits
  } else if (digits.length === 15) {
    sub = '03'
    value = digits
  } else {
    throw new Error('PromptPay ID ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลข 13 หลัก')
  }

  const amt = Number(amount)
  const hasAmount = amt > 0

  let p = tlv('00', '01') + tlv('01', hasAmount ? '12' : '11')
  p += tlv('29', tlv('00', 'A000000677010111') + tlv(sub, value))
  p += tlv('53', '764')
  if (hasAmount) p += tlv('54', amt.toFixed(2))
  p += tlv('58', 'TH')
  p += '6304'

  return p + crc16(p)
}

// แสดงเลขบัญชีแบบปิดบังบางส่วน เช่น 064-XXX-3663
export function maskPromptPayId(target) {
  const d = String(target || '').replace(/\D/g, '')

  if (d.length === 10) return `${d.slice(0, 3)}-XXX-${d.slice(6)}`
  if (d.length >= 13) return `${'X'.repeat(d.length - 3)}${d.slice(-3)}`

  return d
}
