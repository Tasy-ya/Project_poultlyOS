const express = require('express')
const compression = require('./lib/safeCompression')
const path = require('path')
const http = require('http')
const fs = require('fs')

// =====================================================
// เสิร์ฟหน้าเว็บที่ build แล้ว (vite build) แทน vite dev
//   - หน้าลูกค้า  -> พอร์ต 3001 ตัวเดียวกับ backend ที่ "/"  (เรียก API ที่ /api ที่เดียวกัน)
//   - หน้าพนักงาน/แอดมิน -> พอร์ต 5173 (STAFF_PORT) เหมือนเดิม
// ไฟล์ใน /assets มีแฮชในชื่อ จึงแคชได้ยาว ส่วน index.html ห้ามแคช (อัปเดตแล้วเห็นทันที)
// =====================================================

const ROOT = path.resolve(__dirname, '..', '..')
const CUSTOMER_DIST = path.join(ROOT, 'customer-frontend', 'dist')
const STAFF_DIST = path.join(ROOT, 'frontend', 'dist')

const exists = dir => fs.existsSync(path.join(dir, 'index.html'))

function spaRouter(dir) {
  const router = express.Router()
  const indexFile = path.join(dir, 'index.html')

  router.use(
    express.static(dir, {
      index: false,
      setHeaders(res, file) {
        if (file.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache')
        } else if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400')
        }
      },
    })
  )

  // ลิงก์ลึก เช่น /pay/xxxx /receipt/xxxx ต้องตอบ index.html ให้ React Router จัดการต่อ
  router.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexFile)
  })

  return router
}

const hasCustomerApp = () => exists(CUSTOMER_DIST)
const customerAppRouter = () => spaRouter(CUSTOMER_DIST)

// ส่งต่อคำขอ /api ของหน้าพนักงานไปที่ backend (พอร์ต PORT) เพื่อให้เปิดผ่านพอร์ตเดียว/ลิงก์เดียวได้
// หน้าพนักงานที่ build แล้วเรียก /api บนพอร์ตเดียวกับหน้าเว็บ (ตั้ง VITE_API_URL=/api ตอน build)
function apiProxy(req, res, next) {
  if (!req.url.startsWith('/api')) return next()

  const target = http.request(
    {
      host: '127.0.0.1',
      port: Number(process.env.PORT || 3001),
      method: req.method,
      path: req.url,
      headers: { ...req.headers, host: `127.0.0.1:${process.env.PORT || 3001}` },
    },
    upstream => {
      res.writeHead(upstream.statusCode || 502, upstream.headers)
      upstream.pipe(res)
    }
  )

  target.on('error', () => {
    if (!res.headersSent) res.status(502).json({ error: 'เชื่อมต่อ backend ไม่ได้' })
    else res.end()
  })

  req.pipe(target)
}

function startStaffAppServer() {
  if (!exists(STAFF_DIST)) {
    console.log('ยังไม่ได้ build หน้าพนักงาน (frontend/dist) — ใช้ npm run dev ที่ frontend ต่อไปได้')
    return
  }

  const port = Number(process.env.STAFF_PORT || 5173)
  const app = express()

  app.use(apiProxy)
  app.use(compression())
  app.use(spaRouter(STAFF_DIST))

  app
    .listen(port, '0.0.0.0', () => {
      console.log(`หน้าพนักงาน/แอดมิน: http://localhost:${port}/`)
    })
    .on('error', err => {
      console.error(
        `เปิดหน้าพนักงานที่พอร์ต ${port} ไม่ได้ (${err.code}) — ถ้ากำลังรัน npm run dev ของ frontend อยู่ให้ปิดก่อน`
      )
    })
}

module.exports = { hasCustomerApp, customerAppRouter, startStaffAppServer }