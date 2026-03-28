import { test, expect } from '@playwright/test'

/**
 * Camera capture E2E flow.
 *
 * These tests use browser context permissions to grant camera access and
 * mock getUserMedia so no real camera hardware is required in CI.
 */

test.describe('Camera capture flow', () => {
  test.beforeEach(async ({ context }) => {
    // Grant camera permission so the browser doesn't block getUserMedia
    await context.grantPermissions(['camera'])

    // Inject a fake getUserMedia that returns a dummy stream
    await context.addInitScript(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 480
      const stream = (canvas as HTMLCanvasElement).captureStream(10)

      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.resolve(stream),
          enumerateDevices: () => Promise.resolve([]),
        },
        writable: true,
        configurable: true,
      })
    })
  })

  test('camera preview renders after permission granted', async ({ page }) => {
    await page.goto('/')
    // Video element should become visible with srcObject set
    const video = page.locator('video')
    await expect(video).toBeVisible({ timeout: 8000 })
  })

  test('capture button is visible in IDLE state', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('video')).toBeVisible({ timeout: 8000 })
    const captureBtn = page.getByRole('button', { name: /capture/i })
    await expect(captureBtn).toBeVisible()
  })

  test('clicking capture starts countdown', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('video')).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /capture/i }).click()
    // Countdown should show a digit 3, 2, or 1
    await expect(page.locator('[data-testid="countdown"]').or(page.locator('text=/^[321]$/'))).toBeVisible({ timeout: 5000 })
  })

  test('filter swatches are visible and selectable', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('video')).toBeVisible({ timeout: 8000 })

    const swatches = page.locator('[data-testid="filter-swatch"]').or(page.getByRole('button', { name: /bw|vintage|warm|cool/i }))
    const count = await swatches.count()
    expect(count).toBeGreaterThanOrEqual(2)

    // Click BW swatch — no error should occur
    const bwSwatch = page.getByRole('button', { name: /bw/i }).first()
    if (await bwSwatch.count() > 0) {
      await bwSwatch.click()
    }
  })

  test('shows upload fallback when camera is denied', async ({ context, page }) => {
    // Override with rejecting getUserMedia
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })),
        },
        writable: true,
        configurable: true,
      })
    })

    await page.goto('/')
    // Should show camera denied message and upload zone
    await expect(page.getByText(/camera access denied/i).or(page.getByText(/upload/i))).toBeVisible({ timeout: 8000 })
  })
})
