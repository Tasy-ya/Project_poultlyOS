// compression (gzip) ช่วยให้มือถือโหลดเร็วขึ้น แต่ไม่ใช่ของจำเป็น
// ถ้ายังไม่ได้ npm install ให้ข้ามไปก่อน แทนที่จะทำให้ทั้ง backend ล้ม (หน้าเว็บจะขึ้น Failed to fetch)
module.exports = function safeCompression(options) {
  try {
    return require('compression')(options)
  } catch (err) {
    console.warn(
      '[เตือน] ยังไม่ได้ติดตั้งแพ็กเกจ compression — ทำงานต่อได้แต่ไม่บีบอัดข้อมูล ' +
        'แก้โดยรัน npm install ในโฟลเดอร์ backend'
    )
    return (req, res, next) => next()
  }
}
