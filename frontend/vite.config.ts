import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // /api ile başlayan istekler .NET API'ye yönlendirilir (CORS derdi olmaz).
    proxy: {
      '/api': 'http://localhost:5080',
    },
  },
})
