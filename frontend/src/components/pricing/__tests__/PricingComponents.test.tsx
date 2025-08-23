import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import PricingDisplay from '../PricingDisplay';
import PricingFallback from '../PricingFallback';
import PricingContainer from '../PricingContainer';

// Mock the hooks
jest.mock('../../../hooks/usePricing', () => ({
  usePricing: jest.fn()
}));

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

const mockUsePricing = require('../../../hooks/usePricing').usePricing;
const mockUseAuth = require('../../../hooks/useAuth').useAuth;

describe('Pricing Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PricingFallback', () => {
    it('renders fallback pricing plans', () => {
      render(<PricingFallback />);
      
      expect(screen.getByText('Pricing Service Temporarily Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
      const mockRetry = jest.fn();
      render(<PricingFallback onRetry={mockRetry} />);
      
      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);
      
      expect(mockRetry).toHaveBeenCalled();
    });

    it('shows contact support link when enabled', () => {
      render(<PricingFallback showContactSupport={true} />);
      
      expect(screen.getByText('Contact Support')).toBeInTheDocument();
    });
  });

  describe('PricingDisplay', () => {
    const mockPlans = [
      {
        planId: 'starter',
        planName: 'Starter',
        priceAmount: 999,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Feature 1', 'Feature 2'],
        isPopular: false,
        integrityHash: 'hash1'
      },
      {
        planId: 'pro',
        planName: 'Professional',
        priceAmount: 2999,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
        isPopular: true,
        integrityHash: 'hash2'
      }
    ];

    it('renders pricing plans when loaded successfully', () => {
      mockUsePricing.mockReturnValue({
        plans: mockPlans,
        isLoading: false,
        error: null,
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn()
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null
      });

      render(<PricingDisplay />);
      
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('shows loading state', () => {
      mockUsePricing.mockReturnValue({
        plans: [],
        isLoading: true,
        error: null,
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn()
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null
      });

      render(<PricingDisplay />);
      
      expect(screen.getByText('Loading pricing...')).toBeInTheDocument();
    });

    it('shows fallback component on error when enabled', () => {
      mockUsePricing.mockReturnValue({
        plans: [],
        isLoading: false,
        error: 'Database connection failed',
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn()
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null
      });

      render(<PricingDisplay showFallbackOnError={true} />);
      
      expect(screen.getByText('Pricing Service Temporarily Unavailable')).toBeInTheDocument();
    });

    it('shows different button text for authenticated users', () => {
      mockUsePricing.mockReturnValue({
        plans: mockPlans,
        isLoading: false,
        error: null,
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn()
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com' }
      });

      render(<PricingDisplay />);
      
      expect(screen.getAllByText('Choose Plan')).toHaveLength(2);
      expect(screen.getByText('✓ Authenticated as test@example.com')).toBeInTheDocument();
    });

    it('calls onPlanSelect when plan is selected', async () => {
      const mockOnPlanSelect = jest.fn();
      const mockValidatePurchase = jest.fn().mockResolvedValue({
        isValid: true,
        validatedAmount: 999
      });

      mockUsePricing.mockReturnValue({
        plans: mockPlans,
        isLoading: false,
        error: null,
        refreshPricing: jest.fn(),
        validatePurchase: mockValidatePurchase
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com' }
      });

      render(<PricingDisplay onPlanSelect={mockOnPlanSelect} />);
      
      const planButton = screen.getAllByText('Choose Plan')[0];
      fireEvent.click(planButton);
      
      await waitFor(() => {
        expect(mockValidatePurchase).toHaveBeenCalledWith('starter', 999, 'INR');
        expect(mockOnPlanSelect).toHaveBeenCalledWith('starter', 999);
      });
    });
  });

  describe('PricingContainer', () => {
    it('renders PricingDisplay by default', () => {
      mockUsePricing.mockReturnValue({
        plans: [],
        isLoading: false,
        error: null,
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn(),
        checkServiceHealth: jest.fn().mockResolvedValue({
          isHealthy: true,
          status: 'healthy'
        })
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null
      });

      render(<PricingContainer />);
      
      expect(screen.getByText('Database-validated pricing')).toBeInTheDocument();
    });

    it('shows fallback after max retries', async () => {
      mockUsePricing.mockReturnValue({
        plans: [],
        isLoading: false,
        error: 'Connection failed',
        refreshPricing: jest.fn(),
        validatePurchase: jest.fn(),
        checkServiceHealth: jest.fn().mockResolvedValue({
          isHealthy: false,
          status: 'unhealthy',
          error: 'Service down'
        })
      });

      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null
      });

      render(<PricingContainer maxRetries={0} />);
      
      await waitFor(() => {
        expect(screen.getByText('Pricing Service Temporarily Unavailable')).toBeInTheDocument();
      });
    });
  });
});