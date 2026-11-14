import { expect, test } from '@playwright/test'

// Smoke test of the featured case levels preview (src/levels/, Ivan). Run alone:
//   npx playwright test tests/e2e/levels.spec.ts
test('levels preview lists the 10 featured cases and opens one', async ({ page }) => {
  await page.goto('/levels.html')

  const select = page.getByTestId('case-select')
  await expect(select.locator('option')).toHaveCount(11) // "Pick a case…" + 10 cases
  await expect(page.getByTestId('case-list').locator('li')).toHaveCount(10)

  await select.selectOption('dana_valencia')
  const level = page.getByTestId('case-level')
  await expect(level.getByRole('heading', { name: 'Valencia DANA' })).toBeVisible()
  await expect(level.locator('svg.lvl-chart path.lvl-chart__line')).toBeVisible({ timeout: 15_000 })

  await level.getByRole('button', { name: 'Exit' }).click()
  await expect(page.getByTestId('case-list')).toBeVisible()
})
