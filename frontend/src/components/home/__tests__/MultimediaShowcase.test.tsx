import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import MultimediaShowcase from '../MultimediaShowcase';
import { FeatureWithMedia } from '../../../types/multimedia';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useInView: () => true,
}));

// Mock Next.js Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, onLoad, onError, ...props }: any) => {
    return (
      <img
        src={src}
        alt={alt}
        onLoad={onLoad}
        onError={onError}
        {...props}
      />
    );
  },
}));

// Mock responsive media hook
jest.mock('../../hooks/useResponsiveMedia', () => ({
  useResponsiveMedia: () => ({
    isMobile: false,
    isTablet: false,
    shouldAutoPlay: () => true,
    getAnimationDuration: (duration: number) => duration,
    canUseHeavyAnimations: true,
    shouldLazyLoad: false,
    getGridColumns: () => 2,
  }),
  useTouchGestures: () => ({
    onTouchStart: jest.fn(),
    onTouchMove: jest.fn(),
    onTouchEnd: jest.fn(),
  }),
}));

const mockFeatures: FeatureWithMedia[] = [
  {
    id: 'test-feature-1',
    title: 'Test Feature 1',
    description: 'This is a test feature description',
    imageUrl: '/test-image-1.jpg',
    videoUrl: '/test-video-1.mp4',
    demoUrl: '/demo/test-1',
    category: 'templates',
    highlights: ['Feature 1', 'Highlight 1'],
  },
  {
    id: 'test-feature-2',
    title: 'Test Feature 2',
    description: 'This is another test feature description',
    imageUrl: '/test-image-2.jpg',
    category: 'analytics',
    highlights: ['Feature 2', 'Highlight 2'],
  },
];

describe('MultimediaShowcase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    expect(screen.getByText('Experience the')).toBeInTheDocument();
    expect(screen.getByText('Future of Email')).toBeInTheDocument();
  });

  it('displays feature titles and descriptions', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    expect(screen.getByText('Test Feature 1')).toBeInTheDocument();
    expect(screen.getByText('This is a test feature description')).toBeInTheDocument();
    expect(screen.getByText('Test Feature 2')).toBeInTheDocument();
  });

  it('displays feature highlights', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    expect(screen.getByText('Feature 1')).toBeInTheDocument();
    expect(screen.getByText('Highlight 1')).toBeInTheDocument();
    expect(screen.getByText('Feature 2')).toBeInTheDocument();
    expect(screen.getByText('Highlight 2')).toBeInTheDocument();
  });

  it('shows category badges', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('handles feature selection', () => {
    const onFeatureSelect = jest.fn();
    render(<MultimediaShowcase features={mockFeatures} onFeatureSelect={onFeatureSelect} />);
    
    const feature2Button = screen.getByText('Test Feature 2').closest('div');
    if (feature2Button) {
      fireEvent.click(feature2Button);
      expect(onFeatureSelect).toHaveBeenCalledWith('test-feature-2');
    }
  });

  it('displays video demo button when videoUrl is provided', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const watchDemoButtons = screen.getAllByText('Watch Demo');
    expect(watchDemoButtons).toHaveLength(1); // Only first feature has video
  });

  it('displays live demo button when demoUrl is provided', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const liveDemoButtons = screen.getAllByText('Try Live Demo');
    expect(liveDemoButtons).toHaveLength(1); // Only first feature has demo URL
  });

  it('handles navigation controls', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const nextButton = screen.getByRole('button', { name: /next/i });
    const prevButton = screen.getByRole('button', { name: /prev/i });
    
    expect(nextButton).toBeInTheDocument();
    expect(prevButton).toBeInTheDocument();
    
    fireEvent.click(nextButton);
    // Should advance to next feature
  });

  it('renders images with proper alt text', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
    
    // Check that images have alt text
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });

  it('handles image loading states', async () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const images = screen.getAllByRole('img');
    
    // Simulate image load
    act(() => {
      fireEvent.load(images[0]);
    });
    
    // Should handle the load event without errors
  });

  it('handles image error states', async () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const images = screen.getAllByRole('img');
    
    // Simulate image error
    act(() => {
      fireEvent.error(images[0]);
    });
    
    // Should show fallback content
    await waitFor(() => {
      expect(screen.getByText('Feature Preview')).toBeInTheDocument();
    });
  });

  it('opens video player when video button is clicked', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    const watchDemoButton = screen.getByText('Watch Demo');
    fireEvent.click(watchDemoButton);
    
    // Should open video player modal
    // Note: This would need more specific testing based on the video player implementation
  });

  it('applies responsive classes correctly', () => {
    const { container } = render(<MultimediaShowcase features={mockFeatures} />);
    
    // Check that responsive grid classes are applied
    const gridContainer = container.querySelector('.grid');
    expect(gridContainer).toHaveClass('lg:grid-cols-2');
  });

  it('handles empty features array gracefully', () => {
    render(<MultimediaShowcase features={[]} />);
    
    // Should still render the header
    expect(screen.getByText('Experience the')).toBeInTheDocument();
    expect(screen.getByText('Future of Email')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <MultimediaShowcase features={mockFeatures} className="custom-class" />
    );
    
    const section = container.querySelector('section');
    expect(section).toHaveClass('custom-class');
  });

  it('shows progress indicators', () => {
    render(<MultimediaShowcase features={mockFeatures} />);
    
    // Should show progress dots for each feature
    const progressContainer = screen.getByRole('main').querySelector('.flex.gap-2');
    expect(progressContainer).toBeInTheDocument();
  });

  it('handles touch gestures on mobile', () => {
    // Mock mobile responsive hook
    jest.doMock('../../hooks/useResponsiveMedia', () => ({
      useResponsiveMedia: () => ({
        isMobile: true,
        isTablet: false,
        shouldAutoPlay: () => false,
        getAnimationDuration: (duration: number) => duration * 0.5,
        canUseHeavyAnimations: false,
        shouldLazyLoad: true,
        getGridColumns: () => 1,
      }),
      useTouchGestures: () => ({
        onTouchStart: jest.fn(),
        onTouchMove: jest.fn(),
        onTouchEnd: jest.fn(),
      }),
    }));

    render(<MultimediaShowcase features={mockFeatures} />);
    
    // Should apply mobile-specific classes and behavior
    const gridContainer = screen.getByRole('main').querySelector('.grid');
    expect(gridContainer).toHaveClass('grid-cols-1');
  });
});