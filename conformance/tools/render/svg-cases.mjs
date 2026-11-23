// The cases behind conformance/vectors/render/render-svg-*.json (conformance/README.md "Mẫu SVG").
// Each case: { id, input, note, error? }. With `error` the vector is kind "encode-invalid" + render "svg"; without it
// kind "svg" and the expected SVG is whatever @tingqr/render's toSvg returns (gen-svg.mjs).
// Error cases are named render-svg-invalid-*: the matrix runners count files named render-invalid-*, so they stay apart.

// 1x1 transparent PNG. Not a real bank logo; toSvg never decodes the image, it only checks the href and embeds it.
export const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

const TEXT = 'ting ting qr'
// A logo needs a code big enough that the cleared box is at most 10% of it: minVersion 5 (37 modules) is.
const LOGO = { minVersion: 5 }

/** A case that must render. */
const ok = (id, input, note) => ({ id: `render-svg-${id}`, input: { text: TEXT, ...input }, note })
/** A case that must throw INVALID_VALUE from toSvg. */
const bad = (id, input, note) => ({ id: `render-svg-invalid-${id}`, input: { text: TEXT, ...input }, error: 'INVALID_VALUE', note })

export const CASES = [
  ok('default', {}, 'no options: margin 4, black on white, no size'),
  ok('margin-0', { margin: 0 }, 'margin 0: viewBox is the matrix size'),
  ok('margin-16', { margin: 16 }, 'largest margin'),
  ok('colours-lower', { foreground: '#0a2540', background: '#f6f9fc' }, 'lower-case six-digit hex'),
  ok('colours-upper', { foreground: '#0A2540', background: '#F6F9FC' }, 'upper-case hex is written back as given'),
  ok('colours-short', { foreground: '#000', background: '#fff' }, 'three-digit hex is written back as given'),
  ok('background-transparent', { background: 'transparent' }, 'no background rect and no contrast check'),
  ok('background-transparent-light-foreground', { foreground: '#ffffff', background: 'transparent' }, 'with a transparent background nothing is checked'),
  ok('contrast-at-threshold', { foreground: '#767676', background: '#ffffff' }, '#767676 on white is 4.54:1, just above the 4.5:1 bar'),
  ok('size-integer', { size: 200 }, 'size as a number: width and height 200'),
  ok('size-fraction', { size: 100.5 }, 'size as a non-integer number'),
  ok('size-tenth', { size: 0.1 }, 'size 0.1: the shortest decimal form must be written'),
  ok('size-mm', { size: '40mm' }, 'size as a length'),
  ok('size-percent', { size: '100%' }, 'size as a percentage'),
  ok('size-length-fraction', { size: '1.5in' }, 'length with a fraction'),
  ok('ecc-l', { ecc: 'L' }, 'ecc L'),
  ok('ecc-m', { ecc: 'M' }, 'ecc M'),
  ok('ecc-q', { ecc: 'Q' }, 'ecc Q'),
  ok('ecc-h', { ecc: 'H' }, 'ecc H'),
  { id: 'render-svg-khmer', input: { text: 'ការទូទាត់ QR' }, note: 'Khmer text: byte mode, UTF-8' },
  { id: 'render-svg-emoji', input: { text: 'ting 😀 qr' }, note: 'emoji: a UTF-16 surrogate pair in the source text' },
  ok('logo-default', { ...LOGO, logo: { href: PNG } }, 'logo with defaults (size 0.2, padding 1, background = QR background); ecc is forced to H'),
  ok('logo-size-025', { ...LOGO, logo: { href: PNG, size: 0.25, padding: 0 } }, 'largest logo size, no padding'),
  ok('logo-size-02-padding-4', { ...LOGO, logo: { href: PNG, size: 0.2, padding: 4 }, minVersion: 16 }, 'largest padding on a bigger code'),
  ok('logo-padding-0', { ...LOGO, logo: { href: PNG, padding: 0 } }, 'padding 0'),
  ok('logo-background', { ...LOGO, logo: { href: PNG, background: '#fff8e1' } }, 'own background behind the logo'),
  ok('logo-background-transparent', { ...LOGO, logo: { href: PNG, background: 'transparent' } }, 'transparent logo background: no rect behind the logo'),
  ok('logo-ecc-h', { ...LOGO, ecc: 'H', logo: { href: PNG } }, 'an explicit ecc H with a logo is accepted'),
  ok('logo-quote-in-href', { ...LOGO, logo: { href: 'logo.png?a=1&b="2"' } }, 'a relative path: & and " are escaped in the attribute'),
  ok('logo-transparent-qr', { ...LOGO, background: 'transparent', logo: { href: PNG } }, 'transparent QR background: the logo background follows it'),

  bad('margin-negative', { margin: -1 }, 'margin below 0'),
  bad('margin-17', { margin: 17 }, 'margin above 16'),
  bad('margin-fraction', { margin: 1.5 }, 'margin must be an integer'),
  bad('colour-name', { foreground: 'red' }, 'colour must be #rgb or #rrggbb'),
  bad('colour-no-hash', { foreground: '000000' }, 'colour without #'),
  bad('background-colour', { background: 'white' }, 'the background is a hex colour or transparent'),
  bad('foreground-lighter', { foreground: '#ffffff', background: '#000000' }, 'inverted code: foreground lighter than background'),
  bad('foreground-equal', { foreground: '#ffffff', background: '#ffffff' }, 'foreground equals background'),
  bad('contrast-below-threshold', { foreground: '#777777', background: '#ffffff' }, '#777777 on white is 4.48:1, just under the 4.5:1 bar'),
  bad('size-zero', { size: 0 }, 'size 0'),
  bad('size-negative', { size: -5 }, 'negative size'),
  bad('size-unit', { size: '10furlongs' }, 'unknown length unit'),
  bad('size-zero-length', { size: '0mm' }, 'a length of zero'),
  bad('size-empty', { size: '' }, 'empty length'),
  bad('ecc-unknown', { ecc: 'X' }, 'an option of the matrix reaches toSvg too'),
  bad('max-version', { maxVersion: 1, text: 'this text does not fit in a version 1 code' }, 'text longer than maxVersion allows'),
  bad('logo-size-zero', { ...LOGO, logo: { href: PNG, size: 0 } }, 'logo size 0'),
  bad('logo-size-03', { ...LOGO, logo: { href: PNG, size: 0.3 } }, 'logo size above 0.25'),
  bad('logo-padding-5', { ...LOGO, logo: { href: PNG, padding: 5 } }, 'logo padding above 4'),
  bad('logo-padding-fraction', { ...LOGO, logo: { href: PNG, padding: 1.5 } }, 'logo padding must be an integer'),
  bad('logo-href-script', { ...LOGO, logo: { href: 'javascript:alert(1)' } }, 'logo href with a script scheme'),
  bad('logo-href-data-html', { ...LOGO, logo: { href: 'data:text/html,<b>x</b>' } }, 'logo href that is a data URI but not an image'),
  bad('logo-href-empty', { ...LOGO, logo: { href: '' } }, 'empty logo href'),
  bad('logo-href-backslash', { ...LOGO, logo: { href: '/\\evil.example/x.png' } }, 'a backslash in a path reads as / in a browser'),
  bad('logo-href-protocol-relative', { ...LOGO, logo: { href: '//evil.example/x.png' } }, 'protocol-relative logo href'),
  bad('logo-background-colour', { ...LOGO, logo: { href: PNG, background: 'gold' } }, 'logo background must be a hex colour or transparent'),
  bad('logo-ecc-l', { ...LOGO, ecc: 'L', logo: { href: PNG } }, 'a logo needs ecc H'),
  bad('logo-too-big', { logo: { href: PNG, size: 0.25, padding: 4 } }, 'the cleared box takes more than 10% of a small code'),
]
