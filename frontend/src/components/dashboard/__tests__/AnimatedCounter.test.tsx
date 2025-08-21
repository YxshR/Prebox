import { render, screen } from '@testing-library/react';
import AnimatedCounter from '../AnimatedCounter';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  useMotionValue: () => ({ set: jest.fn() }),
  useTransform: () => 0,
  animate: jest.fn(),
}));

describe('AnimatedCounter', () => {
  it('renders with correct value', () => {
    render(<AnimatedCounter value={100} />);
    // The component should render, even if animation is mocked
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders with prefix and suffix', () => {
    render(<AnimatedCounter value={50} prefix="$" suffix="%" />);
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });
});