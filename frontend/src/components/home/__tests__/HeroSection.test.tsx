import { render, screen, fireEvent } from '@testing-library/react';
import HeroSection from '../HeroSection';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, onLoad, onError, ...props }: any) => {
    // Simulate successful image load
    setTimeout(() => {
      if (onLoad) onLoad();
    }, 100);
    return <img alt={alt} {...props} />;
  },
}));

describe('HeroSection', () => {
  const mockOnSignupClick = jest.fn();

  beforeEach(() => {
    mockOnSignupClick.mockClear();
  });

  it('renders the hero section with main elements', () => {
    render(<HeroSection onSignupClick={mockOnSignupClick} />);
    
    // Check for main headline
    expect(screen.getByText('Transform Your')).toBeInTheDocument();
    expect(screen.getByText('Email Marketing')).toBeInTheDocument();
    
    // Check for description
    expect(screen.getByText(/Experience the future of bulk email marketing/)).toBeInTheDocument();
    
    // Check for CTA buttons
    expect(screen.getByText('Start Free Trial')).toBeInTheDocument();
    expect(screen.getByText('Watch Demo')).toBeInTheDocument();
  });

  it('calls onSignupClick when Start Free Trial button is clicked', () => {
    render(<HeroSection onSignupClick={mockOnSignupClick} />);
    
    const signupButton = screen.getByText('Start Free Trial');
    fireEvent.click(signupButton);
    
    expect(mockOnSignupClick).toHaveBeenCalledTimes(1);
  });

  it('renders feature highlights', () => {
    render(<HeroSection onSignupClick={mockOnSignupClick} />);
    
    expect(screen.getByText('AI Templates')).toBeInTheDocument();
    expect(screen.getByText('Real-time Analytics')).toBeInTheDocument();
    expect(screen.getByText('Bulk Sending')).toBeInTheDocument();
    expect(screen.getByText('Custom Domains')).toBeInTheDocument();
  });

  it('renders trust indicators', () => {
    render(<HeroSection onSignupClick={mockOnSignupClick} />);
    
    expect(screen.getByText('Trusted by 10,000+ businesses worldwide')).toBeInTheDocument();
    expect(screen.getByText('No credit card required • 14-day free trial • Cancel anytime')).toBeInTheDocument();
  });

  it('renders the dashboard preview image', () => {
    render(<HeroSection onSignupClick={mockOnSignupClick} />);
    
    const image = screen.getByAltText('Perbox Dashboard Preview - Email Marketing Platform Interface');
    expect(image).toBeInTheDocument();
  });
});