import { expect, test } from '@playwright/test'

// Almería-Murcia level (src/levels/almeria/, Ivan). Run alone:
//   npx playwright test tests/e2e/levels_almeria.spec.ts
test.describe('Almería-Murcia level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('almeria_murcia')
  })

  test('phase 1: Yes is wrong, and the official numbers appear after the answer', async ({ page }) => {
    const level = page.getByTestId('almeria-level')
    await expect(level.getByRole('heading', { name: 'Negative but not proven' })).toBeVisible()
    await expect(page.getByTestId('soil-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await expect(page.getByTestId('soil-panel-slope')).toHaveText('−0.36 kg/m² (0-10 cm) per decade')
    await expect(page.getByTestId('soil-panel-ci')).toHaveText('−0.93 to +0.19')
    await expect(page.getByTestId('soil-panel-p')).toHaveText('0.15')
    await expect(page.getByTestId('ci-fan')).toBeVisible()
  })

  test('shuffles are added only after answering, and the full run scores 3 / 3', async ({ page }) => {
    await page.getByRole('button', { name: "We can't claim it" }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right.')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Shuffle the years' })).toBeVisible()
    const hist = page.getByTestId('soil-round-hist')
    await expect(hist).toHaveAttribute('data-shown', '0')
    await expect(page.getByTestId('soil-round-one')).toHaveCount(0)

    await page.getByRole('button', { name: 'No, it will hide in the cloud' }).click()
    await page.getByTestId('soil-round-one').click()
    await expect(hist).toHaveAttribute('data-shown', '1')
    await expect(hist.locator('circle')).toHaveCount(1)
    for (let i = 0; i < 10; i++) await page.getByTestId('soil-round-many').click()
    await expect(hist).toHaveAttribute('data-shown', '200')
    await expect(page.getByTestId('soil-round-counter')).toContainText('200 of 200 shuffles: 47 (gold dots)')
    await expect(page.getByTestId('soil-round-feedback')).toContainText('Right!')
    await expect(page.getByTestId('soil-round-feedback')).toContainText('47 of 200 shuffles (24%)')
    await page.getByRole('button', { name: 'Next round: precipitation' }).click()

    await page.getByRole('button', { name: 'No, it will hide in the cloud' }).click()
    await page.getByTestId('rain-round-all').click()
    await expect(page.getByTestId('rain-round-hist')).toHaveAttribute('data-shown', '200')
    await expect(page.getByTestId('rain-round-feedback')).toContainText('61 of 200 shuffles (31%)')
    await page.getByRole('button', { name: 'See the summary' }).click()

    await expect(page.getByTestId('almeria-score')).toHaveText('Score: 3 / 3')
    await expect(page.getByTestId('almeria-summary')).toContainText('Absence of evidence is not evidence of absence')
    await expect(page.getByTestId('last-result')).toHaveText('onResult almeria_murcia: correct, score 3')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('predicting that the real slope stands out is wrong', async ({ page }) => {
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Yes, it will stand out' }).click()
    for (let i = 0; i < 10; i++) await page.getByTestId('soil-round-many').click()
    await expect(page.getByTestId('soil-round-feedback')).toContainText('Not quite.')
    await expect(page.getByTestId('soil-round-feedback')).toContainText('hides inside the cloud of chance')
  })
})
