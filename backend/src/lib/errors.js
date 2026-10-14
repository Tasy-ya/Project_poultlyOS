// ข้อผิดพลาดที่ "บอกลูกค้าได้ตรง ๆ" (ข้อความปลอดภัย ไม่รั่วรายละเอียดภายใน)
class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

module.exports = { HttpError }
