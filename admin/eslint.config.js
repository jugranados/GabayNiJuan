import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // The browser may only ever hold the public anon key.
      'no-restricted-syntax': [
        'error',
        { selector: "Literal[value=/service_role/i]", message: 'Never reference a service-role key in the browser.' },
      ],
    },
  },
);
