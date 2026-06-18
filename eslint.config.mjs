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
    files: ['packages/core/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '../application/**',
                '../../application/**',
                '@pahcer/core/application/**',
                '@pahcer/node-adapters/**',
                '@pahcer/vscode-extension/**',
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
    files: ['packages/core/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@pahcer/node-adapters/**', '@pahcer/vscode-extension/**'],
              message: 'Application layer must not depend on adapters or presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/vscode-extension/src/presentation/**/*.{ts,tsx}'],
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
                '@pahcer/core/domain/**',
                '@pahcer/node-adapters/**',
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
    files: ['packages/node-adapters/src/infrastructure/**/*.ts'],
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
                '@pahcer/vscode-extension/**',
              ],
              message: 'Infrastructure layer must not depend on presentation.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/web-interface/src/client/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@pahcer/core/domain/**', '@pahcer/node-adapters/**'],
              message: 'Web client must depend on application DTOs, not domain or adapters.',
            },
          ],
        },
      ],
    },
  },
];
