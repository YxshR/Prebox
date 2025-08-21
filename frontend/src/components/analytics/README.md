# Analytics Dashboard Components

This directory contains the animated analytics dashboard components for the bulk email platform.

## Components

### AnimatedMetricCard
A reusable metric card component with animated counters and change indicators.

**Features:**
- Animated number counting from 0 to target value
- Support for number, percentage, and currency formatting
- Change indicators with previous value comparison
- Customizable colors and icons
- Smooth animations with configurable delays

**Usage:**
```tsx
<AnimatedMetricCard
  title="Total Emails Sent"
  value={2500}
  previousValue={2200}
  format="number"
  icon={<EnvelopeIcon className="w-6 h-6" />}
  color="blue"
  delay={0.2}
/>
```

### DeliveryTrendsChart
An animated line chart showing email delivery trends over time.

**Features:**
- Multiple data series (delivered, bounced, failed, total)
- Animated line drawing with staggered delays
- Interactive tooltips with motion animations
- Responsive design
- Custom color scheme for different metrics

### EngagementMetricsChart
An interactive bar chart displaying engagement metrics.

**Features:**
- Bar chart with custom colors for each metric
- Interactive tooltips showing counts and rates
- Animated loading states
- Summary cards showing engagement rates
- Responsive layout

### CampaignPerformanceChart
A donut chart showing campaign performance distribution.

**Features:**
- Donut chart with campaign-wise breakdown
- Interactive tooltips with detailed metrics
- Campaign legend with performance stats
- Animated chart rendering
- Total summary display

### TimeRangeSelector
A time range selector component for filtering analytics data.

**Features:**
- Predefined time ranges (7 days, 30 days, 3 months, etc.)
- Custom date range picker
- Automatic period selection based on range
- Smooth animations for UI transitions
- Current selection display

## API Integration

The analytics components integrate with the backend analytics API through `analyticsApi.ts`:

- `GET /api/analytics/dashboard` - Complete dashboard data
- `GET /api/analytics/delivery-trends` - Delivery trend data
- `GET /api/analytics/engagement` - Engagement metrics
- `GET /api/analytics/campaigns` - Campaign performance
- `GET /api/analytics/key-metrics` - Key metrics summary

## Animation Features

All components use Framer Motion for smooth animations:

- **Staggered animations**: Components animate in sequence for better UX
- **Loading states**: Skeleton loaders and animated placeholders
- **Interactive feedback**: Hover effects and click animations
- **Data transitions**: Smooth transitions when data updates
- **Performance optimized**: Animations are optimized for 60fps

## Responsive Design

The dashboard is fully responsive:

- **Mobile**: Single column layout with stacked components
- **Tablet**: Two-column grid for charts
- **Desktop**: Full grid layout with optimal spacing
- **Large screens**: Maximum width container with proper spacing

## Testing

Components include comprehensive tests:

- Unit tests for individual components
- Integration tests for API interactions
- Animation behavior testing
- Responsive layout testing

## Performance Considerations

- **Lazy loading**: Charts are loaded only when needed
- **Memoization**: Expensive calculations are memoized
- **Virtualization**: Large datasets use virtual scrolling
- **Debounced updates**: API calls are debounced to prevent spam
- **Optimized re-renders**: Components use React.memo where appropriate

## Accessibility

All components follow accessibility best practices:

- **ARIA labels**: Proper labeling for screen readers
- **Keyboard navigation**: Full keyboard support
- **Color contrast**: WCAG AA compliant color schemes
- **Focus management**: Proper focus indicators
- **Alternative text**: Descriptive text for visual elements