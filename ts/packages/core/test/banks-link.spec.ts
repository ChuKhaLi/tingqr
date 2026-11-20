import { TingQrError } from '../src/index.js'
import { BANK_APPS, bankAppLink } from '../src/banks.js'
import { linkFor } from '../src/banks/link.js'

function thrown(f: () => unknown): TingQrError {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(TingQrError)
    return e as TingQrError
  }
  throw new Error('expected a throw')
}

test('without fallbackUrl the Android link has no browser fallback', () => {
  expect(bankAppLink('tcb', 'android')).not.toContain('S.browser_fallback_url')
  expect(bankAppLink('tcb', 'android', {})).toBe(bankAppLink('tcb', 'android'))
})

test('iOS ignores fallbackUrl', () => {
  expect(bankAppLink('mb', 'ios', { fallbackUrl: 'https://example.com/x' })).toBe('mbbank://')
})

test('a local http fallback is accepted', () => {
  expect(bankAppLink('mb', 'android', { fallbackUrl: 'http://localhost:4200/x' })).toBe(
    'intent://#Intent;scheme=mbbank;package=com.mbmobile;S.browser_fallback_url=http%3A%2F%2Flocalhost%3A4200%2Fx;end',
  )
})

test('accented characters and spaces in fallbackUrl are percent-encoded', () => {
  const link = bankAppLink('mb', 'android', { fallbackUrl: 'https://ví-dụ.vn/a b?c=đ' })
  expect(link).toMatch(/;end$/)
  expect(link).not.toMatch(/[\s\u0080-￿]/)
  const value = /S\.browser_fallback_url=([^;]*);end$/.exec(link)![1]!
  expect(decodeURIComponent(value)).toBe('https://ví-dụ.vn/a b?c=đ')
})

test.each(['data:text/html,x', 'intent://x#Intent;end', 'javascript:alert(1)', 'ftp://example.com/', '/relative', ''])(
  'fallbackUrl %j throws INVALID_VALUE naming the field',
  (fallbackUrl) => {
    const e = thrown(() => bankAppLink('mb', 'android', { fallbackUrl }))
    expect(e.code).toBe('INVALID_VALUE')
    expect(e.message).toContain('fallbackUrl')
  },
)

test('a fallbackUrl that is not a URL says it must be absolute', () => {
  expect(thrown(() => bankAppLink('mb', 'android', { fallbackUrl: 'not a url' })).message).toContain('absolute')
})

test('an app without an iOS scheme throws on ios', () => {
  const androidOnly = { id: 'x', name: 'X', bin: null, confidence: 'single-source', vietqrAutofill: false, android: { package: 'a.b', scheme: 'x', host: '' } } as const
  const e = thrown(() => linkFor(androidOnly, 'x', 'ios'))
  expect(e.code).toBe('INVALID_VALUE')
  expect(e.message).toContain('ios')
})

test('an unknown app, a bad platform and a missing platform name what is wrong', () => {
  expect(thrown(() => bankAppLink('nope', 'android')).message).toContain('nope')
  expect(thrown(() => bankAppLink('mb', 'windows' as never)).message).toContain('platform')
  expect(thrown(() => bankAppLink('momo', 'android')).message).toContain('android')
})

test('every app builds a link on each platform it has', () => {
  for (const app of BANK_APPS) {
    if (app.ios) expect(bankAppLink(app.id, 'ios')).toBe(`${app.ios.scheme}://`)
    if (app.android) expect(bankAppLink(app.id, 'android')).toMatch(/^intent:\/\/[^#]*#Intent;scheme=[^;]+;package=[^;]+;end$/)
  }
})
