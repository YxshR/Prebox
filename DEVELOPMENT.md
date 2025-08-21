# Development Environment Setup

This document provides instructions for setting up the development environment for the Bulk Email Platform.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Docker** and **Docker Compose**
- **Git**

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bulk-email-platform
   ```

2. **Run the setup script**
   ```bash
   # Windows
   npm run setup
   
   # Linux/macOS
   chmod +x scripts/setup-dev.sh
   ./scripts/setup-dev.sh
   ```

3. **Start development servers**
   ```bash
   # Start all services with Docker Compose
   npm run docker:up
   
   # Or start individual services
   npm run dev
   ```

## Project Structure

```
bulk-email-platform/
├── frontend/              # Next.js user dashboard (Port 3000)
├── admin-frontend/        # Next.js admin panel (Port 3002)
├── backend/              # Node.js API server (Port 3001)
├── shared/               # Shared types and utilities
├── scripts/              # Development scripts
├── docker-compose.yml    # Docker services configuration
└── .prettierrc          # Code formatting configuration
```

## Environment Configuration

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
```

### Admin Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_ADMIN_SECRET=your-admin-secret-key
```

### Backend (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bulk_email_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
AWS_ACCESS_KEY_ID=your-aws-access-key
SENDGRID_API_KEY=your-sendgrid-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
OPENAI_API_KEY=your-openai-api-key
```

## Available Scripts

### Root Level Scripts
- `npm run setup` - Run development environment setup
- `npm run dev` - Start all development servers
- `npm run build` - Build all applications
- `npm run lint` - Lint all applications
- `npm run lint:fix` - Fix linting issues in all applications
- `npm run format` - Format code in all applications
- `npm run test` - Run tests for all applications

### Docker Scripts
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services
- `npm run docker:logs` - View Docker logs
- `npm run docker:build` - Build Docker images

### Individual Application Scripts
- `npm run dev:frontend` - Start frontend development server
- `npm run dev:admin` - Start admin frontend development server
- `npm run dev:backend` - Start backend development server

## Database Setup

The development environment uses Docker containers for PostgreSQL and Redis:

### PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: bulk_email_platform
- **Username**: postgres
- **Password**: postgres

### Redis
- **Host**: localhost
- **Port**: 6379

The database schema is automatically initialized when the PostgreSQL container starts using the `backend/config/init.sql` file.

## Code Quality Tools

### ESLint Configuration
- TypeScript support
- Prettier integration
- Next.js specific rules for frontend applications
- Node.js specific rules for backend

### Prettier Configuration
- 2-space indentation
- Single quotes
- Semicolons
- 80 character line width
- Trailing commas (ES5)

### Running Code Quality Checks
```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format all code
npm run format

# Check formatting without fixing
npm run format:check
```

## Development Workflow

1. **Start the development environment**
   ```bash
   npm run docker:up
   npm run dev
   ```

2. **Make your changes**
   - Frontend changes: `frontend/` directory
   - Admin changes: `admin-frontend/` directory
   - Backend changes: `backend/` directory
   - Shared utilities: `shared/` directory

3. **Test your changes**
   ```bash
   npm run test
   npm run lint
   ```

4. **Format your code**
   ```bash
   npm run format
   ```

## Application URLs

- **Frontend (User Dashboard)**: http://localhost:3000
- **Admin Frontend**: http://localhost:3002
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Troubleshooting

### Port Conflicts
If you encounter port conflicts, you can modify the ports in:
- `docker-compose.yml` for database services
- `package.json` scripts for application ports
- Environment files for API URLs

### Database Connection Issues
1. Ensure Docker is running
2. Check if PostgreSQL container is healthy: `docker-compose ps`
3. View logs: `docker-compose logs postgres`

### Redis Connection Issues
1. Check if Redis container is running: `docker-compose ps`
2. View logs: `docker-compose logs redis`

### Node.js Dependencies
If you encounter dependency issues:
```bash
# Clean all node_modules
npm run clean

# Reinstall all dependencies
npm run install:all
```

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Node.js Documentation](https://nodejs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Docker Documentation](https://docs.docker.com/)

## Getting Help

If you encounter issues during development:
1. Check this documentation
2. Review the application logs
3. Check Docker container status
4. Verify environment variables are set correctly