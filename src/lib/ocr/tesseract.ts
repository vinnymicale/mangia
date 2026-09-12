import { createWorker } from 'tesseract.js'

/**
 * Reads text out of an image with tesseract.js.
 *
 * The worker is created and terminated per call rather than kept resident. It
 * holds tens of megabytes of WASM heap and language data, which is a poor
 * trade for a feature used a handful of times a month; the startup cost is
 * paid inside a request the user already knows is slow.
 */
export async function runOcr(image: Buffer): Promise<string> {
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(image)
    return data.text.trim()
  } finally {
    // Skipping this on the error path would leak the heap exactly when a user
    // is most likely to retry.
    await worker.terminate()
  }
}
