import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// แยกจากระบบพนักงาน (5173) — ลูกค้าเปิดที่พอร์ต 5174
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5174 },
})
