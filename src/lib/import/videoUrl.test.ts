import { describe, it, expect } from 'vitest'
import { classifyUrl } from './videoUrl'

describe('classifyUrl', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('reads a youtube id out of %s', (url, id) => {
    expect(classifyUrl(url)).toEqual({ kind: 'video', platform: 'youtube', id })
  })

  it.each([
    ['https://www.instagram.com/p/CxYzAbCdEfG/', 'CxYzAbCdEfG'],
    ['https://www.instagram.com/reel/CxYzAbCdEfG/', 'CxYzAbCdEfG'],
    ['https://instagram.com/reels/CxYzAbCdEfG', 'CxYzAbCdEfG'],
    ['https://www.instagram.com/tv/CxYzAbCdEfG/', 'CxYzAbCdEfG'],
  ])('reads an instagram id out of %s', (url, id) => {
    expect(classifyUrl(url)).toEqual({ kind: 'video', platform: 'instagram', id })
  })

  it.each([
    ['https://www.tiktok.com/@chef/video/7212345678901234567', '7212345678901234567'],
    ['https://tiktok.com/@chef.name/video/7212345678901234567?is_copy_url=1', '7212345678901234567'],
  ])('reads a tiktok id out of %s', (url, id) => {
    expect(classifyUrl(url)).toEqual({ kind: 'video', platform: 'tiktok', id })
  })

  it('treats a tiktok short link as tiktok even though the id is opaque', () => {
    expect(classifyUrl('https://vm.tiktok.com/ZMabcdef/')).toEqual({
      kind: 'video',
      platform: 'tiktok',
      id: 'ZMabcdef',
    })
  })

  // The article path is the default, so a misclassification here would break
  // importing from ordinary recipe sites -- the feature that already works.
  it.each([
    'https://www.seriouseats.com/perfect-pan-pizza',
    'https://cooking.nytimes.com/recipes/1234-carbonara',
    // A recipe site that merely mentions video in its path.
    'https://example.com/video-recipes/lasagna',
    // YouTube, but not a video: a channel page carries no recipe.
    'https://www.youtube.com/@somechannel',
    // Instagram, but a profile rather than a post.
    'https://www.instagram.com/somechef/',
  ])('treats %s as an article', (url) => {
    expect(classifyUrl(url)).toEqual({ kind: 'article' })
  })

  it('treats a malformed url as an article so the existing path reports it', () => {
    expect(classifyUrl('not a url')).toEqual({ kind: 'article' })
  })

  it('ignores case in the host', () => {
    expect(classifyUrl('https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'video',
      platform: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('does not match a lookalike host', () => {
    expect(classifyUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'article',
    })
    expect(classifyUrl('https://youtube.com.evil.test/watch?v=abc')).toEqual({
      kind: 'article',
    })
  })
})
