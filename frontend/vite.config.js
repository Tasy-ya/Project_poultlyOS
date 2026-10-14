import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true = เครื่องอื่นในร้าน (มือถือ/แท็บเล็ต) เปิดผ่าน IP ของเครื่องนี้ได้
  server: {
    host: true,
  },
})
