const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { HttpError } = require('./errors')

// =====================================================
// เก็บรูปสลิปโอนเงินของลูกค้า
//   - เก็บเป็นไฟล์ใน backend/uploads/slips (ไม่เสิร์ฟเป็นสาธารณะ)
//   - พนักงาน/แอดมินดูได้ผ่าน API ที่ตรวจสิทธิ์เท่านั้น
//   - ตรวจประเภทไฟล์จากเนื้อไฟล์จริง (JPEG / PNG / WebP) ไม่เชื่อนามสกุลที่ลูกค้าส่งมา
// =====================================================

const SLIP_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'slips')
const MAX_BYTES = 6 * 1024 * 1024

function detectType(buf) {
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }

  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' }
  }

  if (
    buf.length > 12 &&
    buf.slice(0, 4).toString('ascii') === 'RIFF' &&
    buf.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' }
  }

  return null
}

function saveSlip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new HttpError(400, 'ไม่พบรูปสลิป กรุณาเลือกรูปแล้วลองใหม่')
  }

  if (buf.length > MAX_BYTES) {
    throw new HttpError(413, 'รูปสลิปใหญ่เกินไป (ไม่เกิน 6 MB)')
  }

  const type = detectType(buf)

  if (!type) {
    throw new HttpError(400, 'รองรับเฉพาะรูปภาพ JPG, PNG หรือ WebP')
  }

  fs.mkdirSync(SLIP_DIR, { recursive: true })

  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${type.ext}`
  fs.writeFileSync(path.join(SLIP_DIR, name), buf)

  return name
}

// คืนที่อยู่ไฟล์ (กัน path traversal) หรือ null ถ้าไม่มีไฟล์
function slipFile(name) {
  const safe = path.basename(String(name || ''))

  if (!/^[0-9]+-[0-9a-f]{16}\.(jpg|png|webp)$/.test(safe)) return null

  const full = path.join(SLIP_DIR, safe)

  return fs.existsSync(full) ? full : null
}

function removeSlip(name) {
  const full = slipFile(name)

  if (full) {
    try {
      fs.unlinkSync(full)
    } catch {
      // ลบไม่ได้ก็ไม่เป็นไร
    }
  }
}

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex')

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const mimeOf = name => MIME[String(name || '').split('.').pop().toLowerCase()] || null

module.exports = { saveSlip, slipFile, removeSlip, sha256, mimeOf, MAX_BYTES }
