const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const esbuild = require('esbuild');

function findTests(dir, extension = '.test.ts') {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findTests(entryPath, extension);
    }
    return entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

async function main() {
  const entryPoints = findTests('packages/core/test');
  if (entryPoints.length === 0) {
    throw new Error('No tests found');
  }

  fs.rmSync('dist/test', { recursive: true, force: true });

  await esbuild.build({
    entryPoints,
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    outbase: 'packages',
    outdir: 'dist/test',
    sourcemap: true,
    sourcesContent: false,
    logLevel: 'info',
  });

  if (process.argv.includes('--run')) {
    const testFiles = findTests('dist/test', '.test.js');
    const result = spawnSync(process.execPath, ['--test', ...testFiles], {
      stdio: 'inherit',
    });
    process.exit(result.status ?? 1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
