# Logo Upload and Branding System

This module provides comprehensive logo upload and branding customization functionality for the bulk email platform. It allows paid users to customize their email branding with logos, colors, fonts, and custom CSS.

## Features

### ✅ Implemented Features

1. **Logo Upload Service**
   - File validation (PNG, JPG, SVG, WebP)
   - Size limits (5MB max)
   - Secure file storage
   - Multiple logo positions (header, footer, sidebar)
   - Automatic thumbnail generation support

2. **Branding Customization**
   - Color customization (primary, secondary, text colors)
   - Font family selection
   - Logo positioning options
   - Custom CSS support
   - Live preview generation

3. **Template Integration**
   - Automatic branding application to email templates
   - Template-specific branding overrides
   - Default branding for free tier users
   - Branding removal capabilities

4. **Subscription Tier Support**
   - Free tier: No logo customization, default branding
   - Paid Standard: Logo customization available
   - Premium: Full branding customization
   - Enterprise: Unlimited branding options

5. **API Endpoints**
   - `POST /api/branding/logo` - Upload logo
   - `GET /api/branding/settings` - Get branding settings
   - `PUT /api/branding/settings` - Update branding settings
   - `POST /api/branding/preview` - Generate preview
   - `DELETE /api/branding/logo` - Delete logo
   - `GET /api/branding/logos/:tenantId/:filename` - Serve logo files
   - `GET /api/branding/history` - Get upload history

6. **Frontend Components**
   - `BrandingPage` - Main branding management page
   - `LogoUpload` - Drag-and-drop logo upload component
   - `BrandingCustomizer` - Color and font customization
   - `BrandingPreview` - Live preview with desktop/mobile views

## Requirements Satisfied

This implementation satisfies all requirements from **Requirement 18**:

- ✅ **18.1**: Logo upload service with file validation and storage
- ✅ **18.2**: Branding customization interface with live preview
- ✅ **18.3**: Logo placement options (header, footer, sidebar)
- ✅ **18.4**: Color and text combination customization
- ✅ **18.5**: Branding application across all email templates

## Database Schema

### Tables Created

1. **branding_settings**
   - Stores branding configuration per tenant
   - Includes logo URL, colors, fonts, positioning
   - Supports custom CSS for advanced customization

2. **logo_uploads**
   - Tracks logo upload history and metadata
   - Stores file information and upload status
   - Maintains audit trail of logo changes

### Migration Files

- `create_branding_tables.sql` - Creates branding and logo upload tables
- Includes proper indexes for performance
- Foreign key constraints for data integrity

## File Structure

```
backend/src/branding/
├── branding.service.ts          # Core branding business logic
├── branding.routes.ts           # API route handlers
├── branding.types.ts            # TypeScript interfaces and enums
├── branding.validation.ts       # Request validation schemas
├── template-branding.service.ts # Template integration service
├── __tests__/
│   └── branding.service.test.ts # Unit tests
└── README.md                    # This documentation

frontend/src/components/branding/
├── BrandingPage.tsx             # Main branding page
├── LogoUpload.tsx              # Logo upload component
├── BrandingCustomizer.tsx      # Customization interface
└── BrandingPreview.tsx         # Live preview component

frontend/src/stores/
└── brandingStore.ts            # Zustand state management
```

## API Usage Examples

### Upload Logo

```bash
curl -X POST http://localhost:3001/api/branding/logo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "logo=@/path/to/logo.png" \
  -F "position=header"
```

### Update Branding Settings

```bash
curl -X PUT http://localhost:3001/api/branding/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "primaryColor": "#3b82f6",
    "secondaryColor": "#ffffff",
    "textColor": "#374151",
    "fontFamily": "Inter, sans-serif",
    "logoPosition": "header"
  }'
```

### Generate Preview

```bash
curl -X POST http://localhost:3001/api/branding/preview \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "primaryColor": "#059669",
      "logoPosition": "header"
    },
    "templateId": "optional-template-id"
  }'
```

## Frontend Usage

