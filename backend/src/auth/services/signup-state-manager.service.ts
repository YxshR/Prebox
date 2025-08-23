/**
 * Signup State Management Service
 * 
 * This service manages the multi-step phone signup flow state,
 * tracking progress through phone verification, email verification, and password creation.
 */

import { v4 as uuidv4 } from 'uuid';
import redisClient from '../../config/redis';
import { logger } from '../../shared/logger';

export enum SignupStep {
  PHONE_VERIFICATION = 'phone_verification',
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_CREATION = 'password_creation',
  COMPLETED = 'completed'
}

export interface SignupState {
  id: string;
  currentStep: SignupStep;
  phone?: string;
  phoneVerified: boolean;
  email?: string;
  emailVerified: boolean;
  passwordHash?: string;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

export interface CreateSignupStateInput {
  phone?: string;
  email?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSignupStateInput {
  currentStep?: SignupStep;
  phone?: string;
  phoneVerified?: boolean;
  email?: string;
  emailVerified?: boolean;
  passwordHash?: string;
  metadata?: Record<string, any>;
}

export class SignupStateManager {
  private readonly STATE_EXPIRY_HOURS = 24; // 24 hours to complete signup
  private readonly REDIS_PREFIX = 'signup_state:';

  /**
   * Create a new signup state for multi-step flow
   */
  async createSignupState(input: CreateSignupStateInput): Promise<SignupState> {
    try {
      const id = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.STATE_EXPIRY_HOURS * 60 * 60 * 1000);

      const state: SignupState = {
        id,
        currentStep: SignupStep.PHONE_VERIFICATION,
        phone: input.phone,
        phoneVerified: false,
        email: input.email,
        emailVerified: false,
        createdAt: now,
        expiresAt,
        metadata: input.metadata || {}
      };

      // Store in Redis with expiration
      const key = this.getRedisKey(id);
      await redisClient.setEx(
        key,
        this.STATE_EXPIRY_HOURS * 60 * 60,
        JSON.stringify(state)
      );

      logger.info(`Created signup state ${id} for phone: ${input.phone}`);
      return state;
    } catch (error) {
      logger.error('Error creating signup state:', error);
      throw new Error('Failed to create signup state');
    }
  }

  /**
   * Get signup state by ID
   */
  async getSignupState(id: string): Promise<SignupState | null> {
    try {
      const key = this.getRedisKey(id);
      const stateData = await redisClient.get(key);

      if (!stateData) {
        return null;
      }

      const state = JSON.parse(stateData) as SignupState;
      
      // Convert date strings back to Date objects
      state.createdAt = new Date(state.createdAt);
      state.expiresAt = new Date(state.expiresAt);

      // Check if expired
      if (state.expiresAt < new Date()) {
        await this.deleteSignupState(id);
        return null;
      }

      return state;
    } catch (error) {
      logger.error('Error getting signup state:', error);
      return null;
    }
  }

  /**
   * Update signup state
   */
  async updateSignupState(id: string, input: UpdateSignupStateInput): Promise<SignupState> {
    try {
      const existingState = await this.getSignupState(id);
      if (!existingState) {
        throw new Error('Signup state not found or expired');
      }

      const updatedState: SignupState = {
        ...existingState,
        ...input,
        // Preserve original timestamps
        createdAt: existingState.createdAt,
        expiresAt: existingState.expiresAt
      };

      // Store updated state
      const key = this.getRedisKey(id);
      const remainingTTL = await redisClient.ttl(key);
      
      if (remainingTTL > 0) {
        await redisClient.setEx(key, remainingTTL, JSON.stringify(updatedState));
      } else {
        // Fallback to default expiry if TTL is not available
        await redisClient.setEx(
          key,
          this.STATE_EXPIRY_HOURS * 60 * 60,
          JSON.stringify(updatedState)
        );
      }

      logger.info(`Updated signup state ${id}, step: ${updatedState.currentStep}`);
      return updatedState;
    } catch (error) {
      logger.error('Error updating signup state:', error);
      throw error;
    }
  }

