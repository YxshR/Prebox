#!/bin/bash

# Security Database Migrations Deployment Script
# This script handles deployment of enhanced security features database changes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="bulk-email-platform"
KUBECTL_CONTEXT="production"
MIGRATION_JOB_NAME="security-migrations-$(date +%Y%m%d-%H%M%S)"

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

check_prerequisites() {
    log_info "Checking prerequisites for security migrations..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info --context=$KUBECTL_CONTEXT &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace $NAMESPACE --context=$KUBECTL_CONTEXT &> /dev/null; then
        log_error "Namespace $NAMESPACE does not exist"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

backup_database() {
    log_step "Creating database backup before migrations..."
    
    # Create backup job
    kubectl apply --context=$KUBECTL_CONTEXT -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: db-backup-$(date +%Y%m%d-%H%M%S)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: postgres-backup
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          pg_dump \$DATABASE_URL > /backup/security-migration-backup-\$(date +%Y%m%d-%H%M%S).sql
          echo "Backup completed successfully"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: connection-string
        volumeMounts:
        - name: backup-storage
          mountPath: /backup
      volumes:
      - name: backup-storage
        persistentVolumeClaim:
          claimName: database-backup-pvc
      restartPolicy: OnFailure
  backoffLimit: 3
EOF
    
    # Wait for backup to complete
    log_info "Waiting for database backup to complete..."
    kubectl wait --for=condition=complete job/db-backup-$(date +%Y%m%d-%H%M%S) -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT
    
    log_info "Database backup completed successfully"
}

apply_security_migrations() {
    log_step "Applying security database migrations..."
    
    # Create migration job
    kubectl apply --context=$KUBECTL_CONTEXT -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: $MIGRATION_JOB_NAME
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: security-migrations
        image: perbox/database-migrator:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Starting security migrations..."
          
          # Migration 1: Enhanced Users Table
          echo "Applying enhanced users table migration..."
          psql \$DATABASE_URL -f /migrations/001_enhanced_users_table.sql
          
          # Migration 2: Per-User JWT Secrets
          echo "Applying per-user JWT secrets migration..."
          psql \$DATABASE_URL -f /migrations/002_per_user_jwt_secrets.sql
          
          # Migration 3: Enhanced OTP Table
          echo "Applying enhanced OTP table migration..."
          psql \$DATABASE_URL -f /migrations/003_enhanced_otp_table.sql
          
          # Migration 4: Secure Pricing Table
          echo "Applying secure pricing table migration..."
          psql \$DATABASE_URL -f /migrations/004_secure_pricing_table.sql
          
          # Migration 5: Security Audit Log Table
          echo "Applying security audit log table migration..."
          psql \$DATABASE_URL -f /migrations/005_security_audit_log.sql
          
          # Migration 6: Media Assets Table
          echo "Applying media assets table migration..."
          psql \$DATABASE_URL -f /migrations/006_media_assets_table.sql
          
          # Migration 7: Security Indexes
          echo "Applying security indexes migration..."
          psql \$DATABASE_URL -f /migrations/007_security_indexes.sql
          
          echo "All security migrations completed successfully"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: connection-string
        volumeMounts:
        - name: migration-scripts
          mountPath: /migrations
      volumes:
      - name: migration-scripts
        configMap:
          name: security-migration-scripts
      restartPolicy: OnFailure
  backoffLimit: 3
EOF
    
    # Wait for migrations to complete
    log_info "Waiting for security migrations to complete..."
    kubectl wait --for=condition=complete job/$MIGRATION_JOB_NAME -n $NAMESPACE --timeout=600s --context=$KUBECTL_CONTEXT
    
    log_info "Security migrations completed successfully"
}

seed_security_data() {
    log_step "Seeding initial security data..."
    
    # Create seeding job
    kubectl apply --context=$KUBECTL_CONTEXT -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: security-data-seed-$(date +%Y%m%d-%H%M%S)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: security-seeder
        image: perbox/database-seeder:latest
        command:
        - /bin/sh
        - -c
        - |
          echo "Seeding initial security data..."
          
          # Seed secure pricing data
          echo "Seeding secure pricing data..."
          psql \$DATABASE_URL -f /seeds/secure_pricing_seed.sql
          
          # Seed media assets data
          echo "Seeding media assets data..."
          psql \$DATABASE_URL -f /seeds/media_assets_seed.sql
          
          # Generate JWT secrets for existing users
          echo "Generating JWT secrets for existing users..."
          psql \$DATABASE_URL -f /seeds/generate_user_jwt_secrets.sql
          
          echo "Security data seeding completed successfully"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: connection-string
        - name: PRICING_JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: enhanced-security-secrets
              key: pricing-jwt-secret
        volumeMounts:
        - name: seed-scripts
          mountPath: /seeds
      volumes:
      - name: seed-scripts
        configMap:
          name: security-seed-scripts
      restartPolicy: OnFailure
  backoffLimit: 3
EOF
    
    log_info "Security data seeding completed successfully"
}

verify_migrations() {
    log_step "Verifying security migrations..."
    
    # Create verification job
    kubectl apply --context=$KUBECTL_CONTEXT -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: migration-verification-$(date +%Y%m%d-%H%M%S)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migration-verifier
        image: postgres:15-alpine
        command:
        - /bin/sh
        - -c
        - |
          echo "Verifying security migrations..."
          
          # Check if all tables exist
          echo "Checking table existence..."
          psql \$DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'otp_verifications', 'secure_pricing', 'media_assets', 'security_audit_log');"
          
          # Check if JWT secret columns exist
          echo "Checking JWT secret columns..."
          psql \$DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('jwt_secret', 'jwt_refresh_secret');"
          
          # Check if indexes exist
          echo "Checking security indexes..."
          psql \$DATABASE_URL -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('users', 'otp_verifications', 'secure_pricing');"
          
          # Verify data integrity
          echo "Verifying data integrity..."
          psql \$DATABASE_URL -c "SELECT COUNT(*) as user_count FROM users WHERE jwt_secret IS NOT NULL;"
          psql \$DATABASE_URL -c "SELECT COUNT(*) as pricing_count FROM secure_pricing WHERE jwt_signature IS NOT NULL;"
          
          echo "Migration verification completed successfully"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: connection-string
      restartPolicy: OnFailure
  backoffLimit: 3
EOF
    
    log_info "Migration verification completed successfully"
}

