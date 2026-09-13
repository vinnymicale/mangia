/**
 * Renders the recipe card the photo-import e2e spec uploads.
 *
 * Checked in as a PNG rather than generated during the run: the spec is slow
 * enough already with a real OCR engine in it, and a fixture that is rebuilt
 * every time is a fixture whose failures are ambiguous -- a red spec should
 * mean the import broke, not that the renderer drifted.
 *
 * Rendered through Playwright's Chromium because it is already a dependency
 * and produces real anti-aliased type. Handwriting is what this feature is for,
 * but tesseract reads it too poorly to assert on, so the card is printed: the
 * spec proves the pipeline, not the engine's accuracy.
 *
 * Run: node scripts/make-ocr-fixture.mjs
 */
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures', 'recipe-card.png')

const CARD = `
<body style="margin:0;width:900px;background:#fdfbf5;font-family:Georgia,serif;color:#1a1a1a">
  <div style="padding:64px 72px;font-size:30px;line-height:1.7">
    <div style="font-size:44px;font-weight:bold;margin-bottom:28px">Lemon Butter Beans</div>
    <div style="margin-bottom:8px">Serves 4</div>
    <div style="margin-bottom:28px">Prep 10 minutes Cook 25 minutes</div>
    <div style="font-weight:bold;margin-bottom:10px">Ingredients</div>
    <div>2 cups white beans</div>
    <div>3 tablespoons butter</div>
    <div>1 lemon</div>
    <div>4 cloves garlic</div>
    <div style="margin-bottom:28px">1 teaspoon salt</div>
    <div style="font-weight:bold;margin-bottom:10px">Instructions</div>
    <div>Melt the butter in a wide pan.</div>
    <div>Add the garlic and cook until fragrant.</div>
    <div>Stir in the beans and the juice of the lemon.</div>
    <div>Simmer for twenty minutes and season.</div>
  </div>
</body>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
await page.setContent(CARD)
await page.locator('div').first().screenshot({ path: OUT })
await browser.close()
console.log(`wrote ${OUT}`)
