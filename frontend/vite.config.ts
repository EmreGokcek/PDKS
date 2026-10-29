import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// "npm run dev:phone": aynı ağdaki telefondan https ile erişim (kamera yalnızca https'te çalışır).
// "npm run dev:paylas": ücretsiz Cloudflare tüneliyle (trycloudflare.com) başkalarına açmak için; demo hesap düğmeleri gizlenir.
export default defineConfig(({ mode }) => {
  const phone = mode === 'phone'
  const share = mode === 'paylas'
  return {
    plugins: [react(), tailwindcss(), ...(phone ? [basicSsl()] : [])],
    server: {
      port: 5173,
      host: phone ? true : undefined,
      // Tünel adresinden gelen isteklere izin ver (Vite tanımadığı adresleri güvenlik için reddeder).
      allowedHosts: share ? ['.trycloudflare.com'] : undefined,
      // /api ile başlayan istekler .NET API'ye yönlendirilir (CORS derdi olmaz).
      proxy: {
        // ws: canlı pano bağlantısı (/api/hubs/live) WebSocket kullanır.
        '/api': { target: 'http://localhost:5080', ws: true },
      },
    },
  }
})
