#!/bin/bash

echo "🎭 Setting up Bulk Email Platform Demo"
echo "====================================="
echo

echo "📦 Installing dependencies..."
cd backend
npm install
cd ../frontend
npm install
cd ..

echo
echo "🗄️ Setting up demo users..."
cd backend
npm run seed:demo
cd ..

echo
echo "🎉 Demo setup complete!"
echo
echo "📋 Demo Login Credentials:"
echo "========================"
echo
echo "🆓 Free Tier:     demo@bulkemail.com / Demo123!"
echo "📊 Standard:      standard@bulkemail.com / Standard123!"
echo "💎 Premium:       premium@bulkemail.com / Premium123!"
echo "🏢 Enterprise:    enterprise@bulkemail.com / Enterprise123!"
echo "🆕 New User:      newuser@bulkemail.com / NewUser123!"
echo
echo "🚀 To start the application:"
echo "  Backend:  cd backend && npm run dev"
echo "  Frontend: cd frontend && npm run dev"
echo
echo "🌐 Access URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo