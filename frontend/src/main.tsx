import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from 'sonner'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import './i18n'
import './index.css'
import { ThemeProvider, useTheme } from './theme/ThemeProvider'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

function ThemedToaster() {
  const { resolved } = useTheme()
  return <Toaster theme={resolved} position="bottom-right" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* Sistemde "hareketi azalt" açıksa animasyonlar sadeleşir */}
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <App />
              <ThemedToaster />
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  </StrictMode>,
)
