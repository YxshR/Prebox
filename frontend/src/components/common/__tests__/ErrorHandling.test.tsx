import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorHandlingProvider, useErrorHandling } from '../ErrorHandlingProvider';
import { UserFriendlyError } from '../UserFriendlyError';
import { GracefulDegradation } from '../GracefulDegradation';
import { OfflineCapable } from '../OfflineCapable';

// Mock the connection status hook
jest.mock('../../hooks/useConnectionStatus', () => ({
  useConnectionStatus: () => ({
    status: {
      isOnline: true,
      isConnected: true,
      lastChecked: new Date(),
      retryCount: 0,
      error: null
    },
    isRetrying: false,
    retryConnection: jest.fn(),
    refreshStatus: jest.fn()
  })
}));

// Test component that uses error handling
const TestComponent = () => {
  const { showError, errors, dismissError } = useErrorHandling();

  return (
    <div>
      <button
        onClick={() => showError('Test error message', 'Test Context')}
        data-testid="trigger-error"
      >
        Trigger Error
      </button>
      <button
        onClick={() => showError({ code: 'ERR_CONNECTION_REFUSED', message: 'Connection failed' })}
        data-testid="trigger-connection-error"
      >
        Trigger Connection Error
      </button>
      <div data-testid="error-count">{errors.length}</div>
      {errors.map(error => (
        <div key={error.id} data-testid={`error-${error.id}`}>
          {error.context}: {typeof error.error === 'string' ? error.error : error.error.message}
          <button onClick={() => dismissError(error.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
};

describe('Error Handling System', () => {
  describe('ErrorHandlingProvider', () => {
    it('should provide error handling context', () => {
      render(
        <ErrorHandlingProvider>
          <TestComponent />
        </ErrorHandlingProvider>
      );

      expect(screen.getByTestId('error-count')).toHaveTextContent('0');
    });

    it('should handle string errors', async () => {
      render(
        <ErrorHandlingProvider>
          <TestComponent />
        </ErrorHandlingProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-error'));

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('1');
      });

      expect(screen.getByText('Test Context: Test error message')).toBeInTheDocument();
    });

    it('should handle object errors', async () => {
      render(
        <ErrorHandlingProvider>
          <TestComponent />
        </ErrorHandlingProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-connection-error'));

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('1');
      });

      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });

    it('should dismiss errors', async () => {
      render(
        <ErrorHandlingProvider>
          <TestComponent />
        </ErrorHandlingProvider>
      );

      fireEvent.click(screen.getByTestId('trigger-error'));

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('1');
      });

      fireEvent.click(screen.getByText('Dismiss'));

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('0');
      });
    });

    it('should limit maximum errors', async () => {
      render(
        <ErrorHandlingProvider maxErrors={2}>
          <TestComponent />
        </ErrorHandlingProvider>
      );

      // Trigger 3 errors
      fireEvent.click(screen.getByTestId('trigger-error'));
      fireEvent.click(screen.getByTestId('trigger-error'));
      fireEvent.click(screen.getByTestId('trigger-error'));

      await waitFor(() => {
        expect(screen.getByTestId('error-count')).toHaveTextContent('2');
      });
    });
  });

  describe('UserFriendlyError', () => {
    it('should display user-friendly message for network errors', () => {
      const error = { code: 'ERR_CONNECTION_REFUSED', message: 'Connection refused' };
      
      render(<UserFriendlyError error={error} />);

      expect(screen.getByText('Connection Problem')).toBeInTheDocument();
      expect(screen.getByText(/having trouble connecting to our servers/)).toBeInTheDocument();
    });

    it('should display user-friendly message for HTTP errors', () => {
      const error = { status: 404, message: 'Not found' };
      
      render(<UserFriendlyError error={error} />);

      expect(screen.getByText('Not Found')).toBeInTheDocument();
      expect(screen.getByText(/requested resource could not be found/)).toBeInTheDocument();
    });

    it('should display fallback message for unknown errors', () => {
      const error = 'Unknown error occurred';
      
      render(<UserFriendlyError error={error} />);

      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
      expect(screen.getByText(/unexpected error/)).toBeInTheDocument();
    });

    it('should show retry button when onRetry is provided', () => {
      const onRetry = jest.fn();
      const error = 'Test error';
      
      render(<UserFriendlyError error={error} onRetry={onRetry} />);

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalled();
    });

    it('should show dismiss button when onDismiss is provided', () => {
      const onDismiss = jest.fn();
      const error = 'Test error';
      
      render(<UserFriendlyError error={error} onDismiss={onDismiss} />);

      const dismissButton = screen.getByText('Dismiss');
      expect(dismissButton).toBeInTheDocument();

      fireEvent.click(dismissButton);
      expect(onDismiss).toHaveBeenCalled();
    });

    it('should not expose sensitive technical details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = {
        message: 'Database connection failed',
        stack: 'Error: Database connection failed\n    at connect (db.js:123:45)',
        code: 'DB_ERROR'
      };
      
      render(<UserFriendlyError error={error} showDetails={true} />);

      // Should show user-friendly message
      expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
      
      // Should not show technical details in production
      expect(screen.queryByText('Database connection failed')).not.toBeInTheDocument();
      expect(screen.queryByText(/stack/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('GracefulDegradation', () => {
    it('should show children when connection is available', () => {
      render(
        <GracefulDegradation>
          <div data-testid="main-content">Main Content</div>
        </GracefulDegradation>
      );

      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });

    it('should show fallback content when connection is unavailable', () => {
      // Mock offline status
      jest.mocked(require('../../hooks/useConnectionStatus').useConnectionStatus).mockReturnValue({
        status: {
          isOnline: false,
          isConnected: false,
          lastChecked: new Date(),
          retryCount: 1,
          error: 'No internet connection'
        },
        isRetrying: false,
        retryConnection: jest.fn(),
        refreshStatus: jest.fn()
      });

      render(
        <GracefulDegradation>
          <div data-testid="main-content">Main Content</div>
        </GracefulDegradation>
      );

      expect(screen.queryByTestId('main-content')).not.toBeInTheDocument();
      expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument();
    });

    it('should show custom fallback content', () => {
      // Mock offline status
      jest.mocked(require('../../hooks/useConnectionStatus').useConnectionStatus).mockReturnValue({
        status: {
          isOnline: false,
          isConnected: false,
          lastChecked: new Date(),
          retryCount: 0,
          error: null
        },
        isRetrying: false,
        retryConnection: jest.fn(),
        refreshStatus: jest.fn()
      });

      const customFallback = <div data-testid="custom-fallback">Custom Fallback</div>;

      render(
        <GracefulDegradation fallbackContent={customFallback}>
          <div data-testid="main-content">Main Content</div>
        </GracefulDegradation>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByTestId('main-content')).not.toBeInTheDocument();
    });
  });

  describe('OfflineCapable', () => {
    it('should show offline indicator when offline', () => {
      // Mock offline status
      jest.mocked(require('../../hooks/useConnectionStatus').useConnectionStatus).mockReturnValue({
        status: {
          isOnline: false,
          isConnected: false,
          lastChecked: new Date(),
          retryCount: 0,
          error: null
        },
        isRetrying: false,
        retryConnection: jest.fn(),
        refreshStatus: jest.fn()
      });

      render(
        <OfflineCapable>
          <div>Content</div>
        </OfflineCapable>
      );

      expect(screen.getByText('Offline Mode')).toBeInTheDocument();
      expect(screen.getByText(/currently offline/)).toBeInTheDocument();
    });

    it('should not show offline indicator when online', () => {
      render(
        <OfflineCapable>
          <div>Content</div>
        </OfflineCapable>
      );

      expect(screen.queryByText('Offline Mode')).not.toBeInTheDocument();
    });
  });
});

describe('Error Message Mapping', () => {
  const testCases = [
    {
      input: { code: 'ERR_CONNECTION_REFUSED' },
      expectedTitle: 'Connection Problem',
      expectedMessage: /trouble connecting to our servers/
    },
    {
      input: { status: 401 },
      expectedTitle: 'Authentication Required',
      expectedMessage: /sign in to access/
    },
    {
      input: { status: 403 },
      expectedTitle: 'Access Denied',
      expectedMessage: /don't have permission/
    },
    {
      input: { status: 404 },
      expectedTitle: 'Not Found',
      expectedMessage: /could not be found/
    },
    {
      input: { status: 429 },
      expectedTitle: 'Too Many Requests',
      expectedMessage: /making requests too quickly/
    },
    {
      input: { status: 500 },
      expectedTitle: 'Server Error',
      expectedMessage: /technical difficulties/
    },
    {
      input: 'Random error message',
      expectedTitle: 'Something Went Wrong',
      expectedMessage: /unexpected error/
    }
  ];

  testCases.forEach(({ input, expectedTitle, expectedMessage }) => {
    it(`should map ${JSON.stringify(input)} to user-friendly message`, () => {
      render(<UserFriendlyError error={input} />);

      expect(screen.getByText(expectedTitle)).toBeInTheDocument();
      expect(screen.getByText(expectedMessage)).toBeInTheDocument();
    });
  });
});