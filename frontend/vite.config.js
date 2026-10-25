import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    // อนุญาตให้เปิดผ่านโดเมน tunnel (trycloudflare.com)
    allowedHosts: ['.trycloudflare.com'],
    // ส่งคำขอ /api ต่อไปที่ backend ในเครื่อง
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})