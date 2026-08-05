const esbuild = require('esbuild');

const production = process.argv.includes('--production');

esbuild
  .build({
    entryPoints: ['packages/cli/src/cli.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    outfile: 'dist/pahcer-ui.js',
    banner: { js: '#!/usr/bin/env node' },
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    logLevel: 'info',
  })
  .catch(() => process.exit(1));
