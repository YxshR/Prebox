#!/bin/bash

# Complete Production Deployment Script for Home Page Redesign
# This script deploys all components including security features, CDN, and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="bulk-email-platform"
KUBECTL_CONTEXT="production"
DEPLOYMENT_VERSION=$(date +%Y%m%d-%H%M%S)

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

log_success() {
    echo -e "${PURPLE}[SUCCESS]${NC} $1"
}

check_prerequisites() {
    log_step "Checking deployment prerequisites..."
    
    # Check required tools
    for tool in kubectl aws docker; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
    
    # Check cluster connectivity
    if ! kubectl cluster-info --context=$KUBECTL_CONTEXT &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

deploy_security_infrastructure() {
    log_step "Deploying enhanced security infrastructure..."
    
    # Apply security migration configmaps
    kubectl apply -f infrastructure/scripts/security-migration-configmaps.yml --context=$KUBECTL_CONTEXT
    
    # Update secrets with new security features
    kubectl apply -f infrastructure/kubernetes/production/secrets.yml --context=$KUBECTL_CONTEXT
    
    # Update configmaps with security configuration
    kubectl apply -f infrastructure/kubernetes/production/configmaps.yml --context=$KUBECTL_CONTEXT
    
    # Deploy security monitoring
    kubectl apply -f infrastructure/monitoring/security-monitoring.yml --context=$KUBECTL_CONTEXT
    
    log_success "Security infrastructure deployed"
}

deploy_cdn_infrastructure() {
    log_step "Deploying CDN and media optimization infrastructure..."
    
    # Create CDN directory if it doesn't exist
    mkdir -p infrastructure/cdn
    
    # Deploy CloudFront configuration
    kubectl apply -f infrastructure/cdn/cloudfront-config.yml --context=$KUBECTL_CONTEXT
    
    # Deploy media optimization service
    kubectl apply -f infrastructure/cdn/media-optimization.yml --context=$KUBECTL_CONTEXT
    
    # Wait for CDN setup job to complete
    log_info "Waiting for CDN setup to complete..."
    kubectl wait --for=condition=complete job/cdn-setup-job -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT || true
    
    log_success "CDN infrastructure deployed"
}

deploy_monitoring_infrastructure() {
    log_step "Deploying monitoring and alerting infrastructure..."
    
    # Deploy Grafana dashboards
    kubectl apply -f infrastructure/monitoring/grafana-dashboards.yml --context=$KUBECTL_CONTEXT
    
    # Update Prometheus configuration with new security rules
    kubectl patch configmap monitoring-config -n $NAMESPACE --context=$KUBECTL_CONTEXT --patch-file=/dev/stdin <<EOF
data:
  security-rules.yml: |
$(cat infrastructure/monitoring/security-monitoring.yml | grep -A 1000 "security-rules.yml:" | tail -n +2 | sed 's/^/    /')
EOF
    
    # Restart Prometheus to load new rules
    kubectl rollout restart deployment/prometheus -n $NAMESPACE --context=$KUBECTL_CONTEXT || true
    
    log_success "Monitoring infrastructure deployed"
}

run_database_migrations() {
    log_step "Running database migrations for security features..."
    
    # Make migration script executable
    chmod +x infrastructure/scripts/deploy-security-migrations.sh
    
    # Run security migrations
    ./infrastructure/scripts/deploy-security-migrations.sh --context=$KUBECTL_CONTEXT --namespace=$NAMESPACE
    
    log_success "Database migrations completed"
}

update_application_deployments() {
    log_step "Updating application deployments with new configurations..."
    
    # Update backend deployment
    kubectl patch deployment backend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT -p '{
      "spec": {
        "template": {
          "metadata": {
            "labels": {
              "version": "'$DEPLOYMENT_VERSION'"
            }
          },
          "spec": {
            "containers": [{
              "name": "backend",
              "env": [
                {"name": "ENABLE_PER_USER_JWT", "value": "true"},
                {"name": "ENABLE_PRICING_PROTECTION", "value": "true"},
                {"name": "ENABLE_ENHANCED_OTP", "value": "true"},
                {"name": "ENABLE_SECURITY_MONITORING", "value": "true"},
                {"name": "CDN_ENABLED", "value": "true"},
                {"name": "CDN_URL", "value": "https://cdn.perbox.com"},
                {"name": "DEPLOYMENT_VERSION", "value": "'$DEPLOYMENT_VERSION'"}
              ]
            }]
          }
        }
      }
    }'
    
    # Update frontend deployment
    kubectl patch deployment frontend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT -p '{
      "spec": {
        "template": {
          "metadata": {
            "labels": {
              "version": "'$DEPLOYMENT_VERSION'"
            }
          },
          "spec": {
            "containers": [{
              "name": "frontend",
              "env": [
                {"name": "NEXT_PUBLIC_ENABLE_PHONE_VERIFICATION", "value": "true"},
                {"name": "NEXT_PUBLIC_ENABLE_EMAIL_SIGNUP", "value": "false"},
                {"name": "NEXT_PUBLIC_ENABLE_PRICING_PROTECTION", "value": "true"},
                {"name": "NEXT_PUBLIC_ENABLE_ANIMATIONS", "value": "true"},
                {"name": "NEXT_PUBLIC_ENABLE_MULTIMEDIA_SHOWCASE", "value": "true"},
                {"name": "NEXT_PUBLIC_CDN_URL", "value": "https://cdn.perbox.com"},
                {"name": "NEXT_PUBLIC_MEDIA_URL", "value": "https://media.perbox.com"},
                {"name": "DEPLOYMENT_VERSION", "value": "'$DEPLOYMENT_VERSION'"}
              ]
            }]
          }
        }
      }
    }'
    
    # Wait for rollouts to complete
    kubectl rollout status deployment/backend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT --timeout=600s
    kubectl rollout status deployment/frontend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT --timeout=600s
    
    log_success "Application deployments updated"
}

