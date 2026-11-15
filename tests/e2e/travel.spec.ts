// Fast travel: M opens the travel map, Esc closes it, and a landmark click flies the detective there.
import { expect, test, type Page } from '@playwright/test'

type TravelWindow = {
  __game?: {
    chase?: { introActive?: boolean }
    carState?: { x: number; z: number; speed: number }
    landmarks?: { positionOf: (id: string) => { x: number; z: number } | null }
  }
  __travel?: { plane: { active: boolean } }
}

/** Same start as demo.spec.ts: Play, then skip the intro camera (headless renders without a GPU). */
async function startGame(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await page.waitForFunction(() => (window as TravelWindow).__game?.chase?.introActive === true, null, { timeout: 90_000 })
  await page.keyboard.press('KeyX') // unused key: only skips the intro
  await page.waitForFunction(() => (window as TravelWindow).__game?.chase?.introActive === false, null, { timeout: 90_000 })
  await expect(page.locator('.location-panel')).toBeVisible({ timeout: 30_000 })
}

test('M opens the travel map, Esc closes it, a landmark flies the detective there', async ({ page }) => {
  // Headless Chromium without a GPU draws about one frame per second and the flight advances per
  // frame (dt capped at 0.1 s), so the ~5 s trip takes about a minute here
  test.setTimeout(360_000)
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await startGame(page)
  const map = page.getByRole('dialog', { name: 'Where to, detective?' })

  // M opens, Esc closes (and does not open the pause panel)
  await page.keyboard.press('KeyM')
  await expect(map).toBeVisible()
  await expect(page.getByRole('button', { name: /^Fly to / }).first()).toBeVisible({ timeout: 30_000 })
  await page.keyboard.press('Escape')
  await expect(map).toBeHidden()
  await expect(page.locator('.pause-menu')).toHaveCount(0)

  // M again, pick the Sagrada Familia: the map closes and the plane trip starts
  await page.keyboard.press('KeyM')
  await expect(map).toBeVisible()
  await page.getByRole('button', { name: 'Fly to Sagrada Familia, Barcelona' }).click()
  await expect(map).toBeHidden()
  await page.waitForFunction(() => (window as TravelWindow).__travel?.plane.active === true, null, { timeout: 30_000 })
  await page.waitForFunction(() => (window as TravelWindow).__travel?.plane.active === false, null, { timeout: 240_000, polling: 500 })

  // He stands on the plaza, close to the monument
  const arrival = await page.evaluate(() => {
    const g = (window as TravelWindow).__game!
    const target = g.landmarks!.positionOf('sagrada-familia')!
    return { distance: Math.hypot(g.carState!.x - target.x, g.carState!.z - target.z), speed: g.carState!.speed }
  })
  expect(arrival.distance).toBeLessThan(200)
  // Physics runs again after the landing: at most a tiny slope drift, no running
  expect(Math.abs(arrival.speed)).toBeLessThan(1)
  await expect(page.locator('.location-panel')).toContainText('Sagrada Familia', { timeout: 30_000 })
  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([])
})
