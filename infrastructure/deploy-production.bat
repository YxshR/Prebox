@echo off
REM Production Deployment Script for Bulk Email Platform (Windows)
REM This script deploys the complete infrastructure to production

setlocal enabledelayedexpansion

REM Configuration
set NAMESPACE=bulk-email-platform
set KUBECTL_CONTEXT=production
set DOCKER_REGISTRY=ghcr.io/bulk-email-platform

REM Colors (Windows doesn't support colors in batch easily, so we'll use echo)
set INFO_PREFIX=[INFO]
set WARN_PREFIX=[WARN]
set ERROR_PREFIX=[ERROR]

:log_info
echo %INFO_PREFIX% %~1
goto :eof

:log_warn
echo %WARN_PREFIX% %~1
goto :eof

:log_error
echo %ERROR_PREFIX% %~1
goto :eof

:check_prerequisites
call :log_info "Checking prerequisites..."

REM Check if kubectl is installed
kubectl version --client >nul 2>&1
if errorlevel 1 (
    call :log_error "kubectl is not installed"
    exit /b 1
)

REM Check if docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    call :log_error "docker is not installed"
    exit /b 1
)

REM Check if we can connect to the cluster
kubectl cluster-info --context=%KUBECTL_CONTEXT% >nul 2>&1
if errorlevel 1 (
    call :log_error "Cannot connect to Kubernetes cluster with context: %KUBECTL_CONTEXT%"
    exit /b 1
)

call :log_info "Prerequisites check passed"
goto :eof

:create_namespace
call :log_info "Creating namespace and applying resource quotas..."
kubectl apply -f infrastructure/kubernetes/production/namespace.yml --context=%KUBECTL_CONTEXT%
goto :eof

:setup_secrets
call :log_info "Setting up secrets..."
call :log_warn "Make sure to update the secret values before applying!"

REM Check if secrets already exist
kubectl get secret postgres-credentials -n %NAMESPACE% --context=%KUBECTL_CONTEXT% >nul 2>&1
if not errorlevel 1 (
    call :log_warn "Secrets already exist. Skipping secret creation."
    call :log_warn "If you need to update secrets, delete them first or apply manually."
) else (
    kubectl apply -f infrastructure/kubernetes/production/secrets.yml --context=%KUBECTL_CONTEXT%
)
goto :eof

:apply_configmaps
call :log_info "Applying configuration maps..."
kubectl apply -f infrastructure/kubernetes/production/configmaps.yml --context=%KUBECTL_CONTEXT%
goto :eof

:setup_database
call :log_info "Setting up PostgreSQL cluster..."
kubectl apply -f infrastructure/database/cluster-config.yml --context=%KUBECTL_CONTEXT%

call :log_info "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres-primary -n %NAMESPACE% --timeout=300s --context=%KUBECTL_CONTEXT%

call :log_info "Database setup completed"
goto :eof

:setup_storage
call :log_info "Setting up file storage..."
kubectl apply -f infrastructure/storage/s3-bucket-config.yml --context=%KUBECTL_CONTEXT%
kubectl apply -f infrastructure/storage/file-upload-service.yml --context=%KUBECTL_CONTEXT%

call :log_info "Waiting for S3 bucket setup to complete..."
kubectl wait --for=condition=complete job/s3-bucket-setup -n %NAMESPACE% --timeout=300s --context=%KUBECTL_CONTEXT%
goto :eof

:deploy_applications
call :log_info "Deploying applications..."

REM Deploy services first
kubectl apply -f infrastructure/kubernetes/production/services.yml --context=%KUBECTL_CONTEXT%

REM Deploy applications
kubectl apply -f infrastructure/kubernetes/production/deployments.yml --context=%KUBECTL_CONTEXT%

call :log_info "Waiting for deployments to be ready..."
kubectl wait --for=condition=available deployment/backend-deployment -n %NAMESPACE% --timeout=600s --context=%KUBECTL_CONTEXT%
kubectl wait --for=condition=available deployment/frontend-deployment -n %NAMESPACE% --timeout=600s --context=%KUBECTL_CONTEXT%
kubectl wait --for=condition=available deployment/admin-frontend-deployment -n %NAMESPACE% --timeout=600s --context=%KUBECTL_CONTEXT%
goto :eof

:setup_load_balancer
call :log_info "Setting up load balancer and API gateway..."
kubectl apply -f infrastructure/load-balancer/nginx-config.yml --context=%KUBECTL_CONTEXT%
kubectl apply -f infrastructure/api-gateway/kong-config.yml --context=%KUBECTL_CONTEXT%

call :log_info "Waiting for load balancer to be ready..."
kubectl wait --for=condition=available deployment/nginx-load-balancer -n %NAMESPACE% --timeout=300s --context=%KUBECTL_CONTEXT%
kubectl wait --for=condition=available deployment/kong-gateway -n %NAMESPACE% --timeout=300s --context=%KUBECTL_CONTEXT%
goto :eof

:run_health_checks
call :log_info "Running health checks..."

REM Check service endpoints
call :log_info "Checking service endpoints..."
kubectl get endpoints -n %NAMESPACE% --context=%KUBECTL_CONTEXT%

call :log_info "Health checks completed!"
goto :eof

:display_access_info
call :log_info "Deployment completed successfully!"
echo.
echo Access Information:
echo ==================
echo.
echo Application URLs (once DNS is configured):
echo - Main Application: https://app.bulkemail.com
echo - Admin Panel: https://admin.bulkemail.com
echo - API Endpoint: https://api.bulkemail.com
echo.
echo Internal Services:
kubectl get services -n %NAMESPACE% --context=%KUBECTL_CONTEXT%
echo.
echo Pod Status:
kubectl get pods -n %NAMESPACE% --context=%KUBECTL_CONTEXT%
goto :eof

:main
call :log_info "Starting production deployment for Bulk Email Platform"

call :check_prerequisites
if errorlevel 1 exit /b 1

call :create_namespace
if errorlevel 1 exit /b 1

call :setup_secrets
if errorlevel 1 exit /b 1

call :apply_configmaps
if errorlevel 1 exit /b 1

call :setup_database
if errorlevel 1 exit /b 1

call :setup_storage
if errorlevel 1 exit /b 1

call :deploy_applications
if errorlevel 1 exit /b 1

call :setup_load_balancer
if errorlevel 1 exit /b 1

call :run_health_checks
if errorlevel 1 exit /b 1

call :display_access_info

call :log_info "Production deployment completed successfully!"
goto :eof

REM Parse command line arguments (basic implementation)
if "%1"=="--help" (
    echo Usage: %0 [OPTIONS]
    echo.
    echo Options:
    echo   --help              Show this help message
    echo.
    echo Note: For advanced options, edit the script variables at the top
    exit /b 0
)

REM Run main function
call :main