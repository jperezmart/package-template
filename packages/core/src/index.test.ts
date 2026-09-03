import { expect, it } from 'vitest';

import { greet } from './index.js';

it('greets by name', () => {
  expect(greet('world')).toBe('Hello, world!');
});
