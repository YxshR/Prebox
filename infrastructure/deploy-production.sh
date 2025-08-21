#!/bin/bash

# Production Deployment Script for Bulk Email Platform
# This script deploys the complete infrastructure to production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="bulk-email-platform"
KUBECTL_CONTEXT="production"
DOCKER_REGISTRY="ghcr.io/bulk-email-platform"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info --context=$KUBECTL_CONTEXT &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster with context: $KUBECTL_CONTEXT"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

create_namespace() {
    log_info "Creating namespace and applying resource quotas..."
    kubectl apply -f infrastructure/kubernetes/production/namespace.yml --context=$KUBECTL_CONTEXT
}

setup_secrets() {
    log_info "Setting up secrets..."
    log_warn "Make sure to update the secret values before applying!"
    
    # Check if secrets already exist
    if kubectl get secret postgres-credentials -n $NAMESPACE --context=$KUBECTL_CONTEXT &> /dev/null; then
        log_warn "Secrets already exist. Skipping secret creation."
        log_warn "If you need to update secrets, delete them first or apply manually."
    else
        kubectl apply -f infrastructure/kubernetes/production/secrets.yml --context=$KUBECTL_CONTEXT
    fi
}

apply_configmaps() {
    log_info "Applying configuration maps..."
    kubectl apply -f infrastructure/kubernetes/production/configmaps.yml --context=$KUBECTL_CONTEXT
}

setup_database() {
    log_info "Setting up PostgreSQL cluster..."
    kubectl apply -f infrastructure/database/cluster-config.yml --context=$KUBECTL_CONTEXT
    
    # Wait for database to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres-primary -n $NAMESPACE --timeout=300s --context=$KUBECTL_CONTEXT
    
    # Run database migrations
    log_info "Running database migrations..."
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT \
        $(kubectl get pods -n $NAMESPACE -l app=postgres-primary --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}') \
        -- psql -U postgres -d bulk_email_platform -f /docker-entrypoint-initdb.d/production-schema.sql
}

setup_storage() {
    log_info "Setting up file storage..."
    kubectl apply -f infrastructure/storage/s3-bucket-config.yml --context=$KUBECTL_CONTEXT
    kubectl apply -f infrastructure/storage/file-upload-service.yml --context=$KUBECTL_CONTEXT
    
    # Wait for S3 setup job to complete
    log_info "Waiting for S3 bucket setup to complete..."
    kubectl wait --for=condition=complete job/s3-bucket-setup -n $NAMESPACE --timeout=300s --context=$KUBECTL_CONTEXT
}

deploy_applications() {
    log_info "Deploying applications..."
    
    # Deploy services first
    kubectl apply -f infrastructure/kubernetes/production/services.yml --context=$KUBECTL_CONTEXT
    
    # Deploy applications
    kubectl apply -f infrastructure/kubernetes/production/deployments.yml --context=$KUBECTL_CONTEXT
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available deployment/backend-deployment -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT
    kubectl wait --for=condition=available deployment/frontend-deployment -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT
    kubectl wait --for=condition=available deployment/admin-frontend-deployment -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT
}

setup_load_balancer() {
    log_info "Setting up load balancer and API gateway..."
    kubectl apply -f infrastructure/load-balancer/nginx-config.yml --context=$KUBECTL_CONTEXT
    kubectl apply -f infrastructure/api-gateway/kong-config.yml --context=$KUBECTL_CONTEXT
    
    # Wait for load balancer to be ready
    log_info "Waiting for load balancer to be ready..."
    kubectl wait --for=condition=available deployment/nginx-load-balancer -n $NAMESPACE --timeout=300s --context=$KUBECTL_CONTEXT
    kubectl wait --for=condition=available deployment/kong-gateway -n $NAMESPACE --timeout=300s --context=$KUBECTL_CONTEXT
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check if all pods are running
    FAILED_PODS=$(kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [ $FAILED_PODS -gt 0 ]; then
        log_error "Some pods are not running:"
        kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running
        exit 1
    fi
    
    # Check service endpoints
    log_info "Checking service endpoints..."
    kubectl get endpoints -n $NAMESPACE --context=$KUBECTL_CONTEXT
    
    # Test database connectivity
    log_info "Testing database connectivity..."
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT \
        $(kubectl get pods -n $NAMESPACE -l app=postgres-primary --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}') \
        -- pg_isready -U postgres
    
    # Test Redis connectivity
    log_info "Testing Redis connectivity..."
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT \
        $(kubectl get pods -n $NAMESPACE -l app=redis --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}') \
        -- redis-cli ping
    
    log_info "Health checks passed!"
}

display_access_info() {
    log_info "Deployment completed successfully!"
    echo ""
    echo "Access Information:"
    echo "=================="
    
    # Get load balancer IP
    LB_IP=$(kubectl get service nginx-load-balancer-service -n $NAMESPACE --context=$KUBECTL_CONTEXT -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending...")
    
    echo "Load Balancer IP: $LB_IP"
    echo ""
    echo "Application URLs (once DNS is configured):"
    echo "- Main Application: https://app.bulkemail.com"
    echo "- Admin Panel: https://admin.bulkemail.com"
    echo "- API Endpoint: https://api.bulkemail.com"
    echo ""
    echo "Internal Services:"
    kubectl get services -n $NAMESPACE --context=$KUBECTL_CONTEXT
    echo ""
    echo "Pod Status:"
    kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT
}

cleanup_on_error() {
    log_error "Deployment failed. Cleaning up..."
    # Add cleanup commands here if needed
    exit 1
}

# Main deployment flow
main() {
    log_info "Starting production deployment for Bulk Email Platform"
    
    # Set error trap
    trap cleanup_on_error ERR
    
    check_prerequisites
    create_namespace
    setup_secrets
    apply_configmaps
    setup_database
    setup_storage
    deploy_applications
    setup_load_balancer
    run_health_checks
    display_access_info
    
    log_info "Production deployment completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --context)
            KUBECTL_CONTEXT="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --context CONTEXT    Kubernetes context to use (default: production)"
            echo "  --namespace NS       Kubernetes namespace (default: bulk-email-platform)"
            echo "  --registry REGISTRY  Docker registry (default: ghcr.io/bulk-email-platform)"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main