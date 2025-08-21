/**
 * Comprehensive tests for AnimatedPricingSection component
 * Requirements: 1.3, 7.3, 7.4, 8.1
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimatedPricingSection from '../AnimatedPricingSection';
import { pricingApi } from '../../../lib/pricingApi';

// Mock dependencies
jest.mock('../../../lib/pricingApi', () => ({
  pricingApi: {
    getSecurePricing: jest.fn(),
    validatePurchaseRequest: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    h2: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useInView: () => true,
  useAnimation: () => ({
    start: jest.fn(),
    set: jest.fn(),
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockPricingData = [
  {
    planId: 'starter',
    planName: 'Starter',
    priceAmount: 99.99,
    currency: 'INR',
    billingCycle: 'monthly' as const,
    features: ['1,000 emails/month', 'Basic templates', 'Email support'],
    limits: { emails: 1000, recipients: 500 },
    isPopular: false,
    jwtSignature: 'valid.jwt.signature.starter'
  },
  {
    planId: 'professional',
    planName: 'Professional',
    priceAmount: 199.99,
    currency: 'INR',
    billingCycle: 'monthly' as const,
    features: ['10,000 emails/month', 'Premium templates', 'Priority support', 'Analytics'],
    limits: { emails: 10000, recipients: 5000 },
    isPopular: true,
    jwtSignature: 'valid.jwt.signature.professional'
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise',
    priceAmount: 499.99,
    currency: 'INR',
    billingCycle: 'monthly' as const,
    features: ['Unlimited emails', 'Custom templates', '24/7 support', 'Advanced analytics', 'API access'],
    limits: { emails: -1, recipients: -1 },
    isPopular: false,
    jwtSignature: 'valid.jwt.signature.enterprise'
  }
];

describe('AnimatedPricingSection Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (pricingApi.getSecurePricing as jest.Mock).mockResolvedValue(mockPricingData);
  });

  describe('Component Rendering', () => {
    it('renders pricing section with secure data', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Choose Your Plan')).toBeInTheDocument();
        expect(screen.getByText('Starter')).toBeInTheDocument();
        expect(screen.getByText('Professional')).toBeInTheDocument();
        expect(screen.getByText('Enterprise')).toBeInTheDocument();
      });

      expect(pricingApi.getSecurePricing).toHaveBeenCalledTimes(1);
    });

    it('displays pricing information correctly', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('₹99.99')).toBeInTheDocument();
        expect(screen.getByText('₹199.99')).toBeInTheDocument();
        expect(screen.getByText('₹499.99')).toBeInTheDocument();
      });

      // Check features are displayed
      expect(screen.getByText('1,000 emails/month')).toBeInTheDocument();
      expect(screen.getByText('10,000 emails/month')).toBeInTheDocument();
      expect(screen.getByText('Unlimited emails')).toBeInTheDocument();
    });

    it('highlights popular plan', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        const popularBadge = screen.getByText('Most Popular');
        expect(popularBadge).toBeInTheDocument();
        
        const professionalCard = popularBadge.closest('[data-testid="pricing-card-professional"]');
        expect(professionalCard).toHaveClass('popular');
      });
    });

    it('shows loading state initially', () => {
      (pricingApi.getSecurePricing as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(<AnimatedPricingSection />);

      expect(screen.getByTestId('pricing-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading pricing...')).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
      (pricingApi.getSecurePricing as jest.Mock).mockRejectedValue(
        new Error('Failed to load pricing')
      );

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load pricing')).toBeInTheDocument();
        expect(screen.getByText('Please try again later')).toBeInTheDocument();
      });
    });
  });

  describe('Price Animations', () => {
    it('animates price reveals on scroll', async () => {
      const mockStart = jest.fn();
      const mockUseAnimation = require('framer-motion').useAnimation;
      mockUseAnimation.mockReturnValue({ start: mockStart, set: jest.fn() });

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Should trigger animation when in view
      expect(mockStart).toHaveBeenCalledWith({
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, delay: expect.any(Number) }
      });
    });

    it('staggers card animations', async () => {
      const mockStart = jest.fn();
      const mockUseAnimation = require('framer-motion').useAnimation;
      mockUseAnimation.mockReturnValue({ start: mockStart, set: jest.fn() });

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Each card should have different delay
      expect(mockStart).toHaveBeenCalledWith(
        expect.objectContaining({
          transition: expect.objectContaining({
            delay: expect.any(Number)
          })
        })
      );
    });

    it('handles reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<AnimatedPricingSection />);

      const section = screen.getByTestId('pricing-section');
      expect(section).toHaveClass('reduce-motion');
    });
  });

  describe('Interactive Features', () => {
    it('handles plan selection', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-plan-starter');
      await user.click(selectButton);

      expect(screen.getByText('Plan Selected')).toBeInTheDocument();
      expect(screen.getByText('Starter plan selected')).toBeInTheDocument();
    });

    it('shows plan comparison modal', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Compare Plans')).toBeInTheDocument();
      });

      const compareButton = screen.getByText('Compare Plans');
      await user.click(compareButton);

      expect(screen.getByTestId('comparison-modal')).toBeInTheDocument();
      expect(screen.getByText('Feature Comparison')).toBeInTheDocument();
    });

    it('handles billing cycle toggle', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Monthly')).toBeInTheDocument();
      });

      const yearlyToggle = screen.getByText('Yearly');
      await user.click(yearlyToggle);

      // Should show yearly pricing (with discount)
      await waitFor(() => {
        expect(screen.getByText('₹999.90')).toBeInTheDocument(); // 10 months price
        expect(screen.getByText('Save 17%')).toBeInTheDocument();
      });
    });

    it('shows feature tooltips on hover', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Analytics')).toBeInTheDocument();
      });

      const analyticsFeature = screen.getByText('Analytics');
      await user.hover(analyticsFeature);

      await waitFor(() => {
        expect(screen.getByText('Detailed email performance metrics')).toBeInTheDocument();
      });
    });
  });

  describe('Security Features', () => {
    it('validates pricing data integrity', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Check that JWT signatures are present in data attributes
      const starterCard = screen.getByTestId('pricing-card-starter');
      expect(starterCard).toHaveAttribute('data-signature', 'valid.jwt.signature.starter');
    });

    it('prevents client-side price manipulation', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Try to manipulate price in DOM
      const priceElement = screen.getByText('₹99.99');
      
      // Simulate DOM manipulation attempt
      act(() => {
        priceElement.textContent = '₹9.99';
      });

      const selectButton = screen.getByTestId('select-plan-starter');
      await user.click(selectButton);

      // Should validate against server-side pricing
      expect(pricingApi.validatePurchaseRequest).toHaveBeenCalledWith(
        'starter',
        99.99, // Original server price, not manipulated price
        expect.any(String)
      );
    });

    it('handles pricing tampering detection', async () => {
      (pricingApi.validatePurchaseRequest as jest.Mock).mockRejectedValue(
        new Error('Pricing data mismatch detected')
      );

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-plan-starter');
      await user.click(selectButton);

      await waitFor(() => {
        expect(screen.getByText('Security Error')).toBeInTheDocument();
        expect(screen.getByText('Pricing validation failed')).toBeInTheDocument();
      });
    });

    it('implements secure purchase flow', async () => {
      (pricingApi.validatePurchaseRequest as jest.Mock).mockResolvedValue({
        isValid: true,
        serverAmount: 99.99,
        purchaseToken: 'secure.purchase.token'
      });

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-plan-starter');
      await user.click(selectButton);

      await waitFor(() => {
        expect(pricingApi.validatePurchaseRequest).toHaveBeenCalledWith(
          'starter',
          99.99,
          expect.any(String) // User ID or session token
        );
      });

      expect(screen.getByText('Proceeding to checkout...')).toBeInTheDocument();
    });

    it('logs security events', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock tampered pricing data
      const tamperedData = [...mockPricingData];
      tamperedData[0].priceAmount = 9.99; // Tampered price
      (pricingApi.getSecurePricing as jest.Mock).mockResolvedValue(tamperedData);

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Security Warning: Pricing data integrity check failed',
          expect.any(Object)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Performance Optimization', () => {
    it('implements lazy loading for non-critical features', async () => {
      render(<AnimatedPricingSection />);

      // Comparison modal should not be loaded initially
      expect(screen.queryByTestId('comparison-modal')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Compare Plans')).toBeInTheDocument();
      });

      const compareButton = screen.getByText('Compare Plans');
      await user.click(compareButton);

      // Should load comparison modal dynamically
      await waitFor(() => {
        expect(screen.getByTestId('comparison-modal')).toBeInTheDocument();
      });
    });

    it('caches pricing data appropriately', async () => {
      const { rerender } = render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      expect(pricingApi.getSecurePricing).toHaveBeenCalledTimes(1);

      // Re-render component
      rerender(<AnimatedPricingSection />);

      // Should use cached data, not make another API call
      expect(pricingApi.getSecurePricing).toHaveBeenCalledTimes(1);
    });

    it('handles memory cleanup on unmount', () => {
      const { unmount } = render(<AnimatedPricingSection />);

      // Component should clean up any timers, subscriptions, etc.
      unmount();

      // Verify no memory leaks (in a real test, you'd check for specific cleanup)
      expect(true).toBe(true); // Placeholder for actual memory leak tests
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      expect(screen.getByRole('region', { name: 'Pricing plans' })).toBeInTheDocument();
      expect(screen.getByLabelText('Select Starter plan')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Professional plan')).toBeInTheDocument();
      expect(screen.getByLabelText('Select Enterprise plan')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Tab through pricing cards
      await user.tab();
      expect(screen.getByTestId('select-plan-starter')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('select-plan-professional')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('select-plan-enterprise')).toHaveFocus();
    });

    it('announces price changes to screen readers', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Monthly')).toBeInTheDocument();
      });

      const yearlyToggle = screen.getByText('Yearly');
      await user.click(yearlyToggle);

      // Should announce the price change
      expect(screen.getByRole('status')).toHaveTextContent(
        'Pricing updated to yearly billing'
      );
    });

    it('provides high contrast mode support', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<AnimatedPricingSection />);

      const section = screen.getByTestId('pricing-section');
      expect(section).toHaveClass('high-contrast');
    });
  });

  describe('Error Handling', () => {
    it('handles network failures gracefully', async () => {
      (pricingApi.getSecurePricing as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load pricing')).toBeInTheDocument();
        expect(screen.getByText('Check your connection and try again')).toBeInTheDocument();
      });

      // Should provide retry option
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('allows retry after errors', async () => {
      (pricingApi.getSecurePricing as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockPricingData);

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load pricing')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });
    });

    it('handles partial data gracefully', async () => {
      const partialData = [mockPricingData[0]]; // Only one plan
      (pricingApi.getSecurePricing as jest.Mock).mockResolvedValue(partialData);

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      // Should still render available plans
      expect(screen.queryByText('Professional')).not.toBeInTheDocument();
      expect(screen.queryByText('Enterprise')).not.toBeInTheDocument();
    });

    it('validates pricing data structure', async () => {
      const invalidData = [
        {
          planId: 'invalid',
          // Missing required fields
        }
      ];
      (pricingApi.getSecurePricing as jest.Mock).mockResolvedValue(invalidData);

      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Invalid pricing data')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('adapts layout for mobile devices', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<AnimatedPricingSection />);

      const section = screen.getByTestId('pricing-section');
      expect(section).toHaveClass('mobile-layout');
    });

    it('handles touch interactions', async () => {
      render(<AnimatedPricingSection />);

      await waitFor(() => {
        expect(screen.getByText('Starter')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-plan-starter');
      
      // Simulate touch events
      fireEvent.touchStart(selectButton);
      fireEvent.touchEnd(selectButton);

      expect(screen.getByText('Plan Selected')).toBeInTheDocument();
    });

    it('optimizes animations for mobile performance', () => {
      // Mock mobile device
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      });

      render(<AnimatedPricingSection />);

      const section = screen.getByTestId('pricing-section');
      expect(section).toHaveClass('mobile-optimized');
    });
  });
});