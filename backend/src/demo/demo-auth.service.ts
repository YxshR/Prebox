/**
 * Demo Auth Service
 * 
 * This service provides authentication functionality for demo purposes
 * without requiring a database connection.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { 
  User, 
  LoginCredentials, 
  AuthToken,
  UserRole,
  SubscriptionTier 
} from '../shared/types';

export class DemoAuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'demo-jwt-secret-key-for-testing-only';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'demo-refresh-secret-key-for-testing-only';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  private demoUsers: any[] = [];

  constructor() {
    this.loadDemoUsers();
  }

  private loadDemoUsers() {
    try {
      const demoUsersPath = path.join(__dirname, 'demo-users.json');
      if (fs.existsSync(demoUsersPath)) {
        const data = fs.readFileSync(demoUsersPath, 'utf8');
        this.demoUsers = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load demo users:', error);
      // Fallback demo users
      this.demoUsers = [
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
        }
      ];
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const user = this.demoUsers.find(u => u.email === credentials.email);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // For demo purposes, we'll do a simple password check
    // In production, this would use bcrypt.compare with hashed passwords
    if (user.password !== credentials.password) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    user.lastLoginAt = new Date().toISOString();

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: this.mapToUser(user)
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as any;
      
      const user = this.demoUsers.find(u => u.id === decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      return this.mapToUser(user);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as any;
      
      const user = this.demoUsers.find(u => u.id === decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60,
        user: this.mapToUser(user)
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  private generateAccessToken(user: any): string {
    const payload = { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId 
    };
    
    const secret = this.JWT_SECRET as jwt.Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_EXPIRES_IN as string };
    
    return jwt.sign(payload, secret, options);
  }

  private generateRefreshToken(user: any): string {
    const payload = { userId: user.id };
    const secret = this.JWT_REFRESH_SECRET as jwt.Secret;
    const options: jwt.SignOptions = { expiresIn: this.JWT_REFRESH_EXPIRES_IN as string };
    
    return jwt.sign(payload, secret, options);
  }

  private mapToUser(userData: any): User {
    return {
      id: userData.id,
      email: userData.email,
      phone: userData.phone,
      firstName: userData.firstName,
      lastName: userData.lastName,
      tenantId: userData.tenantId,
      role: userData.role as UserRole,
      subscriptionTier: userData.subscriptionTier as SubscriptionTier,
      isEmailVerified: userData.isEmailVerified,
      isPhoneVerified: userData.isPhoneVerified,
      googleId: userData.googleId,
      createdAt: new Date(userData.createdAt),
      lastLoginAt: new Date(userData.lastLoginAt)
    };
  }

  // Get all demo users for testing
  getDemoUsers(): User[] {
    return this.demoUsers.map(user => this.mapToUser(user));
  }
}