  /**
   * Mark phone as verified and advance to email verification step
   */
  async markPhoneVerified(id: string): Promise<SignupState> {
    return this.updateSignupState(id, {
      phoneVerified: true,
      currentStep: SignupStep.EMAIL_VERIFICATION
    });
  }

  /**
   * Mark email as verified and advance to password creation step
   */
  async markEmailVerified(id: string): Promise<SignupState> {
    return this.updateSignupState(id, {
      emailVerified: true,
      currentStep: SignupStep.PASSWORD_CREATION
    });
  }

  /**
   * Complete signup by setting password and marking as completed
   */
  async completeSignup(id: string, passwordHash: string): Promise<SignupState> {
    return this.updateSignupState(id, {
      passwordHash,
      currentStep: SignupStep.COMPLETED
    });
  }

  /**
   * Delete signup state (cleanup)
   */
  async deleteSignupState(id: string): Promise<boolean> {
    try {
      const key = this.getRedisKey(id);
      const result = await redisClient.del(key);
      
      logger.info(`Deleted signup state ${id}`);
      return result > 0;
    } catch (error) {
      logger.error('Error deleting signup state:', error);
      return false;
    }
  }

  /**
   * Get signup state by phone number (for duplicate checking)
   */
  async getSignupStateByPhone(phone: string): Promise<SignupState | null> {
    try {
      // This is not efficient for large scale, but works for the current implementation
      // In production, consider using a separate index or database table
      const pattern = `${this.REDIS_PREFIX}*`;
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        const stateData = await redisClient.get(key);
        if (stateData) {
          const state = JSON.parse(stateData) as SignupState;
          if (state.phone === phone) {
            // Convert date strings back to Date objects
            state.createdAt = new Date(state.createdAt);
            state.expiresAt = new Date(state.expiresAt);

            // Check if expired
            if (state.expiresAt < new Date()) {
              await redisClient.del(key);
              continue;
            }

            return state;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting signup state by phone:', error);
      return null;
    }
  }

  /**
   * Get signup state by email (for duplicate checking)
   */
  async getSignupStateByEmail(email: string): Promise<SignupState | null> {
    try {
      // This is not efficient for large scale, but works for the current implementation
      // In production, consider using a separate index or database table
      const pattern = `${this.REDIS_PREFIX}*`;
      const keys = await redisClient.keys(pattern);

      for (const key of keys) {
        const stateData = await redisClient.get(key);
        if (stateData) {
          const state = JSON.parse(stateData) as SignupState;
          if (state.email === email) {
            // Convert date strings back to Date objects
            state.createdAt = new Date(state.createdAt);
            state.expiresAt = new Date(state.expiresAt);

            // Check if expired
            if (state.expiresAt < new Date()) {
              await redisClient.del(key);
              continue;
            }

            return state;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting signup state by email:', error);
      return null;
    }
  }

  /**
   * Validate that signup state can proceed to next step
   */
  validateStepTransition(currentStep: SignupStep, targetStep: SignupStep): boolean {
    const stepOrder = [
      SignupStep.PHONE_VERIFICATION,
      SignupStep.EMAIL_VERIFICATION,
      SignupStep.PASSWORD_CREATION,
      SignupStep.COMPLETED
    ];

    const currentIndex = stepOrder.indexOf(currentStep);
    const targetIndex = stepOrder.indexOf(targetStep);

    // Can only move forward one step at a time
    return targetIndex === currentIndex + 1;
  }

  /**
   * Cleanup expired signup states (should be called periodically)
   */
  async cleanupExpiredStates(): Promise<number> {
    try {
      const pattern = `${this.REDIS_PREFIX}*`;
      const keys = await redisClient.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const stateData = await redisClient.get(key);
        if (stateData) {
          const state = JSON.parse(stateData) as SignupState;
          const expiresAt = new Date(state.expiresAt);

          if (expiresAt < new Date()) {
            await redisClient.del(key);
            cleanedCount++;
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} expired signup states`);
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up expired states:', error);
      return 0;
    }
  }

  /**
   * Get Redis key for signup state
   */
  private getRedisKey(id: string): string {
    return `${this.REDIS_PREFIX}${id}`;
  }
}