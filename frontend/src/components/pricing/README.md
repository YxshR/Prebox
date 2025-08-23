# Pricing Components

This directory contains the frontend pricing components with database integration and authentication state awareness.

## Components

### PricingDisplay
The main pricing display component that shows server-validated pricing plans with database integration.

**Features:**
- Database-validated pricing information
- Authentication state integration
- Loading states and error handling
- Server-side purchase validation
- Responsive design with animations

**Props:**
```typescript
interface PricingDisplayProps {
  onPlanSelect?: (planId: string, amount: number) => void;
  showComparison?: boolean;
  billingCycle?: 'monthly' | 'yearly';
  className?: string;
  showFallbackOnError?: boolean;
}
```

**Usage:**
```tsx
import { PricingDisplay } from '@/components/pricing';

<PricingDisplay
  onPlanSelect={(planId, amount) => {
    console.log('Plan selected:', planId, amount);
  }}
  billingCycle="monthly"
  showFallbackOnError={true}
/>
```

### PricingFallback
Error state component shown when the database is unavailable or pricing service fails.

**Features:**
- Fallback pricing plans when database is unavailable
- Retry functionality
- Contact support integration
- Graceful degradation

**Props:**
```typescript
interface PricingFallbackProps {
  onRetry?: () => void;
  className?: string;
  showContactSupport?: boolean;
}
```

**Usage:**
```tsx
import { PricingFallback } from '@/components/pricing';

<PricingFallback
  onRetry={() => window.location.reload()}
  showContactSupport={true}
/>
```

### PricingContainer (Recommended)
Comprehensive container component that combines display and fallback functionality with automatic retry logic.

**Features:**
- Automatic error handling and retry logic
- Service health monitoring
- Seamless fallback integration
- Authentication state awareness
- Exponential backoff retry strategy

**Props:**
```typescript
interface PricingContainerProps {
  onPlanSelect?: (planId: string, amount: number) => void;
  showComparison?: boolean;
  billingCycle?: 'monthly' | 'yearly';
  className?: string;
  autoRetry?: boolean;
  maxRetries?: number;
}
```

**Usage:**
```tsx
import { PricingContainer } from '@/components/pricing';

<PricingContainer
  onPlanSelect={(planId, amount) => {
    // Handle plan selection with authentication context
    console.log('Plan selected:', planId, amount);
  }}
  billingCycle="monthly"
  autoRetry={true}
  maxRetries={3}
/>
```

### PricingExample
Demonstration component showing different usage patterns and integration examples.

## Authentication Integration

All pricing components are integrated with the authentication state:

- **Authenticated users**: Get server-side purchase validation and personalized pricing
- **Non-authenticated users**: See standard pricing with prompts to sign up
- **Authentication indicators**: Visual feedback showing user authentication status

## Error Handling

The components implement comprehensive error handling:

1. **Loading States**: Skeleton loaders while fetching pricing data
2. **Network Errors**: Automatic retry with exponential backoff
3. **Service Unavailable**: Fallback to static pricing plans
4. **Validation Errors**: Clear error messages and retry options

## Database Integration

Components integrate with the backend pricing service:

- **Server Validation**: All pricing data is validated server-side
- **Real-time Updates**: Pricing reflects current database values
- **Cache Management**: Intelligent caching with refresh capabilities
- **Health Monitoring**: Service health checks for reliability

## Requirements Fulfilled

This implementation fulfills the following requirements:

- **4.1**: ✅ Create PricingDisplay component with database integration
- **4.2**: ✅ Implement PricingFallback component for error scenarios
- **4.3**: ✅ Add loading states and error handling for pricing data
- **4.4**: ✅ Integrate pricing components with authentication state

## File Structure

```
pricing/
├── PricingDisplay.tsx      # Main pricing display component
├── PricingFallback.tsx     # Error fallback component
├── PricingContainer.tsx    # Comprehensive container (recommended)
├── PricingExample.tsx      # Usage examples and demo
├── index.ts               # Component exports
├── __tests__/             # Component tests
│   └── PricingComponents.test.tsx
├── verify-components.ts   # Type verification
└── README.md             # This file
```

## Dependencies

- `framer-motion`: For animations and transitions
- `@/hooks/usePricing`: Pricing data management hook
- `@/hooks/useAuth`: Authentication state hook
- `@/types/pricing`: TypeScript type definitions

## Testing

Run tests with:
```bash
npm test src/components/pricing
```

## Development

For development and debugging, the components include:
- Service health indicators (development mode only)
- Retry attempt counters
- Authentication state displays
- Error boundary integration

## Best Practices

1. **Use PricingContainer** for most implementations
2. **Handle authentication state** appropriately in callbacks
3. **Implement proper error boundaries** around pricing components
4. **Test fallback scenarios** regularly
5. **Monitor service health** in production