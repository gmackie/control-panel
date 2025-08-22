# Cluster Autoscaling Guide

## Overview

The GMAC.IO Control Panel includes a powerful cluster autoscaling feature that automatically adjusts the number of nodes in your k3s cluster based on resource utilization and predefined policies.

## Features

- **Multiple Scaling Policies**: Configure different policies for CPU, memory, or pod-based scaling
- **Flexible Thresholds**: Set custom scale-up and scale-down thresholds
- **Cooldown Periods**: Prevent rapid scaling with configurable cooldown timers
- **Real-time Metrics**: Monitor cluster metrics and scaling decisions in real-time
- **Dry Run Mode**: Test policies without actual scaling actions

## Architecture

### Components

1. **ClusterAutoscaler Module** (`src/lib/cluster/modules/autoscaler.ts`)
   - Core autoscaling logic
   - Metrics collection
   - Policy evaluation
   - Scaling decisions

2. **AutoscalingPanel UI** (`src/components/cluster/AutoscalingPanel.tsx`)
   - Policy configuration interface
   - Real-time metrics display
   - Scaling history visualization

3. **API Routes**
   - `/api/cluster/autoscaling` - Main autoscaling endpoint
   - `/api/cluster/autoscaling/policies` - Policy templates

### How It Works

1. **Metrics Collection**
   - Collects CPU, memory, and pod metrics from all nodes
   - Stores historical data for trend analysis
   - Updates every 60 seconds by default

2. **Policy Evaluation**
   - Compares current metrics against policy thresholds
   - Considers cooldown periods to prevent flapping
   - Makes scaling decisions based on policy rules

3. **Scaling Actions**
   - **Scale Up**: Provisions new worker nodes via Hetzner API
   - **Scale Down**: Drains and removes underutilized nodes
   - Maintains minimum and maximum node limits

## Configuration

### Environment Variables

```env
HETZNER_API_TOKEN=your-hetzner-api-token
```

### Default Policies

#### CPU-Based Scaling
- Scales based on average CPU utilization across nodes
- Default target: 70% CPU utilization
- Scale up at 120% of target (84% CPU)
- Scale down at 50% of target (35% CPU)

#### Memory-Based Scaling
- Scales based on average memory utilization
- Default target: 80% memory utilization
- Scale up at 110% of target (88% memory)
- Scale down at 60% of target (48% memory)

#### Pod Pressure Scaling
- Scales based on pod count and pending pods
- Default target: 100 pods per node
- Immediate scale up when pods are pending
- Scale down when significantly under capacity

#### Business Hours Scaling
- Time-based scaling for predictable workloads
- Scale up during business hours (8 AM - 6 PM)
- Scale down after hours and weekends
- Combines with utilization metrics

## Usage

### Enable Autoscaling

1. Navigate to the Cluster page
2. Click on the "Autoscaling" tab
3. Toggle the desired policy to enable it
4. Adjust thresholds and limits as needed

### Monitor Scaling Events

The autoscaling panel displays:
- Current cluster metrics
- Active policies and their status
- Recent scaling events
- Node count over time

### Configure Policies

Each policy can be customized with:
- **Node Limits**: Min/max nodes allowed
- **Target Metrics**: CPU%, Memory%, or Pod count
- **Thresholds**: When to scale up/down
- **Cooldowns**: Time between scaling actions

### Example Configuration

```typescript
{
  name: 'production-scaling',
  enabled: true,
  minNodes: 3,
  maxNodes: 10,
  targetCPUUtilization: 75,
  targetMemoryUtilization: 85,
  scaleUpThreshold: 1.2,    // Scale up at 90% CPU or 102% memory
  scaleDownThreshold: 0.5,  // Scale down at 37.5% CPU or 42.5% memory
  scaleUpCooldown: 300,     // 5 minutes
  scaleDownCooldown: 900,   // 15 minutes
}
```

## Best Practices

1. **Start Conservative**
   - Begin with higher scale-up thresholds
   - Use longer cooldown periods
   - Monitor behavior before aggressive tuning

2. **Consider Workload Patterns**
   - Use business hours scaling for predictable loads
   - Adjust thresholds based on application requirements
   - Account for startup times in cooldown periods

3. **Cost Optimization**
   - Set appropriate maximum node limits
   - Use scale-down thresholds that balance cost and performance
   - Consider spot instances for non-critical workloads

4. **Monitoring**
   - Review scaling history regularly
   - Watch for scaling flapping (rapid up/down)
   - Adjust policies based on observed patterns

## Troubleshooting

### Autoscaler Not Working

1. Check if HETZNER_API_TOKEN is set
2. Verify kubeconfig is properly configured
3. Ensure metrics-server is installed in cluster
4. Check autoscaler health in the UI

### Excessive Scaling

1. Increase cooldown periods
2. Widen the gap between scale-up and scale-down thresholds
3. Review metrics history for anomalies
4. Consider using dry-run mode for testing

### Nodes Not Joining Cluster

1. Verify cloud-init script in node provisioning
2. Check k3s token and server URL
3. Review firewall rules between nodes
4. Check Hetzner API quotas

## API Reference

### GET /api/cluster/autoscaling
Returns current autoscaling status, policies, and metrics.

### PUT /api/cluster/autoscaling
Updates a specific policy configuration.

```json
{
  "policyName": "cpu-based",
  "updates": {
    "enabled": true,
    "targetCPUUtilization": 80
  }
}
```

### GET /api/cluster/autoscaling/policies
Returns available policy templates.

## Future Enhancements

- Custom metrics support (Prometheus integration)
- Predictive scaling based on historical patterns
- Multi-cluster autoscaling coordination
- Cost-aware scaling decisions
- Integration with HPA (Horizontal Pod Autoscaler)