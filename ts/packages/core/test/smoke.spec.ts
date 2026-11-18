import { VERSION } from '../src/index.js'

test('core exports a version string', () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
})
