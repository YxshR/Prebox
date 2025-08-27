#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({
      host: 'localhost',
      port: port,
      method: 'GET',
      path: '/health',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function killPort(port) {
  return new Promise((resolve) => {
    exec(`npx kill-port ${port}`, (error) => {
      resolve(!error);
    });
  });
}

async function setupEnvironment() {
  colorLog('\n🔧 Setting up environment files...', 'blue');
  
  // Backend .env setup
  const backendEnvPath = 'backend/.env';
  if (!fs.existsSync(backendEnvPath)) {
    colorLog('Creating backend/.env...', 'yellow');
    const backendEnv = `# Development Configuration
PORT=3001
NODE_ENV=development
DEMO_MODE=true

# JWT Configuration  
JWT_SECRET=dev-super-secret-jwt-key-for-development-only
JWT_REFRESH_SECRET=dev-super-secret-refresh-key-for-development-only
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3002

# Email Configuration (disabled for demo)
DISABLE_EMAIL_SENDING=true
PRIMARY_EMAIL_PROVIDER=mock
FALLBACK_EMAIL_PROVIDER=mock

# Application URLs
FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3002

# Feature Flags
ENABLE_EMAIL_VERIFICATION=false
ENABLE_PHONE_VERIFICATION=true
ENABLE_AI_TEMPLATES=true

# Demo Mode Settings
DISABLE_SMTP_TRANSPORTER=true
`;
    fs.writeFileSync(backendEnvPath, backendEnv);
    colorLog('✅ Created backend/.env', 'green');
  } else {
    // Ensure demo mode is enabled
    let envContent = fs.readFileSync(backendEnvPath, 'utf8');
    if (!envContent.includes('DEMO_MODE=true')) {
      envContent += '\nDEMO_MODE=true\n';
      fs.writeFileSync(backendEnvPath, envContent);
      colorLog('✅ Enabled demo mode in backend/.env', 'green');
    }
  }
  
  // Frontend .env.local setup
  const frontendEnvPath = 'frontend/.env.local';
  if (!fs.existsSync(frontendEnvPath)) {
    colorLog('Creating frontend/.env.local...', 'yellow');
    const frontendEnv = `# Local Development Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (optional for demo)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=demo-client-id

# Auth0 (optional for demo)  
NEXT_PUBLIC_AUTH0_DOMAIN=demo.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=demo-client-id
`;
    fs.writeFileSync(frontendEnvPath, frontendEnv);
    colorLog('✅ Created frontend/.env.local', 'green');
  }
}

