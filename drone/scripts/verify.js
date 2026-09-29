const { execSync } = require('child_process');
const path = require('path');

try {
  console.log("Launching TypeScript validation test runner via ts-node...");
  execSync('npx -y ts-node --skip-project -O "{\\"module\\": \\"commonjs\\", \\"esModuleInterop\\": true}" packages/core/tests/run_tests.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
  
  console.log("Launching TypeScript scenario generator and boundary tests...");
  execSync('npx -y ts-node --skip-project -O "{\\"module\\": \\"commonjs\\", \\"esModuleInterop\\": true}" packages/core/tests/generate_scenarios.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });
} catch (err) {
  console.error("Test execution encountered an error.");
  process.exit(1);
}
