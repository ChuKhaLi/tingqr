// Loaded with `node --import` by cli.test.mjs: replaces global fetch with the fixture-backed fake, so the CLI never
// calls the network. TINGQR_FAKE=malformed serves a bank list without `data`.
import { fakeFetch } from './helpers.mjs'

globalThis.fetch = fakeFetch(process.env.TINGQR_FAKE === 'malformed' ? { banks: { code: '00' } } : {}).fetch
