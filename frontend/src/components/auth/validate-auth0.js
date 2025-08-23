// Simple validation script to check Auth0 components
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Auth0 components...');

// Check if all required files exist
const requiredFiles = [
  'Auth0SignupFlow.tsx',
  'Auth0Callback.tsx', 
  'PhoneVerificationForAuth0.tsx',
  'Auth0Provider.tsx',
  'Auth0_README.md'
];

const authDir = __dirname;
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(authDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    allFilesExist = false;
  }
});

// Check if components are exported in index.ts
const indexPath = path.join(authDir, 'index.ts');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  const requiredExports = [
    'Auth0SignupFlow',
    'Auth0Callback',
    'PhoneVerificationForAuth0',
    'Auth0ProviderWrapper'
  ];
  
  requiredExports.forEach(exportName => {
    if (indexContent.includes(exportName)) {
      console.log(`✅ ${exportName} exported in index.ts`);
    } else {
      console.log(`❌ ${exportName} not exported in index.ts`);
      allFilesExist = false;
    }
  });
} else {
  console.log('❌ index.ts missing');
  allFilesExist = false;
}

// Check if Auth0 lib exists
const auth0LibPath = path.join(__dirname, '../../lib/auth0.ts');
if (fs.existsSync(auth0LibPath)) {
  console.log('✅ Auth0 lib configuration exists');
} else {
  console.log('❌ Auth0 lib configuration missing');
  allFilesExist = false;
}

// Check if demo page exists
const demoPagePath = path.join(__dirname, '../../app/auth0-demo/page.tsx');
if (fs.existsSync(demoPagePath)) {
  console.log('✅ Auth0 demo page exists');
} else {
  console.log('❌ Auth0 demo page missing');
  allFilesExist = false;
}

// Check if callback page exists
const callbackPagePath = path.join(__dirname, '../../app/auth/callback/page.tsx');
if (fs.existsSync(callbackPagePath)) {
  console.log('✅ Auth0 callback page exists');
} else {
  console.log('❌ Auth0 callback page missing');
  allFilesExist = false;
}

if (allFilesExist) {
  console.log('\n🎉 All Auth0 components validated successfully!');
  console.log('\n📋 Summary:');
  console.log('- Auth0SignupFlow: Main signup component with Auth0 integration');
  console.log('- Auth0Callback: Handles Auth0 authentication redirects');
  console.log('- PhoneVerificationForAuth0: Phone verification for Auth0 users');
  console.log('- Auth0ProviderWrapper: Auth0 context provider');
  console.log('- Demo page: /auth0-demo for testing');
  console.log('- Callback page: /auth/callback for Auth0 redirects');
  console.log('\n🔧 Next steps:');
  console.log('1. Configure Auth0 environment variables');
  console.log('2. Set up Auth0 application in Auth0 dashboard');
  console.log('3. Test the signup flow at /auth0-demo');
} else {
  console.log('\n❌ Some Auth0 components are missing or not properly configured');
  process.exit(1);
}