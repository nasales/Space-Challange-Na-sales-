// Aneto glacier level (src/levels/aneto/), opened from the levels preview page.
import { expect, test } from '@playwright/test'

test.describe('Aneto glacier level', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/levels.html')
    await page.getByTestId('case-select').selectOption('aneto_glacier')
  })

  test('phase 1 shows both variables with their official numbers', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Heat or rain?' })).toBeVisible()
    await expect(page.getByTestId('t2m-panel-slope')).toContainText('+0.39')
    await expect(page.getByTestId('t2m-panel')).toContainText('Significant')
    await expect(page.getByTestId('rain-panel-p')).toHaveText('0.717')
    await expect(page.getByTestId('rain-panel')).toContainText('Not significant')
  })

  test('right answers score 2 and fire onResult', async ({ page }) => {
    await page.getByRole('button', { name: 'Temperature' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Right!')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('heading', { name: 'Is Aneto the fastest?' })).toBeVisible()
    await expect(page.getByTestId('race-chart')).toHaveCount(0) // revealed after ordering
    const items = page.getByTestId('rank-list').locator('li')
    await expect(items).toHaveCount(7)
    await expect(items.last()).toContainText('Aneto glacier') // starts south to north
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Move Aneto glacier up' }).click()
    await expect(items.first()).toContainText('Aneto glacier')
    await page.getByTestId('reveal').click()

    await expect(page.getByTestId('race-chart')).toBeVisible()
    await expect(page.getByTestId('race-band')).toBeVisible()
    await expect(page.getByTestId('rank-feedback')).toContainText('Aneto at #1')
    await page.getByRole('button', { name: 'Fastest estimate, but not clearly' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Right!')
    await expect(page.getByTestId('phase2-feedback')).toContainText('overlaps 6 of the other 6 ranges')
    await page.getByRole('button', { name: 'See the summary' }).click()

    await expect(page.getByTestId('aneto-score')).toHaveText('Score: 2 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult aneto_glacier: correct, score 2')
    await page.getByRole('button', { name: 'Back to the map' }).click()
    await expect(page.getByTestId('case-list')).toBeVisible()
  })

  test('drag and drop reorders the list', async ({ page }) => {
    await page.getByRole('button', { name: 'Rain' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    const items = page.getByTestId('rank-list').locator('li')
    await page.getByTestId('rank-aneto_glacier').dragTo(items.first())
    await expect(items.first()).toContainText('Aneto glacier')
  })

  test('wrong answers score 0', async ({ page }) => {
    await page.getByRole('button', { name: 'Both' }).click()
    await expect(page.getByTestId('phase1-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByTestId('reveal').click()
    await page.getByRole('button', { name: 'Yes, clearly faster' }).click()
    await expect(page.getByTestId('phase2-feedback')).toContainText('Not quite.')
    await page.getByRole('button', { name: 'See the summary' }).click()
    await expect(page.getByTestId('aneto-score')).toHaveText('Score: 0 / 2')
    await expect(page.getByTestId('last-result')).toHaveText('onResult aneto_glacier: wrong, score 0')
  })
})
