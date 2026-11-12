import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from './index';

describe('workspace', () => {
  it('runs tests in packages/core', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });
});
