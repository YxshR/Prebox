import { render, screen } from '@testing-library/react';
import AnimatedMetricCard from '../AnimatedMetricCard';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  useMotionValue: () => ({ onChange: jest.fn() }),
  useTransform: () => ({ onChange: jest.fn() }),
  animate: jest.fn(),
}));

describe('AnimatedMetricCard', () => {
  it('renders metric card with title and value', () => {
    render(
      <AnimatedMetricCard
        title="Total Emails"
        value={1250}
        format="number"
      />
    );

    expect(screen.getByText('Total Emails')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
  });

  it('formats percentage values correctly', () => {
    render(
      <AnimatedMetricCard
        title="Open Rate"
        value={45.5}
        format="percentage"
      />
    );

    expect(screen.getByText('45.5%')).toBeInTheDocument();
  });

  it('formats currency values correctly', () => {
    render(
      <AnimatedMetricCard
        title="Revenue"
        value={1500}
        format="currency"
      />
    );

    expect(screen.getByText('₹1,500')).toBeInTheDocument();
  });

  it('shows change indicator when previous value is provided', () => {
    render(
      <AnimatedMetricCard
        title="Total Emails"
        value={1250}
        previousValue={1000}
        format="number"
      />
    );

    // Should show positive change
    expect(screen.getByText('25.0%')).toBeInTheDocument();
  });
});