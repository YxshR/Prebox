# Design Document

## Overview

This design document outlines the comprehensive redesign of the Perbox home page to create a premium, engaging user experience with enhanced security, streamlined authentication, and multimedia content. The redesign addresses connection issues, simplifies the signup process to phone-only authentication, and implements robust security measures for user data and pricing protection.

## Architecture

### Frontend Architecture
- **Framework**: Next.js 15 with TypeScript (existing)
- **Styling**: Tailwind CSS with custom animations
- **Animation Library**: Framer Motion (existing)
- **State Management**: Zustand for global state
- **Media Handling**: Next.js Image optimization and video components
- **Form Management**: React Hook Form with validation

### Backend Architecture
- **API Layer**: Express.js with enhanced security middleware
- **Database**: PostgreSQL with new security-focused tables
- **Authentication**: Individual JWT secrets per user
- **Security**: JWT-signed pricing data and server-side validation
- **Media Storage**: Optimized asset delivery for images/videos

### Security Architecture
- **Per-User JWT Secrets**: Individual JWT_SECRET and JWT_REFRESH_SECRET for each user
- **Pricing Protection**: JWT-signed pricing data stored in database
- **OTP Management**: Secure database storage with expiration
- **Server-Side Validation**: All critical operations validated server-side

## Components and Interfaces

### 1. Enhanced Home Page Components

#### HeroSection Component
```typescript
interface HeroSectionProps {
  onSignupClick: () => void;
}
```
- Premium gradient background with animated elements
- Compelling headline with animated text reveals
- High-quality hero video/image showcasing platform capabilities
- Single prominent CTA button for phone signup
- Smooth scroll indicators and micro-interactions

#### MultimediaShowcase Component
```typescript
interface MultimediaShowcaseProps {
  features: FeatureWithMedia[];
  onFeatureSelect: (featureId: string) => void;
}

interface FeatureWithMedia {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  imageUrl: string;
  demoUrl?: string;
}
```
- Interactive feature demonstrations with videos
- Lazy-loaded high-quality images
- Smooth transitions between content sections
- Mobile-optimized media playback

#### AnimatedPricingSection Component
```typescript
interface PricingTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  isPopular?: boolean;
  jwtSignature: string; // Server-signed pricing data
}
```
- JWT-protected pricing display
- Animated price reveals and feature highlights
- Interactive tier comparison
- Secure purchase flow integration

### 2. Streamlined Authentication Components

#### PhoneOnlySignup Component
```typescript
interface PhoneSignupProps {
  onSuccess: (userData: UserRegistrationData) => void;
  onError: (error: AuthError) => void;
}
```
- Single phone number input with international formatting
- Real-time validation and formatting
- Smooth transition to OTP verification
- Enhanced UX with loading states and animations

#### SecureOTPVerification Component
```typescript
interface SecureOTPProps {
  phoneNumber: string;
  otpId: string;
  onVerificationSuccess: (tokens: AuthTokens) => void;
}
```
- 6-digit OTP input with auto-advance
- Secure server-side OTP validation
- Resend functionality with rate limiting
- Enhanced security feedback

### 3. Security Enhancement Components

#### PricingProtection Service
```typescript
interface PricingProtectionService {
  validatePricing(planId: string, clientPrice: number): Promise<boolean>;
  getSecurePricing(planId: string): Promise<SecurePricingData>;
  signPricingData(pricingData: PricingData): string;
}
```

#### UserSecurityManager
```typescript
interface UserSecurityManager {
  generateUserJWTSecrets(userId: string): Promise<JWTSecrets>;
  validateUserToken(token: string, userId: string): Promise<boolean>;
  rotateUserSecrets(userId: string): Promise<JWTSecrets>;
}
```

## Data Models

### Enhanced User Model
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  jwt_secret VARCHAR(255) NOT NULL,
  jwt_refresh_secret VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_verified BOOLEAN DEFAULT FALSE,
  profile_data JSONB
);
```

### Secure OTP Storage
```sql
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### JWT-Protected Pricing
```sql
CREATE TABLE secure_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  features JSONB NOT NULL,
  jwt_signature TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Media Assets Management
```sql
CREATE TABLE media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type VARCHAR(20) NOT NULL, -- 'image', 'video', 'animation'
  file_path VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255),
  section VARCHAR(50) NOT NULL, -- 'hero', 'features', 'pricing'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Error Handling

