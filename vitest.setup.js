/**
 * @fileoverview Vitest global setup — runs once before the test suite,
 * loaded via vite.config.js's test.setupFiles.
 *
 * Only actually needed by jsdom-environment tests (hooks/components);
 * the existing pure-logic (node-environment) tests don't touch
 * anything this file sets up, so it's harmless for them to load this
 * too.
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmounts anything rendered by a jsdom-environment test after each
// test finishes, so one test's rendered hook/component can't leak
// into the next one.
afterEach(() => {
  cleanup();
});
