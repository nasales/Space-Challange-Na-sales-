import { expect, test } from '@playwright/test'

// Córdoba heat level (src/levels/cordoba/, Ivan). Run alone:
//   npx playwright test tests/e2e/levels_cordoba.spec.ts
// Numbers from src/levels/cordoba/cordoba_level.json (pipeline/level_cordoba.py).
test.describe('Córdoba heat level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('cordoba_heat')
  })

  test('records appear only after the prediction, and the 2000s are wrong', async ({ page }) => {
    const level = page.getByTestId('cordoba-level')
    await expect(level.getByRole('heading', { name: 'Record hunters' })).toBeVisible()
    await expect(page.getByTestId('record-chart')).toHaveAttribute('data-records', 'false')
    await expect(page.getByTestId('record-dots')).toHaveCount(0)
    await expect(page.getByTestId('bars-observed')).toHaveCount(0)
    await expect(level).toContainText('The 2020s are a partial decade: data run only to September 2026.')

    await page.getByRole('button', { name: '2000s', exact: true }).click()
    await expect(page.getByTestId('record-chart')).toHaveAttribute('data-records', 'true')
    await expect(page.getByTestId('record-dots').locator('circle')).toHaveCount(41)
    await expect(page.getByTestId('record-count')).toHaveText(
      'On the chart: 28 record warm months (red) and 13 record cold months (blue).',
    )
    await expect(page.getByTestId('bars-observed-warm-3')).toHaveAttribute('data-value', '8')
    await expect(page.getByTestId('bars-observed-cold-0')).toHaveAttribute('data-value', '11')
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await expect(page.getByTestId('phase1-feedback')).toContainText(
      'The 2020s: 8 warm and 0 cold records, the highest share of warm records.',
    )
    await expect(page.getByTestId('phase1-feedback')).toContainText(
      'Share of warm records: 1990s 8 of 19, 2000s 4 of 5, 2010s 8 of 9, 2020s 8 of 8.',
    )
    await expect(page.getByTestId('phase1-feedback')).toContainText('And the 2020s are not even complete.')
  })

  test('full run scores 2 / 2', async ({ page }) => {
    await page.getByRole('button', { name: '2020s*' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right!')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Without a trend?' })).toBeVisible()
    await expect(page.getByTestId('bars-compared')).toHaveCount(0)
    await page.getByRole('button', { name: 'Yes, more than chance' }).click()
    await expect(page.getByTestId('bars-compared-warm-exp-3')).toHaveAttribute('data-value', '1.866')
    await expect(page.getByTestId('chance-line')).toHaveText(
      'In 2000 trend-free runs there were 18.1 warm records on average, and more than 26 in only 5% of runs. Córdoba has 28.',
    )
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await page.getByRole('button', { name: 'See the summary' }).click()

    await expect(page.getByTestId('cordoba-score')).toHaveText('Score: 2 / 2')
    await expect(page.getByTestId('cordoba-summary')).toContainText('warm records outnumber cold records')
    await expect(page.getByTestId('last-result')).toHaveText('onResult cordoba_heat: correct, score 2')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('saying chance explains the records is wrong', async ({ page }) => {
    await page.getByRole('button', { name: '2020s*' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'No, chance explains them' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('last-result')).toHaveText('onResult cordoba_heat: wrong, score 1')
  })
})
