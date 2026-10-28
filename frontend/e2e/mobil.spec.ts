import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('personel telefonda Bugünüm ekranını ve alt sekmeleri görür', async ({ page }) => {
  await login(page, 'personel@pdks.local')
  await expect(page).toHaveURL(/\/personel$/)
  await expect(page.getByRole('heading', { name: /Merhaba/ })).toBeVisible()

  const tabs = page.getByRole('navigation', { name: 'Menü' })
  await expect(tabs.getByRole('link', { name: 'Vardiyalarım' })).toBeVisible()
  await tabs.getByRole('link', { name: 'Duyurular' }).click()
  await expect(page.getByRole('heading', { name: 'Duyurular' })).toBeVisible()
})
