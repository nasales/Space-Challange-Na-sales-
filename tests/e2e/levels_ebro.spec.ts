import { expect, test, type Page } from '@playwright/test'

// Ebro Delta level (src/levels/ebro/, Ivan). Numbers from ebro_level.json (pipeline/level_ebro.py):
// T2M +0.35 °C per decade (p < 0.001), 1980-01 to 2026-09 = 4.67 decades, total +1.61 °C
// (95% range +1.21 to +2.01 °C); PRECIP not significant (p = 0.897).

async function removeSeasons(page: Page, first = 'Not sure') {
  await page.getByRole('button', { name: first, exact: true }).click()
  await page.getByRole('button', { name: 'Build the typical year' }).click()
  await page.getByRole('button', { name: 'Subtract' }).click()
}

async function setGuess(page: Page, tenths: number) {
  const slider = page.getByTestId('guess-slider')
  await slider.focus()
  for (let i = 0; i < Math.abs(tenths); i++) await slider.press(tenths > 0 ? 'ArrowRight' : 'ArrowLeft')
}

test.describe('Ebro Delta level', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('ebro_delta')
  })

  test('phase 1: predict, build the typical year, subtract, then answer', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Remove the seasons' })).toBeVisible()
    await expect(page.getByTestId('season-chart')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Build the typical year' })).toHaveCount(0)
    await expect(page.getByTestId('typical-line')).toHaveCount(0)

    await page.getByRole('button', { name: 'No', exact: true }).click()
    await page.getByRole('button', { name: 'Build the typical year' }).click()
    await expect(page.getByTestId('typical-line')).toBeVisible()
    await expect(page.getByTestId('typical-step')).toContainText('January')
    await expect(page.getByTestId('typical-step')).toContainText('August')

    await page.getByRole('button', { name: 'Subtract' }).click()
    await expect(page.getByTestId('sen-line')).toBeVisible()
    await expect(page.getByTestId('season-chart')).toHaveCount(0)

    await page.getByRole('button', { name: 'Yes, a warming trend' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Before, you said you could not see a trend.')
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right:')
    await expect(page.getByTestId('t2m-panel-slope')).toHaveText('+0.35 °C per decade')
    await expect(page.getByTestId('t2m-panel')).toContainText('Significant')
  })

  test('phase 2: the estimate is locked before the total is revealed', async ({ page }) => {
    await removeSeasons(page)
    await page.getByRole('button', { name: 'Yes, a warming trend' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('heading', { name: 'How much in total?' })).toBeVisible()
    await expect(page.getByText('January 1980 to September 2026').first()).toBeVisible()
    await expect(page.getByTestId('total-reveal')).toHaveCount(0)

    await setGuess(page, 16)
    await expect(page.getByTestId('guess-value')).toHaveText('+1.6 °C')
    await page.getByRole('button', { name: 'Lock my estimate' }).click()
    await expect(page.getByTestId('total-reveal')).toContainText('+0.35 °C per decade × 4.67 decades = +1.61 °C')
    await expect(page.getByTestId('total-reveal')).toContainText('+1.21 to +2.01 °C')
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('precip-line')).toContainText('no significant trend (p = 0.897)')
    await expect(page.getByTestId('guess-slider')).toBeDisabled()
  })

  test('both right scores 2 and fires onResult', async ({ page }) => {
    await removeSeasons(page, 'Yes')
    await page.getByRole('button', { name: 'Yes, a warming trend' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await setGuess(page, 12)
    await page.getByRole('button', { name: 'Lock my estimate' }).click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('ebro-score')).toHaveText('Score: 2 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult ebro_delta: correct, score 2')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('wrong answers score 0', async ({ page }) => {
    await removeSeasons(page)
    await page.getByRole('button', { name: 'Still no trend' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite')
    await page.getByRole('button', { name: 'Next' }).click()
    await setGuess(page, 5)
    await page.getByRole('button', { name: 'Lock my estimate' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('ebro-score')).toHaveText('Score: 0 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult ebro_delta: wrong, score 0')
  })
})
