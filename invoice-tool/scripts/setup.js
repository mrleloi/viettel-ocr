/**
 * Setup script — run once after cloning the repo.
 * Usage: npm run setup
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, cwd = ROOT) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

async function setup() {
  console.log('🔧 Invoice Tool — Setup\n');

  // 1. Install dependencies
  console.log('📦 Installing dependencies...');
  run('npm install');

  // 2. Copy config.env if not exists
  const configPath = path.join(ROOT, 'config.env');
  const examplePath = path.join(ROOT, 'config.env.example');
  if (!fs.existsSync(configPath)) {
    fs.copyFileSync(examplePath, configPath);
    console.log('\n📝 Created config.env from template');
    console.log('   → Edit config.env and set GEMINI_API_KEY before starting');
  } else {
    console.log('\n✅ config.env already exists');
  }

  // 3. Create data directories
  const dataDir = path.join(ROOT, 'data');
  for (const sub of ['uploads', 'exports', 'logs']) {
    const dir = path.join(dataDir, sub);
    fs.mkdirSync(dir, { recursive: true });
  }
  console.log('📁 Data directories created');

  // 4. Build shared package
  console.log('\n🔨 Building shared package...');
  run('npm run build -w packages/shared');

  console.log('\n✅ Setup complete!');
  console.log('   1. Edit config.env and set GEMINI_API_KEY');
  console.log('   2. Run: npm run dev');
}

setup().catch((err) => {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
});
