import { describe, it, expect, vi, beforeEach } from 'vitest'

const createWorker = vi.hoisted(() => vi.fn())
vi.mock('tesseract.js', () => ({ createWorker }))

import { runOcr } from './tesseract'

function workerReturning(text: string) {
  const worker = {
    recognize: vi.fn().mockResolvedValue({ data: { text } }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }
  createWorker.mockResolvedValue(worker)
  return worker
}

beforeEach(() => vi.clearAllMocks())

describe('runOcr', () => {
  it('returns the recognised text', async () => {
    workerReturning('  Nonna Pasta\n2 cups flour\n')
    expect(await runOcr(Buffer.from('image'))).toBe('Nonna Pasta\n2 cups flour')
  })

  it('terminates the worker so the WASM heap is released', async () => {
    const worker = workerReturning('text')
    await runOcr(Buffer.from('image'))
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('terminates the worker even when recognition throws', async () => {
    const worker = workerReturning('unused')
    worker.recognize.mockRejectedValue(new Error('corrupt image'))

    await expect(runOcr(Buffer.from('bad'))).rejects.toThrow('corrupt image')
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
