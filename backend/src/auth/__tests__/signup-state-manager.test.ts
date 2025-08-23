/**
 * Signup State Manager Unit Tests
 * 
 * Tests the signup state management functionality including:
 * - Creating and managing signup states
 * - State transitions
 * - Expiration handling
 * - Duplicate checking
 */

import { SignupStateManager, SignupStep } from '../services/signup-state-manager.service';
import redisClient from '../../config/redis';

describe('SignupStateManager', () => {
  let stateManager: SignupStateManager;

  beforeAll(async () => {
    stateManager = new SignupStateManager();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clean up Redis before each test
    const keys = await redisClient.keys('signup_state:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  afterEach(async () => {
    // Clean up Redis after each test
    const keys = await redisClient.keys('signup_state:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  describe('createSignupState', () => {
    it('should create a new signup state successfully', async () => {
      const input = {
        phone: '+1234567890',
        metadata: { source: 'test' }
      };

      const state = await stateManager.createSignupState(input);

      expect(state).toBeDefined();
      expect(state.id).toBeDefined();
      expect(state.phone).toBe(input.phone);
      expect(state.currentStep).toBe(SignupStep.PHONE_VERIFICATION);
      expect(state.phoneVerified).toBe(false);
      expect(state.emailVerified).toBe(false);
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.expiresAt).toBeInstanceOf(Date);
      expect(state.metadata).toEqual(input.metadata);

      // Verify expiration is set correctly (24 hours from now)
      const expectedExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(state.expiresAt.getTime() - expectedExpiry.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should create state with email', async () => {
      const input = {
        email: 'test@example.com'
      };

      const state = await stateManager.createSignupState(input);

      expect(state.email).toBe(input.email);
      expect(state.phone).toBeUndefined();
    });

    it('should create state with default metadata if not provided', async () => {
      const input = {
        phone: '+1234567890'
      };

      const state = await stateManager.createSignupState(input);

      expect(state.metadata).toEqual({});
    });
  });

  describe('getSignupState', () => {
    it('should retrieve existing signup state', async () => {
      const input = {
        phone: '+1234567890',
        email: 'test@example.com'
      };

      const createdState = await stateManager.createSignupState(input);
      const retrievedState = await stateManager.getSignupState(createdState.id);

      expect(retrievedState).toBeDefined();
      expect(retrievedState!.id).toBe(createdState.id);
      expect(retrievedState!.phone).toBe(input.phone);
      expect(retrievedState!.email).toBe(input.email);
      expect(retrievedState!.currentStep).toBe(SignupStep.PHONE_VERIFICATION);
    });

    it('should return null for non-existent state', async () => {
      const nonExistentId = 'non-existent-id';
      const state = await stateManager.getSignupState(nonExistentId);

      expect(state).toBeNull();
    });

    it('should return null for expired state and clean it up', async () => {
      // Create a state
      const input = { phone: '+1234567890' };
      const createdState = await stateManager.createSignupState(input);

      // Manually expire the state by setting TTL to 1 second
      const key = `signup_state:${createdState.id}`;
      await redisClient.expire(key, 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const retrievedState = await stateManager.getSignupState(createdState.id);
      expect(retrievedState).toBeNull();
    });
  });

  describe('updateSignupState', () => {
    let stateId: string;

    beforeEach(async () => {
      const input = {
        phone: '+1234567890',
        email: 'test@example.com'
      };
      const state = await stateManager.createSignupState(input);
      stateId = state.id;
    });

    it('should update signup state successfully', async () => {
      const updateInput = {
        currentStep: SignupStep.EMAIL_VERIFICATION,
        phoneVerified: true,
        metadata: { updated: true }
      };

      const updatedState = await stateManager.updateSignupState(stateId, updateInput);

      expect(updatedState.currentStep).toBe(SignupStep.EMAIL_VERIFICATION);
      expect(updatedState.phoneVerified).toBe(true);
      expect(updatedState.metadata).toEqual({ updated: true });

      // Verify the update persisted
      const retrievedState = await stateManager.getSignupState(stateId);
      expect(retrievedState!.currentStep).toBe(SignupStep.EMAIL_VERIFICATION);
      expect(retrievedState!.phoneVerified).toBe(true);
    });

    it('should preserve original timestamps when updating', async () => {
      const originalState = await stateManager.getSignupState(stateId);
      const originalCreatedAt = originalState!.createdAt;
      const originalExpiresAt = originalState!.expiresAt;

      await stateManager.updateSignupState(stateId, {
        phoneVerified: true
      });

      const updatedState = await stateManager.getSignupState(stateId);
      expect(updatedState!.createdAt).toEqual(originalCreatedAt);
      expect(updatedState!.expiresAt).toEqual(originalExpiresAt);
    });

    it('should throw error for non-existent state', async () => {
      const nonExistentId = 'non-existent-id';

      await expect(
        stateManager.updateSignupState(nonExistentId, { phoneVerified: true })
      ).rejects.toThrow('Signup state not found or expired');
    });
  });

  describe('markPhoneVerified', () => {
    it('should mark phone as verified and advance to email step', async () => {
      const input = { phone: '+1234567890' };
      const state = await stateManager.createSignupState(input);

      const updatedState = await stateManager.markPhoneVerified(state.id);

      expect(updatedState.phoneVerified).toBe(true);
      expect(updatedState.currentStep).toBe(SignupStep.EMAIL_VERIFICATION);
    });
  });

  describe('markEmailVerified', () => {
    it('should mark email as verified and advance to password step', async () => {
      const input = { phone: '+1234567890', email: 'test@example.com' };
      const state = await stateManager.createSignupState(input);

      // First mark phone as verified
      await stateManager.markPhoneVerified(state.id);

      // Then mark email as verified
      const updatedState = await stateManager.markEmailVerified(state.id);

      expect(updatedState.emailVerified).toBe(true);
      expect(updatedState.currentStep).toBe(SignupStep.PASSWORD_CREATION);
    });
  });

  describe('completeSignup', () => {
    it('should complete signup with password hash', async () => {
      const input = { phone: '+1234567890', email: 'test@example.com' };
      const state = await stateManager.createSignupState(input);
      const passwordHash = 'hashed-password';

      const updatedState = await stateManager.completeSignup(state.id, passwordHash);

      expect(updatedState.passwordHash).toBe(passwordHash);
      expect(updatedState.currentStep).toBe(SignupStep.COMPLETED);
    });
  });

  describe('deleteSignupState', () => {
    it('should delete signup state successfully', async () => {
      const input = { phone: '+1234567890' };
      const state = await stateManager.createSignupState(input);

      const deleted = await stateManager.deleteSignupState(state.id);
      expect(deleted).toBe(true);

      // Verify state is gone
      const retrievedState = await stateManager.getSignupState(state.id);
      expect(retrievedState).toBeNull();
    });

    it('should return false for non-existent state', async () => {
      const nonExistentId = 'non-existent-id';
      const deleted = await stateManager.deleteSignupState(nonExistentId);
      expect(deleted).toBe(false);
    });
  });

  describe('getSignupStateByPhone', () => {
    it('should find signup state by phone number', async () => {
      const phone = '+1234567890';
      const input = { phone };
      const createdState = await stateManager.createSignupState(input);

      const foundState = await stateManager.getSignupStateByPhone(phone);

      expect(foundState).toBeDefined();
      expect(foundState!.id).toBe(createdState.id);
      expect(foundState!.phone).toBe(phone);
    });

    it('should return null if no state found for phone', async () => {
      const phone = '+9999999999';
      const foundState = await stateManager.getSignupStateByPhone(phone);

      expect(foundState).toBeNull();
    });

    it('should ignore expired states when searching by phone', async () => {
      const phone = '+1234567890';
      const input = { phone };
      const createdState = await stateManager.createSignupState(input);

      // Manually expire the state
      const key = `signup_state:${createdState.id}`;
      await redisClient.expire(key, 1);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const foundState = await stateManager.getSignupStateByPhone(phone);
      expect(foundState).toBeNull();
    });
  });

  describe('getSignupStateByEmail', () => {
    it('should find signup state by email address', async () => {
      const email = 'test@example.com';
      const input = { email };
      const createdState = await stateManager.createSignupState(input);

      const foundState = await stateManager.getSignupStateByEmail(email);

      expect(foundState).toBeDefined();
      expect(foundState!.id).toBe(createdState.id);
      expect(foundState!.email).toBe(email);
    });

    it('should return null if no state found for email', async () => {
      const email = 'notfound@example.com';
      const foundState = await stateManager.getSignupStateByEmail(email);

      expect(foundState).toBeNull();
    });
  });

  describe('validateStepTransition', () => {
    it('should allow valid step transitions', async () => {
      const validTransitions = [
        [SignupStep.PHONE_VERIFICATION, SignupStep.EMAIL_VERIFICATION],
        [SignupStep.EMAIL_VERIFICATION, SignupStep.PASSWORD_CREATION],
        [SignupStep.PASSWORD_CREATION, SignupStep.COMPLETED]
      ];

      validTransitions.forEach(([current, target]) => {
        const isValid = stateManager.validateStepTransition(current, target);
        expect(isValid).toBe(true);
      });
    });

    it('should reject invalid step transitions', async () => {
      const invalidTransitions = [
        [SignupStep.PHONE_VERIFICATION, SignupStep.PASSWORD_CREATION], // Skipping email
        [SignupStep.EMAIL_VERIFICATION, SignupStep.COMPLETED], // Skipping password
        [SignupStep.PASSWORD_CREATION, SignupStep.PHONE_VERIFICATION], // Going backwards
        [SignupStep.COMPLETED, SignupStep.EMAIL_VERIFICATION] // Going backwards
      ];

      invalidTransitions.forEach(([current, target]) => {
        const isValid = stateManager.validateStepTransition(current, target);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should clean up expired states', async () => {
      // Create multiple states
      const state1 = await stateManager.createSignupState({ phone: '+1111111111' });
      const state2 = await stateManager.createSignupState({ phone: '+2222222222' });
      const state3 = await stateManager.createSignupState({ phone: '+3333333333' });

      // Expire first two states
      await redisClient.expire(`signup_state:${state1.id}`, 1);
      await redisClient.expire(`signup_state:${state2.id}`, 1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const cleanedCount = await stateManager.cleanupExpiredStates();

      expect(cleanedCount).toBe(2);

      // Verify only the third state remains
      const remainingState = await stateManager.getSignupState(state3.id);
      expect(remainingState).toBeDefined();

      const expiredState1 = await stateManager.getSignupState(state1.id);
      const expiredState2 = await stateManager.getSignupState(state2.id);
      expect(expiredState1).toBeNull();
      expect(expiredState2).toBeNull();
    });

    it('should return 0 when no expired states exist', async () => {
      // Create a fresh state
      await stateManager.createSignupState({ phone: '+1234567890' });

      const cleanedCount = await stateManager.cleanupExpiredStates();
      expect(cleanedCount).toBe(0);
    });
  });
});