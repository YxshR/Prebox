'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DocumentTextIcon,
  CodeBracketIcon,
  ArrowDownTrayIcon,
  BookOpenIcon,
  PlayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Toaster, toast } from 'react-hot-toast';
import SyntaxHighlighter from '@/components/ui/SyntaxHighlighter';

interface CodeExample {
  language: string;
  code: string;
  title: string;
  description?: string;
}

interface LibraryItem {
  name: string;
  description: string;
  version: string;
  downloadUrl: string;
  language: string;
  icon: string;
  size: string;
}

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  example: CodeExample;
  response: string;
}

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState('api-docs');
  const [activeEndpoint, setActiveEndpoint] = useState('send-single');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [downloadingLibrary, setDownloadingLibrary] = useState<string | null>(null);
  const [activeGuideStep, setActiveGuideStep] = useState(0);

  const tabs = [
    { id: 'api-docs', name: 'API Documentation', icon: DocumentTextIcon },
    { id: 'integration-guides', name: 'Integration Guides', icon: BookOpenIcon },
    { id: 'libraries', name: 'Libraries & SDKs', icon: CodeBracketIcon },
  ];

  const apiEndpoints: Record<string, ApiEndpoint> = {
    'send-single': {
      method: 'POST',
      path: '/api/emails/send/single',
      description: 'Send a single email with validation and quota enforcement',
      example: {
        language: 'javascript',
        title: 'Send Single Email',
        code: `const response = await fetch('https://api.bulkemail.com/api/emails/send/single', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Hello World',
    htmlContent: '<h1>Welcome!</h1><p>This is a test email.</p>',
    textContent: 'Welcome! This is a test email.',
    replyTo: 'noreply@example.com',
    priority: 'normal'
  })
});

const result = await response.json();
console.log(result);`
      },
      response: `{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "emailId": "email_1234567890_def456",
    "status": "queued",
    "message": "Email queued for sending",
    "estimatedDeliveryTime": "Less than 1 minute"
  }
}`
    },
    'send-bulk': {
      method: 'POST',
      path: '/api/emails/send/bulk',
      description: 'Send multiple emails in a single batch operation',
      example: {
        language: 'javascript',
        title: 'Send Bulk Emails',
        code: `const response = await fetch('https://api.bulkemail.com/api/emails/send/bulk', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    emails: [
      {
        to: 'user1@example.com',
        subject: 'Welcome User 1',
        htmlContent: '<h1>Hello User 1</h1>',
        textContent: 'Hello User 1'
      },
      {
        to: 'user2@example.com',
        subject: 'Welcome User 2',
        htmlContent: '<h1>Hello User 2</h1>',
        textContent: 'Hello User 2'
      }
    ],
    priority: 'normal',
    campaignId: 'campaign_123'
  })
});

const result = await response.json();
console.log(result);`
      },
      response: `{
  "success": true,
  "data": {
    "batchJobId": "batch_1234567890_xyz789",
    "emailCount": 2,
    "status": "queued",
    "message": "Batch emails queued for sending",
    "estimatedDeliveryTime": "Less than 1 minute"
  }
}`
    },
    'send-campaign': {
      method: 'POST',
      path: '/api/emails/send/campaign',
      description: 'Send personalized emails using templates and variables',
      example: {
        language: 'javascript',
        title: 'Send Campaign Emails',
        code: `const response = await fetch('https://api.bulkemail.com/api/emails/send/campaign', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    campaignId: 'campaign_123',
    templateId: 'template_456',
    recipients: [
      {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        customFields: { company: 'Acme Corp' }
      }
    ],
    variables: {
      subject: 'Welcome {{firstName}}!',
      htmlContent: '<h1>Hello {{firstName}} {{lastName}}</h1>'
    },
    scheduledAt: '2024-12-25T10:00:00Z'
  })
});

const result = await response.json();
console.log(result);`
      },
      response: `{
  "success": true,
  "data": {
    "campaignId": "campaign_123",
    "batchJobId": "batch_1234567890_campaign",
    "recipientCount": 1,
    "status": "scheduled",
    "scheduledAt": "2024-12-25T10:00:00Z"
  }
}`
    },
    'api-keys': {
      method: 'POST',
      path: '/api/auth/api-keys',
      description: 'Create and manage API keys for programmatic access',
      example: {
        language: 'javascript',
        title: 'Create API Key',
        code: `const response = await fetch('https://api.bulkemail.com/api/auth/api-keys', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'My API Key',
    scopes: ['email:send', 'email:read'],
    expiresAt: '2024-12-31T23:59:59Z'
  })
});

const result = await response.json();
console.log(result);`
      },
      response: `{
  "success": true,
  "data": {
    "id": "key_1234567890",
    "name": "My API Key",
    "key": "bep_1234567890abcdef...",
    "scopes": ["email:send", "email:read"],
    "expiresAt": "2024-12-31T23:59:59Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}`
    },
    'job-status': {
      method: 'GET',
      path: '/api/emails/jobs/{jobId}/status',
      description: 'Get the status and progress of an email job',
      example: {
        language: 'javascript',
        title: 'Check Job Status',
        code: `const jobId = 'job_1234567890_abc123';
const response = await fetch('https://api.bulkemail.com/api/emails/jobs/' + jobId + '/status', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer your_jwt_token'
  }
});

const result = await response.json();
console.log(result);`
      },
      response: `{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "completed",
    "progress": 100,
    "createdAt": "2024-01-15T10:00:00Z",
    "processedOn": "2024-01-15T10:00:05Z",
    "finishedOn": "2024-01-15T10:00:10Z",
    "returnValue": {
      "messageId": "msg_abc123",
      "provider": "amazon-ses"
    }
  }
}`
    },
    'webhooks': {
      method: 'POST',
      path: '/api/emails/webhooks/ses',
      description: 'Receive delivery events from email service providers',
      example: {
        language: 'javascript',
        title: 'Handle Webhook Events',
        code: `// Express.js webhook handler
app.post('/api/emails/webhooks/ses', (req, res) => {
  const signature = req.headers['x-amz-sns-message-type'];
  const body = req.body;
  
  // Verify webhook signature
  if (verifyWebhookSignature(body, signature)) {
    const message = JSON.parse(body.Message);
    
    // Handle different event types
    switch (message.eventType) {
      case 'delivery':
        console.log('Email delivered:', message.mail.messageId);
        break;
      case 'bounce':
        console.log('Email bounced:', message.bounce.bounceType);
        break;
      case 'complaint':
        console.log('Spam complaint:', message.complaint.complaintFeedbackType);
        break;
    }
  }
  
  res.status(200).send('OK');
});`
      },
      response: `{
  "Type": "Notification",
  "Message": "{
    \\"eventType\\": \\"delivery\\",
    \\"mail\\": {
      \\"messageId\\": \\"msg_123\\",
      \\"destination\\": [\\"user@example.com\\"]
    },
    \\"delivery\\": {
      \\"timestamp\\": \\"2024-01-15T10:00:00Z\\",
      \\"processingTimeMillis\\": 1500
    }
  }"
}`
    }
  };

  const libraries: LibraryItem[] = [
    {
      name: 'JavaScript SDK',
      description: 'Official JavaScript/Node.js SDK with TypeScript support',
      version: 'v1.2.0',
      downloadUrl: 'https://cdn.bulkemail.com/sdk/js/bulkemail-js-sdk-v1.2.0.zip',
      language: 'JavaScript',
      icon: '📦',
      size: '2.1 MB'
    },
    {
      name: 'Python SDK',
      description: 'Python library with async support and comprehensive error handling',
      version: 'v1.1.5',
      downloadUrl: 'https://cdn.bulkemail.com/sdk/python/bulkemail-python-sdk-v1.1.5.zip',
      language: 'Python',
      icon: '🐍',
      size: '1.8 MB'
    },
    {
      name: 'PHP SDK',
      description: 'PHP library compatible with Laravel, Symfony, and vanilla PHP',
      version: 'v1.0.8',
      downloadUrl: 'https://cdn.bulkemail.com/sdk/php/bulkemail-php-sdk-v1.0.8.zip',
      language: 'PHP',
      icon: '🐘',
      size: '1.5 MB'
    }
  ];

  const codeExamples: Record<string, CodeExample[]> = {
    'authentication': [
      {
        language: 'javascript',
        title: 'Using JWT Token',
        description: 'Authenticate using Bearer token for web applications',
        code: `const response = await fetch('https://api.bulkemail.com/api/emails/send/single', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Test Email',
    htmlContent: '<h1>Hello World</h1>'
  })
});`
      },
      {
        language: 'javascript',
        title: 'Using API Key',
        description: 'Authenticate using API key for server-to-server communication',
        code: `const response = await fetch('https://api.bulkemail.com/api/emails/send/single', {
  method: 'POST',
  headers: {
    'X-API-Key': 'bep_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Test Email',
    htmlContent: '<h1>Hello World</h1>'
  })
});`
      },
      {
        language: 'python',
        title: 'Python with API Key',
        description: 'Python example using requests library',
        code: `import requests

headers = {
    'X-API-Key': 'bep_your_api_key_here',
    'Content-Type': 'application/json'
}

data = {
    'to': 'recipient@example.com',
    'subject': 'Test Email',
    'htmlContent': '<h1>Hello World</h1>'
}

response = requests.post(
    'https://api.bulkemail.com/api/emails/send/single',
    headers=headers,
    json=data
)

print(response.json())`
      },
      {
        language: 'bash',
        title: 'cURL Example',
        description: 'Command line example using cURL',
        code: `curl -X POST https://api.bulkemail.com/api/emails/send/single \\
  -H "X-API-Key: bep_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "htmlContent": "<h1>Hello World</h1>"
  }'`
      }
    ]
  };

  const integrationGuides = [
    {
      title: 'Quick Start Guide',
      description: 'Get up and running in 5 minutes',
      steps: [
        'Create your account and get API key',
        'Install SDK or set up HTTP client',
        'Send your first email',
        'Handle responses and errors'
      ]
    },
    {
      title: 'Webhook Integration',
      description: 'Receive real-time delivery notifications',
      steps: [
        'Set up webhook endpoint',
        'Verify webhook signatures',
        'Handle delivery events',
        'Update your database'
      ]
    },
    {
      title: 'Bulk Email Campaigns',
      description: 'Send personalized emails to thousands',
      steps: [
        'Prepare recipient lists',
        'Create email templates',
        'Set up campaign parameters',
        'Monitor delivery progress'
      ]
    },
    {
      title: 'Advanced Features',
      description: 'Custom domains, scheduling, and analytics',
      steps: [
        'Configure custom domain',
        'Set up email scheduling',
        'Implement analytics tracking',
        'Optimize deliverability'
      ]
    }
  ];

  const copyToClipboard = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(id);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const downloadLibrary = async (library: LibraryItem) => {
    setDownloadingLibrary(library.name);
    toast.success(`Downloading ${library.name}...`);
    
    setTimeout(() => {
      setDownloadingLibrary(null);
      toast.success(`${library.name} downloaded successfully!`);
    }, 2000);
  };

  const renderCodeBlock = (example: CodeExample, id: string) => (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <span className="text-gray-300 text-sm font-medium">{example.title}</span>
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
            {example.language}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => copyToClipboard(example.code, id)}
          className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
        >
          {copiedCode === id ? (
            <CheckIcon className="w-4 h-4 text-green-400" />
          ) : (
            <ClipboardDocumentIcon className="w-4 h-4" />
          )}
          <span className="text-xs">
            {copiedCode === id ? 'Copied!' : 'Copy'}
          </span>
        </motion.button>
      </div>
      {example.description && (
        <div className="px-4 py-2 bg-blue-900/20 border-b border-gray-700">
          <p className="text-sm text-blue-300">{example.description}</p>
        </div>
      )}
      <SyntaxHighlighter 
        language={example.language}
        className="bg-transparent"
      >
        {example.code}
      </SyntaxHighlighter>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <Toaster position="top-right" />
      
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Documentation & Library
        </h1>
        <p className="text-gray-600 text-lg">
          Everything you need to integrate with our bulk email platform
        </p>
      </motion.div>

      <div className="mb-8">
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.name}</span>
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'api-docs' && (
          <motion.div
            key="api-docs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  API Endpoints
                </h3>
                <div className="space-y-2">
                  {Object.entries(apiEndpoints).map(([key, endpoint]) => (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setActiveEndpoint(key)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        activeEndpoint === key
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs font-mono px-2 py-1 rounded ${
                              endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                              endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {endpoint.method}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {endpoint.path}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {endpoint.description}
                          </p>
                        </div>
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <span className={`text-sm font-mono px-3 py-1 rounded ${
                      apiEndpoints[activeEndpoint].method === 'GET' ? 'bg-green-100 text-green-800' :
                      apiEndpoints[activeEndpoint].method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {apiEndpoints[activeEndpoint].method}
                    </span>
                    <code className="text-lg font-mono text-gray-900">
                      {apiEndpoints[activeEndpoint].path}
                    </code>
                  </div>
                  <p className="text-gray-600 mb-6">
                    {apiEndpoints[activeEndpoint].description}
                  </p>

                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">
                      Request Example
                    </h4>
                    {renderCodeBlock(apiEndpoints[activeEndpoint].example, `${activeEndpoint}-request`)}
                  </div>

                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">
                      Response Example
                    </h4>
                    <div className="bg-gray-900 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          </div>
                          <span className="text-gray-300 text-sm font-medium">Response</span>
                          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-1 rounded">
                            JSON
                          </span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => copyToClipboard(apiEndpoints[activeEndpoint].response, `${activeEndpoint}-response`)}
                          className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedCode === `${activeEndpoint}-response` ? (
                            <CheckIcon className="w-4 h-4 text-green-400" />
                          ) : (
                            <ClipboardDocumentIcon className="w-4 h-4" />
                          )}
                          <span className="text-xs">
                            {copiedCode === `${activeEndpoint}-response` ? 'Copied!' : 'Copy'}
                          </span>
                        </motion.button>
                      </div>
                      <SyntaxHighlighter 
                        language="json"
                        className="bg-transparent"
                      >
                        {apiEndpoints[activeEndpoint].response}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>

                {/* Authentication Examples */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Authentication Examples
                  </h3>
                  <div className="space-y-4">
                    {codeExamples.authentication.map((example, index) => (
                      <div key={index}>
                        {renderCodeBlock(example, `auth-${index}`)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'integration-guides' && (
          <motion.div
            key="integration-guides"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {integrationGuides.map((guide, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <PlayIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {guide.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {guide.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {guide.steps.map((step, stepIndex) => (
                    <motion.div
                      key={stepIndex}
                      whileHover={{ x: 5 }}
                      className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all ${
                        activeGuideStep === stepIndex && index === 0
                          ? 'bg-blue-50 border-l-4 border-blue-600'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveGuideStep(stepIndex)}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        activeGuideStep >= stepIndex && index === 0
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {stepIndex + 1}
                      </div>
                      <span className="text-sm text-gray-700">{step}</span>
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Start Guide
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === 'libraries' && (
          <motion.div
            key="libraries"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Official SDKs & Libraries
              </h3>
              <p className="text-gray-600">
                Download our official libraries to integrate quickly with your favorite programming language.
                All SDKs include TypeScript definitions, comprehensive error handling, and built-in retry logic.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {libraries.map((library, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="text-2xl">{library.icon}</div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {library.name}
                      </h4>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{library.version}</span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{library.size}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">
                    {library.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {library.language}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => downloadLibrary(library)}
                      disabled={downloadingLibrary === library.name}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {downloadingLibrary === library.name ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          <span>Download</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Installation Instructions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Installation Instructions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Package Managers</h4>
                  {renderCodeBlock({
                    language: 'bash',
                    title: 'Install via NPM/Yarn',
                    code: `# NPM
npm install @bulkemail/sdk

# Yarn
yarn add @bulkemail/sdk

# Python
pip install bulkemail-sdk

# Composer (PHP)
composer require bulkemail/sdk`
                  }, 'install-packages')}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Direct Download</h4>
                  {renderCodeBlock({
                    language: 'bash',
                    title: 'Download and Extract',
                    code: `# Download SDK
wget https://cdn.bulkemail.com/sdk/js/latest.zip

# Extract
unzip latest.zip

# Include in your project
<script src="bulkemail-sdk.min.js"></script>`
                  }, 'install-direct')}
                </div>
              </div>
            </div>

            {/* Rate Limits and Quotas */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Rate Limits & Quotas
              </h3>
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg mb-4">
                <div className="flex items-center space-x-2 mb-2">
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                  <h4 className="font-medium text-amber-800">Important Notes</h4>
                </div>
                <ul className="space-y-1 text-sm text-amber-800">
                  <li>• API rate limits vary by subscription tier</li>
                  <li>• Free tier: 100 emails/day, 300 recipients/month</li>
                  <li>• Paid Standard: 500-1000 emails/day, 1500-5000 recipients/month</li>
                  <li>• Premium: 2000-5000 emails/day, 10000-25000 recipients/month</li>
                  <li>• Enterprise: Custom limits based on your contract</li>
                </ul>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Rate Limit Headers</h5>
                  {renderCodeBlock({
                    language: 'bash',
                    title: 'Response Headers',
                    code: `X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-Quota-Type: daily_emails
X-Quota-Usage: 1
X-Quota-Limit: 1000`
                  }, 'rate-limit-headers')}
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h5 className="font-medium text-gray-900 mb-2">Error Response</h5>
                  {renderCodeBlock({
                    language: 'json',
                    title: 'Rate Limit Exceeded',
                    code: `{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 1000,
      "resetTime": "2024-01-01T12:00:00Z"
    }
  }
}`
                  }, 'rate-limit-error')}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}