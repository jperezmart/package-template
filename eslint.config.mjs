// SCAFFOLDING — a minimal working config so `pnpm lint` is green on a fresh
// clone. Replace it with whatever your repo actually wants; nothing in the
// standard depends on this file, or on ESLint existing at all.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
