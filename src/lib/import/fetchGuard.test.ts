import { describe, it, expect } from 'vitest'
import { isPrivateAddress, assertWebUrl } from './fetchGuard'

describe('isPrivateAddress', () => {
  it('flags loopback, LAN, and metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '192.168.1.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '192.169.0.1', '2606:4700::1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
})

describe('assertWebUrl', () => {
  it('accepts http and https', () => {
    expect(assertWebUrl('https://example.com/a').hostname).toBe('example.com')
    expect(assertWebUrl('http://example.com/a').hostname).toBe('example.com')
  })

  // file: and data: would otherwise read the container's own disk.
  it('refuses any other scheme', () => {
    for (const url of ['file:///etc/passwd', 'data:text/html,hi', 'ftp://example.com/x']) {
      expect(() => assertWebUrl(url), url).toThrow(/http and https/)
    }
  })

  it('refuses a string that is not a url', () => {
    expect(() => assertWebUrl('not a url')).toThrow(/not a valid URL/i)
  })
})
