// Simple script to reset the circuit breaker and test API connection
const { apiCircuitBreaker } = require('./src/lib/retry');

console.log('Current circuit breaker state:', apiCircuitBreaker.getState());
console.log('Failure count:', apiCircuitBreaker.getFailureCount());

// Reset the circuit breaker
apiCircuitBreaker.reset();

console.log('Circuit breaker reset!');
console.log('New state:', apiCircuitBreaker.getState());

// Test API connection
async function testConnection() {
  try {
    const response = await fetch('http://localhost:3001/api/health');
    const data = await response.json();
    console.log('API Health Check:', data);
  } catch (error) {
    console.error('API connection test failed:', error.message);
  }
}

testConnection();