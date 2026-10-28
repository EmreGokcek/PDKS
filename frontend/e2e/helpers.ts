import { expect, type Page } from '@playwright/test'

export const PASSWORD = process.env.E2E_PASSWORD ?? 'Pdks123!'

/** Giriş yapar; aydınlatma metni ilk kez soruluyorsa onaylar. */
export async function login(page: Page, email: string, options: { remember?: boolean } = {}) {
  await page.goto('/giris')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill(PASSWORD)
  if (options.remember) await page.getByLabel(/Beni hatırla/).check()
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await acceptPrivacyIfAsked(page)
}

export async function acceptPrivacyIfAsked(page: Page) {
  await page.waitForURL((url) => !url.pathname.startsWith('/giris'))
  if (new URL(page.url()).pathname === '/aydinlatma') {
    await expect(page.getByRole('heading', { name: /Aydınlatma Metni/ })).toBeVisible()
    await page.getByLabel('Aydınlatma metnini okudum ve anladım.').check()
    await page.getByRole('button', { name: 'Devam et' }).click()
    await page.waitForURL((url) => url.pathname !== '/aydinlatma')
  }
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Çıkış yap' }).first().click()
  await page.waitForURL('**/giris')
}