### Using the Branding Store

```typescript
import { useBrandingStore } from '../stores/brandingStore';

function MyComponent() {
  const { 
    settings, 
    uploadLogo, 
    updateSettings, 
    generatePreview,
    isLoading 
  } = useBrandingStore();

  const handleLogoUpload = async (file: File) => {
    await uploadLogo(file, 'header');
  };

  const handleColorChange = async (color: string) => {
    await updateSettings({ primaryColor: color });
  };

  return (
    <div>
      {/* Your branding UI */}
    </div>
  );
}
```

### Using Branding Components

```typescript
import { BrandingPage } from '../components/branding/BrandingPage';

function SettingsPage() {
  return (
    <div>
      <BrandingPage />
    </div>
  );
}
```

## Configuration

### Environment Variables

```env
# File upload configuration
LOGO_UPLOAD_PATH=uploads/logos
LOGO_MAX_FILE_SIZE=5242880  # 5MB in bytes

# Storage configuration (for production)
AWS_S3_BUCKET=your-logo-bucket
AWS_REGION=us-east-1
```

### Default Branding Settings

The system provides tier-specific default branding:

- **Free Tier**: Basic colors, footer branding with platform attribution
- **Paid Standard**: Enhanced colors, logo customization available
- **Premium**: Full customization, custom domain branding
- **Enterprise**: Unlimited customization options

## Security Considerations

1. **File Validation**: Strict MIME type and extension checking
2. **Size Limits**: 5MB maximum file size to prevent abuse
3. **Path Traversal Protection**: Filename sanitization
4. **Access Control**: Subscription tier validation
5. **CSRF Protection**: Proper token validation
6. **Content Security**: CSS validation to prevent XSS

## Performance Optimizations

1. **Caching**: Logo files served with long-term cache headers
2. **Compression**: Automatic image optimization (planned)
3. **CDN Integration**: Ready for CDN deployment
4. **Database Indexing**: Optimized queries with proper indexes

## Testing

### Running Tests

```bash
cd backend
npm test -- branding.service.test.ts
```

### Test Coverage

- ✅ Logo upload validation
- ✅ Branding settings CRUD operations
- ✅ Template branding application
- ✅ Subscription tier access control
- ✅ File validation and security
- ✅ Error handling and edge cases

## Deployment Notes

### Production Considerations

1. **File Storage**: Configure AWS S3 or similar for logo storage
2. **CDN**: Set up CloudFront or similar for logo delivery
3. **Database**: Ensure branding tables are created via migration
4. **Monitoring**: Set up alerts for upload failures
5. **Backup**: Include logo files in backup strategy

### Migration Commands

```sql
-- Run the branding tables migration
\i backend/src/config/migrations/create_branding_tables.sql
```

## Troubleshooting

### Common Issues

1. **Logo Upload Fails**
   - Check file size and type
   - Verify subscription tier allows logo uploads
   - Ensure upload directory permissions

2. **Preview Not Generating**
   - Verify branding settings are saved
   - Check template service integration
   - Review CSS validation errors

3. **Branding Not Applied**
   - Confirm template integration is enabled
   - Check subscription tier permissions
   - Verify branding settings are active

### Debug Commands

```bash
# Check branding settings
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/branding/settings

# Check upload history
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/branding/history
```

## Future Enhancements

### Planned Features

1. **Advanced Image Processing**
   - Automatic image optimization
   - Multiple size generation
   - Format conversion (WebP support)

2. **Template Gallery**
   - Pre-designed branded templates
   - Template marketplace integration
   - Brand kit management

3. **Analytics Integration**
   - Branding performance metrics
   - A/B testing for branded emails
   - Engagement tracking by branding

4. **Advanced Customization**
   - CSS editor with syntax highlighting
   - Brand guideline enforcement
   - Multi-brand support for enterprises

## Support

For issues or questions regarding the branding system:

1. Check this documentation
2. Review the test files for usage examples
3. Check the API response error messages
4. Contact the development team

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Status**: ✅ Complete and Production Ready