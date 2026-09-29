const fs = require('fs');
const path = require('path');

const files = [
  'packages/country-nepal/app/index.html',
  'packages/country-nepal/app/style.css',
  'packages/country-nepal/app/app.js',
  'packages/country-nepal/app/engine.bundle.js'
];

console.log("=== Checking Application Assets Availability ===");
let success = true;

for (const file of files) {
  const fullPath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`[OK] ${file} (${stats.size} bytes)`);
  } else {
    console.error(`[ERR] Missing file: ${file}`);
    success = false;
  }
}

if (!success) {
  process.exit(1);
} else {
  console.log("=== All App Assets Verified Successfully ===");
}
