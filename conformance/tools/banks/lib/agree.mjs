// Does a source say exactly what tingqr emits for an app? Used to set and to test bank-apps.json `sources[].agrees`.
// `confidence: "multi-source"` needs two distinct independent sources that agree (conformance/README.md).

/**
 * The BankApps array of the vietnam-qr-pay 1.5.1 snapshot, read without running it: `appsJs` is
 * dist/constants/bank-apps.js, `keysJs` is dist/constants/bank-key.js (enum name → string value).
 */
export function parseVietnamQrPay(appsJs, keysJs) {
  const keys = Object.fromEntries([...keysJs.matchAll(/BankKey\["(\w+)"\] = "([^"]+)"/g)].map((m) => [m[1], m[2]]))
  return [...appsJs.matchAll(/\{\s*bank:\s*bank_key_1\.BankKey\.(\w+),([\s\S]*?)\}/g)].map((m) => {
    if (!keys[m[1]]) throw new Error(`vietnam-qr-pay: BankKey.${m[1]} not in bank-key.js`)
    const scheme = /scheme:\s*'([^']*)'/.exec(m[2])?.[1]
    const packageId = /packageId:\s*'([^']*)'/.exec(m[2])?.[1]
    return { bank: keys[m[1]], ...(scheme !== undefined && { scheme }), packageId }
  })
}

/**
 * @param {'vietqr.io'|'vietnam-qr-pay'|'qrviet'|'noel-tree'} name
 * @param app  the curated app ({ ios?: { scheme }, android?: { package, scheme, host } })
 * @param src  that source's entry for the app (shape per source), or undefined
 */
export function sourceAgrees(name, app, src) {
  if (!src) return false
  const ios = app.ios?.scheme
  const and = app.android
  switch (name) {
    case 'vietqr.io':
      return (
        (!app.ios || src.ios?.scheme === ios) &&
        (!and || (src.android?.scheme === and.scheme && src.android?.package === and.package && src.android?.host === and.host))
      )
    case 'vietnam-qr-pay':
      return (!app.ios || src.scheme === ios) && (!and || (src.scheme === and.scheme && src.packageId === and.package))
    case 'qrviet':
      return (!app.ios || src.ios?.scheme === `${ios}://`) && (!and || src.android?.package === and.package)
    case 'noel-tree':
      return (!app.ios || src.scheme === ios) && (!and || (src.scheme === and.scheme && src.android === and.package && src.androidHost === and.host))
    default:
      throw new Error(`unknown source ${name}`)
  }
}
