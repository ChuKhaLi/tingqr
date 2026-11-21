import '@angular/compiler'
import { getTestBed } from '@angular/core/testing'
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing'

// TestBed needs a DOM; the SSR test runs in the node environment with platform-server instead.
if (typeof document !== 'undefined') getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting())
