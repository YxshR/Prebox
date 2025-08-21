# AI Template Service

The AI Template Service provides intelligent email template generation using AI models through OpenRouter and OpenAI. It includes quota management, usage tracking, and template customization features based on subscription tiers.

## Features

### Core Functionality
- **AI-Powered Template Generation**: Generate professional email templates using natural language prompts
- **Template Customization**: Modify existing templates with styling and content changes
- **Multi-Provider Support**: Extensible architecture supporting OpenAI and future AI providers
- **Quota Management**: Tier-based usage limits and tracking
- **Template Variables**: Automatic extraction and management of template variables

### Subscription Tier Limits

| Tier | Daily Limit | Monthly Limit | Features |
|------|-------------|---------------|----------|
| Free | 1 template | 30 templates | Basic generation |
| Paid Standard | 10 templates | 300 templates | Enhanced features |
| Premium | Unlimited | Unlimited | Full access |
| Enterprise | Unlimited | Unlimited | Custom features |

## API Endpoints

### Generate Template
```http
POST /api/ai-templates/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "prompt": "Create a welcome email for new customers",
  "templateType": "welcome",
  "tone": "friendly",
  "brandName": "My Company",
  "industry": "SaaS",
  "targetAudience": "Small business owners",
  "callToAction": "Get started with your free trial",
  "additionalContext": "We offer project management software"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "template": {
      "id": "ai_template_1234567890_abc123def",
      "tenantId": "tenant_123",
      "name": "My Company welcome template - 2024-01-15",
      "subject": "Welcome to {{companyName}}, {{firstName}}!",
      "htmlContent": "<html>...</html>",
      "textContent": "Welcome to My Company...",
      "variables": [
        {
          "name": "firstName",
          "type": "text",
          "required": true
        },
        {
          "name": "companyName",
          "type": "text",
          "required": false
        }
      ],
      "isAIGenerated": true,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "generationMetadata": {
      "model": "OpenAI",
      "tokensUsed": 1250,
      "generationTime": 3500,
      "prompt": "Create a welcome email for new customers"
    }
  }
}
```

### Customize Template
```http
POST /api/ai-templates/customize
Authorization: Bearer <token>
Content-Type: application/json

{
  "templateId": "template_123",
  "modifications": {
    "subject": "Updated subject line",
    "styling": {
      "primaryColor": "#ff6b35",
      "fontFamily": "Arial, sans-serif",
      "customCss": ".header { background: #f0f0f0; }"
    }
  }
}
```

### Check Quota
```http
GET /api/ai-templates/quota
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "canGenerate": true,
    "usage": {
      "dailyUsage": 3,
      "dailyLimit": 10,
      "monthlyUsage": 45,
      "monthlyLimit": 300,
      "hasUnlimitedAccess": false,
      "tier": "paid_standard"
    }
  }
}
```

### Get Usage Statistics
```http
GET /api/ai-templates/usage
Authorization: Bearer <token>
```

### Get Template Types
```http
GET /api/ai-templates/types
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "types": [
      "promotional",
      "transactional",
      "newsletter",
      "welcome",
      "abandoned_cart",
      "product_announcement",
      "event_invitation",
      "survey_feedback",
      "seasonal_campaign",
      "custom"
    ]
  }
}
```

### Get Template Suggestions
```http
GET /api/ai-templates/suggestions?industry=healthcare
Authorization: Bearer <token>
```

## Usage Examples

### Basic Template Generation
```typescript
import { AITemplateService } from './ai-template.service';

const aiService = new AITemplateService(subscriptionService);

const request = {
  tenantId: 'tenant_123',
  prompt: 'Create a promotional email for our new product launch',
  templateType: 'promotional',
  tone: 'professional',
  brandName: 'TechCorp',
  callToAction: 'Learn more about our new features'
};

const result = await aiService.generateTemplate(request);
console.log('Generated template:', result.template.name);
```

