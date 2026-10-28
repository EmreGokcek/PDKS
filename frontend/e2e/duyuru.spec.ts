import { expect, test } from '@playwright/test'
import { login, logout } from './helpers'

test('müdürün yazdığı duyuruyu personel görür', async ({ page }) => {
  const title = `E2E duyurusu ${Date.now().toString(36)}`

  await login(page, 'mudur@pdks.local')
  await page.goto('/mudur/duyurular')
  await page.getByRole('button', { name: 'Duyuru yaz' }).click()
  await page.getByLabel('Başlık').fill(title)
  await page.getByLabel(/Metin/).fill('Uçtan uca test tarafından yazıldı.')
  await page.getByRole('button', { name: 'Yayınla' }).click()
  await expect(page.getByText('Duyuru yayınlandı.')).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await logout(page)

  await login(page, 'personel@pdks.local')
  await page.goto('/personel/duyurular')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Duyuru yaz' })).toHaveCount(0)
})
