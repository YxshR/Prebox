#!/usr/bin/env ts-node

/**
 * Demo User Seeding Script
 * 
 * This script creates demo users for testing the bulk email platform
 * with different subscription tiers and verification states.
 */

import { AuthService } from '../src/auth/auth.service';
import { UserRegistration, SubscriptionTier } from '../src/shared/types';
import pool from '../src/config/database';

interface DemoUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tier: SubscriptionTier;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  description: string;
}

const demoUsers: DemoUser[] = [
  {
    email: 'demo@bulkemail.com',
    password: 'Demo123!',
    firstName: 'Demo',
    lastName: 'User',
    phone: '+1234567890',
    tier: SubscriptionTier.FREE,
    isEmailVerified: true,
    isPhoneVerified: true,
    description: 'Free tier user - fully verified'
  },
  {
    email: 'standard@bulkemail.com',
    password: 'Standard123!',
    firstName: 'Standard',
    lastName: 'User',
    phone: '+1234567891',
    tier: SubscriptionTier.PAID_STANDARD,
    isEmailVerified: true,
    isPhoneVerified: true,
    description: 'Standard tier user - fully verified'
  },
  {
    email: 'premium@bulkemail.com',
    password: 'Premium123!',
    firstName: 'Premium',
    lastName: 'User',
    phone: '+1234567892',
    tier: SubscriptionTier.PREMIUM,
    isEmailVerified: true,
    isPhoneVerified: false,
    description: 'Premium tier user - email verified only'
  },
  {
    email: 'enterprise@bulkemail.com',
    password: 'Enterprise123!',
    firstName: 'Enterprise',
    lastName: 'User',
    phone: '+1234567893',
    tier: SubscriptionTier.ENTERPRISE,
    isEmailVerified: true,
    isPhoneVerified: true,
    description: 'Enterprise tier user - fully verified'
  },
  {
    email: 'newuser@bulkemail.com',
    password: 'NewUser123!',
    firstName: 'New',
    lastName: 'User',
    tier: SubscriptionTier.FREE,
    isEmailVerified: false,
    isPhoneVerified: false,
    description: 'New user - not verified (for onboarding demo)'
  }
];

async function seedDemoUsers() {
  const authService = new AuthService();
  const client = await pool.connect();

  try {
    console.log('🌱 Starting demo user seeding...\n');

    for (const demoUser of demoUsers) {
      try {
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [demoUser.email]
        );

        if (existingUser.rows.length > 0) {
          console.log(`⚠️  User ${demoUser.email} already exists, skipping...`);
          continue;
        }

        // Register the user
        const userData: UserRegistration = {
          email: demoUser.email,
          password: demoUser.password,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
          phone: demoUser.phone,
          registrationMethod: 'email'
        };

        const user = await authService.register(userData);
        console.log(`✅ Created user: ${demoUser.email}`);

        // Update verification status and subscription tier
        await client.query(`
          UPDATE users 
          SET 
            is_email_verified = $1,
            is_phone_verified = $2,
            subscription_tier = $3
          WHERE id = $4
        `, [
          demoUser.isEmailVerified,
          demoUser.isPhoneVerified,
          demoUser.tier,
          user.id
        ]);

        // Update subscription limits based on tier
        const limits = getTierLimits(demoUser.tier);
        await client.query(`
          UPDATE subscriptions 
          SET 
            plan_id = $1,
            daily_email_limit = $2,
            monthly_recipient_limit = $3,
            monthly_email_limit = $4,
            template_limit = $5,
            custom_domain_limit = $6
          WHERE tenant_id = $7
        `, [
          demoUser.tier,
          limits.dailyEmailLimit,
          limits.monthlyRecipientLimit,
          limits.monthlyEmailLimit,
          limits.templateLimit,
          limits.customDomainLimit,
          user.tenantId
        ]);

        console.log(`   📊 Tier: ${demoUser.tier}`);
        console.log(`   ✉️  Email verified: ${demoUser.isEmailVerified}`);
        console.log(`   📱 Phone verified: ${demoUser.isPhoneVerified}`);
        console.log(`   📝 ${demoUser.description}\n`);

      } catch (error) {
        console.error(`❌ Failed to create user ${demoUser.email}:`, error);
      }
    }

    console.log('🎉 Demo user seeding completed!\n');
    console.log('📋 Demo Login Credentials:');
    console.log('=' .repeat(50));
    
    demoUsers.forEach(user => {
      console.log(`\n👤 ${user.firstName} ${user.lastName} (${user.tier})`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Description: ${user.description}`);
    });

    console.log('\n' + '=' .repeat(50));
    console.log('🚀 You can now login with any of these credentials!');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('🔧 Backend: http://localhost:8000');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

function getTierLimits(tier: SubscriptionTier) {
  switch (tier) {
    case SubscriptionTier.FREE:
      return {
        dailyEmailLimit: 100,
        monthlyRecipientLimit: 300,
        monthlyEmailLimit: 2000,
        templateLimit: 1,
        customDomainLimit: 0
      };
    case SubscriptionTier.PAID_STANDARD:
      return {
        dailyEmailLimit: 1000,
        monthlyRecipientLimit: 5000,
        monthlyEmailLimit: 30000,
        templateLimit: 10,
        customDomainLimit: 1
      };
    case SubscriptionTier.PREMIUM:
      return {
        dailyEmailLimit: 5000,
        monthlyRecipientLimit: 25000,
        monthlyEmailLimit: 100000,
        templateLimit: -1, // Unlimited
        customDomainLimit: 10
      };
    case SubscriptionTier.ENTERPRISE:
      return {
        dailyEmailLimit: -1, // Unlimited
        monthlyRecipientLimit: -1, // Unlimited
        monthlyEmailLimit: -1, // Unlimited
        templateLimit: -1, // Unlimited
        customDomainLimit: -1 // Unlimited
      };
    default:
      return {
        dailyEmailLimit: 100,
        monthlyRecipientLimit: 300,
        monthlyEmailLimit: 2000,
        templateLimit: 1,
        customDomainLimit: 0
      };
  }
}

// Run the seeding script
if (require.main === module) {
  seedDemoUsers().catch(console.error);
}

export { seedDemoUsers, demoUsers };