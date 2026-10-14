// จำกัดจำนวนครั้งต่อ IP (ในหน่วยความจำ พอสำหรับเซิร์ฟเวอร์เครื่องเดียว)
function rateLimit({ windowMs, max, message = 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่' }) {
  const hits = new Map()

  setInterval(() => {
    const now = Date.now()
    for (const [key, v] of hits) {
      if (now - v.start > windowMs) hits.delete(key)
    }
  }, windowMs).unref()

  return (req, res, next) => {
    const key = req.ip
    const now = Date.now()
    const cur = hits.get(key)

    if (!cur || now - cur.start > windowMs) {
      hits.set(key, { start: now, count: 1 })
      return next()
    }

    cur.count += 1

    if (cur.count > max) {
      return res.status(429).json({ error: message })
    }

    next()
  }
}

module.exports = { rateLimit }
