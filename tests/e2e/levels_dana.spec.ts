import { expect, test, type Page } from '@playwright/test'

// Valencia DANA level (src/levels/dana/, Ivan). Numbers from dana_level.json (pipeline/level_dana.py):
// Oct 2024 = 3.6 mm/day (normal October 2.2), number 41 of 333 months; rain trend p = 0.672 with the
// flood, 0.743 without; T2M +0.31 °C per decade, p < 0.001, +1.5 °C over the record, about 10% more water.

/** Picks October 2024 with the keyboard: End = last month (Sep 2025), 11 months back = Oct 2024. */
async function pickFloodMonth(page: Page) {
  const slider = page.getByTestId('pick-slider')
  await slider.focus()
  await slider.press('End')
  for (let i = 0; i < 11; i++) await slider.press('ArrowLeft')
  await expect(page.getByTestId('pick-month')).toHaveText('Oct 2024')
}

test.describe('Valencia DANA level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('dana_valencia')
  })

  test('phase 1: the flood is hidden until the player picks a month', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Find the flood' })).toBeVisible()
    await expect(page.getByTestId('flood-marker')).toHaveCount(0)
    await expect(page.getByTestId('rain-line')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'This is the flood' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'No significant trend' })).toHaveCount(0)
  })

  test('clicking the chart picks a month; a far pick says how far it was', async ({ page }) => {
    await page.getByTestId('flood-chart').click({ position: { x: 60, y: 150 } })
    await expect(page.getByTestId('pick-line')).toBeVisible()
    await expect(page.getByTestId('pick-month')).toContainText('1998')
    await page.getByRole('button', { name: 'This is the flood' }).click()
    await expect(page.getByTestId('flood-marker')).toBeVisible()
    await expect(page.getByTestId('pick-feedback')).toContainText('months away')
    await expect(page.getByTestId('pick-feedback')).toContainText('number 41 of 333 months')
  })

  test('correct path: spot on, no rain trend, warming; score 3 and onResult', async ({ page }) => {
    await pickFloodMonth(page)
    await page.getByRole('button', { name: 'This is the flood' }).click()
    await expect(page.getByTestId('pick-feedback')).toContainText('Oct 2024. Spot on!')
    await expect(page.getByTestId('pick-feedback')).toContainText('averaged 3.6 mm/day')

    await page.getByRole('button', { name: 'No significant trend' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right:')
    await expect(page.getByTestId('with-panel-p')).toHaveText('0.672')
    await expect(page.getByTestId('without-panel-p')).toHaveText('0.743')
    await expect(page.getByTestId('with-panel')).toContainText('Not significant')
    await expect(page.getByTestId('rain-line')).toBeVisible()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'The warm background' })).toBeVisible()
    await expect(page.getByTestId('temp-line')).toBeVisible()
    await expect(page.getByTestId('temp-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('phase2-feedback')).toContainText('about 7% more water per °C')
    await expect(page.getByTestId('temp-panel-slope')).toHaveText('+0.31 °C per decade')
    await expect(page.getByTestId('temp-panel-p')).toHaveText('< 0.001')

    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('dana-score')).toHaveText('Score: 3 / 3')
    await expect(page.getByTestId('dana-summary')).toContainText('A record event is not a trend')
    await expect(page.getByTestId('last-result')).toHaveText('onResult dana_valencia: correct, score 3')
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByTestId('flood-chart').click({ position: { x: 60, y: 150 } })
    await page.getByRole('button', { name: 'This is the flood' }).click()
    await page.getByRole('button', { name: 'Yes, more rain' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('dana-score')).toHaveText('Score: 0 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult dana_valencia: wrong, score 0')
  })

  test('Exit goes back to the case list', async ({ page }) => {
    await pickFloodMonth(page)
    await page.getByRole('button', { name: 'This is the flood' }).click()
    await page.getByRole('button', { name: 'No significant trend' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })
})
