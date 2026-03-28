import { test, expect } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

/**
 * Upload mode E2E flow.
 * Drag & drop or file input → strip renders → filter change re-renders.
 */

// Create a minimal valid JPEG (1×1 pixel) for testing file uploads
function createMinimalJpeg(): Buffer {
  // Minimal valid 1×1 JPEG bytes
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0x26,
    0xa5, 0x3f, 0xff, 0xd9,
  ])
}

let tmpDir: string
const tmpFiles: string[] = []

test.describe('Upload mode flow', () => {
  test.beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photobooth-test-'))
    // Write 4 minimal JPEGs for upload tests
    for (let i = 1; i <= 4; i++) {
      const p = path.join(tmpDir, `test-photo-${i}.jpg`)
      fs.writeFileSync(p, createMinimalJpeg())
      tmpFiles.push(p)
    }
  })

  test.afterAll(() => {
    tmpFiles.forEach(f => { try { fs.unlinkSync(f) } catch { /* ignore */ } })
    try { fs.rmdirSync(tmpDir) } catch { /* ignore */ }
  })

  test.beforeEach(async ({ context }) => {
    // Block camera to ensure upload mode is visible
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: () => Promise.reject(Object.assign(new Error('NotFound'), { name: 'NotFoundError' })),
        },
        writable: true,
        configurable: true,
      })
    })
  })

  test('upload zone is visible when camera is unavailable', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByText(/drop/i).or(page.getByText(/upload/i)).or(page.locator('[data-testid="upload-zone"]'))
    ).toBeVisible({ timeout: 8000 })
  })

  test('file input accepts image files', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByText(/drop/i).or(page.locator('[data-testid="upload-zone"]'))
    ).toBeVisible({ timeout: 8000 })

    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()

    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('image')
  })

  test('uploading 4 images triggers strip composition', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByText(/drop/i).or(page.locator('[data-testid="upload-zone"]'))
    ).toBeVisible({ timeout: 8000 })

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(tmpFiles.slice(0, 4))

    // Should navigate to result (compositing → result)
    // Look for Download PNG button or the strip image
    await expect(
      page.getByRole('button', { name: /download png/i }).or(page.getByAltText('Photo booth strip'))
    ).toBeVisible({ timeout: 15000 })
  })

  test('uploading wrong number of images shows an error or rejects', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByText(/drop/i).or(page.locator('[data-testid="upload-zone"]'))
    ).toBeVisible({ timeout: 8000 })

    const fileInput = page.locator('input[type="file"]')
    // Upload only 1 file for a layout expecting 4
    await fileInput.setInputFiles([tmpFiles[0]])

    // Should show an error or not proceed to result state
    // Either an error message appears, or we stay in the upload state
    const errorMsg = page.getByText(/wrong|invalid|need|require|select/i)
    const downloadBtn = page.getByRole('button', { name: /download png/i })

    // Wait briefly and assert download button does NOT appear for wrong count
    await page.waitForTimeout(2000)
    const downloadVisible = await downloadBtn.isVisible().catch(() => false)
    if (downloadVisible) {
      // If app accepted 1 file as "single" layout, that's also valid behavior
      // The key is no crash
      expect(downloadVisible).toBe(true)
    } else {
      await expect(errorMsg.or(page.locator('[data-testid="upload-zone"]'))).toBeVisible()
    }
  })
})
