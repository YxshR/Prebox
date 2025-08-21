# Branding System Documentation

## Overview

The branding system allows users to customize their email templates with logos, colors, fonts, and custom CSS. This system provides a complete interface for logo upload, brand customization, and real-time preview functionality.

## Features

### 1. Logo Upload Interface
- **Drag-and-drop functionality**: Users can drag logo files directly onto the upload area
- **File validation**: Supports PNG, JPG, SVG, and WebP formats up to 5MB
- **Visual feedback**: Animated upload states and progress indicators
- **Current logo management**: Display and delete existing logos
- **Upload history**: Track previous logo uploads

### 2. Live Preview System
- **Real-time updates**: Changes are reflected immediately in the preview
- **Multiple view modes**: Desktop and mobile preview options
- **Template selection**: Preview branding on different email templates
- **Interactive iframe**: Secure preview rendering

### 3. Color Picker and Font Selection
- **Color presets**: Quick selection from predefined color schemes
- **Custom color inputs**: Hex color picker with validation
- **Font family selection**: Choose from web-safe font options
- **Real-time validation**: Immediate feedback on invalid color values

### 4. Branding Template Application
- **Automatic application**: New templates inherit branding settings
- **Template-specific customization**: Override branding per template
- **Consistent styling**: Maintain brand consistency across all emails

## Component Architecture

```
BrandingPage (Main Container)
├── LogoUpload (Logo management)
├── BrandingCustomizer (Settings configuration)
└── BrandingPreview (Live preview)
```

### BrandingPage
Main container component that orchestrates the entire branding interface.

**Props:**
- None (uses internal state management)

**Features:**
- Layout management
- State coordination between child components
- Error handling and notifications

### LogoUpload
Handles logo file upload with drag-and-drop functionality.

**Props:**
```typescript
interface LogoUploadProps {
  onUploadComplete?: () => void;
  className?: string;
}
```

**Features:**
- Drag-and-drop file upload
- File type and size validation
- Upload progress tracking
- Current logo display and deletion
- Animated upload states

### BrandingCustomizer
Provides interface for customizing brand settings.

**Props:**
```typescript
interface BrandingCustomizerProps {
  onPreviewChange?: (previewHtml: string) => void;
  className?: string;
}
```

**Features:**
- Logo position selection
- Color preset selection
- Custom color inputs with validation
- Font family selection
- Custom CSS editor
- Live preview toggle
- Reset to defaults functionality

### BrandingPreview
Displays real-time preview of branding changes.

**Props:**
```typescript
interface BrandingPreviewProps {
  previewHtml?: string;
  isLoading?: boolean;
  className?: string;
  onTemplateChange?: (templateId: string) => void;
}
```

**Features:**
- Desktop/mobile view modes
- Template selection
- Secure iframe rendering
- Loading states
- Empty state handling

## State Management

The branding system uses Zustand for state management with the following structure:

```typescript
interface BrandingStore {
  // State
  settings: BrandingSettings | null;
  logoHistory: LogoUpload[];
  preview: BrandingPreview | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;

  // Actions
  fetchSettings: (includeHistory?: boolean) => Promise<void>;
  updateSettings: (updates: Partial<BrandingSettings>) => Promise<void>;
  uploadLogo: (file: File, position?: string) => Promise<void>;
  deleteLogo: () => Promise<void>;
  generatePreview: (settings: Partial<BrandingSettings>, templateId?: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}
```

## API Integration

The system integrates with the backend through the `brandingApi` service:

### Endpoints
- `GET /api/branding/settings` - Fetch branding settings
- `PUT /api/branding/settings` - Update branding settings
- `POST /api/branding/logo` - Upload logo file
- `DELETE /api/branding/logo` - Delete logo
- `POST /api/branding/preview` - Generate preview
- `GET /api/branding/history` - Get upload history

### Authentication
All API calls require Bearer token authentication:
```typescript
headers: {
  Authorization: `Bearer ${token}`
}
```

## Usage Examples

### Basic Implementation
```tsx
import { BrandingPage } from './components/branding/BrandingPage';

function App() {
  return <BrandingPage />;
}
```

