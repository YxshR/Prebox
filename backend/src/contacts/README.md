# Contact Management System

This module implements comprehensive contact management functionality for the bulk email platform, including contact CRUD operations, list management, CSV import/export, suppression lists, and engagement tracking.

## Features

### 1. Contact Management
- **Create, Read, Update, Delete** contacts with full validation
- **Search and filter** contacts by various criteria (email, name, status, tags, etc.)
- **Custom fields** support for additional contact data
- **Tagging system** for contact organization
- **Multi-source tracking** (manual, import, API, form)

### 2. Contact List Management
- **Create and manage** contact lists for segmentation
- **Add/remove contacts** from lists with bulk operations
- **Suppression lists** for bounce/complaint/unsubscribe management
- **Automatic contact counting** with database triggers
- **List membership tracking** with audit trail

### 3. CSV Import/Export
- **CSV file upload** with configurable field mapping
- **Batch processing** with progress tracking and error reporting
- **Duplicate handling** options (skip, update, or error)
- **Import job tracking** with status and error details
- **Export functionality** with filtering and format options (CSV/JSON)

### 4. Suppression List Management
- **Automatic suppression** for bounces, complaints, and unsubscribes
- **Manual suppression** entries with reason tracking
- **Suppression checking** before email sends
- **Multiple suppression types** (bounce, complaint, unsubscribe, manual)
- **Source campaign tracking** for suppression entries

### 5. Engagement Tracking
- **Event recording** for all email interactions (sent, delivered, opened, clicked, etc.)
- **Engagement scoring** based on interaction patterns
- **Contact engagement summaries** with metrics and trends
- **IP address and user agent** tracking for detailed analytics

## API Endpoints

### Contact Operations
```
POST   /api/contacts              - Create new contact
GET    /api/contacts              - Search/list contacts with filters
GET    /api/contacts/:id          - Get specific contact
PUT    /api/contacts/:id          - Update contact
DELETE /api/contacts/:id          - Delete contact
```

### Contact List Operations
```
POST   /api/lists                 - Create new contact list
GET    /api/lists                 - Get all lists for tenant
GET    /api/lists/:id             - Get specific list
PUT    /api/lists/:id             - Update list
DELETE /api/lists/:id             - Delete list
GET    /api/lists/:id/contacts    - Get contacts in list
POST   /api/lists/:id/contacts/:contactId   - Add contact to list
DELETE /api/lists/:id/contacts/:contactId   - Remove contact from list
```

### Import/Export Operations
```
POST   /api/import                - Import contacts from CSV
POST   /api/export                - Export contacts to CSV/JSON
```

### Suppression Management
```
POST   /api/suppression           - Add email to suppression list
DELETE /api/suppression           - Remove email from suppression list
GET    /api/suppression           - Get suppression list
GET    /api/suppression/check/:email - Check if email is suppressed
```

### Engagement Tracking
```
POST   /api/engagement            - Record engagement event
GET    /api/contacts/:id/engagement - Get contact engagement summary
```

## Database Schema

The contact management system uses the following tables:

- **contacts** - Main contact information
- **contact_lists** - Contact list definitions
- **contact_list_memberships** - Many-to-many relationship between contacts and lists
- **contact_engagement_events** - All email interaction events
- **contact_import_jobs** - CSV import job tracking
- **suppression_entries** - Email suppression management
- **contact_segments** - Advanced segmentation (future use)

## Usage Examples

### Creating a Contact
```typescript
const contact = await contactService.createContact(tenantId, {
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  phone: '+1234567890',
  customFields: {
    company: 'Acme Corp',
    role: 'Manager'
  },
  tags: ['customer', 'premium'],
  listIds: ['list-uuid-1', 'list-uuid-2']
});
```

### Importing Contacts from CSV
```typescript
const result = await contactService.importContactsFromCSV(
  tenantId,
  csvBuffer,
  'contacts.csv',
  {
    email: 'Email',
    firstName: 'First Name',
    lastName: 'Last Name',
    customFields: {
      'Company': 'company',
      'Phone': 'phone'
    }
  },
  {
    createNewList: true,
    newListName: 'Imported Contacts',
    skipDuplicates: true
  }
);
```

### Recording Engagement Events
```typescript
await contactService.recordEngagementEvent({
  contactId: 'contact-uuid',
  campaignId: 'campaign-uuid',
  eventType: EngagementEventType.OPENED,
  eventData: { timestamp: new Date() },
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});
```

### Managing Suppression Lists
```typescript
// Add to suppression list
await contactService.addToSuppressionList(
  tenantId,
  'bounced@example.com',
  SuppressionType.BOUNCE,
  'Hard bounce received',
  'campaign-uuid'
);

// Check if email is suppressed
const isSuppressed = await contactService.isEmailSuppressed(
  tenantId,
  'test@example.com'
);
```

## Requirements Fulfilled

This implementation addresses the following requirements from the specification:

- **Requirement 5.1**: Contact import/export functionality with CSV support ✅
- **Requirement 5.2**: Contact list creation and segmentation ✅
- **Requirement 5.3**: Automatic suppression list management ✅
- **Requirement 5.5**: Contact engagement tracking ✅

## Security Features

- **Tenant isolation** - All operations are scoped to the authenticated user's tenant
- **Input validation** - Email format validation and data sanitization
- **SQL injection protection** - Parameterized queries throughout
- **File upload security** - CSV file type validation and size limits
- **Access control** - Authentication middleware on all routes

## Performance Considerations

- **Database indexing** - Optimized indexes for common query patterns
- **Batch processing** - Efficient bulk operations for imports
- **Pagination** - Built-in pagination for large result sets
- **Connection pooling** - Proper database connection management
- **Async processing** - Non-blocking operations for large imports

## Error Handling

The system includes comprehensive error handling for:
- Invalid email formats
- Duplicate contact detection
- File upload errors
- Database constraint violations
- Import processing failures
- Authentication and authorization errors

All errors are properly logged and return appropriate HTTP status codes with descriptive error messages.