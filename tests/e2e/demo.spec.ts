// Demo path: main menu -> Play -> the game loads, the 3D map is drawn and the HUD appears on top.
// Extend this file as the next steps exist (stop -> variable -> chart -> conclusion -> AI check).
import { expect, test, type Page } from '@playwright/test'

/** Opens the app and presses Play on the main menu. */
async function startGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
}

test('main menu shows the Play button and the animated detective', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await expect(page.locator('.detective-showcase canvas')).toBeVisible()
  // The map is not loaded until Play is pressed
  await expect(page.locator('.game-view__canvas')).toHaveCount(0)

  await page.waitForTimeout(3600) // mid-jump of the hero loop
  await page.screenshot({ path: 'test-results/menu-jump.png' })
  await page.waitForTimeout(1800) // hero pose
  await page.screenshot({ path: 'test-results/menu-pose.png' })
  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([])
})

test('game loads with the map and the HUD', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await startGame(page)

  // The 3D canvas is created and the loading message goes away
  await expect(page.locator('.game-view__canvas canvas')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Drawing the map…')).toBeHidden({ timeout: 30_000 })
  await expect(page.locator('.hud__status')).toHaveCount(0)

  // HUD: controls hint, location panel and speedometer
  await expect(page.locator('.controls-hint')).toBeVisible()
  await expect(page.locator('.location-panel')).toBeVisible()
  await expect(page.locator('.speedometer')).toBeVisible()

  await page.screenshot({ path: 'test-results/demo-loaded.png' })
  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([])
})

test('the detective moves and the speedometer reacts', async ({ page }) => {
  await startGame(page)
  await expect(page.locator('.speedometer')).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('.speedometer__value')).toHaveText('0')

  // The game listens to the keyboard on window, so no click is needed
  // (the HUD layers cover the canvas and would block a click anyway)
  await page.keyboard.down('w')
  await expect(page.locator('.speedometer__value')).not.toHaveText('0', { timeout: 5_000 })
  await page.keyboard.up('w')

  await page.screenshot({ path: 'test-results/demo-moving.png' })
})

// Magnifier variable picker (src/ui/magnifier/): stopped -> Space -> lens with six clues -> Esc.
test('Space while stopped opens the magnifier with the six variables', async ({ page }) => {
  test.setTimeout(180_000) // map build + camera flight are slow when the level tests run in parallel
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await startGame(page)
  await expect(page.locator('.location-panel')).toBeVisible({ timeout: 30_000 })

  // The detective takes the magnifier out after standing still for a moment; Space only works then
  // (retry Space until the picker starts; then wait for the camera flight, slow in a headless browser)
  await expect(async () => {
    await page.keyboard.press('Space')
    await expect(page.locator('.variable-picker')).toBeAttached({ timeout: 1_500 })
  }).toPass({ timeout: 60_000 })
  const lens = page.locator('.variable-picker__lens[role="dialog"]')
  await expect(lens).toBeVisible({ timeout: 30_000 })

  await expect(lens.locator('button.clue')).toHaveCount(6)
  await page.waitForTimeout(800) // camera flight and clue animation
  await page.screenshot({ path: 'test-results/magnifier-open.png' })

  // While the lens is up the car does not move
  await page.keyboard.down('w')
  await page.waitForTimeout(500)
  await page.keyboard.up('w')
  await expect(page.locator('.speedometer__value')).toHaveText('0')

  // The clues load the data of this point. Without a database in this build they stay inactive.
  await expect(lens.locator('.clue-ring__footer')).not.toContainText('Reading the evidence', { timeout: 20_000 })
  const live = lens.locator('button.clue--live')
  if ((await live.count()) > 0) {
    await live.first().click()
    const sheet = page.locator('.clue-result')
    await expect(sheet.locator('svg.clue-result__chart path.clue-result__line')).toBeVisible()
    // The chart comes first; the statistical result only when the player asks for it
    await expect(sheet.locator('.clue-result__verdict')).toHaveCount(0)
    await sheet.getByRole('button', { name: /show the result/ }).click()
    await expect(sheet.locator('.clue-result__verdict')).toContainText(/p [=<]/)
    await page.screenshot({ path: 'test-results/magnifier-result.png' })
    // Esc goes back to the clues, the lens stays up
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(lens).toBeVisible()
  }

  await page.keyboard.press('Escape')
  await expect(lens).toBeHidden({ timeout: 5_000 })
  expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
})
