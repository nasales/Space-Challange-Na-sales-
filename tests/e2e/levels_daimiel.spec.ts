import { expect, test } from '@playwright/test'

// Tablas de Daimiel level (src/levels/daimiel/, Ivan). Numbers from daimiel_level.json
// (pipeline/level_daimiel.py): SOILM p = 0.047 (weak), PRECIP p = 0.83; 10 of 19 featured series
// significant; pure noise: 1.0 per run on average (500 runs); 7 survive 0.05 / 19 (all T2M).

test.describe('Tablas de Daimiel level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('daimiel')
  })

  test('phase 1 shows soil and rain with their official numbers', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dry wetland' })).toBeVisible()
    await expect(page.getByTestId('soil-panel-p')).toHaveText('0.047')
    await expect(page.getByTestId('soil-panel')).toContainText('Significant')
    await expect(page.getByTestId('rain-panel')).toContainText('Not significant')
    await page.getByRole('button', { name: 'Weak evidence' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right: weak evidence')
  })

  test('phase 2 asks first, then shows the chance histogram', async ({ page }) => {
    await page.getByRole('button', { name: 'Weak evidence' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: '19 tests' })).toBeVisible()
    await expect(page.getByTestId('test-grid').locator('li')).toHaveCount(19)
    await expect(page.getByTestId('chance-hist')).toHaveCount(0)
    await page.getByRole('button', { name: 'About 1', exact: true }).click()
    await expect(page.getByTestId('chance-hist')).toBeVisible()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('chance-hist-real')).toContainText('Real data: 10')
  })

  test('phase 3 reveals which results survive the stricter threshold', async ({ page }) => {
    await page.getByRole('button', { name: 'Weak evidence' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'About 1', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'A stricter bar' })).toBeVisible()
    await expect(page.getByText('does not survive')).toHaveCount(0)
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByTestId('phase3-feedback')).toContainText('7 of the 10')
    await expect(page.getByTestId('test-case_daimiel_SOILM')).toContainText('does not survive')
    await expect(page.getByTestId('test-case_aneto_glacier_T2M')).toContainText('survives')
  })

  test('all right scores 3 and fires onResult', async ({ page }) => {
    await page.getByRole('button', { name: 'Weak evidence' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'About 1', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('daimiel-score')).toHaveText('Score: 3 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult daimiel: correct, score 3')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByRole('button', { name: 'Strong evidence' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'About 10', exact: true }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('daimiel-score')).toHaveText('Score: 0 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult daimiel: wrong, score 0')
  })
})