### Template Customization
```typescript
const customization = {
  templateId: 'template_123',
  tenantId: 'tenant_123',
  modifications: {
    subject: 'New and improved subject',
    styling: {
      primaryColor: '#007bff',
      fontFamily: 'Helvetica, Arial, sans-serif'
    }
  }
};

const customizedTemplate = await aiService.customizeTemplate(customization);
```

### Quota Validation
```typescript
const canGenerate = await aiService.validateTemplateQuota('tenant_123');
if (!canGenerate) {
  console.log('Quota exceeded, upgrade required');
}
```

## Configuration

### Environment Variables
```bash
# AI Provider Configuration (choose one)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-api-key
OPENROUTER_SITE_URL=http://localhost:3001
OPENROUTER_SITE_NAME=Your App Name

# Alternative providers
OPENAI_API_KEY=your-openai-api-key
CLAUDE_API_KEY=your-claude-api-key

# Feature flags
ENABLE_AI_TEMPLATES=true
```

### AI Provider Configuration
The service supports multiple AI providers with automatic fallback:

**OpenRouter (Primary):**
```typescript
const config = {
  model: 'openai/gpt-4o',
  maxTokens: 2000,
  temperature: 0.7
};

const provider = new OpenRouterProvider(apiKey, config);
```

**OpenAI (Fallback):**
```typescript
const config = {
  model: 'gpt-4',
  maxTokens: 2000,
  temperature: 0.7
};

const provider = new OpenAIProvider(apiKey, config);
```

The service automatically selects OpenRouter if `OPENROUTER_API_KEY` is available, otherwise falls back to OpenAI.

## Template Variables

The service automatically extracts template variables from generated content using the `{{variableName}}` syntax:

### Common Variables
- `{{firstName}}` - Recipient's first name
- `{{lastName}}` - Recipient's last name
- `{{email}}` - Recipient's email address
- `{{companyName}}` - Company or organization name
- `{{productName}}` - Product or service name

### Variable Types
- `text` - String values
- `number` - Numeric values
- `date` - Date values
- `boolean` - True/false values

## Error Handling

### Common Error Codes
- `QUOTA_EXCEEDED` - Template generation quota exceeded
- `VALIDATION_ERROR` - Invalid request parameters
- `GENERATION_FAILED` - AI provider error
- `FEATURE_DISABLED` - AI templates feature disabled
- `UNAUTHORIZED` - Authentication required

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Template generation quota exceeded for current subscription tier",
    "details": {
      "dailyUsage": 10,
      "dailyLimit": 10,
      "tier": "paid_standard"
    }
  }
}
```

## Testing

Run the test suite:
```bash
npm test ai-template.service.test.ts
```

### Test Coverage
- Template generation with various parameters
- Quota validation across different tiers
- Usage tracking and limits
- Template customization
- Error handling scenarios

## Integration

### With Campaign Service
```typescript
// Generate template and use in campaign
const aiResult = await aiTemplateService.generateTemplate(request);
const template = await campaignService.createTemplate({
  tenantId: request.tenantId,
  name: aiResult.template.name,
  subject: aiResult.template.subject,
  htmlContent: aiResult.template.htmlContent,
  textContent: aiResult.template.textContent,
  variables: aiResult.template.variables,
  isAIGenerated: true
});
```

### With Subscription Service
The service automatically integrates with the subscription system to enforce tier-based limits and track usage.

## Performance Considerations

- **Caching**: Template suggestions and types are cached
- **Rate Limiting**: Built-in quota management prevents abuse
- **Async Processing**: Template generation is non-blocking
- **Token Optimization**: Efficient prompt construction to minimize API costs

## Security

- **API Key Protection**: Secure storage of AI provider credentials
- **Input Validation**: Comprehensive request validation
- **Tenant Isolation**: Usage tracking per tenant
- **Content Filtering**: Safe content generation guidelines

## Future Enhancements

- **Claude Integration**: Support for Anthropic's Claude models
- **Template Library**: Pre-built template collection
- **A/B Testing**: Template variant generation
- **Performance Analytics**: Template effectiveness tracking
- **Multi-language Support**: International template generation