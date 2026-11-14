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

// PROTOTYPE variable menu (src/ui/probe/): replace this test when the magnifying glass is ready.
test('Space opens the variable menu with the data of the current point', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await startGame(page)
  await expect(page.locator('.location-panel')).toBeVisible({ timeout: 30_000 })

  await page.keyboard.press('Space')
  const menu = page.getByRole('dialog', { name: 'Investigate this place' })
  await expect(menu).toBeVisible()

  // Either the six variables of the point, or a clear message (no database in this build / sea)
  const vars = menu.locator('.point-probe__var')
  await expect(vars.first().or(menu.locator('.point-probe__msg').filter({ hasNotText: 'Gathering' }))).toBeVisible({
    timeout: 15_000,
  })

  if ((await vars.count()) > 0) {
    await expect(vars).toHaveCount(6)
    await menu.locator('.point-probe__var:not([disabled])').first().click()
    // Chart without the conclusion; the result only after asking for it
    await expect(menu.locator('.point-probe__chart path.point-probe__line')).toBeVisible()
    await expect(menu.locator('.point-probe__result')).toHaveCount(0)
    await menu.getByRole('button', { name: 'Show the statistical result' }).click()
    await expect(menu.locator('.point-probe__result')).toContainText(/p [=<]/)
    await page.screenshot({ path: 'test-results/probe-result.png' })
  }

  // While the menu is open the car does not move
  await page.keyboard.down('w')
  await page.waitForTimeout(500)
  await page.keyboard.up('w')
  await expect(page.locator('.speedometer__value')).toHaveText('0')

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
})
