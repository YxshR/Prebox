<<<<<<< HEAD
# Bulk Email Platform

A comprehensive bulk email platform that enables users to send promotional and transactional emails through a multi-tier SaaS service.

## Project Structure

```
bulk-email-platform/
├── frontend/                 # Next.js user dashboard (Port 3000)
├── admin-frontend/          # Next.js admin panel (Port 3002)  
├── backend/                 # Node.js API services (Port 3001)
├── shared/                  # Shared types and utilities
└── docs/                   # Documentation
```

## Features

- **Multi-Tier Subscription System**: Free, Paid Standard, Premium, and Enterprise tiers
- **Email Campaign Management**: Template creation, scheduling, and analytics
- **AI-Powered Templates**: Generate professional email templates using AI
- **Custom Domain Support**: Premium users can use their own domains
- **Real-time Analytics**: Animated dashboards with comprehensive metrics
- **API Integration**: REST API for programmatic email sending
- **Contact Management**: Import, segment, and manage email lists
- **Compliance**: GDPR, CAN-SPAM, and DPDP compliant

## Technology Stack

### Frontend Applications
- **Framework**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charts**: Recharts
- **State Management**: Zustand
- **Forms**: React Hook Form

### Backend Services
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Queue**: Bull (Redis-based)
- **Authentication**: JWT
- **Email Service**: Amazon SES / SendGrid
- **Payments**: Stripe / Razorpay

## Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd bulk-email-platform
```

2. Install dependencies for all applications
```bash
npm run install:all
```

3. Set up environment variables
```bash
# Copy environment templates
cp backend/.env.example backend/.env
# Edit the .env file with your configuration
```

4. Start development servers
```bash
npm run dev
```

This will start:
- Frontend (User Dashboard): http://localhost:3000
- Admin Frontend: http://localhost:3002  
- Backend API: http://localhost:3001

### Individual Application Commands

```bash
# Frontend development
cd frontend && npm run dev

# Admin frontend development  
cd admin-frontend && npm run dev

# Backend development
cd backend && npm run dev

# Shared utilities build
cd shared && npm run build
```

## Subscription Tiers

### Free Tier
- 100 emails/day, 300 recipients/month, 2000 emails/month
- 1 AI template daily
- Ads and website branding included

### Paid Standard (₹39-59 + GST)
- 500-1000 emails/day, 1500-5000 recipients/month
- 10 AI/Custom templates daily
- Logo customization

### Premium (₹249-649 + GST)  
- 2000-5000 emails/day, 10000-25000 recipients/month
- Unlimited templates, custom business emails
- Advanced analytics

### Enterprise (Custom)
- Customizable limits and features
- Dedicated support
- Full platform access

## API Documentation

The REST API provides endpoints for:
- Authentication and user management
- Campaign creation and management
- Email sending (single and bulk)
- Analytics and reporting
- Webhook handling

API documentation will be available at `/docs` when the backend is running.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the ISC License.
=======
# Perbox
>>>>>>> 206ea93bbf3591c076e44b888f7aeefc25d2aa1e
