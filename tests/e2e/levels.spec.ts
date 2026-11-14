import { expect, test } from '@playwright/test'

// Smoke test of the featured case levels preview (src/levels/, Ivan). Run alone:
//   npx playwright test tests/e2e/levels.spec.ts
test('levels preview lists the 10 featured cases and opens one', async ({ page }) => {
  await page.goto('/levels.html')

  const select = page.getByTestId('case-select')
  await expect(select.locator('option')).toHaveCount(11) // "Pick a case…" + 10 cases
  await expect(page.getByTestId('case-list').locator('li')).toHaveCount(10)

  // Every case now has its own level (registry.ts); each level spec covers its Exit button.
  await select.selectOption('dana_valencia')
  await expect(page.getByRole('heading', { name: 'Find the flood' })).toBeVisible()

  await select.selectOption('')
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

test.describe('Doñana level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('donana')
  })

  test('starts on the full record, significant by a hair', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'On the edge' })).toBeVisible()
    await expect(page.getByTestId('range-value')).toContainText('2000 – 2026')
    await expect(page.getByTestId('window-panel-p')).toHaveText('0.0498')
    await expect(page.getByTestId('window-panel')).toContainText('Significant')
    await expect(page.getByTestId('p-meter')).toHaveAttribute('data-p', '0.0498')
  })

  test('moving the end one year flips the result and the counter shows it', async ({ page }) => {
    const end = page.getByTestId('range-end')
    await end.focus()
    await end.press('ArrowLeft') // 2000-2025
    await expect(page.getByTestId('range-value')).toContainText('2000 – 2025')
    await expect(page.getByTestId('window-panel')).toContainText('Not significant')
    await expect(page.getByTestId('p-meter')).not.toHaveAttribute('data-p', '0.0498')
    await expect(page.getByTestId('flip-counter')).toContainText('2 windows: 1 significant, 1 not significant')
    await expect(page.getByTestId('flip-counter')).toContainText('flipped 1 time.')
  })

  test('all three phases answered right score 3 and fire onResult', async ({ page }) => {
    await page.getByRole('button', { name: 'Weak' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right: weak.')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'The confidence range' })).toBeVisible()
    await expect(page.getByTestId('ci-fan')).toHaveCount(0) // revealed after the answer
    await page.getByRole('button', { name: 'Yes', exact: true }).click()
    await expect(page.getByTestId('ci-fan')).toBeVisible()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('phase2-feedback')).toContainText('it includes zero')
    await expect(page.getByTestId('phase2-feedback')).toContainText('different tools')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Rain or something else?' })).toBeVisible()
    await expect(page.getByTestId('rain-panel')).toContainText('Not significant')
    await expect(page.getByTestId('soil-panel')).toContainText('Significant')
    await page.getByRole('button', { name: 'Rain alone does not explain it' }).click()
    await expect(page.getByTestId('phase3-feedback')).toContainText('Right!')
    await page.getByRole('button', { name: 'See the summary' }).click()

    await expect(page.getByTestId('donana-score')).toHaveText('Score: 3 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult donana: correct, score 3')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByRole('button', { name: 'Strong' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'No', exact: true }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Yes, less rain' }).click()
    await expect(page.getByTestId('phase3-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('donana-score')).toHaveText('Score: 0 / 3')
    await expect(page.getByTestId('last-result')).toHaveText('onResult donana: wrong, score 0')
  })
})
