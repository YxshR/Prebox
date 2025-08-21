# Production Infrastructure Setup

This directory contains all the configuration files and scripts needed to deploy the Bulk Email Platform to production.

## Overview

The production infrastructure includes:

- **PostgreSQL Cluster**: High-availability database with read replicas
- **Redis Cluster**: Caching and queue management
- **Load Balancer**: NGINX-based load balancing with SSL termination
- **API Gateway**: Kong-based API management and rate limiting
- **File Storage**: S3-based storage for logos and branding assets
- **CI/CD Pipelines**: GitHub Actions for automated deployment
- **Monitoring**: Prometheus and Grafana for observability

## Prerequisites

Before deploying to production, ensure you have:

1. **Kubernetes Cluster**: A production-ready Kubernetes cluster (EKS, GKE, or AKS)
2. **kubectl**: Configured to access your production cluster
3. **Docker Registry**: Access to GitHub Container Registry or similar
4. **AWS Account**: For S3 storage and SES email services
5. **Domain Names**: Registered domains for the application
6. **SSL Certificates**: Valid SSL certificates for your domains

## Directory Structure

```
infrastructure/
├── database/
│   ├── production-schema.sql      # Complete database schema
│   └── cluster-config.yml         # PostgreSQL cluster configuration
├── kubernetes/
│   └── production/
│       ├── namespace.yml          # Namespace and resource quotas
│       ├── secrets.yml            # Secret templates
│       ├── configmaps.yml         # Configuration maps
│       ├── deployments.yml        # Application deployments
│       └── services.yml           # Kubernetes services
├── load-balancer/
│   └── nginx-config.yml           # NGINX load balancer configuration
├── api-gateway/
│   └── kong-config.yml            # Kong API gateway configuration
├── storage/
│   ├── s3-bucket-config.yml       # S3 bucket setup
│   └── file-upload-service.yml    # File upload service
├── deploy-production.sh           # Linux/Mac deployment script
├── deploy-production.bat          # Windows deployment script
└── README.md                      # This file
```

## Deployment Steps

### 1. Prepare Secrets

Before deployment, you need to create and configure secrets:

```bash
# Copy the secrets template
cp infrastructure/kubernetes/production/secrets.yml secrets-production.yml

# Edit the file and add base64-encoded values for:
# - Database passwords
# - JWT secrets
# - API keys (AWS, SendGrid, Stripe, etc.)
# - SSL certificates
```

### 2. Configure Domain Names

Update the following files with your actual domain names:

- `infrastructure/load-balancer/nginx-config.yml`
- `infrastructure/kubernetes/production/configmaps.yml`

### 3. Set Up AWS Resources

Ensure you have:

- AWS IAM user with S3 and SES permissions
- SES domain verification completed
- Route 53 or external DNS configured

### 4. Deploy Infrastructure

#### Linux/Mac:
```bash
# Make the script executable
chmod +x infrastructure/deploy-production.sh

# Run the deployment
./infrastructure/deploy-production.sh
```

#### Windows:
```cmd
# Run the deployment script
infrastructure\deploy-production.bat
```

#### Manual Deployment:
```bash
# Set your kubectl context
kubectl config use-context production

# Deploy step by step
kubectl apply -f infrastructure/kubernetes/production/namespace.yml
kubectl apply -f secrets-production.yml  # Your customized secrets
kubectl apply -f infrastructure/kubernetes/production/configmaps.yml
kubectl apply -f infrastructure/database/cluster-config.yml
kubectl apply -f infrastructure/storage/s3-bucket-config.yml
kubectl apply -f infrastructure/kubernetes/production/services.yml
kubectl apply -f infrastructure/kubernetes/production/deployments.yml
kubectl apply -f infrastructure/load-balancer/nginx-config.yml
kubectl apply -f infrastructure/api-gateway/kong-config.yml
```

### 5. Verify Deployment

Check that all components are running:

```bash
# Check pods
kubectl get pods -n bulk-email-platform

# Check services
kubectl get services -n bulk-email-platform

# Check ingress/load balancer
kubectl get ingress -n bulk-email-platform

# View logs
kubectl logs -f deployment/backend-deployment -n bulk-email-platform
```

## Configuration Details

### Database Configuration

