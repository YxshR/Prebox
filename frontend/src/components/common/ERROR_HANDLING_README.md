# Comprehensive Error Handling System

This document describes the comprehensive error handling system implemented for the Perbox home page redesign. The system provides graceful degradation, offline capabilities, user-friendly error messages, and progressive image loading.

## Overview

The error handling system consists of several interconnected components that work together to provide a robust user experience even when backend services are unavailable or network conditions are poor.

## Components

### 1. ErrorHandlingProvider

The main provider component that manages global error state and provides context to child components.

```tsx
import { ErrorHandlingProvider } from '../components/common/ErrorHandlingProvider';

<ErrorHandlingProvider
  showGlobalErrorBanner={true}
  enableOfflineMode={true}
  enableGracefulDegradation={true}
  maxErrors={5}
>
  <App />
</ErrorHandlingProvider>
```

**Features:**
- Global error state management
- Automatic error dismissal for non-critical errors
- Error toast notifications
- Connection status monitoring
- Maximum error limit to prevent UI overflow

### 2. GracefulDegradation

Provides fallback content when backend services are unavailable.

```tsx
import { GracefulDegradation, ApiDependentContent, CriticalFeature, OptionalFeature } from '../components/common/GracefulDegradation';

// Basic usage
<GracefulDegradation requiresConnection={true}>
  <MyComponent />
</GracefulDegradation>

// API-dependent content with custom fallback
<ApiDependentContent fallback={<CustomFallback />}>
  <DataDrivenComponent />
</ApiDependentContent>

// Critical features that need connection
<CriticalFeature featureName="Payment Processing">
  <PaymentForm />
</CriticalFeature>

// Optional features that can work offline
<OptionalFeature offlineMessage="This feature requires internet">
  <AIGenerator />
</OptionalFeature>
```

**Features:**
- Automatic connection monitoring
- Customizable fallback content
- Auto-retry with exponential backoff
- Different degradation levels for different feature types

### 3. OfflineCapable

Provides offline functionality with sync capabilities.

```tsx
import { OfflineCapable, OfflineCapableForm, OfflineCapableData } from '../components/common/OfflineCapable';

// Basic offline wrapper
<OfflineCapable syncOnReconnect={true}>
  <MyComponent />
</OfflineCapable>

// Offline-capable form
<OfflineCapableForm onSubmit={handleSubmit}>
  <FormFields />
</OfflineCapableForm>

// Data with offline caching
<OfflineCapableData cacheKey="user-data" fallbackData={defaultData}>
  {(data, isStale) => <DataDisplay data={data} isStale={isStale} />}
</OfflineCapableData>
```

**Features:**
- Offline detection and indicators
- Pending action queuing
- Automatic sync on reconnection
- Data caching with localStorage
- Form submission queuing

### 4. UserFriendlyError

Displays user-friendly error messages without exposing security details.

```tsx
import { UserFriendlyError, useUserFriendlyError } from '../components/common/UserFriendlyError';

// Direct usage
<UserFriendlyError
  error={error}
  variant="toast"
  showRetry={true}
  onRetry={handleRetry}
  onDismiss={handleDismiss}
/>

// Hook usage
const { error, showError, clearError } = useUserFriendlyError();

// Show error
showError('Network connection failed');
showError({ code: 'ERR_CONNECTION_REFUSED', message: 'Connection refused' });
```

**Features:**
- Maps technical errors to user-friendly messages
- Hides sensitive technical details in production
- Multiple display variants (inline, modal, banner, toast)
- Automatic error ID generation for support
- Retry and dismiss functionality

### 5. Enhanced LazyMedia

Progressive image loading with placeholders and error handling.

```tsx
import LazyMedia, { ProgressiveImage, SmartImage, ImagePlaceholder } from '../components/common/LazyMedia';

// Basic lazy loading
<LazyMedia
  src="/image.jpg"
  alt="Description"
  type="image"
  showProgressiveLoading={true}
  retryAttempts={3}
  fallbackSrc="/fallback.jpg"
/>

// Progressive quality loading
<ProgressiveImage
  src="/high-quality.jpg"
  lowQualitySrc="/low-quality.jpg"
  mediumQualitySrc="/medium-quality.jpg"
  alt="Description"
/>

// Connection-aware image loading
<SmartImage
  src="/image.jpg"
  alt="Description"
  adaptToConnection={true}
/>

// Placeholder for failed images
<ImagePlaceholder
  alt="Failed to load image"
  icon="image"
  message="Image unavailable"
/>
```

**Features:**
- Intersection Observer for lazy loading
- Progressive loading indicators
- Automatic retry with exponential backoff
- Connection-aware quality adjustment
- Fallback image support
- Shimmer loading effects

## Error Message Mapping

The system maps technical errors to user-friendly messages:

| Technical Error | User-Friendly Title | User-Friendly Message |
|----------------|-------------------|---------------------|
| `ERR_CONNECTION_REFUSED` | Connection Problem | We're having trouble connecting to our servers |
| `ERR_NETWORK` | Network Error | There seems to be a network issue |
| `401` | Authentication Required | Please sign in to access this feature |
| `403` | Access Denied | You don't have permission to access this feature |
| `404` | Not Found | The requested resource could not be found |
| `429` | Too Many Requests | You're making requests too quickly |
| `500` | Server Error | We're experiencing technical difficulties |
| `503` | Service Unavailable | We're performing maintenance |
| Unknown | Something Went Wrong | We encountered an unexpected error |

