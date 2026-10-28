import { expect, test } from '@playwright/test'
import { login } from './helpers'

// Canlı bağlantı gerçek API ister; yerelde sahte API ile çalışırken atlanır (E2E_MOCK=1).
test.skip(!!process.env.E2E_MOCK, 'Sahte API canlı bağlantıyı desteklemiyor')

test('müdür panosu canlı bağlantıya geçer', async ({ page }) => {
  await login(page, 'mudur@pdks.local')
  await expect(page.getByRole('heading', { name: 'Genel bakış' })).toBeVisible()
  await expect(page.getByText('Canlı', { exact: true })).toBeVisible({ timeout: 15_000 })
})
