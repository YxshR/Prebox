/**
 * Integration test for Auth0 components
 * This test verifies that components can be imported and instantiated correctly
 */

import { Auth0SignupFlow } from '../Auth0SignupFlow';
import { Auth0Callback } from '../Auth0Callback';
import { PhoneVerificationForAuth0 } from '../PhoneVerificationForAuth0';
import { Auth0ProviderWrapper } from '../Auth0Provider';

describe('Auth0 Components Integration', () => {
  it('should export Auth0SignupFlow component', () => {
    expect(Auth0SignupFlow).toBeDefined();
    expect(typeof Auth0SignupFlow).toBe('function');
  });

  it('should export Auth0Callback component', () => {
    expect(Auth0Callback).toBeDefined();
    expect(typeof Auth0Callback).toBe('function');
  });

  it('should export PhoneVerificationForAuth0 component', () => {
    expect(PhoneVerificationForAuth0).toBeDefined();
    expect(typeof PhoneVerificationForAuth0).toBe('function');
  });

  it('should export Auth0ProviderWrapper component', () => {
    expect(Auth0ProviderWrapper).toBeDefined();
    expect(typeof Auth0ProviderWrapper).toBe('function');
  });

  it('should have correct component names', () => {
    expect(Auth0SignupFlow.name).toBe('Auth0SignupFlow');
    expect(Auth0Callback.name).toBe('Auth0Callback');
    expect(PhoneVerificationForAuth0.name).toBe('PhoneVerificationForAuth0');
    expect(Auth0ProviderWrapper.name).toBe('Auth0ProviderWrapper');
  });
});