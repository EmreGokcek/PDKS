import { expect, test } from '@playwright/test'
import { acceptPrivacyIfAsked } from './helpers'

test('yeni firma kaydolur, profilini tamamlar ve kiosk ekler', async ({ page }) => {
  const email = `kurucu.${Date.now().toString(36)}@e2e.test`

  await page.goto('/giris')
  await page.getByRole('link', { name: /Firmanı kaydet/ }).click()
  await page.getByLabel('Firma adı').fill('E2E Kafe')
  await page.getByLabel('Ad', { exact: true }).fill('Ayşe')
  await page.getByLabel('Soyad').fill('Kurucu')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre').fill('GucluSifre123')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Firmayı oluştur' }).click()

  // Yönetici hesabı açıldı; profil tamamlanınca panele geçilir.
  await acceptPrivacyIfAsked(page)
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()

  await page.getByRole('link', { name: 'Firma ayarları' }).first().click()
  await page.getByRole('button', { name: 'Kiosk ekle' }).click()
  await page.getByRole('button', { name: 'Kioskı oluştur' }).click()
  await expect(page.getByRole('heading', { name: 'Kiosk giriş bilgileri' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText(/@kiosk\.pdks$/)).toBeVisible()
})
