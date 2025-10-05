const fs = require('node:fs');
const path = require('node:path');

// Simply copy the Chart.js UMD build instead of bundling
const source = path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
const dest = path.join(__dirname, 'dist', 'chart.js');

// Ensure dist directory exists
if (!fs.existsSync(path.dirname(dest))) {
	fs.mkdirSync(path.dirname(dest), { recursive: true });
}

// Copy the file
fs.copyFileSync(source, dest);

console.log('Chart.js copied to dist/chart.js');
