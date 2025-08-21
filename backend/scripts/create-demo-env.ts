#!/usr/bin/env ts-node

/**
 * Create Demo Environment
 * 
 * This script creates a simple demo environment without requiring
 * a full database setup. It creates mock users for frontend testing.
 */

import fs from 'fs';
import path from 'path';

const demoUsers = [
  {
    id: 'demo-user-1',
    email: 'demo@bulkemail.com',
    password: 'Demo123!',
    firstName: 'Demo',
    lastName: 'User',
    phone: '+1234567890',
    tenantId: 'tenant-1',
    role: 'user',
    subscriptionTier: 'free',
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    id: 'demo-user-2',
    email: 'standard@bulkemail.com',
    password: 'Standard123!',
    firstName: 'Standard',
    lastName: 'User',
    phone: '+1234567891',
    tenantId: 'tenant-2',
    role: 'user',
    subscriptionTier: 'paid_standard',
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    id: 'demo-user-3',
    email: 'premium@bulkemail.com',
    password: 'Premium123!',
    firstName: 'Premium',
    lastName: 'User',
    phone: '+1234567892',
    tenantId: 'tenant-3',
    role: 'user',
    subscriptionTier: 'premium',
    isEmailVerified: true,
    isPhoneVerified: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    id: 'demo-user-4',
    email: 'enterprise@bulkemail.com',
    password: 'Enterprise123!',
    firstName: 'Enterprise',
    lastName: 'User',
    phone: '+1234567893',
    tenantId: 'tenant-4',
    role: 'user',
    subscriptionTier: 'enterprise',
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    id: 'demo-user-5',
    email: 'newuser@bulkemail.com',
    password: 'NewUser123!',
    firstName: 'New',
    lastName: 'User',
    tenantId: 'tenant-5',
    role: 'user',
    subscriptionTier: 'free',
    isEmailVerified: false,
    isPhoneVerified: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  }
];

function createDemoEnvironment() {
  console.log('🎭 Creating Demo Environment...\n');

  // Create demo users file
  const demoUsersPath = path.join(__dirname, '../src/demo/demo-users.json');
  const demoDir = path.dirname(demoUsersPath);
  
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  fs.writeFileSync(demoUsersPath, JSON.stringify(demoUsers, null, 2));
  console.log('✅ Created demo users file');

  // Create .env file for demo
  const envPath = path.join(__dirname, '../.env');
  const envContent = `# Demo Environment Configuration
NODE_ENV=development
PORT=8000

# JWT Configuration
JWT_SECRET=demo-jwt-secret-key-for-testing-only
JWT_REFRESH_SECRET=demo-refresh-secret-key-for-testing-only
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Demo Mode (no database required)
DEMO_MODE=true

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file for demo mode');

  console.log('\n🎉 Demo environment created successfully!');
  console.log('\n📋 Demo Login Credentials:');
  console.log('=' .repeat(50));
  
  demoUsers.forEach(user => {
    const tierEmoji = {
      'free': '🆓',
      'paid_standard': '📊',
      'premium': '💎',
      'enterprise': '🏢'
    }[user.subscriptionTier] || '👤';
    
    console.log(`\n${tierEmoji} ${user.firstName} ${user.lastName} (${user.subscriptionTier})`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${user.password}`);
    console.log(`   Verified: Email ${user.isEmailVerified ? '✅' : '❌'}, Phone ${user.isPhoneVerified ? '✅' : '❌'}`);
  });

  console.log('\n' + '=' .repeat(50));
  console.log('🚀 Start the backend with: npm run dev');
  console.log('🌐 Frontend will be available at: http://localhost:3000');
}

if (require.main === module) {
  createDemoEnvironment();
}

export { createDemoEnvironment, demoUsers };