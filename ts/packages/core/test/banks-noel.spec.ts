// Noel tree (tingqr's first user) opens these 15 apps today. Copied from ../noel-tree/src/app/tree/bank-apps.ts on
// 2026-11-20 (fields id, scheme, android, androidHost). Switching Noel tree to tingqr must not change any link.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFORMANCE_DIR } from './conformance-root.js'
import { bankAppLink } from '../src/banks.js'

const NOEL_TREE = [
  { id: 'mb', scheme: 'mbbank', android: 'com.mbmobile', androidHost: '' },
  { id: 'vcb', scheme: 'vietcombankmobile', android: 'com.VCB', androidHost: '' },
  { id: 'tcb', scheme: 'tcb', android: 'vn.com.techcombank.bb.app', androidHost: 'applink' },
  { id: 'bidv', scheme: 'bidv.smartbanking.partner', android: 'com.vnpay.bidv', androidHost: 'payment' },
  { id: 'icb', scheme: 'vietinbankipay', android: 'com.vietinbank.ipay', androidHost: '' },
  { id: 'acb', scheme: 'acbone', android: 'mobile.acb.com.vn', androidHost: '' },
  { id: 'vpb', scheme: 'vpbankneo', android: 'com.vnpay.vpbankonline', androidHost: '' },
  { id: 'tpb', scheme: 'hydro', android: 'com.tpb.mb.gprsandroid', androidHost: 'onboarding' },
  { id: 'vba', scheme: 'agribankmobile', android: 'com.vnpay.Agribank3g', androidHost: '' },
  { id: 'cake', scheme: 'cake.vn', android: 'xyz.be.cake', androidHost: '' },
  { id: 'ocb', scheme: 'newomni-app', android: 'vn.com.ocb.awe', androidHost: '' },
  { id: 'shb', scheme: 'shbmobile', android: 'vn.shb.saha.mbanking', androidHost: '' },
  { id: 'hdb', scheme: 'hdbankmobile', android: 'com.vnpay.hdbank', androidHost: '' },
  { id: 'vib', scheme: 'myvib2', android: 'com.vib.myvib2', androidHost: 'myvib2.com.vn/data' },
  { id: 'timo', scheme: 'plus', android: 'io.lifestyle.plus', androidHost: '' },
]

const apps: { id: string; disagreements: string[] }[] = JSON.parse(
  readFileSync(join(CONFORMANCE_DIR, 'banks', 'bank-apps.json'), 'utf8'),
).apps

test.each(NOEL_TREE)('$id: Android link equals Noel tree appLink', (n) => {
  expect(bankAppLink(n.id, 'android')).toBe(`intent://${n.androidHost}#Intent;scheme=${n.scheme};package=${n.android};end`)
})

test.each(NOEL_TREE)('$id: iOS link equals Noel tree appLink unless a source disagrees on the iOS scheme', (n) => {
  const iosDisagreement = apps.find((a) => a.id === n.id)!.disagreements.some((d) => /iOS/.test(d))
  if (iosDisagreement) return
  expect(bankAppLink(n.id, 'ios')).toBe(`${n.scheme}://`)
})
