import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// "npm run dev:phone": aynı ağdaki telefondan https ile erişim (kamera yalnızca https'te çalışır).
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone'
  return {
    plugins: [react(), tailwindcss(), ...(phone ? [basicSsl()] : [])],
    server: {
      port: 5173,
      host: phone ? true : undefined,
      // /api ile başlayan istekler .NET API'ye yönlendirilir (CORS derdi olmaz).
      proxy: {
        '/api': 'http://localhost:5080',
      },
    },
  }
})
