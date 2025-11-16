const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const entries = {
  comparison: 'src/presentation/view/webview/comparison/index.tsx',
  runOptions: 'src/presentation/view/webview/runOptions/index.tsx',
  initialization: 'src/presentation/view/webview/initialization/index.tsx',
};

async function build() {
  const contexts = await Promise.all(
    Object.entries(entries).map(([name, entry]) =>
      esbuild.context({
        entryPoints: [entry],
        bundle: true,
        outfile: `dist/${name}.js`,
        platform: 'browser',
        target: 'es2020',
        jsx: 'automatic',
        jsxImportSource: 'react',
        loader: {
          '.tsx': 'tsx',
          '.ts': 'ts',
          '.css': 'css',
        },
        minify: production,
        sourcemap: !production,
        define: {
          'process.env.NODE_ENV': production ? '"production"' : '"development"',
        },
        logLevel: 'info',
      }),
    ),
  );

  if (watch) {
    console.log('[watch] build started (webview)');
    await Promise.all(contexts.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(contexts.map((ctx) => ctx.rebuild()));
    await Promise.all(contexts.map((ctx) => ctx.dispose()));
    console.log('[build] webview build complete');
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
