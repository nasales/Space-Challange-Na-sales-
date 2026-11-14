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

test.describe('Filomena level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('filomena_madrid')
  })

  test('loads with the 2018-2021 window, which is too short', async ({ page }) => {
    const level = page.getByTestId('filomena-level')
    await expect(level.getByRole('heading', { name: 'The zoom trap' })).toBeVisible()
    await expect(page.getByTestId('range-value')).toContainText('2018 – 2021')
    await expect(page.getByTestId('window-panel')).toContainText('Too short: we need at least 10 years')
  })

  test('the year slider changes the official numbers', async ({ page }) => {
    const start = page.getByTestId('range-start')
    await start.focus()
    await start.press('Home') // start year -> 1980
    await expect(page.getByTestId('range-value')).toContainText('1980 – 2021')
    const slope = page.getByTestId('window-panel-slope')
    await expect(slope).toContainText('°C per decade')
    const first = await slope.textContent()

    const end = page.getByTestId('range-end')
    await end.focus()
    await end.press('End') // end year -> 2026
    await expect(page.getByTestId('range-value')).toContainText('1980 – 2026')
    await expect(slope).toHaveText('+0.37 °C per decade')
    expect(first).not.toBe('+0.37 °C per decade')
  })

  test('too-short window: claiming cooling is wrong (cherry-picking feedback)', async ({ page }) => {
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await expect(page.getByTestId('phase1-feedback')).toContainText('cherry-picking')
  })

  test("Can't tell on a non-significant window is right and offers the full record", async ({ page }) => {
    const start = page.getByTestId('range-start')
    await start.focus()
    for (let i = 0; i < 8; i++) await start.press('ArrowLeft') // 2010-2021: positive but p = 0.143
    await expect(page.getByTestId('range-value')).toContainText('2010 – 2021')
    await expect(page.getByTestId('window-panel')).toContainText('Not significant')

    await page.getByRole('button', { name: "Can't tell" }).click()
    const feedback = page.getByTestId('phase1-feedback')
    await expect(feedback).toContainText('Right: this window alone is not enough evidence. Try the full record.')
    await expect(feedback).not.toContainText('Not quite.')
    await feedback.getByRole('button', { name: 'Show 1980-2026' }).click()
    await expect(page.getByTestId('range-value')).toContainText('1980 – 2026')
    await expect(page.getByTestId('window-panel-slope')).toHaveText('+0.37 °C per decade')
  })

  test('"Yes" on a non-significant window is wrong and scores 1 of 2', async ({ page }) => {
    const start = page.getByTestId('range-start')
    await start.focus()
    for (let i = 0; i < 8; i++) await start.press('ArrowLeft') // 2010-2021
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    const feedback = page.getByTestId('phase1-feedback')
    await expect(feedback).toContainText('Not quite.')
    await expect(feedback).toContainText('positive, but the p-value is 0.143 (not below 0.05)')

    await feedback.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Barely change' }).click()
    await page.getByTestId('filomena-toggle').click()
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('filomena-score')).toHaveText('Score: 1 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult filomena_madrid: wrong, score 1')
  })

  test('a wrong answer gets a half-point second try on the full record', async ({ page }) => {
    await page.getByRole('button', { name: 'Yes', exact: true }).click() // 2018-2021 is too short: wrong
    const feedback = page.getByTestId('phase1-feedback')
    await expect(feedback).toContainText('Not quite.')
    await feedback.getByRole('button', { name: 'Show 1980-2026' }).click()
    await expect(page.getByTestId('range-value')).toContainText('1980 – 2026')
    await expect(page.getByTestId('retry-prompt')).toBeVisible()

    await page.getByRole('button', { name: 'Yes', exact: true }).click() // second try: right
    await expect(page.getByTestId('retry-feedback')).toContainText('Now with 47 years the evidence is clear.')
    await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeDisabled()

    await feedback.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Barely change' }).click()
    const marker = page.getByTestId('filomena-marker')
    await expect(marker).toContainText('Jan 2021')
    await page.getByTestId('filomena-toggle').click()
    await expect(marker).toHaveAttribute('data-removed', 'true')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('filomena-score')).toHaveText('Score: 1.5 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult filomena_madrid: wrong, score 1.5')
  })

  test('phase 2 toggle moves the line and onResult fires at the end', async ({ page }) => {
    const start = page.getByTestId('range-start')
    await start.focus()
    await start.press('Home')
    await page.getByRole('button', { name: 'Yes', exact: true }).click() // 1980-2021: significant increase
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right: in these years the warming is statistically significant')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Does Filomena break the trend?' })).toBeVisible()
    await page.getByRole('button', { name: 'Barely change' }).click()
    const line = page.getByTestId('sen-line')
    const before = await line.getAttribute('data-slope')
    await page.getByTestId('filomena-toggle').click()
    await expect(line).not.toHaveAttribute('data-slope', before!)
    await expect(page.getByTestId('with-panel')).toContainText('+0.37')
    await expect(page.getByTestId('without-panel')).toContainText('+0.38')
    await expect(page.getByTestId('phase2-feedback')).toContainText('medians')

    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('filomena-score')).toHaveText('Score: 2 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult filomena_madrid: correct, score 2')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })
})
