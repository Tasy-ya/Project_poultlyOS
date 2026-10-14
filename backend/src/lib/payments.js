const crypto = require('crypto')
const { HttpError } = require('./errors')

// =====================================================
// ผู้ให้บริการชำระเงินฝั่งลูกค้า
//
// PAYMENT_MODE=sandbox  (ค่าเริ่มต้น)  อนุมัติทุกรายการทันที สำหรับทดสอบเท่านั้น
//                                      ห้ามใช้กับร้านจริง เพราะไม่ได้รับเงินจริง
// PAYMENT_MODE=live                     ต้องต่อผู้ให้บริการจริง (เช่น PromptPay ผ่าน
//                                      Omise / 2C2P / ธนาคาร) ใน charge() ด้านล่าง
//
// สัญญาของ charge(): คืน { ok: true, ref } เมื่อได้รับเงินแล้วเท่านั้น
// ถ้าไม่สำเร็จให้ throw HttpError (ระบบจะย้อนออเดอร์/สต็อกทั้งหมดให้เอง)
// =====================================================

function mode() {
  return process.env.PAYMENT_MODE || 'sandbox'
}

async function charge({ amount, method = 'qr', description }) {
  if (!(Number(amount) > 0)) {
    throw new HttpError(400, 'ยอดชำระไม่ถูกต้อง')
  }

  if (mode() === 'sandbox') {
    return {
      ok: true,
      method,
      ref: `SBX-${Date.now().toString(36).toUpperCase()}-${crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()}`,
    }
  }

  // TODO(live): เรียกผู้ให้บริการชำระเงินจริงตรงนี้ แล้วคืน { ok: true, ref: <เลขอ้างอิงธนาคาร/ผู้ให้บริการ> }
  // แนะนำให้ใช้รูปแบบ "สร้าง QR -> รอ webhook ยืนยัน" แล้วค่อยสร้างออเดอร์เมื่อ webhook ยืนยัน
  throw new HttpError(503, 'ระบบชำระเงินออนไลน์ยังไม่เปิดใช้งาน กรุณาติดต่อร้าน')
}

module.exports = { charge, mode }
