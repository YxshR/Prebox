#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Preparing deployment...\n');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Make sure you\'re in the project root.');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (packageJson.name !== 'bulk-email-platform') {
  console.error('❌ Error: Not in the bulk-email-platform root directory.');
  process.exit(1);
}

console.log('✅ Project root directory confirmed\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`📋 Node.js version: ${nodeVersion}`);

const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.warn('⚠️  Warning: Node.js 18+ is recommended for deployment');
}

// Check if required directories exist
const requiredDirs = ['frontend', 'admin-frontend', 'backend', 'shared'];
const missingDirs = requiredDirs.filter(dir => !fs.existsSync(dir));

if (missingDirs.length > 0) {
  console.error(`❌ Error: Missing directories: ${missingDirs.join(', ')}`);
  process.exit(1);
}

console.log('✅ All required directories found\n');

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('✅ Root dependencies installed\n');
} catch (error) {
  console.error('❌ Error installing root dependencies');
  process.exit(1);
}

// Install frontend dependencies
console.log('📦 Installing frontend dependencies...');
try {
  execSync('cd frontend && npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('✅ Frontend dependencies installed\n');
} catch (error) {
  console.error('❌ Error installing frontend dependencies');
  process.exit(1);
}

// Install admin-frontend dependencies
console.log('📦 Installing admin-frontend dependencies...');
try {
  execSync('cd admin-frontend && npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('✅ Admin-frontend dependencies installed\n');
} catch (error) {
  console.error('❌ Error installing admin-frontend dependencies');
  process.exit(1);
}

// Build shared package
console.log('🔨 Building shared package...');
try {
  execSync('cd shared && npm install && npm run build', { stdio: 'inherit' });
  console.log('✅ Shared package built\n');
} catch (error) {
  console.error('❌ Error building shared package');
  process.exit(1);
}

// Test frontend build
console.log('🧪 Testing frontend build...');
try {
  execSync('cd frontend && npm run build', { stdio: 'inherit' });
  console.log('✅ Frontend build successful\n');
} catch (error) {
  console.error('❌ Frontend build failed');
  console.log('Check the error above and fix any issues before deploying');
  process.exit(1);
}

// Test admin-frontend build
console.log('🧪 Testing admin-frontend build...');
try {
  execSync('cd admin-frontend && npm run build', { stdio: 'inherit' });
  console.log('✅ Admin-frontend build successful\n');
} catch (error) {
  console.error('❌ Admin-frontend build failed');
  console.log('Check the error above and fix any issues before deploying');
  process.exit(1);
}

console.log('🎉 Deployment preparation complete!\n');
console.log('📋 Next steps:');
console.log('1. Deploy frontend: Set root directory to "frontend" in Vercel');
console.log('2. Deploy admin-frontend: Set root directory to "admin-frontend" in Vercel');
console.log('3. Deploy backend on Railway, Render, or similar platform');
console.log('4. Configure environment variables for each deployment');
console.log('\n📖 See DEPLOYMENT.md for detailed instructions');