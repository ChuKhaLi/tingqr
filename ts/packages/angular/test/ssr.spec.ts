// @vitest-environment node
// Server-side rendering with @angular/platform-server (its own DOM emulation), zoneless (the setup Noel tree uses on Cloudflare Workers; this test runs on Node).
import { Component, provideZonelessChangeDetection } from '@angular/core'
import { bootstrapApplication, type BootstrapContext } from '@angular/platform-browser'
import { provideServerRendering, renderApplication } from '@angular/platform-server'
import { TingQrCode } from '@tingqr/angular'
import { PAYLOAD } from './payload.js'

async function ssr(payload: string, mode: 'auto' | 'svg' | 'img'): Promise<string> {
  @Component({
    selector: 'app-root',
    imports: [TingQrCode],
    template: `<main><tingqr-code [payload]="payload" [mode]="mode" label="QR" /></main>`,
  })
  class Root {
    payload = payload
    mode = mode
  }
  return renderApplication(
    (context: BootstrapContext) =>
      bootstrapApplication(Root, { providers: [provideZonelessChangeDetection(), provideServerRendering()] }, context),
    { document: '<html><body><app-root></app-root></body></html>', url: '/' },
  )
}

const qrPart = (html: string) => html.slice(html.indexOf('<tingqr-code'), html.indexOf('</tingqr-code>'))

test.each(['auto', 'svg'] as const)('mode %s: the server HTML already has the QR as SVG', async (mode) => {
  const html = qrPart(await ssr(PAYLOAD, mode))
  expect(html).toContain('<svg')
  expect(html).toContain('<path')
  expect(html).toContain('role="img"')
})

test('mode img: no SVG and no image on the server (the PNG is drawn in the browser)', async () => {
  const html = qrPart(await ssr(PAYLOAD, 'img'))
  expect(html).toContain('<tingqr-code')
  expect(html).not.toContain('<svg')
  expect(html).not.toContain('<img')
})

test('renders nothing for an invalid payload', async () => {
  const html = await ssr('a'.repeat(5000), 'auto')
  expect(html).toContain('<main>')
  expect(html).toContain('<tingqr-code')
  expect(qrPart(html)).not.toContain('<svg')
})
