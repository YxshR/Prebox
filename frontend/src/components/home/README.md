# Secure Animated Pricing Section

This directory contains the implementation of the secure animated pricing section for the home page redesign.

## Components

### AnimatedPricingSection.tsx
The main pricing section component that implements:
- **JWT-protected pricing display**: Fetches pricing data from secure backend API with server-side validation
- **Smooth price reveal animations**: Uses Framer Motion for professional animations and transitions
- **Interactive tier comparison**: Includes a "Compare Plans" button that opens a detailed comparison modal
- **Server-side validation**: All pricing data is validated against server-side values to prevent client-side manipulation

**Key Features:**
- Secure pricing API integration with retry mechanisms
- Animated price reveals with staggered animations
- Billing cycle toggle (Monthly/Yearly) with discount display
- Popular plan highlighting with badges
- Hover effects and micro-interactions
- Loading states and error handling
- Security notice display

### PricingComparison.tsx
Interactive modal component for detailed plan comparison:
- Side-by-side feature comparison
- Plan selection interface
- Animated feature checkmarks
- Responsive design for mobile devices

### Types (../types/pricing.ts)
TypeScript interfaces for pricing data:
- `PricingTier`: Main pricing plan structure
- `SecurePricingResponse`: API response format
- `PricingValidationResponse`: Validation response format
- `PricingComparison`: Comparison data structure

### API Client (../lib/pricingApi.ts)
Secure pricing API client with:
- JWT-protected pricing retrieval
- Server-side validation methods
- Purchase request validation
- Retry mechanisms for reliability
- Error handling and logging

## Security Features

1. **Server-Side Validation**: All pricing data is validated against server-stored values
2. **JWT Protection**: Pricing data includes JWT signatures for integrity verification
3. **Tampering Detection**: Client-side price manipulation attempts are detected and logged
4. **Rate Limiting**: API endpoints include rate limiting to prevent abuse
5. **Integrity Hashes**: Additional hash verification for pricing data

## Requirements Fulfilled

- **Requirement 1.3**: Interactive tier comparison functionality ✅
- **Requirement 7.3**: Validate all pricing server-side using database values ✅
- **Requirement 7.4**: Ignore client-side pricing data and use only server-verified amounts ✅
- **Requirement 8.1**: Prevent access to sensitive pricing modification functions ✅

## Usage

```tsx
import AnimatedPricingSection from './components/home/AnimatedPricingSection';

<AnimatedPricingSection 
  onPlanSelect={(planId, amount) => {
    // Handle plan selection with server-validated amount
    console.log('Selected plan:', planId, 'Amount:', amount);
  }}
/>
```

## Testing

The component includes comprehensive tests in `__tests__/AnimatedPricingSection.test.tsx`:
- Secure data loading
- Price formatting
- Plan selection with validation
- Error handling
- Animation behavior
- Security validation

## Backend Integration

The component integrates with the secure pricing API at `/api/pricing`:
- `GET /api/pricing` - Retrieve all pricing plans
- `POST /api/pricing/validate` - Validate pricing data
- `POST /api/pricing/purchase/validate` - Validate purchase requests

All endpoints include security middleware for monitoring and rate limiting.