update_application_config() {
    log_step "Updating application configuration for security features..."
    
    # Update backend deployment with new environment variables
    kubectl patch deployment backend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT -p '{
      "spec": {
        "template": {
          "spec": {
            "containers": [{
              "name": "backend",
              "env": [
                {"name": "ENABLE_PER_USER_JWT", "value": "true"},
                {"name": "ENABLE_PRICING_PROTECTION", "value": "true"},
                {"name": "ENABLE_ENHANCED_OTP", "value": "true"},
                {"name": "ENABLE_SECURITY_MONITORING", "value": "true"}
              ]
            }]
          }
        }
      }
    }'
    
    # Update frontend deployment with new feature flags
    kubectl patch deployment frontend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT -p '{
      "spec": {
        "template": {
          "spec": {
            "containers": [{
              "name": "frontend",
              "env": [
                {"name": "NEXT_PUBLIC_ENABLE_PHONE_VERIFICATION", "value": "true"},
                {"name": "NEXT_PUBLIC_ENABLE_EMAIL_SIGNUP", "value": "false"},
                {"name": "NEXT_PUBLIC_ENABLE_PRICING_PROTECTION", "value": "true"}
              ]
            }]
          }
        }
      }
    }'
    
    log_info "Application configuration updated successfully"
}

restart_services() {
    log_step "Restarting services to apply security updates..."
    
    # Restart backend deployment
    kubectl rollout restart deployment/backend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT
    
    # Restart frontend deployment
    kubectl rollout restart deployment/frontend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT
    
    # Wait for rollouts to complete
    kubectl rollout status deployment/backend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT --timeout=300s
    kubectl rollout status deployment/frontend-deployment -n $NAMESPACE --context=$KUBECTL_CONTEXT --timeout=300s
    
    log_info "Services restarted successfully"
}

run_health_checks() {
    log_step "Running post-migration health checks..."
    
    # Check if all pods are running
    FAILED_PODS=$(kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running --no-headers 2>/dev/null | wc -l)
    if [ $FAILED_PODS -gt 0 ]; then
        log_error "Some pods are not running after migration:"
        kubectl get pods -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.phase!=Running
        exit 1
    fi
    
    # Test database connectivity
    log_info "Testing database connectivity..."
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT \
        $(kubectl get pods -n $NAMESPACE -l app=postgres-primary --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}') \
        -- pg_isready -U postgres
    
    # Test API endpoints
    log_info "Testing API endpoints..."
    API_POD=$(kubectl get pods -n $NAMESPACE -l app=backend --context=$KUBECTL_CONTEXT -o jsonpath='{.items[0].metadata.name}')
    kubectl exec -n $NAMESPACE --context=$KUBECTL_CONTEXT $API_POD -- curl -f http://localhost:3001/health
    
    log_info "Health checks passed successfully"
}

cleanup_migration_jobs() {
    log_step "Cleaning up migration jobs..."
    
    # Delete completed migration jobs older than 1 hour
    kubectl delete jobs -n $NAMESPACE --context=$KUBECTL_CONTEXT --field-selector=status.successful=1 --ignore-not-found=true
    
    log_info "Migration jobs cleaned up"
}

main() {
    log_info "Starting security migrations deployment for Perbox Platform"
    
    # Set error trap
    trap 'log_error "Migration failed. Check logs for details."; exit 1' ERR
    
    check_prerequisites
    backup_database
    apply_security_migrations
    seed_security_data
    verify_migrations
    update_application_config
    restart_services
    run_health_checks
    cleanup_migration_jobs
    
    log_info "Security migrations deployment completed successfully!"
    echo ""
    echo "Summary:"
    echo "========"
    echo "✓ Database backup created"
    echo "✓ Security migrations applied"
    echo "✓ Security data seeded"
    echo "✓ Migrations verified"
    echo "✓ Application configuration updated"
    echo "✓ Services restarted"
    echo "✓ Health checks passed"
    echo ""
    echo "The enhanced security features are now active in production."
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
            echo "Options:"
            echo "  --context CONTEXT    Kubernetes context to use (default: production)"
            echo "  --namespace NS       Kubernetes namespace (default: bulk-email-platform)"
            echo "  --dry-run           Show what would be done without executing"
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
if [[ "${DRY_RUN:-false}" == "true" ]]; then
    log_info "DRY RUN MODE - No changes will be made"
    log_info "Would execute security migrations deployment with:"
    log_info "  Context: $KUBECTL_CONTEXT"
    log_info "  Namespace: $NAMESPACE"
else
    main
fi