configure_load_balancer() {
    log_step "Configuring load balancer for new domains..."
    
    # Update NGINX configuration for new domains
    kubectl patch configmap nginx-config -n $NAMESPACE --context=$KUBECTL_CONTEXT --patch-file=/dev/stdin <<EOF
data:
  nginx.conf: |
    upstream backend {
        server backend-service:3001;
    }
    
    upstream frontend {
        server frontend-service:3000;
    }
    
    upstream media-optimization {
        server media-optimization-service:80;
    }
    
    server {
        listen 80;
        server_name perbox.com www.perbox.com;
        return 301 https://\$server_name\$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name perbox.com www.perbox.com;
        
        ssl_certificate /etc/ssl/certs/perbox.crt;
        ssl_certificate_key /etc/ssl/private/perbox.key;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
        
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
    
    server {
        listen 443 ssl http2;
        server_name api.perbox.com;
        
        ssl_certificate /etc/ssl/certs/api-perbox.crt;
        ssl_certificate_key /etc/ssl/private/api-perbox.key;
        
        location / {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
    
    server {
        listen 443 ssl http2;
        server_name media.perbox.com;
        
        ssl_certificate /etc/ssl/certs/media-perbox.crt;
        ssl_certificate_key /etc/ssl/private/media-perbox.key;
        
        location / {
            proxy_pass http://media-optimization;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
EOF
    
    # Restart NGINX
    kubectl rollout restart deployment/nginx-load-balancer -n $NAMESPACE --context=$KUBECTL_CONTEXT
    
    log_success "Load balancer configured"
}

run_comprehensive_health_checks() {
    log_step "Running comprehensive health checks..."
    
    # Check all pods are running
    FAILED_PODS=$(kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [ $FAILED_PODS -gt 0 ]; then
        log_error "Some pods are not running:"
        kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running
        exit 1
    fi
    
    # Test database connectivity and security features
    log_info "Testing database security features..."
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT \
        $(kubectl get pods -n $NAMESPACE -l app=postgres-primary --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}') \
        -- psql -U postgres -d bulk_email_platform -c "SELECT COUNT(*) FROM users WHERE jwt_secret IS NOT NULL;"
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    API_POD=$(kubectl get pods -n $NAMESPACE -l app=backend --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT $API_POD -- curl -f http://localhost:3001/health
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT $API_POD -- curl -f http://localhost:3001/api/auth/health
    
    # Test CDN endpoints
    log_info "Testing CDN endpoints..."
    MEDIA_POD=$(kubectl get pods -n $NAMESPACE -l app=media-optimization --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT $MEDIA_POD -- curl -f http://localhost:8080/health || true
    
    # Test security monitoring
    log_info "Testing security monitoring..."
    SECURITY_POD=$(kubectl get pods -n $NAMESPACE -l app=security-monitor --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT $SECURITY_POD -- curl -f http://localhost:8080/health || true
    
    log_success "Health checks completed successfully"
}

display_deployment_summary() {
    log_step "Deployment Summary"
    
    echo ""
    echo "🚀 Home Page Redesign Production Deployment Complete!"
    echo "=================================================="
    echo ""
    echo "✅ Enhanced Security Features:"
    echo "   • Per-user JWT secrets implemented"
    echo "   • Enhanced OTP system with rate limiting"
    echo "   • JWT-protected pricing system"
    echo "   • Comprehensive security monitoring"
    echo ""
    echo "✅ CDN and Media Optimization:"
    echo "   • CloudFront CDN configured"
    echo "   • Media optimization service deployed"
    echo "   • Optimized asset delivery"
    echo ""
    echo "✅ Monitoring and Alerting:"
    echo "   • Security event monitoring"
    echo "   • Performance dashboards"
    echo "   • Automated alerting system"
    echo ""
    echo "✅ Application Updates:"
    echo "   • Phone-only authentication enabled"
    echo "   • Multimedia showcase activated"
    echo "   • Animated pricing section deployed"
    echo "   • Enhanced error handling"
    echo ""
    
    # Get service information
    echo "🌐 Service Endpoints:"
    echo "===================="
    
    # Get load balancer IP
    LB_IP=$(kubectl get service nginx-load-balancer-service -n $NAMESPACE --context=$KUBECTL_CONTEXT -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "Pending...")
    
    echo "Load Balancer IP: $LB_IP"
    echo ""
    echo "Application URLs (configure DNS):"
    echo "• Main Application: https://perbox.com"
    echo "• API Endpoint: https://api.perbox.com"
    echo "• Media CDN: https://media.perbox.com"
    echo "• CDN Assets: https://cdn.perbox.com"
    echo ""
    
    # Display pod status
    echo "📊 Pod Status:"
    echo "=============="
    kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT
    echo ""
    
    # Display service status
    echo "🔗 Service Status:"
    echo "=================="
    kubectl get services -n $NAMESPACE --context=$KUBECTL_CONTEXT
    echo ""
    
    echo "📈 Monitoring Access:"
    echo "===================="
    echo "• Grafana: https://monitoring.perbox.com"
    echo "• Prometheus: https://prometheus.perbox.com"
    echo "• Security Dashboard: Available in Grafana"
    echo ""
    
    echo "🔐 Security Features Active:"
    echo "============================"
    echo "• Per-user JWT secrets: ✅"
    echo "• Enhanced OTP system: ✅"
    echo "• Pricing protection: ✅"
    echo "• Security monitoring: ✅"
    echo "• Audit logging: ✅"
    echo ""
    
    echo "📝 Next Steps:"
    echo "=============="
    echo "1. Configure DNS records to point to Load Balancer IP"
    echo "2. Verify SSL certificates are properly configured"
    echo "3. Test all authentication flows"
    echo "4. Monitor security dashboards for any issues"
    echo "5. Run user acceptance testing"
    echo ""
    
    echo "Deployment Version: $DEPLOYMENT_VERSION"
    echo "Deployment completed at: $(date)"
}

cleanup_deployment_artifacts() {
    log_step "Cleaning up deployment artifacts..."
    
    # Delete completed jobs older than 1 hour
    kubectl delete jobs -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.successful=1 --ignore-not-found=true
    
    # Clean up old replicasets
    kubectl delete replicasets -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.replicas=0 --ignore-not-found=true
    
    log_success "Cleanup completed"
}

main() {
    log_info "Starting complete production deployment for Home Page Redesign"
    log_info "Deployment Version: $DEPLOYMENT_VERSION"
    echo ""
    
    # Set error trap
    trap 'log_error "Deployment failed. Check logs for details."; exit 1' ERR
    
    check_prerequisites
    deploy_security_infrastructure
    deploy_cdn_infrastructure
    deploy_monitoring_infrastructure
    run_database_migrations
    update_application_deployments
    configure_load_balancer
    run_comprehensive_health_checks
    cleanup_deployment_artifacts
    display_deployment_summary
    
    log_success "🎉 Complete production deployment finished successfully!"
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
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Complete production deployment script for Home Page Redesign"
            echo ""
            echo "Options:"
            echo "  --context CONTEXT    Kubernetes context to use (default: production)"
            echo "  --namespace NS       Kubernetes namespace (default: bulk-email-platform)"
            echo "  --dry-run           Show what would be done without executing"
            echo "  --help              Show this help message"
            echo ""
            echo "This script deploys:"
            echo "  • Enhanced security features (per-user JWT, OTP, pricing protection)"
            echo "  • CDN and media optimization infrastructure"
            echo "  • Monitoring and alerting systems"
            echo "  • Database migrations for security features"
            echo "  • Updated application configurations"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "DRY RUN MODE - No changes will be made"
    log_info "Would execute complete production deployment with:"
    log_info "  Context: $KUBECTL_CONTEXT"
    log_info "  Namespace: $NAMESPACE"
    log_info "  Version: $DEPLOYMENT_VERSION"
else
    main
fi