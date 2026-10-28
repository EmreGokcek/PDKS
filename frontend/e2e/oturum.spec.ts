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
  await expect(page).toHaveURL(/\/admin$/)
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

test('İK personel ve denetim kaydını görür, vardiya planına giremez', async ({ page }) => {
  await login(page, 'ik@pdks.local')
  const menu = page.getByRole('complementary')
  await expect(menu.getByRole('link', { name: 'Denetim kaydı' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'Vardiya planı' })).toHaveCount(0)

  await menu.getByRole('link', { name: 'Denetim kaydı' }).click()
  await expect(page.getByRole('heading', { name: 'Denetim kaydı' })).toBeVisible()

  // Adres elle yazılsa da yetkisi olmayan sayfa açılmaz.
  await page.goto('/ik/vardiyalar')
  await expect(page).toHaveURL(/\/ik$/)
})

test('personel yönetim sayfalarını göremez', async ({ page }) => {
  await login(page, 'personel@pdks.local')
  await page.goto('/personel/personel')
  await expect(page).toHaveURL(/\/personel$/)
  await expect(page.getByRole('heading', { name: /Merhaba/ })).toBeVisible()
})
