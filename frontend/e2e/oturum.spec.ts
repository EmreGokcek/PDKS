import { expect, test } from '@playwright/test'
import { login, logout } from './helpers'

test('hatalı şifre anlaşılır bir hata gösterir', async ({ page }) => {
  await page.goto('/giris')
  await page.getByLabel('E-posta').fill('admin@pdks.local')
  await page.getByLabel('Şifre', { exact: true }).fill('yanlis-sifre')
  await page.getByRole('button', { name: 'Giriş yap' }).click()
  await expect(page.getByRole('alert')).toContainText(/hatalı/)
})

test('yönetici girer, sayfa yenilenince oturum sürer, çıkınca kapanır', async ({ page }) => {
  await login(page, 'admin@pdks.local', { remember: true })
  await expect(page).toHaveURL(/\/admin\/pano/)
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()

  // Erişim anahtarı yalnızca bellekte; yenilemede çerezdeki oturumla devam edilir.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('pdks.token'))).toBeNull()

  await logout(page)
  await page.reload()
  await expect(page).toHaveURL(/\/giris/)
})

test('aydınlatma metni giriş yapmadan okunabilir', async ({ page }) => {
  await page.goto('/giris')
  await page.getByRole('link', { name: 'KVKK aydınlatma metni' }).click()
  await expect(page.getByRole('heading', { name: /Aydınlatma Metni/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Haklarınız' })).toBeVisible()
})

test('giriş yapılmadan korumalı sayfaya gidilince giriş ekranı açılır', async ({ page }) => {
  await page.goto('/admin/personel')
  await expect(page).toHaveURL(/\/giris/)
})