### Individual Components
```tsx
import { LogoUpload, BrandingCustomizer, BrandingPreview } from './components/branding';

function CustomBrandingInterface() {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <LogoUpload onUploadComplete={() => console.log('Upload complete')} />
        <BrandingCustomizer onPreviewChange={(html) => console.log('Preview updated')} />
      </div>
      <div>
        <BrandingPreview previewHtml="<html>...</html>" />
      </div>
    </div>
  );
}
```

## Customization

### Styling
All components use Tailwind CSS classes and can be customized through the `className` prop:

```tsx
<LogoUpload className="custom-upload-styles" />
<BrandingCustomizer className="custom-customizer-styles" />
```

### Color Presets
Add new color presets by modifying the `PRESET_COLORS` array in `BrandingCustomizer.tsx`:

```typescript
const PRESET_COLORS = [
  { name: 'Custom', primary: '#ff6b6b', secondary: '#ffe66d', text: '#4ecdc4' },
  // ... existing presets
];
```

### Font Options
Add new fonts by updating the `FONT_FAMILIES` array:

```typescript
const FONT_FAMILIES = [
  { value: 'Custom Font, sans-serif', label: 'Custom Font' },
  // ... existing fonts
];
```

## Validation

### File Upload Validation
- **File types**: PNG, JPG, SVG, WebP
- **File size**: Maximum 5MB
- **Security**: Filename sanitization and MIME type validation

### Color Validation
- **Format**: Hex colors (#RRGGBB)
- **Pattern**: `/^#[0-9A-Fa-f]{6}$/`
- **Real-time feedback**: Invalid colors show red border

### CSS Validation
- **Length**: Maximum 10,000 characters
- **Security**: Blocks dangerous CSS patterns
- **Sanitization**: Removes potentially harmful content

## Error Handling

The system provides comprehensive error handling:

### Upload Errors
- File size exceeded
- Invalid file type
- Upload failure
- Network errors

### Validation Errors
- Invalid color format
- Malformed CSS
- Missing required fields

### API Errors
- Authentication failures
- Server errors
- Network timeouts

## Performance Considerations

### Debounced Updates
Preview generation is debounced to prevent excessive API calls:
```typescript
useEffect(() => {
  const debounceTimer = setTimeout(() => {
    handleGeneratePreview();
  }, 300);
  return () => clearTimeout(debounceTimer);
}, [localSettings]);
```

### Optimized Rendering
- Components use React.memo for performance
- Framer Motion animations are optimized
- Image loading is lazy where appropriate

### Caching
- Settings are cached in the store
- Preview HTML is cached until settings change
- Logo URLs include cache-busting parameters

## Testing

The branding system includes comprehensive tests:

### Unit Tests
- Component rendering
- User interactions
- State management
- API integration

### Integration Tests
- Complete workflow testing
- Error scenario handling
- Performance testing

### Visual Tests
- Screenshot comparisons
- Animation testing
- Responsive design validation

## Accessibility

The interface follows WCAG 2.1 guidelines:

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Focus indicators are clearly visible
- Tab order is logical

### Screen Reader Support
- Proper ARIA labels and descriptions
- Semantic HTML structure
- Alternative text for images

### Color Contrast
- All text meets WCAG AA contrast requirements
- Color is not the only means of conveying information
- High contrast mode support

## Browser Support

The branding system supports:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

### Planned Features
- Advanced logo positioning options
- Gradient color support
- Custom font upload
- Template-specific branding overrides
- Bulk branding application
- Brand guideline export

### Performance Improvements
- WebP image optimization
- Progressive image loading
- Service worker caching
- CDN integration

## Troubleshooting

### Common Issues

**Logo not displaying:**
- Check file format and size
- Verify upload completion
- Clear browser cache

**Preview not updating:**
- Enable live preview mode
- Check network connectivity
- Verify API authentication

**Colors not applying:**
- Validate hex color format
- Check CSS syntax
- Clear custom CSS if needed

### Debug Mode
Enable debug logging by setting:
```typescript
localStorage.setItem('branding-debug', 'true');
```

This will log detailed information about API calls, state changes, and error conditions to the browser console.