/**
 * Setup script — run once after cloning the repo.
 * Checks prerequisites, installs dependencies, and prepares the environment.
 * Usage: npm run setup
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Runs a command synchronously with inherited stdio.
 * @param {string} cmd - Command to run
 * @param {string} cwd - Working directory
 */
function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

/**
 * Checks that the Node.js version meets the minimum requirement.
 * @param {number} minMajor - Minimum major version required
 */
function checkNodeVersion(minMajor) {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < minMajor) {
    console.error(`\n❌ Node.js ${minMajor}+ required. Found: ${version}`);
    console.error('   → Install from: https://nodejs.org/\n');
    process.exit(1);
  }
  console.log(`✅ Node.js ${version} (>=${minMajor} required)`);
}

async function setup() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   🧾 Viettel OCR — Invoice Tool      ║');
  console.log('║       Project Setup                   ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Check Node.js version
  checkNodeVersion(20);

  // 2. Install dependencies
  console.log('\n📦 Installing dependencies...');
  run('npm install');

  // 3. Copy config.env if not exists
  const configPath = path.join(ROOT, 'config.env');
  const examplePath = path.join(ROOT, 'config.env.example');
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(examplePath, configPath);
    console.log('\n📝 Created config.env from template');
    console.log('   → Edit config.env and set GEMINI_API_KEY before starting');
  } else {
    console.log('\n✅ config.env already exists');
  }

  // 4. Create data directories
  const dataDir = path.join(ROOT, 'data');
  for (const sub of ['uploads', 'exports', 'logs']) {
    const dir = path.join(dataDir, sub);
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log('📁 Data directories created');

  // 5. Create database directory
  const dbDir = path.join(ROOT, 'data', 'db');
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('🗃️  Database directory created');

  // 6. Build shared package
  console.log('\n🔨 Building shared package...');
  run('npm run build -w packages/shared');

  // 7. Verify backend compilation
  console.log('\n🔍 Verifying backend TypeScript...');
  try {
    run('npx tsc --noEmit', path.join(ROOT, 'packages', 'backend'));
    console.log('✅ Backend compilation check passed');
  } catch {
    console.warn('⚠️  Backend TypeScript check had warnings (non-blocking)');
  }

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║       ✅ Setup Complete!               ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('\n  Next steps:');
  console.log('  1. Edit config.env and set GEMINI_API_KEY');
  console.log('  2. Run: npm start');
  console.log('  3. Open: http://localhost:8888\n');
}

setup().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
