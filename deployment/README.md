# Control Panel CI/CD Integration

This directory contains the files needed to integrate the GMAC.IO Control Panel with the CI deployment system.

## Overview

The control panel is built as a containerized application with multiple components:
- **Frontend**: Next.js application with modern UI
- **Backend**: Python FastAPI service for Kubernetes integration
- **AI Services**: Individual microservices for AI-powered operations

## Integration with CI System

### GitHub Actions Workflow

The `.github/workflows/build-and-push.yml` file:
- Builds multi-stage Docker images
- Pushes to GitHub Container Registry (ghcr.io)
- Runs security scans
- Updates deployment configurations
- Triggers deployments to dev/prod environments

### Docker Images

The following images are published to `ghcr.io/gmac-io/`:
- `control-panel:latest` - Frontend application
- `control-panel-backend:latest` - Backend API
- `control-panel-incident-prediction:latest` - AI incident prediction
- `control-panel-capacity-planning:latest` - AI capacity planning
- `control-panel-root-cause-analysis:latest` - AI root cause analysis
- `control-panel-resource-optimization:latest` - AI resource optimization
- `control-panel-anomaly-detection:latest` - AI anomaly detection

### Replacing Static Dashboard

To replace the existing static dashboard in the CI system:

1. **Update the install script** in `/components/control-panel/install.sh`:
   ```bash
   # Replace the existing content with:
   #!/bin/bash
   source "${SCRIPT_DIR}/lib/common.sh"
   
   # Download and run the enhanced installer
   curl -fsSL https://raw.githubusercontent.com/gmac-io/control-panel/main/deployment/install-control-panel.sh | bash -s -- \
     --domain="${DOMAIN:-control-panel.local}" \
     --registry="ghcr.io/gmac-io" \
     --image-tag="latest"
   ```

2. **Or copy the deployment files** to the CI repository:
   ```bash
   cp deployment/control-panel-deployment.yaml /path/to/gmac-io-ci/components/control-panel/
   cp deployment/install-control-panel.sh /path/to/gmac-io-ci/components/control-panel/
   ```

## Installation

### Quick Install

```bash
# Using the enhanced installer
curl -fsSL https://raw.githubusercontent.com/gmac-io/control-panel/main/deployment/install-control-panel.sh | bash

# Or with custom configuration
./deployment/install-control-panel.sh \
  --domain=control.example.com \
  --registry=ghcr.io/your-org \
  --image-tag=v1.0.0
```

### Manual Install

```bash
# Apply the deployment configuration
kubectl apply -f deployment/control-panel-deployment.yaml

# Or use the enhanced installer
./deployment/install-control-panel.sh
```

### Configuration Options

Environment variables for customization:
- `DOMAIN` - Domain for the control panel (default: control-panel.local)
- `REGISTRY` - Docker registry (default: ghcr.io/gmac-io)
- `IMAGE_TAG` - Image tag to deploy (default: latest)
- `STORAGE_CLASS` - Storage class for PVCs (default: longhorn)

## Features

The enhanced control panel provides:

### Core Features
- **Kubernetes Management**: Full cluster administration
- **Application Deployments**: GitOps-style deployments
- **Service Discovery**: Automatic detection of cluster services
- **Monitoring Integration**: Prometheus, Grafana, AlertManager
- **Log Management**: Centralized logging and analysis

### AI-Powered Operations
- **Incident Prediction**: ML-based incident forecasting
- **Capacity Planning**: Intelligent resource forecasting
- **Root Cause Analysis**: Automated incident investigation
- **Resource Optimization**: Smart resource allocation
- **Anomaly Detection**: Multi-method anomaly detection

### Advanced Features
- **Auto-scaling**: Intelligent cluster scaling
- **Hybrid Infrastructure**: Multi-cloud management
- **Security Monitoring**: Real-time security analysis
- **Cost Optimization**: Resource cost management

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Next.js)     │◄──►│   (FastAPI)     │
└─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│                AI Services                              │
├─────────────────┬─────────────────┬─────────────────────┤
│ Incident        │ Capacity        │ Root Cause          │
│ Prediction      │ Planning        │ Analysis            │
├─────────────────┼─────────────────┼─────────────────────┤
│ Resource        │ Anomaly         │                     │
│ Optimization    │ Detection       │                     │
└─────────────────┴─────────────────┴─────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────┐
│              Kubernetes API                             │
└─────────────────────────────────────────────────────────┘
```

## Development

### Building Locally

```bash
# Build all images
docker build --target frontend -t control-panel:latest .
docker build --target backend -t control-panel-backend:latest .
docker build --target incident-prediction -t control-panel-incident-prediction:latest .
# ... etc for other AI services
```

### Testing

```bash
# Run frontend tests
npm test

# Run backend tests
python -m pytest tests/

# Run AI service tests
python -m pytest ai-services/tests/
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Troubleshooting

### Common Issues

1. **Images not pulling**: Check registry credentials and image tags
2. **Services not starting**: Check resource limits and node capacity
3. **Ingress not working**: Verify cert-manager and nginx-ingress are installed
4. **AI services failing**: Check resource allocation (need 1Gi+ RAM each)

### Debugging

```bash
# Check pod status
kubectl get pods -n control-panel

# View logs
kubectl logs -f deployment/control-panel-frontend -n control-panel

# Check service endpoints
kubectl get endpoints -n control-panel

# Describe problematic pods
kubectl describe pod <pod-name> -n control-panel
```

### Health Checks

Access health endpoints:
- Frontend: `https://your-domain/api/health`
- Backend: `https://your-domain/api/health`
- AI Services: `http://service-name:8001/health`

## Security

### RBAC

The control panel requires cluster-admin level permissions for full functionality. Review the RBAC configuration in the deployment files.

### Network Policies

Network policies are included to restrict traffic between components. Adjust as needed for your security requirements.

### Image Security

All images are scanned with Trivy in the CI pipeline. Security scan results are available in the GitHub Security tab.

## Support

For issues and questions:
- GitHub Issues: https://github.com/gmac-io/control-panel/issues
- Documentation: https://docs.gmac.io/control-panel
- Community: https://discord.gg/gmac-io