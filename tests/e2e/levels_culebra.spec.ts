import { expect, test } from '@playwright/test'

// Sierra de la Culebra level (src/levels/culebra/, Ivan). Numbers from culebra_level.json
// (pipeline/level_culebra.py): pre-fire T2M p = 0.024, SOILM p = 0.020; noise 1x: 9/20, 2x: 5/20.

test.describe('Sierra de la Culebra level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('sierra_culebra')
  })

  test('phase 1 shows both clues with the fire marked; panels appear after the answer', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Two clues' })).toBeVisible()
    await expect(page.getByTestId('temp-fire')).toBeVisible()
    await expect(page.getByTestId('soil-fire')).toBeVisible()
    await expect(page.getByTestId('temp-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'Yes, both' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right:')
    await expect(page.getByTestId('phase1-feedback')).toContainText('does not prove the cause')
    await expect(page.getByTestId('temp-panel')).toContainText('Significant')
    await expect(page.getByTestId('soil-panel')).toContainText('Significant')
  })

  test('phase 2 asks first, then reveals the slider and the detection rates', async ({ page }) => {
    await page.getByRole('button', { name: 'Yes, both' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Signal vs noise' })).toBeVisible()
    await expect(page.getByTestId('noise-slider')).toHaveCount(0)
    await expect(page.getByTestId('noise-rate')).toHaveCount(0)

    await page.getByRole('button', { name: 'Only in a few runs' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('noise-rate')).toHaveText('Trend detected in 5 of 20 runs (25%)')

    const slider = page.getByTestId('noise-slider')
    await slider.focus()
    await slider.press('Home')
    await expect(page.getByTestId('noise-rate')).toHaveText('Trend detected in 20 of 20 runs (100%)')
    await expect(page.getByTestId('noise-caption')).toContainText('0.5×')
    await slider.press('End')
    await expect(page.getByTestId('noise-rate')).toHaveText('Trend detected in 4 of 20 runs (20%)')
  })

  test('both right scores 2 and fires onResult', async ({ page }) => {
    await page.getByRole('button', { name: 'Yes, both' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Only in a few runs' }).click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('culebra-score')).toHaveText('Score: 2 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult sierra_culebra: correct, score 2')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Yes, in most runs' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('culebra-score')).toHaveText('Score: 0 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult sierra_culebra: wrong, score 0')
  })
})
