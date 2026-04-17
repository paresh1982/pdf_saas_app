const { execSync } = require('child_process');
const path = require('path');

async function install() {
  const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';
  console.log(`📦 Running cross-platform pip install using: ${PYTHON_CMD}`);
  
  try {
    const requirementsPath = path.join(__dirname, '../../requirements.txt');
    execSync(`${PYTHON_CMD} -m pip install -t python_libs -r "${requirementsPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..') // Run from backend/ root
    });
    console.log('✅ Python dependencies installed successfully.');
  } catch (error) {
    console.error('❌ Pip installation failed:', error.message);
    process.exit(1);
  }
}

install();
