const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testHealthEndpoints() {
  console.log('🔍 Testing Enhanced Health Monitoring Endpoints...\n');

  const endpoints = [
    { name: 'Basic Health Check', url: '/health' },
    { name: 'Enhanced Health Check', url: '/health/enhanced' },
    { name: 'Startup Diagnostics', url: '/health/startup' },
    { name: 'Service Dependencies', url: '/health/dependencies' },
    { name: 'System Information', url: '/health/system-info' },
    { name: 'Connection Status', url: '/health/connection' },
    { name: 'Detailed Health', url: '/health/detailed' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint.name}...`);
      const response = await axios.get(`${BASE_URL}${endpoint.url}`);
      
      console.log(`✅ ${endpoint.name}: Status ${response.status}`);
      
      if (endpoint.url === '/health/startup') {
        const diagnostics = response.data.data.diagnostics;
        console.log(`   📊 Startup Diagnostics: ${diagnostics.length} total`);
        diagnostics.forEach(d => {
          const icon = d.status === 'success' ? '✅' : d.status === 'warning' ? '⚠️' : '❌';
          console.log(`   ${icon} ${d.service}: ${d.message}`);
        });
      }
      
      if (endpoint.url === '/health/enhanced') {
        const health = response.data.data;
        console.log(`   📊 Overall Status: ${health.overall}`);
        console.log(`   📊 Services: ${Object.keys(health.services).length}`);
        console.log(`   📊 Dependencies: ${Object.keys(health.dependencies).length}`);
      }
      
      console.log('');
    } catch (error) {
      console.log(`❌ ${endpoint.name}: Error ${error.response?.status || 'Network Error'}`);
      if (error.response?.data) {
        console.log(`   Error: ${error.response.data.error?.message || 'Unknown error'}`);
      }
      console.log('');
    }
  }

  // Test startup validation trigger
  try {
    console.log('Testing Startup Validation Trigger...');
    const response = await axios.post(`${BASE_URL}/health/validate`);
    console.log(`✅ Startup Validation Trigger: Status ${response.status}`);
    const summary = response.data.data.summary;
    console.log(`   📊 Results: ${summary.success} success, ${summary.warnings} warnings, ${summary.errors} errors`);
    console.log('');
  } catch (error) {
    console.log(`❌ Startup Validation Trigger: Error ${error.response?.status || 'Network Error'}`);
    console.log('');
  }
}

// Run the tests
testHealthEndpoints().catch(console.error);