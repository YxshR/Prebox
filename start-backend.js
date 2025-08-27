const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description} exists`);
    return true;
  } else {
    console.log(`❌ ${description} missing: ${filePath}`);
    return false;
  }
}

function checkNodeModules() {
  const backendNodeModules = path.join('backend', 'node_modules');
  if (fs.existsSync(backendNodeModules)) {
    console.log('✅ Backend dependencies installed');
    return true;
  } else {
    console.log('❌ Backend dependencies not installed');
    return false;
  }
}

async function startBackend() {
  console.log('🚀 Starting Backend Server...\n');
  
  // Check prerequisites
  console.log('1. Checking prerequisites...');
  
  const envExists = checkFile('backend/.env', 'Backend .env file');
  const packageExists = checkFile('backend/package.json', 'Backend package.json');
  const nodeModulesExists = checkNodeModules();
  
  if (!envExists || !packageExists) {
    console.log('\n❌ Missing required files. Please ensure you have:');
    console.log('   - backend/.env file with configuration');
    console.log('   - backend/package.json file');
    return;
  }
  
  if (!nodeModulesExists) {
    console.log('\n📦 Installing backend dependencies...');
    console.log('   Running: npm install in backend directory');
    
    const installProcess = spawn('npm', ['install'], {
      cwd: 'backend',
      stdio: 'inherit',
      shell: true
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Dependencies installed successfully');
        startDevServer();
      } else {
        console.log('❌ Failed to install dependencies');
      }
    });
    
    return;
  }
  
  startDevServer();
}

function startDevServer() {
  console.log('\n2. Starting development server...');
  console.log('   Running: npm run dev in backend directory');
  console.log('   This will start the server with auto-reload on changes');
  console.log('\n📋 Server startup logs:');
  console.log('─'.repeat(50));
  
  const devProcess = spawn('npm', ['run', 'dev'], {
    cwd: 'backend',
    stdio: 'inherit',
    shell: true
  });
  
  devProcess.on('close', (code) => {
    console.log(`\n📋 Server process exited with code ${code}`);
    
    if (code !== 0) {
      console.log('\n💡 Common issues and solutions:');
      console.log('   1. Port 3001 already in use:');
      console.log('      - Kill existing process: npx kill-port 3001');
      console.log('      - Or change PORT in backend/.env');
      console.log('   2. Database connection issues:');
      console.log('      - Check DATABASE_URL in backend/.env');
      console.log('      - Ensure database is accessible');
      console.log('   3. Missing environment variables:');
      console.log('      - Check all required vars are set in backend/.env');
      console.log('   4. TypeScript compilation errors:');
      console.log('      - Check for syntax errors in .ts files');
    }
  });
  
  devProcess.on('error', (error) => {
    console.error('\n❌ Failed to start server:', error.message);
    
    if (error.code === 'ENOENT') {
      console.log('\n💡 Node.js or npm not found. Please ensure:');
      console.log('   1. Node.js is installed (version 16 or higher)');
      console.log('   2. npm is available in your PATH');
    }
  });
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping server...');
    devProcess.kill('SIGINT');
    process.exit(0);
  });
}

// Show usage instructions
console.log('🔧 Backend Server Startup Helper\n');
console.log('This script will:');
console.log('  1. Check if all required files exist');
console.log('  2. Install dependencies if needed');
console.log('  3. Start the development server');
console.log('  4. Show helpful error messages if issues occur\n');

startBackend().catch(console.error);