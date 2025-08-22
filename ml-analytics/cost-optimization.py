#!/usr/bin/env python3
"""
Cost Optimization Recommendations System
Analyzes resource usage patterns and provides intelligent cost optimization recommendations
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import requests
import warnings
warnings.filterwarnings('ignore')

@dataclass
class ResourceUsage:
    """Data class for resource usage analysis"""
    resource_type: str  # cpu, memory, storage, network
    current_allocation: float
    actual_usage: float
    utilization_percentage: float
    peak_usage: float
    average_usage: float
    cost_per_unit: float
    total_current_cost: float

@dataclass
class CostOptimization:
    """Data class for cost optimization recommendations"""
    optimization_type: str  # rightsizing, scheduling, resource_type_change
    target_resource: str
    current_cost: float
    optimized_cost: float
    potential_savings: float
    savings_percentage: float
    implementation_effort: str  # low, medium, high
    risk_level: str  # low, medium, high
    recommendation: str
    implementation_steps: List[str]
    impact_analysis: Dict[str, Any]
    confidence_score: float

@dataclass
class CostTrend:
    """Data class for cost trends"""
    period: str
    cost_trend: str  # increasing, decreasing, stable
    growth_rate: float
    projected_monthly_cost: float
    cost_breakdown: Dict[str, float]
    efficiency_score: float

class CostOptimizationEngine:
    """Advanced cost optimization using ML and usage pattern analysis"""
    
    def __init__(self, prometheus_url: str = "http://prometheus:9090"):
        self.prometheus_url = prometheus_url
        self.cost_models = {}
        self.usage_patterns = {}
        self.model_path = "/models/cost_optimization"
        
        # Cost rates (example rates - would be configured per cloud provider)
        self.cost_rates = {
            'cpu_core_hour': 0.048,      # $0.048 per vCPU hour
            'memory_gb_hour': 0.0067,    # $0.0067 per GB memory hour
            'storage_gb_month': 0.10,    # $0.10 per GB storage per month
            'network_gb': 0.09,          # $0.09 per GB network transfer
            'load_balancer_hour': 0.025, # $0.025 per load balancer hour
            'persistent_volume_gb_month': 0.10  # $0.10 per GB persistent volume per month
        }
        
        # Efficiency thresholds
        self.efficiency_thresholds = {
            'cpu_utilization': {'good': 0.70, 'acceptable': 0.50, 'poor': 0.30},
            'memory_utilization': {'good': 0.80, 'acceptable': 0.60, 'poor': 0.40},
            'storage_utilization': {'good': 0.85, 'acceptable': 0.70, 'poor': 0.50}
        }
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Load existing models
        self._load_models()
    
    def analyze_resource_usage(self, days_back: int = 7) -> Dict[str, ResourceUsage]:
        """Analyze resource usage patterns over time"""
        print("📊 Analyzing resource usage patterns...")
        
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        # Collect resource usage data
        usage_data = self._collect_usage_data(start_time, end_time)
        
        resource_analysis = {}
        
        # Analyze CPU usage
        cpu_analysis = self._analyze_cpu_usage(usage_data)
        if cpu_analysis:
            resource_analysis['cpu'] = cpu_analysis
        
        # Analyze memory usage
        memory_analysis = self._analyze_memory_usage(usage_data)
        if memory_analysis:
            resource_analysis['memory'] = memory_analysis
        
        # Analyze storage usage
        storage_analysis = self._analyze_storage_usage(usage_data)
        if storage_analysis:
            resource_analysis['storage'] = storage_analysis
        
        # Analyze network usage
        network_analysis = self._analyze_network_usage(usage_data)
        if network_analysis:
            resource_analysis['network'] = network_analysis
        
        return resource_analysis
    
    def generate_cost_optimizations(self, resource_usage: Dict[str, ResourceUsage]) -> List[CostOptimization]:
        """Generate cost optimization recommendations"""
        print("💡 Generating cost optimization recommendations...")
        
        optimizations = []
        
        for resource_type, usage in resource_usage.items():
            # Right-sizing recommendations
            rightsizing_opts = self._generate_rightsizing_recommendations(resource_type, usage)
            optimizations.extend(rightsizing_opts)
            
            # Scheduling optimizations
            scheduling_opts = self._generate_scheduling_optimizations(resource_type, usage)
            optimizations.extend(scheduling_opts)
            
            # Resource type optimizations
            type_opts = self._generate_resource_type_optimizations(resource_type, usage)
            optimizations.extend(type_opts)
        
        # Cross-resource optimizations
        cross_resource_opts = self._generate_cross_resource_optimizations(resource_usage)
        optimizations.extend(cross_resource_opts)
        
        # Sort by potential savings
        optimizations.sort(key=lambda x: x.potential_savings, reverse=True)
        
        return optimizations
    
    def analyze_cost_trends(self, days_back: int = 30) -> CostTrend:
        """Analyze cost trends and projections"""
        print("📈 Analyzing cost trends...")
        
        # Collect historical cost data
        cost_data = self._collect_cost_data(days_back)
        
        # Calculate trend
        trend_analysis = self._calculate_cost_trend(cost_data)
        
        # Project future costs
        projected_cost = self._project_monthly_cost(cost_data)
        
        # Calculate efficiency score
        efficiency_score = self._calculate_efficiency_score(cost_data)
        
        return CostTrend(
            period=f"Last {days_back} days",
            cost_trend=trend_analysis['trend'],
            growth_rate=trend_analysis['growth_rate'],
            projected_monthly_cost=projected_cost,
            cost_breakdown=cost_data['breakdown'],
            efficiency_score=efficiency_score
        )
    
    def _collect_usage_data(self, start_time: datetime, end_time: datetime) -> Dict[str, List[float]]:
        """Collect resource usage data from metrics"""
        
        metrics_queries = {
            'cpu_allocated': 'sum(kube_pod_container_resource_requests{resource="cpu", container="control-panel"})',
            'cpu_used': 'sum(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory_allocated_gb': 'sum(kube_pod_container_resource_requests{resource="memory", container="control-panel"}) / 1024 / 1024 / 1024',
            'memory_used_gb': 'sum(container_memory_usage_bytes{container="control-panel"}) / 1024 / 1024 / 1024',
            'storage_allocated_gb': 'sum(kube_persistentvolumeclaim_resource_requests_storage_bytes) / 1024 / 1024 / 1024',
            'storage_used_gb': 'sum(kubelet_volume_stats_used_bytes) / 1024 / 1024 / 1024',
            'network_rx_gb': 'sum(rate(container_network_receive_bytes_total{name="control-panel"}[5m])) * 3600 / 1024 / 1024 / 1024',
            'network_tx_gb': 'sum(rate(container_network_transmit_bytes_total{name="control-panel"}[5m])) * 3600 / 1024 / 1024 / 1024',
            'pod_count': 'count(up{job="control-panel"})'
        }
        
        usage_data = {}
        
        # Collect data points over time
        time_points = []
        current_time = start_time
        while current_time <= end_time:
            time_points.append(current_time)
            current_time += timedelta(hours=1)
        
        for metric_name, query in metrics_queries.items():
            values = []
            for time_point in time_points:
                try:
                    value = self._query_prometheus_at_time(query, time_point)
                    values.append(value)
                except Exception:
                    # Use simulated data if Prometheus unavailable
                    values.append(self._simulate_usage_metric(metric_name, time_point))
            
            usage_data[metric_name] = values
        
        return usage_data
    
    def _analyze_cpu_usage(self, usage_data: Dict[str, List[float]]) -> Optional[ResourceUsage]:
        """Analyze CPU usage patterns"""
        
        if 'cpu_allocated' not in usage_data or 'cpu_used' not in usage_data:
            return None
        
        allocated = np.array(usage_data['cpu_allocated'])
        used = np.array(usage_data['cpu_used'])
        
        # Remove zero allocations
        valid_indices = allocated > 0
        if not np.any(valid_indices):
            return None
        
        allocated = allocated[valid_indices]
        used = used[valid_indices]
        
        current_allocation = np.mean(allocated)
        actual_usage = np.mean(used)
        utilization = actual_usage / current_allocation if current_allocation > 0 else 0
        peak_usage = np.max(used)
        
        cost_per_hour = current_allocation * self.cost_rates['cpu_core_hour']
        daily_cost = cost_per_hour * 24
        
        return ResourceUsage(
            resource_type='cpu',
            current_allocation=current_allocation,
            actual_usage=actual_usage,
            utilization_percentage=utilization * 100,
            peak_usage=peak_usage,
            average_usage=actual_usage,
            cost_per_unit=self.cost_rates['cpu_core_hour'],
            total_current_cost=daily_cost
        )
    
    def _analyze_memory_usage(self, usage_data: Dict[str, List[float]]) -> Optional[ResourceUsage]:
        """Analyze memory usage patterns"""
        
        if 'memory_allocated_gb' not in usage_data or 'memory_used_gb' not in usage_data:
            return None
        
        allocated = np.array(usage_data['memory_allocated_gb'])
        used = np.array(usage_data['memory_used_gb'])
        
        # Remove zero allocations
        valid_indices = allocated > 0
        if not np.any(valid_indices):
            return None
        
        allocated = allocated[valid_indices]
        used = used[valid_indices]
        
        current_allocation = np.mean(allocated)
        actual_usage = np.mean(used)
        utilization = actual_usage / current_allocation if current_allocation > 0 else 0
        peak_usage = np.max(used)
        
        cost_per_hour = current_allocation * self.cost_rates['memory_gb_hour']
        daily_cost = cost_per_hour * 24
        
        return ResourceUsage(
            resource_type='memory',
            current_allocation=current_allocation,
            actual_usage=actual_usage,
            utilization_percentage=utilization * 100,
            peak_usage=peak_usage,
            average_usage=actual_usage,
            cost_per_unit=self.cost_rates['memory_gb_hour'],
            total_current_cost=daily_cost
        )
    
    def _analyze_storage_usage(self, usage_data: Dict[str, List[float]]) -> Optional[ResourceUsage]:
        """Analyze storage usage patterns"""
        
        if 'storage_allocated_gb' not in usage_data or 'storage_used_gb' not in usage_data:
            return None
        
        allocated = np.array(usage_data['storage_allocated_gb'])
        used = np.array(usage_data['storage_used_gb'])
        
        valid_indices = allocated > 0
        if not np.any(valid_indices):
            return None
        
        allocated = allocated[valid_indices]
        used = used[valid_indices]
        
        current_allocation = np.mean(allocated)
        actual_usage = np.mean(used)
        utilization = actual_usage / current_allocation if current_allocation > 0 else 0
        peak_usage = np.max(used)
        
        monthly_cost = current_allocation * self.cost_rates['storage_gb_month']
        
        return ResourceUsage(
            resource_type='storage',
            current_allocation=current_allocation,
            actual_usage=actual_usage,
            utilization_percentage=utilization * 100,
            peak_usage=peak_usage,
            average_usage=actual_usage,
            cost_per_unit=self.cost_rates['storage_gb_month'],
            total_current_cost=monthly_cost
        )
    
    def _analyze_network_usage(self, usage_data: Dict[str, List[float]]) -> Optional[ResourceUsage]:
        """Analyze network usage patterns"""
        
        if 'network_rx_gb' not in usage_data or 'network_tx_gb' not in usage_data:
            return None
        
        rx_data = np.array(usage_data['network_rx_gb'])
        tx_data = np.array(usage_data['network_tx_gb'])
        
        total_usage = rx_data + tx_data
        daily_average = np.mean(total_usage)
        peak_usage = np.max(total_usage)
        
        daily_cost = daily_average * self.cost_rates['network_gb']
        
        return ResourceUsage(
            resource_type='network',
            current_allocation=daily_average,  # Network doesn't have allocation
            actual_usage=daily_average,
            utilization_percentage=100,  # Always 100% of what's used
            peak_usage=peak_usage,
            average_usage=daily_average,
            cost_per_unit=self.cost_rates['network_gb'],
            total_current_cost=daily_cost
        )
    
    def _generate_rightsizing_recommendations(self, resource_type: str, usage: ResourceUsage) -> List[CostOptimization]:
        """Generate right-sizing recommendations"""
        optimizations = []
        
        if resource_type == 'network':
            return optimizations  # Network usage can't be right-sized
        
        utilization = usage.utilization_percentage / 100
        thresholds = self.efficiency_thresholds.get(f'{resource_type}_utilization', 
                                                   {'good': 0.7, 'acceptable': 0.5, 'poor': 0.3})
        
        # Over-provisioned resources
        if utilization < thresholds['poor']:
            # Suggest significant downsizing
            recommended_allocation = usage.peak_usage * 1.2  # 20% buffer above peak
            potential_savings = (usage.current_allocation - recommended_allocation) * usage.cost_per_unit * 24
            
            if potential_savings > 0:
                optimization = CostOptimization(
                    optimization_type='rightsizing',
                    target_resource=f'{resource_type}_allocation',
                    current_cost=usage.total_current_cost,
                    optimized_cost=usage.total_current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=(potential_savings / usage.total_current_cost) * 100,
                    implementation_effort='low',
                    risk_level='low',
                    recommendation=f"Reduce {resource_type} allocation from {usage.current_allocation:.2f} to {recommended_allocation:.2f} units",
                    implementation_steps=[
                        f"Update resource limits in deployment configuration",
                        f"Gradually reduce {resource_type} allocation",
                        "Monitor performance metrics during transition",
                        "Validate application performance"
                    ],
                    impact_analysis={
                        'current_utilization': f"{utilization:.1%}",
                        'target_utilization': f"{(usage.peak_usage / recommended_allocation):.1%}",
                        'performance_risk': 'Low - significant buffer maintained'
                    },
                    confidence_score=0.9
                )
                optimizations.append(optimization)
        
        elif utilization < thresholds['acceptable']:
            # Suggest moderate downsizing
            recommended_allocation = usage.average_usage * 1.4  # 40% buffer above average
            potential_savings = (usage.current_allocation - recommended_allocation) * usage.cost_per_unit * 24
            
            if potential_savings > 0:
                optimization = CostOptimization(
                    optimization_type='rightsizing',
                    target_resource=f'{resource_type}_allocation',
                    current_cost=usage.total_current_cost,
                    optimized_cost=usage.total_current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=(potential_savings / usage.total_current_cost) * 100,
                    implementation_effort='low',
                    risk_level='medium',
                    recommendation=f"Optimize {resource_type} allocation from {usage.current_allocation:.2f} to {recommended_allocation:.2f} units",
                    implementation_steps=[
                        f"Analyze {resource_type} usage patterns over longer period",
                        f"Gradually reduce {resource_type} allocation",
                        "Implement monitoring and auto-scaling if needed",
                        "Set up alerts for resource pressure"
                    ],
                    impact_analysis={
                        'current_utilization': f"{utilization:.1%}",
                        'target_utilization': f"{(usage.average_usage / recommended_allocation):.1%}",
                        'performance_risk': 'Medium - monitor closely during peak usage'
                    },
                    confidence_score=0.7
                )
                optimizations.append(optimization)
        
        # Under-provisioned resources (potential performance issues)
        elif utilization > 0.9:
            # Suggest increasing allocation
            recommended_allocation = usage.current_allocation * 1.3  # 30% increase
            additional_cost = (recommended_allocation - usage.current_allocation) * usage.cost_per_unit * 24
            
            optimization = CostOptimization(
                optimization_type='rightsizing',
                target_resource=f'{resource_type}_allocation',
                current_cost=usage.total_current_cost,
                optimized_cost=usage.total_current_cost + additional_cost,
                potential_savings=-additional_cost,  # Negative savings (additional cost)
                savings_percentage=-(additional_cost / usage.total_current_cost) * 100,
                implementation_effort='low',
                risk_level='low',
                recommendation=f"Increase {resource_type} allocation from {usage.current_allocation:.2f} to {recommended_allocation:.2f} units to prevent performance issues",
                implementation_steps=[
                    f"Increase {resource_type} allocation to prevent bottlenecks",
                    "Monitor performance improvement",
                    "Consider implementing auto-scaling",
                    "Review usage patterns regularly"
                ],
                impact_analysis={
                    'current_utilization': f"{utilization:.1%}",
                    'target_utilization': f"{(usage.actual_usage / recommended_allocation):.1%}",
                    'performance_risk': 'High without increase - current usage too close to limits'
                },
                confidence_score=0.8
            )
            optimizations.append(optimization)
        
        return optimizations
    
    def _generate_scheduling_optimizations(self, resource_type: str, usage: ResourceUsage) -> List[CostOptimization]:
        """Generate scheduling-based optimizations"""
        optimizations = []
        
        # Spot instance recommendations for non-critical workloads
        if resource_type in ['cpu', 'memory']:
            spot_savings = usage.total_current_cost * 0.6  # 60% savings with spot instances
            
            optimization = CostOptimization(
                optimization_type='scheduling',
                target_resource=f'{resource_type}_instance_type',
                current_cost=usage.total_current_cost,
                optimized_cost=usage.total_current_cost - spot_savings,
                potential_savings=spot_savings,
                savings_percentage=60.0,
                implementation_effort='medium',
                risk_level='medium',
                recommendation=f"Use spot instances for {resource_type} workloads",
                implementation_steps=[
                    "Identify workloads suitable for spot instances",
                    "Implement graceful handling of spot interruptions",
                    "Configure mixed instance types (on-demand + spot)",
                    "Test spot instance behavior with your workload"
                ],
                impact_analysis={
                    'interruption_risk': 'Medium - implement proper handling',
                    'cost_benefit': 'High - up to 60% savings',
                    'workload_suitability': 'Good for stateless applications'
                },
                confidence_score=0.6
            )
            optimizations.append(optimization)
        
        # Reserved instance recommendations for stable workloads
        if usage.utilization_percentage > 70:  # Stable usage pattern
            reserved_savings = usage.total_current_cost * 0.3  # 30% savings with reserved instances
            
            optimization = CostOptimization(
                optimization_type='scheduling',
                target_resource=f'{resource_type}_pricing_model',
                current_cost=usage.total_current_cost,
                optimized_cost=usage.total_current_cost - reserved_savings,
                potential_savings=reserved_savings,
                savings_percentage=30.0,
                implementation_effort='low',
                risk_level='low',
                recommendation=f"Use reserved instances for {resource_type} resources",
                implementation_steps=[
                    "Analyze usage patterns over 3-6 months",
                    "Purchase reserved instances for baseline capacity",
                    "Use on-demand instances for variable capacity",
                    "Monitor and adjust reserved capacity quarterly"
                ],
                impact_analysis={
                    'commitment_period': '1-3 years',
                    'cost_benefit': 'Medium - 30% savings for committed usage',
                    'flexibility_impact': 'Low - still allows scaling'
                },
                confidence_score=0.8
            )
            optimizations.append(optimization)
        
        return optimizations
    
    def _generate_resource_type_optimizations(self, resource_type: str, usage: ResourceUsage) -> List[CostOptimization]:
        """Generate resource type optimization recommendations"""
        optimizations = []
        
        if resource_type == 'storage':
            # Storage class optimization
            if usage.utilization_percentage < 50:
                # Suggest cheaper storage class
                cheaper_rate = self.cost_rates['storage_gb_month'] * 0.7  # 30% cheaper
                potential_savings = usage.current_allocation * (self.cost_rates['storage_gb_month'] - cheaper_rate)
                
                optimization = CostOptimization(
                    optimization_type='resource_type_change',
                    target_resource='storage_class',
                    current_cost=usage.total_current_cost,
                    optimized_cost=usage.total_current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=(potential_savings / usage.total_current_cost) * 100,
                    implementation_effort='medium',
                    risk_level='low',
                    recommendation="Switch to more cost-effective storage class for infrequently accessed data",
                    implementation_steps=[
                        "Identify data access patterns",
                        "Migrate infrequently accessed data to cheaper storage",
                        "Implement lifecycle policies",
                        "Monitor access patterns and costs"
                    ],
                    impact_analysis={
                        'performance_impact': 'Minimal for infrequent access',
                        'data_durability': 'Same durability guarantees',
                        'access_latency': 'Slightly higher for cheaper storage'
                    },
                    confidence_score=0.75
                )
                optimizations.append(optimization)
        
        elif resource_type == 'cpu':
            # CPU architecture optimization (e.g., ARM-based instances)
            if usage.utilization_percentage > 50:  # Good candidate for ARM
                arm_savings = usage.total_current_cost * 0.2  # 20% savings with ARM
                
                optimization = CostOptimization(
                    optimization_type='resource_type_change',
                    target_resource='cpu_architecture',
                    current_cost=usage.total_current_cost,
                    optimized_cost=usage.total_current_cost - arm_savings,
                    potential_savings=arm_savings,
                    savings_percentage=20.0,
                    implementation_effort='high',
                    risk_level='medium',
                    recommendation="Consider ARM-based instances for better price-performance",
                    implementation_steps=[
                        "Test application compatibility with ARM architecture",
                        "Rebuild container images for ARM64",
                        "Performance test with ARM instances",
                        "Gradually migrate workloads"
                    ],
                    impact_analysis={
                        'compatibility_risk': 'Medium - requires testing',
                        'performance_impact': 'Potentially better price-performance',
                        'migration_effort': 'High - requires image rebuilds'
                    },
                    confidence_score=0.6
                )
                optimizations.append(optimization)
        
        return optimizations
    
    def _generate_cross_resource_optimizations(self, resource_usage: Dict[str, ResourceUsage]) -> List[CostOptimization]:
        """Generate optimizations that span multiple resources"""
        optimizations = []
        
        # Auto-scaling optimization
        if 'cpu' in resource_usage and 'memory' in resource_usage:
            cpu_utilization = resource_usage['cpu'].utilization_percentage
            memory_utilization = resource_usage['memory'].utilization_percentage
            
            # If both resources are under-utilized, suggest auto-scaling
            if cpu_utilization < 60 and memory_utilization < 60:
                total_current_cost = resource_usage['cpu'].total_current_cost + resource_usage['memory'].total_current_cost
                potential_savings = total_current_cost * 0.25  # 25% savings with auto-scaling
                
                optimization = CostOptimization(
                    optimization_type='scheduling',
                    target_resource='auto_scaling_configuration',
                    current_cost=total_current_cost,
                    optimized_cost=total_current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=25.0,
                    implementation_effort='medium',
                    risk_level='low',
                    recommendation="Implement auto-scaling to optimize resource allocation based on demand",
                    implementation_steps=[
                        "Configure Horizontal Pod Autoscaler (HPA)",
                        "Set appropriate CPU and memory thresholds",
                        "Configure Vertical Pod Autoscaler (VPA) for recommendations",
                        "Implement cluster auto-scaling",
                        "Monitor scaling behavior and adjust thresholds"
                    ],
                    impact_analysis={
                        'cost_optimization': 'Scale down during low usage periods',
                        'performance_benefit': 'Automatic scaling during high demand',
                        'operational_complexity': 'Medium - requires monitoring setup'
                    },
                    confidence_score=0.8
                )
                optimizations.append(optimization)
        
        # Workload consolidation
        total_cost = sum(usage.total_current_cost for usage in resource_usage.values())
        if total_cost > 100:  # Significant cost base
            consolidation_savings = total_cost * 0.15  # 15% savings through consolidation
            
            optimization = CostOptimization(
                optimization_type='resource_type_change',
                target_resource='workload_consolidation',
                current_cost=total_cost,
                optimized_cost=total_cost - consolidation_savings,
                potential_savings=consolidation_savings,
                savings_percentage=15.0,
                implementation_effort='high',
                risk_level='medium',
                recommendation="Consolidate workloads to improve resource utilization",
                implementation_steps=[
                    "Analyze workload resource requirements and patterns",
                    "Identify consolidation opportunities",
                    "Implement resource quotas and limits",
                    "Test consolidated workloads for performance",
                    "Monitor resource contention"
                ],
                impact_analysis={
                    'efficiency_gain': 'Higher resource utilization',
                    'complexity_increase': 'Medium - requires careful resource management',
                    'isolation_impact': 'Reduced isolation between workloads'
                },
                confidence_score=0.7
            )
            optimizations.append(optimization)
        
        return optimizations
    
    def _collect_cost_data(self, days_back: int) -> Dict[str, Any]:
        """Collect historical cost data"""
        
        # Simulate cost data collection
        # In a real implementation, this would integrate with cloud provider billing APIs
        
        daily_costs = []
        cost_breakdown = {
            'compute': 0,
            'storage': 0,
            'network': 0,
            'load_balancer': 0
        }
        
        for day in range(days_back):
            date = datetime.now() - timedelta(days=day)
            
            # Simulate daily cost with some trend
            base_cost = 50.0  # Base daily cost
            trend_factor = 1 + (day / days_back) * 0.1  # 10% growth over period
            daily_variation = np.random.normal(1.0, 0.1)  # ±10% daily variation
            
            daily_cost = base_cost * trend_factor * daily_variation
            daily_costs.append({
                'date': date,
                'total_cost': daily_cost,
                'compute': daily_cost * 0.6,
                'storage': daily_cost * 0.2,
                'network': daily_cost * 0.15,
                'load_balancer': daily_cost * 0.05
            })
        
        # Calculate breakdown totals
        for day_data in daily_costs:
            for category in cost_breakdown:
                cost_breakdown[category] += day_data[category]
        
        return {
            'daily_costs': daily_costs,
            'breakdown': cost_breakdown,
            'total_period_cost': sum(day['total_cost'] for day in daily_costs)
        }
    
    def _calculate_cost_trend(self, cost_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate cost trend analysis"""
        
        daily_costs = [day['total_cost'] for day in cost_data['daily_costs']]
        
        if len(daily_costs) < 7:
            return {'trend': 'insufficient_data', 'growth_rate': 0}
        
        # Calculate linear trend
        days = np.arange(len(daily_costs))
        costs = np.array(daily_costs)
        
        # Fit linear regression
        z = np.polyfit(days, costs, 1)
        slope = z[0]
        
        # Calculate growth rate as percentage per week
        avg_cost = np.mean(costs)
        weekly_growth_rate = (slope * 7 / avg_cost) * 100
        
        # Determine trend direction
        if abs(weekly_growth_rate) < 2:  # Less than 2% per week
            trend = 'stable'
        elif weekly_growth_rate > 0:
            trend = 'increasing'
        else:
            trend = 'decreasing'
        
        return {
            'trend': trend,
            'growth_rate': weekly_growth_rate
        }
    
    def _project_monthly_cost(self, cost_data: Dict[str, Any]) -> float:
        """Project monthly cost based on trends"""
        
        daily_costs = [day['total_cost'] for day in cost_data['daily_costs']]
        
        if len(daily_costs) < 7:
            return np.mean(daily_costs) * 30 if daily_costs else 0
        
        # Use recent average with trend
        recent_avg = np.mean(daily_costs[-7:])  # Last week average
        trend_analysis = self._calculate_cost_trend(cost_data)
        
        # Project 30 days with trend
        daily_growth = trend_analysis['growth_rate'] / 7 / 100  # Daily growth rate
        
        monthly_cost = 0
        current_daily_cost = recent_avg
        
        for day in range(30):
            monthly_cost += current_daily_cost
            current_daily_cost *= (1 + daily_growth)
        
        return monthly_cost
    
    def _calculate_efficiency_score(self, cost_data: Dict[str, Any]) -> float:
        """Calculate overall cost efficiency score"""
        
        # This would integrate with performance metrics in a real implementation
        # For now, we'll simulate based on cost trends and breakdown
        
        breakdown = cost_data['breakdown']
        total_cost = sum(breakdown.values())
        
        # Calculate efficiency based on cost distribution
        compute_ratio = breakdown['compute'] / total_cost
        storage_ratio = breakdown['storage'] / total_cost
        
        # Ideal ratios (more compute/storage, less network/load balancer overhead)
        ideal_compute_ratio = 0.70
        ideal_storage_ratio = 0.25
        
        compute_efficiency = 1 - abs(compute_ratio - ideal_compute_ratio)
        storage_efficiency = 1 - abs(storage_ratio - ideal_storage_ratio)
        
        # Combine with trend analysis (stable costs are more efficient)
        trend_analysis = self._calculate_cost_trend(cost_data)
        trend_efficiency = 1 - min(abs(trend_analysis['growth_rate']) / 10, 1)  # Penalty for high growth
        
        overall_efficiency = (compute_efficiency + storage_efficiency + trend_efficiency) / 3
        
        return overall_efficiency * 100  # Return as percentage
    
    def _query_prometheus_at_time(self, query: str, timestamp: datetime) -> float:
        """Query Prometheus for a specific timestamp"""
        try:
            ts = int(timestamp.timestamp())
            response = requests.get(
                f"{self.prometheus_url}/api/v1/query",
                params={'query': query, 'time': ts},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'success' and data['data']['result']:
                    return float(data['data']['result'][0]['value'][1])
            
            return self._simulate_usage_metric(query, timestamp)
            
        except Exception:
            return self._simulate_usage_metric(query, timestamp)
    
    def _simulate_usage_metric(self, metric_name: str, timestamp: datetime) -> float:
        """Simulate usage metrics for testing"""
        
        hour = timestamp.hour
        day_factor = 1.0 + 0.3 * np.sin(hour * np.pi / 12)  # Daily usage pattern
        base_noise = np.random.normal(1.0, 0.1)
        
        base_values = {
            'cpu_allocated': 4.0 * base_noise,
            'cpu_used': 2.0 * day_factor * base_noise,
            'memory_allocated_gb': 8.0 * base_noise,
            'memory_used_gb': 5.0 * day_factor * base_noise,
            'storage_allocated_gb': 100.0 * base_noise,
            'storage_used_gb': 60.0 * day_factor * base_noise,
            'network_rx_gb': 10.0 * day_factor * base_noise,
            'network_tx_gb': 8.0 * day_factor * base_noise,
            'pod_count': 3
        }
        
        for key, value in base_values.items():
            if key in metric_name:
                return max(0, value)
        
        return np.random.uniform(0.5, 2.0)
    
    def _save_models(self):
        """Save cost optimization models"""
        models_file = f"{self.model_path}/cost_models.json"
        
        with open(models_file, 'w') as f:
            json.dump({
                'cost_rates': self.cost_rates,
                'efficiency_thresholds': self.efficiency_thresholds,
                'usage_patterns': self.usage_patterns
            }, f, indent=2)
    
    def _load_models(self):
        """Load cost optimization models"""
        try:
            models_file = f"{self.model_path}/cost_models.json"
            
            if os.path.exists(models_file):
                with open(models_file, 'r') as f:
                    data = json.load(f)
                    self.cost_rates.update(data.get('cost_rates', {}))
                    self.efficiency_thresholds.update(data.get('efficiency_thresholds', {}))
                    self.usage_patterns.update(data.get('usage_patterns', {}))
                
                print(f"Loaded cost optimization models")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_cost_summary(self, optimizations: List[CostOptimization], 
                        cost_trend: CostTrend) -> Dict[str, Any]:
        """Get comprehensive cost optimization summary"""
        
        if not optimizations:
            total_savings = 0
            avg_savings_percentage = 0
        else:
            total_savings = sum(opt.potential_savings for opt in optimizations if opt.potential_savings > 0)
            avg_savings_percentage = sum(opt.savings_percentage for opt in optimizations if opt.savings_percentage > 0) / len([opt for opt in optimizations if opt.savings_percentage > 0])
        
        # Categorize optimizations
        optimization_categories = {}
        for opt in optimizations:
            category = opt.optimization_type
            if category not in optimization_categories:
                optimization_categories[category] = []
            optimization_categories[category].append(opt)
        
        # Risk analysis
        low_risk_savings = sum(opt.potential_savings for opt in optimizations 
                              if opt.risk_level == 'low' and opt.potential_savings > 0)
        medium_risk_savings = sum(opt.potential_savings for opt in optimizations 
                                 if opt.risk_level == 'medium' and opt.potential_savings > 0)
        high_risk_savings = sum(opt.potential_savings for opt in optimizations 
                               if opt.risk_level == 'high' and opt.potential_savings > 0)
        
        return {
            'total_potential_savings_daily': total_savings,
            'total_potential_savings_monthly': total_savings * 30,
            'average_savings_percentage': avg_savings_percentage,
            'total_optimizations': len(optimizations),
            'optimization_categories': {
                category: {
                    'count': len(opts),
                    'total_savings': sum(opt.potential_savings for opt in opts if opt.potential_savings > 0)
                } for category, opts in optimization_categories.items()
            },
            'risk_analysis': {
                'low_risk_savings_monthly': low_risk_savings * 30,
                'medium_risk_savings_monthly': medium_risk_savings * 30,
                'high_risk_savings_monthly': high_risk_savings * 30
            },
            'cost_trend': {
                'direction': cost_trend.cost_trend,
                'growth_rate_weekly': f"{cost_trend.growth_rate:.1f}%",
                'projected_monthly_cost': cost_trend.projected_monthly_cost,
                'efficiency_score': f"{cost_trend.efficiency_score:.1f}%"
            },
            'quick_wins': [
                opt.recommendation for opt in optimizations 
                if opt.implementation_effort == 'low' and opt.potential_savings > 5
            ][:3]  # Top 3 quick wins
        }


def main():
    """Main execution function for testing"""
    print("💰 Starting Cost Optimization Analysis...")
    
    # Initialize the cost optimizer
    optimizer = CostOptimizationEngine()
    
    # Analyze resource usage
    print("\n📊 Analyzing resource usage...")
    resource_usage = optimizer.analyze_resource_usage(days_back=7)
    
    if resource_usage:
        print(f"Found usage data for {len(resource_usage)} resource types:")
        for resource_type, usage in resource_usage.items():
            print(f"  {resource_type.upper()}:")
            print(f"    Allocation: {usage.current_allocation:.2f} units")
            print(f"    Utilization: {usage.utilization_percentage:.1f}%")
            print(f"    Daily Cost: ${usage.total_current_cost:.2f}")
    else:
        print("❌ No resource usage data available")
        return
    
    # Generate optimizations
    print("\n💡 Generating cost optimizations...")
    optimizations = optimizer.generate_cost_optimizations(resource_usage)
    
    if optimizations:
        print(f"\nTop {min(5, len(optimizations))} cost optimization opportunities:")
        for i, opt in enumerate(optimizations[:5], 1):
            print(f"\n{i}. {opt.recommendation}")
            print(f"   Type: {opt.optimization_type}")
            print(f"   Daily Savings: ${opt.potential_savings:.2f} ({opt.savings_percentage:.1f}%)")
            print(f"   Monthly Savings: ${opt.potential_savings * 30:.2f}")
            print(f"   Implementation: {opt.implementation_effort} effort, {opt.risk_level} risk")
            print(f"   Confidence: {opt.confidence_score:.1%}")
    else:
        print("✅ No significant cost optimization opportunities found")
    
    # Analyze cost trends
    print("\n📈 Analyzing cost trends...")
    cost_trend = optimizer.analyze_cost_trends(days_back=30)
    
    print(f"Cost Trend Analysis:")
    print(f"  Trend Direction: {cost_trend.cost_trend}")
    print(f"  Weekly Growth Rate: {cost_trend.growth_rate:.1f}%")
    print(f"  Projected Monthly Cost: ${cost_trend.projected_monthly_cost:.2f}")
    print(f"  Cost Efficiency Score: {cost_trend.efficiency_score:.1f}%")
    
    print(f"\nCost Breakdown:")
    for category, cost in cost_trend.cost_breakdown.items():
        percentage = (cost / sum(cost_trend.cost_breakdown.values())) * 100
        print(f"  {category}: ${cost:.2f} ({percentage:.1f}%)")
    
    # Generate comprehensive summary
    print("\n📋 Cost Optimization Summary:")
    summary = optimizer.get_cost_summary(optimizations, cost_trend)
    
    print(f"💰 Total Potential Monthly Savings: ${summary['total_potential_savings_monthly']:.2f}")
    print(f"📊 Average Savings Percentage: {summary['average_savings_percentage']:.1f}%")
    print(f"🎯 Total Optimization Opportunities: {summary['total_optimizations']}")
    
    print(f"\n🔒 Risk-Based Savings Breakdown:")
    risk_analysis = summary['risk_analysis']
    print(f"  Low Risk: ${risk_analysis['low_risk_savings_monthly']:.2f}/month")
    print(f"  Medium Risk: ${risk_analysis['medium_risk_savings_monthly']:.2f}/month")
    print(f"  High Risk: ${risk_analysis['high_risk_savings_monthly']:.2f}/month")
    
    if summary['quick_wins']:
        print(f"\n⚡ Quick Wins (Low Effort, High Impact):")
        for i, win in enumerate(summary['quick_wins'], 1):
            print(f"  {i}. {win}")
    
    print("\n✅ Cost Optimization Analysis completed!")


if __name__ == "__main__":
    main()