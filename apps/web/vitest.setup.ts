import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetBrowserTodayCache, setBrowserTodayClockForTests } from './lib/browser-today';

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => { cleanup(); });

// The rows hide dates the browser's clock says have passed (lib/browser-today). Every test's browser clock is in 2000,
// before any fixture's today, so no test depends on the day it runs; the tests of that rule use the real clock.
beforeEach(() => { setBrowserTodayClockForTests(() => new Date('2000-01-01T00:00:00Z')); resetBrowserTodayCache(); });
