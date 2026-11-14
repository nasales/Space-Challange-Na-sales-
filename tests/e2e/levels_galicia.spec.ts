import { expect, test } from '@playwright/test'

// Galicia fires level (src/levels/galicia/, Ivan). Numbers from galicia_level.json
// (pipeline/level_galicia.py): SOILM Galicia -0.44 kg/m²/decade p = 0.112 (not significant),
// Culebra -0.53 p = 0.026; noise 1.98 vs 2.06; 319 vs 319 months -> answer "smaller slope";
// T2M Galicia +0.26 °C/decade, p < 0.001.

test.describe('Galicia fires level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('galicia_fires')
  })

  test('phase 1 shows both soil charts without numbers; panels appear after the answer', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Twin forests' })).toBeVisible()
    await expect(page.getByTestId('galicia-line')).toBeVisible()
    await expect(page.getByTestId('culebra-line')).toBeVisible()
    await expect(page.getByTestId('galicia-panel')).toHaveCount(0)
    await expect(page.getByTestId('culebra-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'Culebra', exact: true }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right!')
    await expect(page.getByTestId('phase1-feedback')).toContainText('p = 0.112')
    await expect(page.getByTestId('phase1-feedback')).toContainText('p = 0.026')
    await expect(page.getByTestId('galicia-panel')).toContainText('Not significant')
    await expect(page.getByTestId('culebra-panel-p')).toHaveText('0.026')
  })

  test('phase 2 compares slope, noise and months and explains with the numbers', async ({ page }) => {
    await page.getByRole('button', { name: 'Culebra', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'Why the difference?' })).toBeVisible()
    await expect(page.getByTestId('row-slope')).toContainText('−0.44')
    await expect(page.getByTestId('row-noise')).toContainText('1.98')
    await expect(page.getByTestId('row-data')).toContainText('319')
    await page.getByRole('button', { name: 'A smaller slope' }).click()
    const fb = page.getByTestId('phase2-feedback')
    await expect(fb).toContainText('Right!')
    await expect(fb).toContainText('17% smaller than')
    await expect(fb).toContainText('not how big the change is')
  })

  test('all right scores 3, fires onResult and exits', async ({ page }) => {
    await page.getByRole('button', { name: 'Culebra', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'A smaller slope' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'The other clue' })).toBeVisible()
    await expect(page.getByTestId('temp-panel')).toHaveCount(0)
    await page.getByRole('button', { name: 'Yes, significantly' }).click()
    await expect(page.getByTestId('phase3-feedback')).toContainText('+0.26')
    await expect(page.getByTestId('temp-panel')).toContainText('Significant')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('galicia-score')).toHaveText('Score: 3 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult galicia_fires: correct, score 3')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByRole('button', { name: 'Both', exact: true }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'More year-to-year noise' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'No warming' }).click()
    await expect(page.getByTestId('phase3-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('galicia-score')).toHaveText('Score: 0 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult galicia_fires: wrong, score 0')
  })
})
