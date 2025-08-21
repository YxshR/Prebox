@echo off
echo 🚀 Setting up Bulk Email Platform development environment...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker first.
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose first.
    exit /b 1
)

REM Create environment files from examples
echo 📝 Creating environment files...

if not exist "frontend\.env.local" (
    copy "frontend\.env.example" "frontend\.env.local" >nul
    echo ✅ Created frontend\.env.local
)

if not exist "admin-frontend\.env.local" (
    copy "admin-frontend\.env.example" "admin-frontend\.env.local" >nul
    echo ✅ Created admin-frontend\.env.local
)

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo ✅ Created backend\.env
)

REM Install dependencies for all applications
echo 📦 Installing dependencies...

echo Installing frontend dependencies...
cd frontend && npm install && cd ..

echo Installing admin-frontend dependencies...
cd admin-frontend && npm install && cd ..

echo Installing backend dependencies...
cd backend && npm install && cd ..

echo Installing shared dependencies...
cd shared && npm install && cd ..

REM Start Docker services
echo 🐳 Starting Docker services...
docker-compose up -d postgres redis

REM Wait for databases to be ready
echo ⏳ Waiting for databases to be ready...
timeout /t 10 /nobreak >nul

echo ✅ Development environment setup complete!
echo.
echo 🎯 Next steps:
echo 1. Update environment variables in .env files with your actual values
echo 2. Start the development servers:
echo    - Frontend: cd frontend ^&^& npm run dev
echo    - Admin Frontend: cd admin-frontend ^&^& npm run dev
echo    - Backend: cd backend ^&^& npm run dev
echo 3. Or use Docker Compose: docker-compose up
echo.
echo 🌐 Application URLs:
echo    - Frontend: http://localhost:3000
echo    - Admin Frontend: http://localhost:3002
echo    - Backend API: http://localhost:3001

pause