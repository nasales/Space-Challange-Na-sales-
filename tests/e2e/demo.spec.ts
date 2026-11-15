// Demo path: main menu -> Play -> the game loads, the 3D map is drawn and the HUD appears on top.
// Extend this file as the next steps exist (stop -> variable -> chart -> conclusion -> AI check).
import { expect, test, type Page } from '@playwright/test'

/**
 * Opens the app, presses Play on the main menu and skips the intro camera (any key does it).
 * Headless Chromium renders without a GPU at ~1 frame per second, and the intro advances per frame
 * (dt capped at 0.1 s), so playing it in full takes over a minute there; with a GPU it takes ~5 s.
 */
async function startGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  type IntroWindow = { __game?: { chase?: { introActive?: boolean } } }
  await page.waitForFunction(() => (window as IntroWindow).__game?.chase?.introActive === true, null, { timeout: 60_000 })
  await page.keyboard.press('KeyX') // unused key: only skips the intro
  await page.waitForFunction(() => (window as IntroWindow).__game?.chase?.introActive === false, null, { timeout: 60_000 })
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
    // The full analysis is on the sheet from the start: verdict first, then the charts
    await expect(sheet.locator('.clue-result__verdict')).toBeVisible()
    await expect(sheet.locator('.clue-result__verdict')).toContainText(/p [=<]/)
    await expect(sheet.locator('svg.clue-result__chart path.clue-result__line').first()).toBeVisible()
    await page.screenshot({ path: 'test-results/magnifier-result.png' })
    // Esc goes back to the clues, the lens stays up
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(lens).toBeVisible()
  }

  await page.keyboard.press('Escape')
  await expect(lens).toBeHidden({ timeout: 5_000 })
  // Esc closed the lens only: it must not also open the pause panel
  await expect(page.locator('.pause-menu')).toHaveCount(0)
  expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
})

// Pause panel (src/ui/pause/): Esc -> pause (driving ignored) -> Esc resumes -> Esc -> Main menu -> Play again.
test('Esc pauses the game and Main menu goes back to the menu', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))

  await startGame(page)
  await expect(page.locator('.speedometer')).toBeVisible({ timeout: 30_000 })

  const pause = page.getByRole('dialog', { name: 'Paused' })
  await page.keyboard.press('Escape')
  await expect(pause).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeFocused()
  await page.screenshot({ path: 'test-results/pause-open.png' })

  // While paused the detective does not move
  await page.keyboard.down('w')
  await page.waitForTimeout(500)
  await page.keyboard.up('w')
  await expect(page.locator('.speedometer__value')).toHaveText('0')

  // Esc again resumes
  await page.keyboard.press('Escape')
  await expect(pause).toBeHidden()

  // Arrow keys move between the buttons; Enter on "Main menu" leaves the game
  await page.keyboard.press('Escape')
  await expect(pause).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('button', { name: 'Main menu' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible()
  await expect(page.locator('.game-view__canvas')).toHaveCount(0)

  // Play again builds a fresh map (and plays the intro again, skipped as in startGame)
  await startGame(page)
  await expect(page.locator('.game-view__canvas canvas')).toHaveCount(1, { timeout: 30_000 })
  await expect(page.locator('.speedometer')).toBeVisible({ timeout: 30_000 })
  expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
})

// Sound settings (src/ui/settings/SoundSliders.tsx): two sliders in the menu, saved in this browser.
test('the menu has music and sound effects sliders that are remembered', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  await page.goto('/?music=off')
  const music = page.getByRole('slider', { name: 'Music volume' })
  const effects = page.getByRole('slider', { name: 'Sound effects volume' })
  await expect(music).toBeVisible()
  await expect(effects).toBeVisible()

  await effects.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(effects).toHaveValue('65')
  await music.focus()
  await page.keyboard.press('Home')
  await expect(music).toHaveValue('0')

  await page.reload()
  await expect(page.getByRole('slider', { name: 'Music volume' })).toHaveValue('0')
  await expect(page.getByRole('slider', { name: 'Sound effects volume' })).toHaveValue('65')
  expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([])
})
