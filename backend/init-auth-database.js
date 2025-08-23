#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Initializing Authentication Database Schema...\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  No .env file found. Creating from .env.example...');
  const envExamplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Created .env file from .env.example');
    console.log('📝 Please update the .env file with your actual database credentials\n');
  } else {
    console.error('❌ No .env.example file found');
    process.exit(1);
  }
}

try {
  // Build TypeScript files
  console.log('🔨 Building TypeScript files...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  
  // Run database initialization
  console.log('\n🗄️  Initializing database...');
  execSync('npx ts-node src/database/init-database.ts init', { 
    stdio: 'inherit', 
    cwd: __dirname 
  });
  
  console.log('\n✅ Database initialization completed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Update your .env file with actual service credentials');
  console.log('2. Test the database connection: npm run db:status');
  console.log('3. Start the development server: npm run dev');
  
} catch (error) {
  console.error('\n❌ Database initialization failed:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Ensure PostgreSQL is running');
  console.log('2. Check database credentials in .env file');
  console.log('3. Verify database exists and user has proper permissions');
  console.log('4. Run: npm run db:status to check connection');
  process.exit(1);
}