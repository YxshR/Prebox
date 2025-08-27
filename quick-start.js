const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkAndCreateEnvFiles() {
  log('\n📋 Checking environment files...', 'blue');
  
  // Check backend .env
  const backendEnvPath = path.join('backend', '.env');
  if (!fs.existsSync(backendEnvPath)) {
    log('❌ Backend .env file missing', 'red');
    log('Creating basic .env file for demo mode...', 'yellow');
    
    const basicEnv = `# Basic Configuration
PORT=3001
NODE_ENV=development
DEMO_MODE=true

# JWT Configuration
JWT_SECRET=dev-super-secret-jwt-key-for-development-only
JWT_REFRESH_SECRET=dev-super-secret-refresh-key-for-development-only
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3002

# Email (disabled in demo mode)
DISABLE_EMAIL_SENDING=true
PRIMARY_EMAIL_PROVIDER=mock

# Application URLs
FRONTEND_URL=http://localhost:3000
`;
    
    fs.writeFileSync(backendEnvPath, basicEnv);
    log('✅ Created backend/.env with demo configuration', 'green');
  } else {
    log('✅ Backend .env file exists', 'green');
    
    // Check if DEMO_MODE is enabled
    const envContent = fs.readFileSync(backendEnvPath, 'utf8');
    if (!envContent.includes('DEMO_MODE=true')) {
      log('⚠️ Adding DEMO_MODE=true to backend/.env', 'yellow');
      fs.appendFileSync(backendEnvPath, '\n# Demo Mode\nDEMO_MODE=true\n');
    }
  }
  
  // Check frontend .env.local
  const frontendEnvPath = path.join('frontend', '.env.local');
  if (!fs.existsSync(frontendEnvPath)) {
    log('❌ Frontend .env.local file missing', 'red');
    log('Creating .env.local file...', 'yellow');
    
    const frontendEnv = `# Local Development Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
    
    fs.writeFileSync(frontendEnvPath, frontendEnv);
    log('✅ Created frontend/.env.local', 'green');
  } else {
    log('✅ Frontend .env.local file exists', 'green');
  }
}

function installDependencies(directory, name) {
  return new Promise((resolve, reject) => {
    log(`\n📦 Installing ${name} dependencies...`, 'blue');
    
    const nodeModulesPath = path.join(directory, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      log(`✅ ${name} dependencies already installed`, 'green');
      resolve();
      return;
    }
    
    const installProcess = spawn('npm', ['install'], {
      cwd: directory,
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    installProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write('.');
    });
    
    installProcess.stderr.on('data', (data) => {
      output += data.toString();
    });
    
    installProcess.on('close', (code) => {
      console.log(''); // New line after dots
      if (code === 0) {
        log(`✅ ${name} dependencies installed successfully`, 'green');
        resolve();
      } else {
        log(`❌ Failed to install ${name} dependencies`, 'red');
        console.log('Output:', output);
        reject(new Error(`npm install failed in ${directory}`));
      }
    });
  });
}

function startServer(directory, command, name, port) {
  return new Promise((resolve, reject) => {
    log(`\n🚀 Starting ${name} server...`, 'blue');
    
    const serverProcess = spawn('npm', ['run', command], {
      cwd: directory,
      stdio: 'pipe',
      shell: true
    });
    
    let output = '';
    let started = false;
    
    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Check for server start indicators
      if (text.includes(`port ${port}`) || 
          text.includes('Ready on') || 
          text.includes('server running') ||
          text.includes('Backend server running')) {
        if (!started) {
          started = true;
          log(`✅ ${name} server started on port ${port}`, 'green');
          resolve(serverProcess);
        }
      }
      
      // Show important messages
      if (text.includes('error') || text.includes('Error')) {
        log(`⚠️ ${name}: ${text.trim()}`, 'yellow');
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Show errors but don't fail immediately (some are warnings)
      if (text.includes('error') || text.includes('Error')) {
        log(`⚠️ ${name}: ${text.trim()}`, 'yellow');
      }
    });
    
    serverProcess.on('close', (code) => {
      if (!started) {
        log(`❌ ${name} server failed to start (exit code: ${code})`, 'red');
        console.log('Full output:', output);
        reject(new Error(`${name} server failed`));
      }
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (!started) {
        log(`⏰ ${name} server taking longer than expected...`, 'yellow');
        log('This is normal for first-time startup', 'yellow');
        // Don't reject, just warn
      }
    }, 30000);
  });
}

async function quickStart() {
  log('🚀 Quick Start - Bulk Email Platform', 'cyan');
  log('This will set up and start both backend and frontend servers\n', 'cyan');
  
  try {
    // Step 1: Check and create environment files
    checkAndCreateEnvFiles();
    
    // Step 2: Install dependencies
    await installDependencies('backend', 'Backend');
    await installDependencies('frontend', 'Frontend');
    
    // Step 3: Start backend server
    const backendProcess = await startServer('backend', 'dev', 'Backend', 3001);
    
    // Wait a bit for backend to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Start frontend server
    const frontendProcess = await startServer('frontend', 'dev', 'Frontend', 3000);
    
    // Step 5: Show success message
    log('\n🎉 SUCCESS! Both servers are running:', 'green');
    log('   📱 Frontend: http://localhost:3000', 'cyan');
    log('   🔧 Backend:  http://localhost:3001', 'cyan');
    log('   📝 Signup:   http://localhost:3000/auth/register', 'cyan');
    
    log('\n📋 Server Status:', 'blue');
    log('   Backend: Running in demo mode (no database required)', 'green');
    log('   Frontend: Running with hot reload', 'green');
    
    log('\n💡 Tips:', 'yellow');
    log('   - Press Ctrl+C to stop both servers');
    log('   - Check terminal output for any errors');
    log('   - Both servers will auto-reload on file changes');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      log('\n\n🛑 Shutting down servers...', 'yellow');
      backendProcess.kill('SIGINT');
      frontendProcess.kill('SIGINT');
      setTimeout(() => process.exit(0), 2000);
    });
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    log(`\n❌ Quick start failed: ${error.message}`, 'red');
    log('\n💡 Troubleshooting:', 'yellow');
    log('   1. Make sure Node.js 16+ is installed');
    log('   2. Check if ports 3000 and 3001 are available');
    log('   3. Run: npx kill-port 3000 3001');
    log('   4. Try running: node check-backend-status.js');
    process.exit(1);
  }
}

quickStart().catch(console.error);