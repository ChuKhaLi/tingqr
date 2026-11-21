// Each `sources[].agrees` flag in bank-apps.json matches what the dated snapshot of that source actually says.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseDlRedirects } from '../lib/apps.mjs'
import { parseVietnamQrPay, sourceAgrees } from '../lib/agree.mjs'

const BANKS = fileURLToPath(new URL('../../../banks/', import.meta.url))
const SNAP = `${BANKS}sources/2026-11-20/`
const json = (p) => JSON.parse(readFileSync(p, 'utf8'))

const tcb = { ios: { scheme: 'tcb' }, android: { package: 'vn.com.techcombank.bb.app', scheme: 'tcb', host: 'applink' } }

test('vietqr.io agrees only when every emitted field matches the redirect', () => {
  const src = { ios: { scheme: 'tcb' }, android: { package: 'vn.com.techcombank.bb.app', scheme: 'tcb', host: 'applink' } }
  assert.equal(sourceAgrees('vietqr.io', tcb, src), true)
  assert.equal(sourceAgrees('vietqr.io', tcb, { ...src, android: { ...src.android, host: '' } }), false)
  assert.equal(sourceAgrees('vietqr.io', tcb, { ...src, ios: undefined }), false)
  assert.equal(sourceAgrees('vietqr.io', tcb, undefined), false)
})

test('vietnam-qr-pay (one scheme for both systems) agrees only when that scheme and the package match', () => {
  assert.equal(sourceAgrees('vietnam-qr-pay', tcb, { scheme: 'tcb', packageId: 'vn.com.techcombank.bb.app' }), true)
  assert.equal(sourceAgrees('vietnam-qr-pay', tcb, { scheme: 'tcbmobile', packageId: 'vn.com.techcombank.bb.app' }), false)
  const klb = { ios: { scheme: 'kienlongbankmobilebanking' }, android: { package: 'com.sunshine.ksbank', scheme: 'ksbank', host: 'ksbank.co' } }
  assert.equal(sourceAgrees('vietnam-qr-pay', klb, { scheme: 'kienlongbankmobilebanking', packageId: 'com.sunshine.ksbank' }), false)
})

test('qrviet agrees on the iOS scheme and the Android package (it has no Android scheme)', () => {
  assert.equal(sourceAgrees('qrviet', tcb, { ios: { scheme: 'tcb://' }, android: { package: 'vn.com.techcombank.bb.app' } }), true)
  assert.equal(sourceAgrees('qrviet', tcb, { ios: { scheme: 'tcb2://' }, android: { package: 'vn.com.techcombank.bb.app' } }), false)
})

test('noel-tree agrees when its single scheme, package and host all match', () => {
  assert.equal(sourceAgrees('noel-tree', tcb, { scheme: 'tcb', android: 'vn.com.techcombank.bb.app', androidHost: 'applink' }), true)
  assert.equal(sourceAgrees('noel-tree', tcb, { scheme: 'tcb', android: 'vn.com.techcombank.bb.app', androidHost: '' }), false)
})

test('parseVietnamQrPay reads every entry of the snapshot', () => {
  const list = parseVietnamQrPay(readFileSync(`${SNAP}vietnam-qr-pay-bank-apps.js`, 'utf8'), readFileSync(`${SNAP}vietnam-qr-pay-bank-key.js`, 'utf8'))
  assert.equal(list.length, 60)
  assert.deepEqual(list.find((x) => x.bank === 'acb'), { bank: 'acb', scheme: 'acbapp', packageId: 'mobile.acb.com.vn' })
  assert.equal(list.find((x) => x.bank === 'bacabank').scheme, undefined)
})

test('every agrees flag in bank-apps.json matches the 2026-11-20 snapshots', () => {
  const vietqr = new Map(parseDlRedirects(json(`${SNAP}vietqr-dl-redirects.json`)).map((a) => [a.id, a]))
  const vnqr = new Map(parseVietnamQrPay(readFileSync(`${SNAP}vietnam-qr-pay-bank-apps.js`, 'utf8'), readFileSync(`${SNAP}vietnam-qr-pay-bank-key.js`, 'utf8')).map((a) => [a.bank, a]))
  const qrviet = new Map(json(`${SNAP}qrviet-bank-apps.json`).map((a) => [a.code, a]))
  const noel = new Map(json(`${SNAP}noel-tree-bank-apps.json`).apps.map((a) => [a.id, a]))
  const lookup = { 'vietqr.io': vietqr, 'vietnam-qr-pay': vnqr, qrviet, 'noel-tree': noel }
  for (const app of json(`${BANKS}bank-apps.json`).apps) {
    for (const s of app.sources) {
      assert.equal(s.agrees, sourceAgrees(s.name, app, lookup[s.name].get(s.ref)), `${app.id} / ${s.name} ${s.ref}`)
    }
  }
})
