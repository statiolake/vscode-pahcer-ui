import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts'],
  },
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },

    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],

      curly: 'warn',
      eqeqeq: ['warn', 'smart'],
      'no-throw-literal': 'warn',
      semi: 'warn',
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../application/**',
                '../../application/**',
                '../infrastructure/**',
                '../../infrastructure/**',
                '../presentation/**',
                '../../presentation/**',
              ],
              message:
                'Domain layer must not depend on application, infrastructure, or presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../domain/**',
                '../../domain/**',
                '../../../domain/**',
                '../../../../domain/**',
                '../infrastructure/**',
                '../../infrastructure/**',
                '../../../infrastructure/**',
                '../../../../infrastructure/**',
              ],
              message:
                'Presentation layer must depend on application APIs, not domain or infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../presentation/**',
                '../../presentation/**',
                '../../../presentation/**',
                '../../../../presentation/**',
              ],
              message: 'Infrastructure layer must not depend on presentation.',
            },
          ],
        },
      ],
    },
  },
];
