import { defineConfig, devices } from '@playwright/test'

/**
 * Uçtan uca testler. Uygulama (API + web) önceden çalışıyor olmalı:
 * CI'da iş akışı başlatır; yerelde `dotnet run` + `npm run dev` sonrası `npm run e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // CI'da "github" raporlayıcısı başarısız testleri özet (annotation) olarak gösterir.
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'masaustu', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobil\.spec\.ts/ },
    { name: 'telefon', use: { ...devices['Pixel 7'] }, testMatch: /mobil\.spec\.ts/ },
  ],
})