async function installDeps(dir, name) {
  return new Promise((resolve, reject) => {
    colorLog(`\n📦 Installing ${name} dependencies...`, 'blue');
    
    if (fs.existsSync(path.join(dir, 'node_modules'))) {
      colorLog(`✅ ${name} dependencies already installed`, 'green');
      resolve();
      return;
    }
    
    const npm = spawn('npm', ['install'], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    npm.stdout.on('data', () => process.stdout.write('.'));
    
    npm.on('close', (code) => {
      console.log(''); // New line
      if (code === 0) {
        colorLog(`✅ ${name} dependencies installed`, 'green');
        resolve();
      } else {
        colorLog(`❌ Failed to install ${name} dependencies`, 'red');
        reject(new Error(`npm install failed in ${dir}`));
      }
    });
  });
}

async function startServer(dir, script, name, port, successPattern) {
  return new Promise((resolve, reject) => {
    colorLog(`\n🚀 Starting ${name}...`, 'blue');
    
    const server = spawn('npm', ['run', script], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });
    
    let started = false;
    let output = '';
    
    const checkStarted = (data) => {
      const text = data.toString();
      output += text;
      
      if (successPattern.some(pattern => text.includes(pattern))) {
        if (!started) {
          started = true;
          colorLog(`✅ ${name} started successfully`, 'green');
          resolve(server);
        }
      }
      
      // Show important messages
      if (text.includes('error') && !text.includes('warning')) {
        colorLog(`⚠️ ${name}: ${text.trim()}`, 'yellow');
      }
    };
    
    server.stdout.on('data', checkStarted);
    server.stderr.on('data', checkStarted);
    
    server.on('close', (code) => {
      if (!started && code !== 0) {
        colorLog(`❌ ${name} failed to start`, 'red');
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
    
    // Timeout
    setTimeout(() => {
      if (!started) {
        colorLog(`⏰ ${name} is taking longer than expected...`, 'yellow');
      }
    }, 20000);
  });
}

async function main() {
  colorLog('🚀 Bulk Email Platform - Complete Setup & Start', 'cyan');
  colorLog('This will set up everything needed for development\n', 'cyan');
  
  try {
    // Check if ports are available
    colorLog('🔍 Checking ports...', 'blue');
    const backendRunning = await checkPort(3001);
    const frontendRunning = await checkPort(3000);
    
    if (backendRunning || frontendRunning) {
      colorLog('⚠️ Some ports are already in use:', 'yellow');
      if (backendRunning) colorLog('   Port 3001 (backend) is busy', 'yellow');
      if (frontendRunning) colorLog('   Port 3000 (frontend) is busy', 'yellow');
      
      colorLog('Attempting to free ports...', 'yellow');
      if (backendRunning) await killPort(3001);
      if (frontendRunning) await killPort(3000);
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Setup environment
    await setupEnvironment();
    
    // Install dependencies
    await installDeps('backend', 'Backend');
    await installDeps('frontend', 'Frontend');
    
    // Start servers
    const backendProcess = await startServer(
      'backend', 
      'dev', 
      'Backend Server', 
      3001,
      ['Backend server running', 'server running on port']
    );
    
    // Wait for backend to fully start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const frontendProcess = await startServer(
      'frontend',
      'dev', 
      'Frontend Server',
      3000,
      ['Ready on', 'ready on', 'Local:', 'started server on']
    );
    
    // Success message
    colorLog('\n🎉 SUCCESS! Everything is running!', 'green');
    colorLog('━'.repeat(50), 'cyan');
    colorLog('📱 Frontend:  http://localhost:3000', 'cyan');
    colorLog('🔧 Backend:   http://localhost:3001', 'cyan');
    colorLog('📝 Signup:    http://localhost:3000/auth/register', 'cyan');
    colorLog('📊 Health:    http://localhost:3001/health', 'cyan');
    colorLog('━'.repeat(50), 'cyan');
    
    colorLog('\n💡 What to do next:', 'yellow');
    colorLog('1. Open http://localhost:3000/auth/register', 'yellow');
    colorLog('2. Fill in the signup form with test data', 'yellow');
    colorLog('3. Click "Create Account" to test registration', 'yellow');
    colorLog('4. Check both terminal windows for any errors', 'yellow');
    
    colorLog('\n🔧 Running in DEMO MODE:', 'blue');
    colorLog('• No database required', 'blue');
    colorLog('• No email service required', 'blue');
    colorLog('• Perfect for development and testing', 'blue');
    
    colorLog('\n⌨️ Press Ctrl+C to stop both servers', 'magenta');
    
    // Handle shutdown
    process.on('SIGINT', () => {
      colorLog('\n\n🛑 Shutting down...', 'yellow');
      backendProcess.kill('SIGINT');
      frontendProcess.kill('SIGINT');
      setTimeout(() => {
        colorLog('👋 Goodbye!', 'cyan');
        process.exit(0);
      }, 2000);
    });
    
    // Keep alive
    process.stdin.resume();
    
  } catch (error) {
    colorLog(`\n❌ Setup failed: ${error.message}`, 'red');
    colorLog('\n🔧 Troubleshooting steps:', 'yellow');
    colorLog('1. Make sure Node.js 16+ is installed', 'yellow');
    colorLog('2. Check if you have write permissions in this directory', 'yellow');
    colorLog('3. Try running: npm install -g kill-port', 'yellow');
    colorLog('4. Restart your terminal and try again', 'yellow');
    colorLog('5. Check the SIGNUP_TROUBLESHOOTING.md file for more help', 'yellow');
    process.exit(1);
  }
}

main().catch(console.error);