### Connection Error Resolution
1. **API Gateway Configuration**: Implement proper CORS and proxy settings
2. **Health Check Endpoints**: Add comprehensive health monitoring
3. **Graceful Degradation**: Fallback content when services are unavailable
4. **Retry Logic**: Exponential backoff for failed requests
5. **Error Boundaries**: React error boundaries for component failures

### Security Error Handling
1. **JWT Validation Failures**: Secure token refresh mechanisms
2. **Pricing Tampering Detection**: Server-side validation with audit logging
3. **OTP Failures**: Rate limiting and security monitoring
4. **Authentication Errors**: Clear user feedback without exposing security details

### User Experience Error Handling
1. **Network Failures**: Offline-capable UI with sync when reconnected
2. **Media Loading Failures**: Progressive image loading with placeholders
3. **Animation Performance**: Reduced motion preferences support
4. **Form Validation**: Real-time validation with helpful error messages

## Testing Strategy

### Frontend Testing
1. **Component Testing**: Jest + React Testing Library for all new components
2. **Animation Testing**: Framer Motion animation state testing
3. **Responsive Testing**: Cross-device and cross-browser compatibility
4. **Performance Testing**: Core Web Vitals optimization
5. **Accessibility Testing**: WCAG 2.1 compliance verification

### Backend Security Testing
1. **JWT Security Testing**: Token manipulation and validation testing
2. **Pricing Protection Testing**: Client-side tampering simulation
3. **OTP Security Testing**: Rate limiting and expiration validation
4. **Database Security Testing**: SQL injection and data integrity tests

### Integration Testing
1. **Authentication Flow Testing**: End-to-end signup and login flows
2. **Media Loading Testing**: Performance under various network conditions
3. **Security Integration Testing**: Full security stack validation
4. **Payment Flow Testing**: Secure transaction processing validation

### Performance Testing
1. **Page Load Speed**: Target <3s initial load time
2. **Animation Performance**: Maintain 60fps on target devices
3. **Media Optimization**: Efficient loading and caching strategies
4. **Database Performance**: Query optimization for security operations

## Implementation Phases

### Phase 1: Security Infrastructure
- Implement per-user JWT secret generation
- Create secure pricing protection system
- Set up enhanced OTP management
- Database schema updates

### Phase 2: Authentication Streamlining
- Remove duplicate signup options
- Implement phone-only registration flow
- Enhanced OTP verification component
- Security validation integration

### Phase 3: Home Page Redesign
- New hero section with multimedia content
- Interactive feature showcase components
- Animated pricing section with security
- Performance optimization

### Phase 4: Connection Issue Resolution
- API gateway configuration fixes
- Health check implementation
- Error handling enhancement
- Monitoring and alerting setup

## Security Considerations

### Client-Side Protection
1. **Code Obfuscation**: Minimize exposure of sensitive logic
2. **API Endpoint Protection**: Rate limiting and authentication
3. **Input Validation**: Comprehensive client and server-side validation
4. **XSS Prevention**: Content Security Policy implementation

### Server-Side Security
1. **JWT Secret Rotation**: Periodic secret rotation capability
2. **Pricing Integrity**: Cryptographic signing of all pricing data
3. **Audit Logging**: Comprehensive security event logging
4. **Database Encryption**: Sensitive data encryption at rest

### Network Security
1. **HTTPS Enforcement**: All communications over secure channels
2. **API Rate Limiting**: Prevent abuse and DoS attacks
3. **CORS Configuration**: Proper cross-origin resource sharing
4. **Security Headers**: Comprehensive security header implementation

## Performance Optimization

### Frontend Optimization
1. **Code Splitting**: Dynamic imports for non-critical components
2. **Image Optimization**: Next.js Image component with WebP support
3. **Animation Optimization**: Hardware-accelerated CSS animations
4. **Bundle Analysis**: Regular bundle size monitoring and optimization

### Backend Optimization
1. **Database Indexing**: Optimized indexes for security queries
2. **Caching Strategy**: Redis caching for frequently accessed data
3. **Connection Pooling**: Efficient database connection management
4. **Query Optimization**: Optimized queries for user security operations

### Media Optimization
1. **Progressive Loading**: Lazy loading for images and videos
2. **Adaptive Streaming**: Video quality adaptation based on connection
3. **CDN Integration**: Content delivery network for static assets
4. **Compression**: Optimal compression for all media assets