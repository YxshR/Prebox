#!/bin/bash

# Development Environment Setup Script
echo "🚀 Setting up Bulk Email Platform development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create environment files from examples
echo "📝 Creating environment files..."

if [ ! -f "frontend/.env.local" ]; then
    cp frontend/.env.example frontend/.env.local
    echo "✅ Created frontend/.env.local"
fi

if [ ! -f "admin-frontend/.env.local" ]; then
    cp admin-frontend/.env.example admin-frontend/.env.local
    echo "✅ Created admin-frontend/.env.local"
fi

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
fi

# Install dependencies for all applications
echo "📦 Installing dependencies..."

echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

echo "Installing admin-frontend dependencies..."
cd admin-frontend && npm install && cd ..

echo "Installing backend dependencies..."
cd backend && npm install && cd ..

echo "Installing shared dependencies..."
cd shared && npm install && cd ..

# Start Docker services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for databases to be ready
echo "⏳ Waiting for databases to be ready..."
sleep 10

# Run database migrations (if any)
echo "🗄️  Setting up database..."
# Add migration commands here when available

echo "✅ Development environment setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Update environment variables in .env files with your actual values"
echo "2. Start the development servers:"
echo "   - Frontend: cd frontend && npm run dev"
echo "   - Admin Frontend: cd admin-frontend && npm run dev"
echo "   - Backend: cd backend && npm run dev"
echo "3. Or use Docker Compose: docker-compose up"
echo ""
echo "🌐 Application URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - Admin Frontend: http://localhost:3002"
echo "   - Backend API: http://localhost:3001"