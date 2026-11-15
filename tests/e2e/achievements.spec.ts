// Achievements: the trophy toast (dev-only ?achtest demo: one with a progress ring, one single)
// and a real one fired from the game loop (Bull hunter: walk past every roadside bull).
import { expect, test, type Page } from '@playwright/test'

type GameWindow = {
  __game?: { chase?: { introActive?: boolean }; carState?: { x: number; z: number; speed: number } }
}
type AchWindow = { __achievements?: { state: { bulls?: string[] } } }

/**
 * Headless Chromium draws the map without a GPU and its main thread is busy for seconds at a time,
 * so the slide animation cannot be timed from the test: for screenshots the toast is held still in
 * its shown state (slid in, ring filled).
 */
const HOLD_TOASTS = '.ach-toast, .ach-toast__fill { animation: none !important; }'

test('?achtest shows a ring toast, then a single toast', async ({ page }) => {
  await page.goto('/?achtest')
  await page.getByRole('button', { name: 'Play' }).click()
  const toast = page.locator('.ach-toast')
  await expect(toast).toContainText('Case closer', { timeout: 60_000 })
  await expect(toast.locator('.ach-toast__ring')).toHaveCount(1)
  // The queued single toast follows, without a ring, then the queue is empty
  await expect(toast).toContainText('Sea legs', { timeout: 60_000 })
  await expect(toast.locator('.ach-toast__ring')).toHaveCount(0)
  await expect(toast).toHaveCount(0, { timeout: 60_000 })
})

async function startGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => (window as GameWindow).__game?.chase?.introActive === true, null, { timeout: 90_000 })
  await page.keyboard.press('KeyX') // unused key: only skips the intro
  await page.waitForFunction(() => (window as GameWindow).__game?.chase?.introActive === false, null, { timeout: 90_000 })
  await expect(page.locator('.location-panel')).toBeVisible({ timeout: 30_000 })
}

test('on the map: demo toasts, and passing every roadside bull unlocks Bull hunter once', async ({ page }) => {
  test.setTimeout(480_000) // map load + six teleports; slow without a GPU
  await startGame(page)
  await page.addStyleTag({ content: HOLD_TOASTS })
  const toast = page.locator('.ach-toast')

  // Demo toasts over the map (same as ?achtest; nothing is saved)
  // (one at a time: the busy headless page may miss a queued toast's few seconds on screen)
  const demo = (only: string) => page.evaluate(async (o) => (await import('/src/shared/achievements.ts' as string)).demoToasts(o), only)
  await demo('ring')
  await expect(toast).toContainText('Case closer', { timeout: 30_000 })
  await page.screenshot({ path: 'test-results/achievement-ring.png' })
  await expect(toast).toHaveCount(0, { timeout: 30_000 })
  await demo('single')
  await expect(toast).toContainText('Sea legs', { timeout: 30_000 })
  await page.screenshot({ path: 'test-results/achievement-single.png' })
  await expect(toast).toHaveCount(0, { timeout: 30_000 })

  // Bull positions in the world, from the same modules the app uses (Vite dev server)
  const spots: { x: number; z: number }[] = await page.evaluate(async () => {
    const bulls = await import('/src/game/bulls/bullSpots.ts' as string)
    const proj = await import('/src/game/map/projection.ts' as string)
    return bulls.BULL_SPOTS.map((b: { lon: number; lat: number }) => proj.lonLatToWorld(b.lon, b.lat))
  })
  expect(spots.length).toBeGreaterThan(0)
  for (const [i, s] of spots.entries()) {
    await page.evaluate(({ x, z }) => Object.assign((window as GameWindow).__game!.carState!, { x: x + 20, z, speed: 0 }), s)
    // The HUD update reports the position; wait until this bull is counted
    await page.waitForFunction((n) => ((window as AchWindow).__achievements?.state.bulls?.length ?? 0) >= n, i + 1, { timeout: 30_000 })
    if (i < spots.length - 1) await expect(toast).toHaveCount(0) // no toast per bull
  }
  await expect(toast).toContainText('Bull hunter', { timeout: 30_000 })
  await page.screenshot({ path: 'test-results/achievement-bulls.png' })
})
