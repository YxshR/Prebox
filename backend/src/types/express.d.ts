import { User, UserRole, SubscriptionTier } from '../shared/types';
import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      phone?: string;
      firstName?: string;
      lastName?: string;
      tenantId: string;
      role: UserRole;
      subscriptionTier: SubscriptionTier;
      isEmailVerified: boolean;
      isPhoneVerified: boolean;
      googleId?: string;
      auth0Id?: string;
      createdAt: Date;
      lastLoginAt: Date;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  validatedPricing?: {
    planId: string;
    amount: number;
    currency: string;
    plan: any;
  };
  pricingData?: any;
}

export {};