The PostgreSQL cluster includes:
- Primary database with automatic failover
- 2 read replicas for load distribution
- Automated backups and point-in-time recovery
- SSL encryption for all connections

### Storage Configuration

S3 storage is configured with:
- Separate buckets for different asset types
- Cross-region replication for backup
- Lifecycle policies for cost optimization
- Server-side encryption enabled

### Security Features

- Network policies for pod-to-pod communication
- Resource quotas to prevent resource exhaustion
- Secret management for sensitive data
- SSL/TLS encryption for all external traffic
- Rate limiting and DDoS protection

### Monitoring and Observability

The infrastructure includes:
- Prometheus for metrics collection
- Grafana for visualization
- Alert manager for notifications
- Application performance monitoring
- Log aggregation and analysis

## Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

Applications are configured with HPA based on:
- CPU utilization (70% threshold)
- Memory utilization (80% threshold)
- Custom metrics (queue length, response time)

### Vertical Pod Autoscaler (VPA)

VPA is configured to:
- Recommend resource adjustments
- Automatically update resource requests
- Optimize cost and performance

## Backup and Disaster Recovery

### Database Backups

- Automated daily backups to S3
- Point-in-time recovery capability
- Cross-region backup replication
- Backup retention policy (30 days)

### Application Data

- S3 cross-region replication
- Versioning enabled for all objects
- Lifecycle policies for cost optimization

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour
3. **Backup verification**: Weekly automated tests
4. **Failover procedures**: Documented and tested monthly

## Maintenance

### Regular Tasks

- **Weekly**: Review resource utilization and scaling
- **Monthly**: Security updates and patches
- **Quarterly**: Disaster recovery testing
- **Annually**: Infrastructure cost optimization review

### Monitoring Alerts

Key alerts configured:
- High error rates (>5%)
- Database connection failures
- High memory/CPU usage (>90%)
- SSL certificate expiration (30 days)
- Disk space usage (>85%)

## Troubleshooting

### Common Issues

1. **Pod Startup Failures**
   ```bash
   kubectl describe pod <pod-name> -n bulk-email-platform
   kubectl logs <pod-name> -n bulk-email-platform
   ```

2. **Database Connection Issues**
   ```bash
   kubectl exec -it <postgres-pod> -n bulk-email-platform -- psql -U postgres
   ```

3. **Storage Access Problems**
   ```bash
   kubectl logs deployment/file-upload-service -n bulk-email-platform
   ```

4. **Load Balancer Issues**
   ```bash
   kubectl describe service nginx-load-balancer-service -n bulk-email-platform
   ```

### Performance Optimization

- Monitor resource usage with `kubectl top`
- Adjust HPA thresholds based on traffic patterns
- Optimize database queries and indexes
- Review and adjust resource requests/limits

## Security Considerations

### Network Security

- All inter-service communication encrypted
- Network policies restrict pod-to-pod traffic
- Ingress controller with WAF capabilities
- DDoS protection at load balancer level

### Data Security

- Encryption at rest for all persistent data
- Encryption in transit for all communications
- Regular security scanning of container images
- Secrets rotation policy (90 days)

### Compliance

The infrastructure supports:
- GDPR compliance features
- SOC 2 Type II requirements
- PCI DSS for payment processing
- HIPAA for healthcare customers (optional)

## Cost Optimization

### Resource Management

- Right-sizing based on actual usage
- Spot instances for non-critical workloads
- Reserved instances for predictable workloads
- Auto-scaling to match demand

### Storage Optimization

- Lifecycle policies for S3 storage
- Compression for log files
- Regular cleanup of temporary files
- Monitoring of storage costs

## Support and Maintenance

For production support:

1. **Monitoring Dashboard**: Access Grafana at `https://monitoring.bulkemail.com`
2. **Log Analysis**: Kibana at `https://logs.bulkemail.com`
3. **Alert Notifications**: Configured via Slack/PagerDuty
4. **Emergency Contacts**: Documented in runbook

## Next Steps

After successful deployment:

1. Configure DNS records to point to load balancer
2. Set up monitoring dashboards
3. Configure backup verification
4. Test disaster recovery procedures
5. Set up automated security scanning
6. Configure cost monitoring and alerts

For questions or issues, refer to the troubleshooting section or contact the infrastructure team.