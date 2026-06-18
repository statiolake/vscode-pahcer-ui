const esbuild = require('esbuild');

const production = process.argv.includes('--production');

async function main() {
  await Promise.all([
    esbuild.build({
      entryPoints: ['packages/web-interface/src/server.ts'],
      bundle: true,
      format: 'cjs',
      platform: 'node',
      target: 'node22',
      outfile: 'dist/web/server.js',
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      logLevel: 'info',
    }),
    esbuild.build({
      entryPoints: ['packages/web-interface/src/client/index.tsx'],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      target: 'es2020',
      jsx: 'automatic',
      jsxImportSource: 'react',
      outfile: 'dist/web/public/app.js',
      minify: production,
      sourcemap: !production,
      sourcesContent: false,
      define: {
        'process.env.NODE_ENV': production ? '"production"' : '"development"',
      },
      logLevel: 'info',
    }),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
