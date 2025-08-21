# Template Management System

This module implements a comprehensive template management system for the bulk email platform, providing template creation, editing, sharing, and collaboration features.

## Features Implemented

### ✅ Template Library with Search and Filtering
- **Template CRUD Operations**: Create, read, update, delete templates
- **Advanced Search**: Search by name, subject, tags, and content
- **Multi-Filter Support**: Filter by category, AI-generated status, sharing status, creator, and date range
- **Pagination**: Efficient pagination for large template collections
- **Sorting**: Templates sorted by last updated date

### ✅ Drag-and-Drop Template Editor
- **Visual Editor**: Drag-and-drop interface for building email templates
- **Block-Based Design**: Text, image, button, divider, and spacer blocks
- **Real-time Preview**: Live preview of template changes
- **Code Editor**: Switch between visual and HTML code editing
- **Responsive Design**: Mobile and desktop preview modes

### ✅ Template Preview Functionality
- **Multi-Device Preview**: Desktop, mobile, and text-only previews
- **Variable Substitution**: Real-time variable replacement in previews
- **Interactive Variables**: Edit variable values and see instant updates
- **Template Metadata**: Display template information and sharing status

### ✅ Template Sharing and Collaboration
- **Share Templates**: Share templates with specific users via email
- **Permission Management**: View-only or edit permissions
- **Collaboration Tracking**: Track who has access to templates
- **Sharing Status**: Visual indicators for shared templates

## API Endpoints

### Template Management
- `POST /api/templates` - Create new template
- `GET /api/templates` - List templates with filtering and pagination
- `GET /api/templates/:id` - Get specific template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

### Template Operations
- `POST /api/templates/:id/duplicate` - Duplicate template
- `POST /api/templates/:id/preview` - Generate template preview
- `POST /api/templates/:id/share` - Share template with users
- `GET /api/templates/:id/collaborators` - Get template collaborators

### Metadata
- `GET /api/templates/categories` - Get available categories
- `GET /api/templates/tags` - Get available tags

## Frontend Components

### Core Components
- **TemplatesPage**: Main template management page with navigation
- **TemplateLibrary**: Grid/list view of templates with search and filters
- **TemplateCard**: Individual template display with actions
- **TemplateFilters**: Advanced filtering interface

### Editor Components
- **TemplateEditor**: Main template editing interface
- **DragDropEditor**: Visual drag-and-drop editor
- **VariableManager**: Template variable management
- **TemplatePreview**: Multi-device preview with variable editing

### Collaboration
- **ShareTemplateModal**: Template sharing interface
- **Pagination**: Reusable pagination component
- **LoadingSpinner**: Loading state indicator

## Data Models

### EmailTemplate
```typescript
interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: TemplateVariable[];
  isAIGenerated: boolean;
  isShared: boolean;
  sharedWith: string[];
  tags: string[];
  category: string;
  previewImage?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}
```

### TemplateVariable
```typescript
interface TemplateVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'image' | 'url';
  defaultValue?: string;
  required: boolean;
  description?: string;
}
```

## State Management

The frontend uses Zustand for state management with the following features:
- **Template Store**: Centralized template state management
- **API Integration**: Seamless API calls with loading and error states
- **Filter Management**: Persistent filter state with automatic reloading
- **Preview Management**: Template preview state and variable handling

## Key Features

### Search and Filtering
- **Text Search**: Search across template names, subjects, and tags
- **Category Filter**: Filter by template categories (marketing, newsletter, etc.)
- **Type Filter**: Filter by AI-generated vs manual templates
- **Sharing Filter**: Filter by shared vs private templates
- **Date Range**: Filter by creation date range
- **Tag Filter**: Multi-select tag filtering

### Template Editor
- **Visual Editor**: Drag-and-drop blocks for easy template building
- **Code Editor**: Direct HTML editing for advanced users
- **Variable System**: Dynamic content with typed variables
- **Preview Modes**: Desktop, mobile, and text previews
- **Real-time Updates**: Instant preview updates as you edit

### Collaboration Features
- **Template Sharing**: Share templates with team members
- **Permission Control**: View-only or edit permissions
- **Collaboration Tracking**: See who has access to templates
- **Sharing History**: Track sharing activities

## Testing

Comprehensive test suite covering:
- **Service Layer**: Full CRUD operations and business logic
- **API Endpoints**: Request/response validation
- **Filter Logic**: Search and filtering functionality
- **Preview System**: Variable substitution and rendering
- **Collaboration**: Sharing and permission management

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 6.1**: Template creation with drag-and-drop editor ✅
- **Requirement 6.2**: Dynamic content insertion using variables ✅
- **Requirement 6.4**: Template preview functionality ✅
- **Requirement 13.1**: Template management with search and filtering ✅

## Usage Examples

### Creating a Template
```typescript
const template = await templateAPI.createTemplate({
  tenantId: 'tenant_1',
  name: 'Welcome Email',
  subject: 'Welcome {{first_name}}!',
  htmlContent: '<h1>Welcome {{first_name}}!</h1>',
  variables: [{
    id: 'var_1',
    name: 'first_name',
    type: 'text',
    required: true,
    description: 'User first name'
  }],
  tags: ['welcome', 'onboarding'],
  category: 'transactional'
});
```

### Searching Templates
```typescript
const templates = await templateAPI.listTemplates({
  search: 'welcome',
  category: 'transactional',
  tags: ['onboarding'],
  isAIGenerated: false
}, 1, 20);
```

### Sharing a Template
```typescript
await templateAPI.shareTemplate({
  templateId: 'template_123',
  shareWith: ['user@example.com'],
  permissions: 'edit'
});
```

This template management system provides a complete solution for creating, managing, and collaborating on email templates with an intuitive interface and powerful features.