## Hooks

### useErrorHandling

Access the global error handling context.

```tsx
const { errors, showError, dismissError, clearAllErrors, hasErrors } = useErrorHandling();
```

### useApiErrorHandler

Handle API errors with automatic retry logic.

```tsx
const { handleApiError, isConnectionError, connectionStatus } = useApiErrorHandler();

try {
  const result = await apiCall();
} catch (error) {
  await handleApiError(error, 'API Context');
}
```

### useOfflineState

Manage offline state and data caching.

```tsx
const {
  isOnline,
  pendingActions,
  addPendingAction,
  cacheData,
  getCachedData,
  clearCache
} = useOfflineState();
```

### useConnectionStatus

Monitor connection status with retry capabilities.

```tsx
const { status, isRetrying, retryConnection, refreshStatus } = useConnectionStatus();
```

## Higher-Order Components

### withErrorHandling

Wrap components with automatic error handling.

```tsx
const EnhancedComponent = withErrorHandling(MyComponent, {
  enableGracefulDegradation: true,
  enableOfflineMode: true,
  errorContext: 'My Component'
});
```

### withGracefulDegradation

Add graceful degradation to any component.

```tsx
const RobustComponent = withGracefulDegradation(MyComponent, {
  requiresConnection: true,
  showConnectionBanner: true
});
```

### withUserFriendlyError

Add user-friendly error handling to components.

```tsx
const SafeComponent = withUserFriendlyError(MyComponent, {
  variant: 'inline',
  showRetry: true
});
```

## Implementation Examples

### Basic Page Setup

```tsx
import { ErrorHandlingProvider } from '../components/common/ErrorHandlingProvider';
import { PageErrorBoundary } from '../components/common/ErrorBoundary';

export default function MyPage() {
  return (
    <PageErrorBoundary>
      <ErrorHandlingProvider
        showGlobalErrorBanner={true}
        enableOfflineMode={true}
        enableGracefulDegradation={true}
      >
        <PageContent />
      </ErrorHandlingProvider>
    </PageErrorBoundary>
  );
}
```

### API-Dependent Component

```tsx
import { ApiDependentContent } from '../components/common/GracefulDegradation';
import { useApiErrorHandler } from '../components/common/ErrorHandlingProvider';

function DataComponent() {
  const { handleApiError } = useApiErrorHandler();
  const [data, setData] = useState(null);

  const fetchData = async () => {
    try {
      const response = await api.getData();
      setData(response.data);
    } catch (error) {
      await handleApiError(error, 'Data Fetching');
    }
  };

  return (
    <ApiDependentContent
      fallback={<DataSkeleton />}
    >
      <DataDisplay data={data} />
    </ApiDependentContent>
  );
}
```

### Offline-Capable Form

```tsx
import { OfflineCapableForm } from '../components/common/OfflineCapable';

function ContactForm() {
  const handleSubmit = async (data) => {
    // This will be queued if offline and submitted when online
    await api.submitContact(data);
  };

  return (
    <OfflineCapableForm onSubmit={handleSubmit}>
      <form>
        <input name="name" required />
        <input name="email" type="email" required />
        <textarea name="message" required />
        <button type="submit">Submit</button>
      </form>
    </OfflineCapableForm>
  );
}
```

## Testing

The system includes comprehensive tests covering:

- Error state management
- User-friendly error message mapping
- Graceful degradation behavior
- Offline functionality
- Connection status monitoring
- Progressive image loading

Run tests with:
```bash
npm test -- ErrorHandling.test.tsx
```

## Configuration

### Environment Variables

- `NODE_ENV`: Controls whether technical details are shown in errors
- `NEXT_PUBLIC_API_URL`: Base URL for API calls

### Connection Monitoring

The system automatically monitors:
- Browser online/offline events
- API health check responses
- Network connection quality (when available)

### Retry Logic

- Exponential backoff for failed requests
- Maximum retry attempts (configurable)
- Circuit breaker pattern for API calls
- Connection-specific retry strategies

## Best Practices

1. **Wrap critical features** with `CriticalFeature` component
2. **Use API-dependent content** for data-driven components
3. **Implement offline fallbacks** for non-critical features
4. **Cache important data** using the offline state hooks
5. **Provide meaningful error contexts** when showing errors
6. **Test error scenarios** during development
7. **Monitor error rates** in production

## Security Considerations

- Technical error details are hidden in production
- Error IDs are generated for support tracking
- Sensitive information is never exposed to users
- All errors are logged securely for debugging

## Performance Considerations

- Lazy loading reduces initial bundle size
- Progressive image loading improves perceived performance
- Connection-aware quality adjustment saves bandwidth
- Error boundaries prevent cascading failures
- Efficient caching reduces redundant requests

This comprehensive error handling system ensures that users have a smooth experience even when network conditions are poor or backend services are unavailable, while maintaining security and providing developers with the tools they need to debug issues effectively.