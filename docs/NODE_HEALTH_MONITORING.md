# Node Health Monitoring Documentation

## Overview

The GMAC.IO Control Panel includes comprehensive node health monitoring that provides real-time insights into cluster health, resource utilization, and system conditions. The monitoring system proactively detects issues and alerts administrators to potential problems.

## Features

- **Real-time Metrics**: CPU, memory, and pod utilization monitoring
- **Health Status Tracking**: Automatic categorization of nodes as healthy, warning, or critical
- **Condition Monitoring**: Tracks disk pressure, memory pressure, network issues
- **Alert System**: Proactive alerts for resource thresholds and node conditions
- **Historical Data**: Metrics retention for trend analysis
- **Live Updates**: Server-sent events for real-time dashboard updates

## Architecture

### Components

1. **HealthMonitor Module** (`src/lib/cluster/modules/health-monitor.ts`)
   - Collects node metrics via kubectl
   - Evaluates health conditions
   - Manages alerts and notifications
   - Stores historical metrics

2. **HealthDashboard UI** (`src/components/cluster/HealthDashboard.tsx`)
   - Real-time health visualization
   - Node status grid
   - Active alerts display
   - Resource usage progress bars

3. **API Endpoints**
   - `/api/cluster/health` - Health status and alerts
   - `/api/cluster/health/stream` - Real-time SSE stream

### Health Status Levels

- **Healthy** (Green): All systems operating normally
- **Warning** (Yellow): Resource usage high or minor issues detected
- **Critical** (Red): Severe issues requiring immediate attention
- **Unknown** (Gray): Unable to determine status

## Metrics Collected

### Resource Metrics
- **CPU Usage**: Current utilization percentage
- **Memory Usage**: RAM consumption percentage
- **Pod Count**: Number of pods vs. capacity

### Node Conditions
- **Ready**: Node is ready to accept pods
- **MemoryPressure**: Available memory is low
- **DiskPressure**: Available disk space is low
- **PIDPressure**: Process count is near limit
- **NetworkUnavailable**: Network connectivity issues

### System Information
- Kernel version
- OS image
- Container runtime version
- Kubelet version
- Architecture

## Configuration

### Default Thresholds

```javascript
{
  cpu: {
    warning: 70,    // 70% CPU usage
    critical: 90    // 90% CPU usage
  },
  memory: {
    warning: 80,    // 80% memory usage
    critical: 95    // 95% memory usage
  },
  disk: {
    warning: 80,    // 80% disk usage
    critical: 90    // 90% disk usage
  },
  heartbeat: {
    warning: 60,    // 60 seconds without update
    critical: 120   // 120 seconds without update
  }
}
```

### Monitoring Settings

- **Check Interval**: 30 seconds (how often metrics are collected)
- **Metrics Retention**: 24 hours (how long historical data is kept)
- **Alert Resolution**: Automatic when conditions improve

## Usage

### Accessing Health Dashboard

1. Navigate to the Cluster page
2. Click on the "Health" tab
3. View real-time health status

### Understanding the Dashboard

#### Cluster Health Overview
- Shows count of healthy, warning, and critical nodes
- Overall cluster status indicator
- Quick visual summary of cluster health

#### Active Alerts
- Lists current issues requiring attention
- Shows severity level and time since occurrence
- Automatically updates as alerts are resolved

#### Node Health Status
- Individual cards for each node
- Real-time resource usage with progress bars
- Condition badges for specific issues
- Color-coded status indicators

## Alert Types

### Resource Alerts
- **CPU Alert**: Triggered when CPU usage exceeds threshold
- **Memory Alert**: Triggered when memory usage is critical
- **Disk Alert**: Triggered when disk pressure is detected

### Condition Alerts
- **Node Not Ready**: Node cannot accept new pods
- **Network Unavailable**: Network connectivity lost
- **Heartbeat Lost**: No updates received from node

### Example Alert
```json
{
  "id": "node-1-cpu-1234567890",
  "nodeName": "k3s-worker-1",
  "type": "cpu",
  "severity": "warning",
  "message": "CPU usage high: 85.3%",
  "timestamp": "2024-01-10T10:30:00Z",
  "resolved": false
}
```

## Real-time Updates

The health monitoring system uses Server-Sent Events (SSE) for live updates:

### Event Types
- **metrics**: New metrics data for a node
- **alert**: New alert created
- **alertResolved**: Alert has been resolved

### Example SSE Stream
```javascript
data: {"type":"metrics","nodeName":"k3s-master","metrics":{...}}

data: {"type":"alert","data":{"id":"...","message":"CPU usage critical: 92%"}}

data: {"type":"alertResolved","data":{"id":"...","resolvedAt":"2024-01-10T10:35:00Z"}}
```

## Best Practices

### Monitoring Configuration
1. Set appropriate thresholds based on workload
2. Adjust check intervals for critical clusters
3. Configure metrics retention based on analysis needs
4. Test alert thresholds to avoid false positives

### Response to Alerts
1. **CPU Alerts**: 
   - Check for runaway processes
   - Consider horizontal pod autoscaling
   - Review node sizing

2. **Memory Alerts**:
   - Identify memory leaks
   - Check pod resource limits
   - Consider adding nodes

3. **Disk Alerts**:
   - Clean up unused images/volumes
   - Check log rotation
   - Expand storage if needed

4. **Network Alerts**:
   - Verify network connectivity
   - Check firewall rules
   - Review network policies

### Maintenance
1. Regularly review historical metrics
2. Adjust thresholds based on patterns
3. Clean up resolved alerts periodically
4. Test alerting system regularly

## Troubleshooting

### No Metrics Displayed
1. Verify metrics-server is installed in cluster
2. Check kubectl connectivity
3. Ensure proper RBAC permissions
4. Review health monitor logs

### False Alerts
1. Adjust threshold values
2. Increase check intervals
3. Review node specifications
4. Check for metric collection issues

### Missing Nodes
1. Verify node is registered in cluster
2. Check node labels
3. Ensure kubelet is running
4. Review network connectivity

## Integration with Autoscaling

The health monitoring system integrates with cluster autoscaling:
- Provides metrics for scaling decisions
- Alerts can trigger scaling policies
- Historical data helps optimize scaling rules
- Node health considered before removal

## API Reference

### GET /api/cluster/health
Returns current health status, alerts, and summary.

Response:
```json
{
  "summary": {
    "node-1": "healthy",
    "node-2": "warning"
  },
  "alerts": [...],
  "health": {
    "healthy": true,
    "message": "Monitoring 3 nodes, 1 active alert"
  }
}
```

### GET /api/cluster/health?metrics=true&node=node-1
Returns detailed metrics for specific node.

### GET /api/cluster/health/stream
Opens SSE connection for real-time updates.

## Future Enhancements

- Custom metric collection (Prometheus integration)
- Predictive health analysis using ML
- Automated remediation actions
- Integration with external monitoring tools
- Mobile app notifications
- Metric aggregation across multiple clusters
- Custom alert channels (Slack, email)
- Performance baseline learning