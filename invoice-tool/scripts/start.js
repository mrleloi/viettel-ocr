/**
 * Start script — launches all services.
 * Usage: npm start
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

function startProcess(name, command, args, env = {}) {
  const proc = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'pipe',
    shell: true,
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return proc;
}

function validateConfig() {
  const configPath = path.join(ROOT, 'config.env');
  if (!fs.existsSync(configPath)) {
    console.error('❌ config.env not found. Run "npm run setup" first.');
    process.exit(1);
  }
}

async function start() {
  console.log('🚀 Invoice Tool — Starting...\n');
  validateConfig();

  const processes = [];

  // Start mock server (if no external product API configured)
  const configContent = fs.readFileSync(path.join(ROOT, 'config.env'), 'utf8');
  const hasExternalApi = configContent.includes('VIETTEL_PRODUCT_API_URL=http');

  if (!hasExternalApi) {
    console.log('🏪 Starting mock Viettel Product API on :8887...');
    processes.push(
      startProcess('mock', 'npx', ['ts-node', 'packages/mock-server/src/main.ts'], {
        PORT: '8887',
      }),
    );
  }

  // Start backend
  console.log('⚙️  Starting NestJS backend on :8889...');
  processes.push(
    startProcess('backend', 'npm', ['run', 'start:dev', '-w', 'packages/backend']),
  );

  // Start frontend
  console.log('🎨 Starting Next.js frontend on :8888...');
  processes.push(
    startProcess('frontend', 'npm', ['run', 'dev', '-w', 'packages/frontend']),
  );

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutting down...');
    processes.forEach((p) => p.kill());
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('❌ Start failed:', err.message);
  process.exit(1);
});
