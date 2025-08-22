"""
Cost Analytics and Optimization System
Comprehensive cost tracking, analysis, and optimization recommendations
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.cluster import KMeans
import aiohttp
import aioredis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ResourceType(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"
    GPU = "gpu"
    LOAD_BALANCER = "load_balancer"
    PUBLIC_IP = "public_ip"

class CostCategory(Enum):
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    SECURITY = "security"
    MONITORING = "monitoring"
    BACKUP = "backup"
    SUPPORT = "support"
    OTHER = "other"

class OptimizationType(Enum):
    RIGHT_SIZING = "right_sizing"
    SCHEDULING = "scheduling"
    RESOURCE_POOLING = "resource_pooling"
    AUTOMATION = "automation"
    RESERVED_INSTANCES = "reserved_instances"
    SPOT_INSTANCES = "spot_instances"
    STORAGE_OPTIMIZATION = "storage_optimization"
    NETWORK_OPTIMIZATION = "network_optimization"

class Priority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class CostItem:
    item_id: str
    resource_type: ResourceType
    cost_category: CostCategory
    resource_name: str
    resource_id: str
    cost_per_hour: float
    usage_hours: float
    total_cost: float
    currency: str
    billing_period: datetime
    tags: Dict[str, str]
    region: str
    provider: str

@dataclass
class ResourceUsage:
    resource_id: str
    resource_type: ResourceType
    timestamp: datetime
    usage_percentage: float
    allocated_amount: float
    used_amount: float
    unit: str
    cost_per_unit: float

@dataclass
class OptimizationRecommendation:
    recommendation_id: str
    optimization_type: OptimizationType
    resource_id: str
    resource_name: str
    current_cost: float
    projected_cost: float
    potential_savings: float
    savings_percentage: float
    priority: Priority
    confidence: float
    description: str
    implementation_steps: List[str]
    estimated_effort_hours: float
    risks: List[str]
    prerequisites: List[str]

@dataclass
class CostBudget:
    budget_id: str
    name: str
    budget_amount: float
    period: str  # monthly, quarterly, yearly
    cost_categories: List[CostCategory]
    alert_thresholds: Dict[str, float]  # percentage thresholds
    current_spend: float
    forecast_spend: float
    status: str  # under_budget, at_risk, over_budget

@dataclass
class CostAlert:
    alert_id: str
    alert_type: str
    message: str
    severity: str
    resource_id: Optional[str]
    current_value: float
    threshold_value: float
    timestamp: datetime

class CostCalculator:
    def __init__(self):
        # Cost rates per hour (simplified pricing model)
        self.cost_rates = {
            "hetzner": {
                ResourceType.CPU: 0.0095,  # per vCPU hour
                ResourceType.MEMORY: 0.0014,  # per GB hour
                ResourceType.STORAGE: 0.000054,  # per GB hour for HDD
                ResourceType.NETWORK: 0.01,  # per GB transfer
                ResourceType.LOAD_BALANCER: 0.012,  # per hour
                ResourceType.PUBLIC_IP: 0.003  # per hour
            },
            "aws": {
                ResourceType.CPU: 0.0464,  # t3.medium equivalent
                ResourceType.MEMORY: 0.0058,
                ResourceType.STORAGE: 0.0001,  # EBS gp3
                ResourceType.NETWORK: 0.09,  # per GB transfer
                ResourceType.LOAD_BALANCER: 0.0225,
                ResourceType.PUBLIC_IP: 0.005
            },
            "gcp": {
                ResourceType.CPU: 0.0475,  # n1-standard-1 equivalent
                ResourceType.MEMORY: 0.0063,
                ResourceType.STORAGE: 0.0001,  # Standard persistent disk
                ResourceType.NETWORK: 0.12,
                ResourceType.LOAD_BALANCER: 0.025,
                ResourceType.PUBLIC_IP: 0.004
            }
        }
        
        # Efficiency factors for different optimization types
        self.optimization_factors = {
            OptimizationType.RIGHT_SIZING: 0.3,  # 30% potential savings
            OptimizationType.SCHEDULING: 0.15,   # 15% savings through better scheduling
            OptimizationType.RESOURCE_POOLING: 0.25,  # 25% through pooling
            OptimizationType.AUTOMATION: 0.20,   # 20% through automation
            OptimizationType.RESERVED_INSTANCES: 0.40,  # 40% with reserved instances
            OptimizationType.SPOT_INSTANCES: 0.60,     # 60% with spot instances
            OptimizationType.STORAGE_OPTIMIZATION: 0.35,  # 35% through storage optimization
            OptimizationType.NETWORK_OPTIMIZATION: 0.25   # 25% through network optimization
        }
    
    def calculate_resource_cost(self, resource_type: ResourceType, 
                              amount: float, hours: float, 
                              provider: str = "hetzner") -> float:
        """Calculate cost for a specific resource"""
        rate = self.cost_rates.get(provider, {}).get(resource_type, 0.0)
        return rate * amount * hours
    
    def calculate_pod_cost(self, cpu_millicores: float, memory_mb: float, 
                          hours: float, provider: str = "hetzner") -> Dict[str, float]:
        """Calculate cost for a pod based on resource usage"""
        cpu_cores = cpu_millicores / 1000.0
        memory_gb = memory_mb / 1024.0
        
        cpu_cost = self.calculate_resource_cost(ResourceType.CPU, cpu_cores, hours, provider)
        memory_cost = self.calculate_resource_cost(ResourceType.MEMORY, memory_gb, hours, provider)
        
        return {
            "cpu_cost": cpu_cost,
            "memory_cost": memory_cost,
            "total_cost": cpu_cost + memory_cost
        }
    
    def calculate_storage_cost(self, storage_gb: float, storage_type: str,
                             hours: float, provider: str = "hetzner") -> float:
        """Calculate storage cost"""
        # Adjust rate based on storage type
        base_rate = self.cost_rates.get(provider, {}).get(ResourceType.STORAGE, 0.0)
        
        multipliers = {
            "hdd": 1.0,
            "ssd": 2.5,
            "nvme": 4.0,
            "archive": 0.1
        }
        
        rate = base_rate * multipliers.get(storage_type, 1.0)
        return rate * storage_gb * hours
    
    def calculate_network_cost(self, data_gb: float, 
                             provider: str = "hetzner") -> float:
        """Calculate network transfer cost"""
        rate = self.cost_rates.get(provider, {}).get(ResourceType.NETWORK, 0.0)
        return rate * data_gb

class UsageAnalyzer:
    def __init__(self):
        self.regression_model = LinearRegression()
        self.clustering_model = KMeans(n_clusters=5, random_state=42)
        
    def analyze_resource_efficiency(self, usage_data: List[ResourceUsage]) -> Dict[str, Any]:
        """Analyze resource efficiency and utilization patterns"""
        if not usage_data:
            return {}
        
        # Group by resource
        resource_groups = {}
        for usage in usage_data:
            if usage.resource_id not in resource_groups:
                resource_groups[usage.resource_id] = []
            resource_groups[usage.resource_id].append(usage)
        
        efficiency_analysis = {}
        
        for resource_id, usages in resource_groups.items():
            utilizations = [u.usage_percentage for u in usages]
            
            analysis = {
                "resource_id": resource_id,
                "resource_type": usages[0].resource_type.value,
                "avg_utilization": np.mean(utilizations),
                "max_utilization": np.max(utilizations),
                "min_utilization": np.min(utilizations),
                "std_utilization": np.std(utilizations),
                "data_points": len(utilizations),
                "efficiency_score": self._calculate_efficiency_score(utilizations),
                "waste_percentage": self._calculate_waste_percentage(utilizations),
                "optimization_potential": self._calculate_optimization_potential(utilizations)
            }
            
            efficiency_analysis[resource_id] = analysis
        
        return efficiency_analysis
    
    def _calculate_efficiency_score(self, utilizations: List[float]) -> float:
        """Calculate efficiency score (0-100)"""
        avg_util = np.mean(utilizations)
        std_util = np.std(utilizations)
        
        # Ideal utilization is around 70-80%
        ideal_range = (70, 80)
        
        if ideal_range[0] <= avg_util <= ideal_range[1]:
            base_score = 100
        elif avg_util < ideal_range[0]:
            # Under-utilized
            base_score = (avg_util / ideal_range[0]) * 100
        else:
            # Over-utilized
            base_score = max(0, 100 - (avg_util - ideal_range[1]) * 2)
        
        # Penalize high variability
        variability_penalty = min(std_util, 30)  # Cap at 30 points
        
        return max(0, base_score - variability_penalty)
    
    def _calculate_waste_percentage(self, utilizations: List[float]) -> float:
        """Calculate waste percentage"""
        avg_util = np.mean(utilizations)
        
        if avg_util >= 100:
            return 0.0  # No waste if fully utilized
        
        return 100 - avg_util
    
    def _calculate_optimization_potential(self, utilizations: List[float]) -> float:
        """Calculate optimization potential (0-100)"""
        avg_util = np.mean(utilizations)
        max_util = np.max(utilizations)
        
        # If max utilization is very high, optimization potential is low
        if max_util > 90:
            return min(20, 100 - avg_util)
        
        # Otherwise, potential is inversely related to average utilization
        return max(0, min(100, 100 - avg_util))
    
    def detect_usage_patterns(self, usage_data: List[ResourceUsage]) -> Dict[str, Any]:
        """Detect usage patterns and anomalies"""
        if len(usage_data) < 10:
            return {"error": "Insufficient data for pattern detection"}
        
        # Create time series data
        df_data = []
        for usage in usage_data:
            df_data.append({
                'timestamp': usage.timestamp,
                'resource_id': usage.resource_id,
                'usage_percentage': usage.usage_percentage,
                'hour_of_day': usage.timestamp.hour,
                'day_of_week': usage.timestamp.weekday(),
                'cost': usage.used_amount * usage.cost_per_unit
            })
        
        df = pd.DataFrame(df_data)
        
        patterns = {
            "temporal_patterns": self._analyze_temporal_patterns(df),
            "resource_patterns": self._analyze_resource_patterns(df),
            "cost_patterns": self._analyze_cost_patterns(df),
            "anomalies": self._detect_usage_anomalies(df)
        }
        
        return patterns
    
    def _analyze_temporal_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze temporal usage patterns"""
        hourly_usage = df.groupby('hour_of_day')['usage_percentage'].mean()
        daily_usage = df.groupby('day_of_week')['usage_percentage'].mean()
        
        return {
            "peak_hour": int(hourly_usage.idxmax()),
            "low_hour": int(hourly_usage.idxmin()),
            "peak_day": int(daily_usage.idxmax()),
            "low_day": int(daily_usage.idxmin()),
            "hourly_pattern": hourly_usage.to_dict(),
            "daily_pattern": daily_usage.to_dict(),
            "usage_variance": float(df['usage_percentage'].var())
        }
    
    def _analyze_resource_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze resource-specific patterns"""
        resource_stats = df.groupby('resource_id').agg({
            'usage_percentage': ['mean', 'max', 'min', 'std'],
            'cost': ['sum', 'mean']
        }).round(2)
        
        resource_patterns = {}
        for resource_id in resource_stats.index:
            resource_patterns[resource_id] = {
                "avg_usage": resource_stats.loc[resource_id, ('usage_percentage', 'mean')],
                "max_usage": resource_stats.loc[resource_id, ('usage_percentage', 'max')],
                "min_usage": resource_stats.loc[resource_id, ('usage_percentage', 'min')],
                "usage_std": resource_stats.loc[resource_id, ('usage_percentage', 'std')],
                "total_cost": resource_stats.loc[resource_id, ('cost', 'sum')],
                "avg_cost": resource_stats.loc[resource_id, ('cost', 'mean')]
            }
        
        return resource_patterns
    
    def _analyze_cost_patterns(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Analyze cost patterns"""
        df['date'] = df['timestamp'].dt.date
        daily_costs = df.groupby('date')['cost'].sum()
        
        return {
            "daily_cost_trend": daily_costs.to_dict(),
            "average_daily_cost": float(daily_costs.mean()),
            "max_daily_cost": float(daily_costs.max()),
            "min_daily_cost": float(daily_costs.min()),
            "cost_volatility": float(daily_costs.std())
        }
    
    def _detect_usage_anomalies(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect usage anomalies"""
        anomalies = []
        
        for resource_id in df['resource_id'].unique():
            resource_data = df[df['resource_id'] == resource_id]
            usage_values = resource_data['usage_percentage'].values
            
            if len(usage_values) < 5:
                continue
            
            # Use statistical method to detect anomalies
            q1 = np.percentile(usage_values, 25)
            q3 = np.percentile(usage_values, 75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            for _, row in resource_data.iterrows():
                if row['usage_percentage'] < lower_bound or row['usage_percentage'] > upper_bound:
                    anomalies.append({
                        "resource_id": resource_id,
                        "timestamp": row['timestamp'].isoformat(),
                        "usage_percentage": row['usage_percentage'],
                        "expected_range": [lower_bound, upper_bound],
                        "severity": "high" if row['usage_percentage'] > upper_bound * 1.5 else "medium"
                    })
        
        return anomalies

class OptimizationEngine:
    def __init__(self, cost_calculator: CostCalculator, usage_analyzer: UsageAnalyzer):
        self.cost_calculator = cost_calculator
        self.usage_analyzer = usage_analyzer
        
    def generate_optimization_recommendations(self, 
                                            cost_items: List[CostItem],
                                            usage_data: List[ResourceUsage]) -> List[OptimizationRecommendation]:
        """Generate comprehensive optimization recommendations"""
        recommendations = []
        
        # Analyze current efficiency
        efficiency_analysis = self.usage_analyzer.analyze_resource_efficiency(usage_data)
        
        # Generate different types of recommendations
        recommendations.extend(self._generate_rightsizing_recommendations(cost_items, efficiency_analysis))
        recommendations.extend(self._generate_scheduling_recommendations(usage_data))
        recommendations.extend(self._generate_storage_optimization_recommendations(cost_items))
        recommendations.extend(self._generate_instance_type_recommendations(cost_items, usage_data))
        
        # Sort by potential savings
        recommendations.sort(key=lambda r: r.potential_savings, reverse=True)
        
        return recommendations
    
    def _generate_rightsizing_recommendations(self, 
                                           cost_items: List[CostItem],
                                           efficiency_analysis: Dict[str, Any]) -> List[OptimizationRecommendation]:
        """Generate right-sizing recommendations"""
        recommendations = []
        
        for resource_id, analysis in efficiency_analysis.items():
            if analysis["optimization_potential"] > 30:  # High optimization potential
                
                # Find corresponding cost item
                cost_item = next((c for c in cost_items if c.resource_id == resource_id), None)
                if not cost_item:
                    continue
                
                # Calculate potential savings
                current_cost = cost_item.total_cost
                waste_factor = analysis["waste_percentage"] / 100
                potential_savings = current_cost * waste_factor * 0.7  # Conservative estimate
                
                priority = Priority.HIGH if potential_savings > 100 else Priority.MEDIUM
                
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"rightsizing_{resource_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    optimization_type=OptimizationType.RIGHT_SIZING,
                    resource_id=resource_id,
                    resource_name=cost_item.resource_name,
                    current_cost=current_cost,
                    projected_cost=current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=(potential_savings / current_cost) * 100,
                    priority=priority,
                    confidence=0.8 if analysis["efficiency_score"] < 50 else 0.6,
                    description=f"Resource {cost_item.resource_name} shows {analysis['waste_percentage']:.1f}% waste. "
                               f"Average utilization is {analysis['avg_utilization']:.1f}%. Consider right-sizing.",
                    implementation_steps=[
                        "Analyze current resource requirements",
                        "Identify periods of low utilization",
                        "Calculate optimal resource allocation",
                        "Implement gradual right-sizing",
                        "Monitor performance impact"
                    ],
                    estimated_effort_hours=8.0,
                    risks=[
                        "Potential performance degradation",
                        "Application availability impact during changes",
                        "Need for rollback plan"
                    ],
                    prerequisites=[
                        "Performance baseline established",
                        "Monitoring in place",
                        "Change management approval"
                    ]
                )
                
                recommendations.append(recommendation)
        
        return recommendations
    
    def _generate_scheduling_recommendations(self, usage_data: List[ResourceUsage]) -> List[OptimizationRecommendation]:
        """Generate scheduling optimization recommendations"""
        recommendations = []
        
        # Analyze usage patterns
        patterns = self.usage_analyzer.detect_usage_patterns(usage_data)
        
        if "temporal_patterns" in patterns:
            temporal = patterns["temporal_patterns"]
            
            # If there's significant difference between peak and low hours
            hourly_pattern = temporal.get("hourly_pattern", {})
            if hourly_pattern:
                values = list(hourly_pattern.values())
                if max(values) - min(values) > 40:  # 40% difference
                    
                    # Estimate savings from better scheduling
                    avg_daily_cost = 100  # Placeholder, would be calculated from actual data
                    potential_savings = avg_daily_cost * 0.15 * 30  # 15% monthly savings
                    
                    recommendation = OptimizationRecommendation(
                        recommendation_id=f"scheduling_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                        optimization_type=OptimizationType.SCHEDULING,
                        resource_id="cluster",
                        resource_name="Cluster Workloads",
                        current_cost=avg_daily_cost * 30,
                        projected_cost=avg_daily_cost * 30 - potential_savings,
                        potential_savings=potential_savings,
                        savings_percentage=15.0,
                        priority=Priority.MEDIUM,
                        confidence=0.7,
                        description=f"Usage patterns show peak at hour {temporal['peak_hour']} and low at hour {temporal['low_hour']}. "
                                   f"Implementing smart scheduling could reduce costs.",
                        implementation_steps=[
                            "Implement Horizontal Pod Autoscaler (HPA)",
                            "Configure Vertical Pod Autoscaler (VPA)",
                            "Set up cluster autoscaling",
                            "Implement workload scheduling policies",
                            "Monitor scaling effectiveness"
                        ],
                        estimated_effort_hours=16.0,
                        risks=[
                            "Initial setup complexity",
                            "Potential over/under-scaling",
                            "Need for fine-tuning"
                        ],
                        prerequisites=[
                            "Metrics server installed",
                            "Resource requests/limits defined",
                            "Monitoring system in place"
                        ]
                    )
                    
                    recommendations.append(recommendation)
        
        return recommendations
    
    def _generate_storage_optimization_recommendations(self, cost_items: List[CostItem]) -> List[OptimizationRecommendation]:
        """Generate storage optimization recommendations"""
        recommendations = []
        
        storage_items = [c for c in cost_items if c.resource_type == ResourceType.STORAGE]
        
        for cost_item in storage_items:
            # Simulate storage analysis (in reality, would check actual usage)
            current_cost = cost_item.total_cost
            
            # Assume 35% savings possible through optimization
            potential_savings = current_cost * 0.35
            
            if potential_savings > 50:  # Only recommend if savings > $50
                recommendation = OptimizationRecommendation(
                    recommendation_id=f"storage_opt_{cost_item.item_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    optimization_type=OptimizationType.STORAGE_OPTIMIZATION,
                    resource_id=cost_item.resource_id,
                    resource_name=cost_item.resource_name,
                    current_cost=current_cost,
                    projected_cost=current_cost - potential_savings,
                    potential_savings=potential_savings,
                    savings_percentage=35.0,
                    priority=Priority.MEDIUM,
                    confidence=0.6,
                    description=f"Storage {cost_item.resource_name} may benefit from optimization. "
                               f"Consider storage tiering, compression, or cleanup.",
                    implementation_steps=[
                        "Analyze storage usage patterns",
                        "Implement storage lifecycle policies",
                        "Enable compression where applicable",
                        "Clean up unused volumes",
                        "Consider storage tiering"
                    ],
                    estimated_effort_hours=6.0,
                    risks=[
                        "Data access pattern changes",
                        "Potential data loss if not careful",
                        "Performance impact of compression"
                    ],
                    prerequisites=[
                        "Storage usage analysis",
                        "Backup strategy in place",
                        "Data retention policies defined"
                    ]
                )
                
                recommendations.append(recommendation)
        
        return recommendations
    
    def _generate_instance_type_recommendations(self, 
                                              cost_items: List[CostItem],
                                              usage_data: List[ResourceUsage]) -> List[OptimizationRecommendation]:
        """Generate instance type optimization recommendations"""
        recommendations = []
        
        # Group usage by resource
        resource_usage = {}
        for usage in usage_data:
            if usage.resource_id not in resource_usage:
                resource_usage[usage.resource_id] = []
            resource_usage[usage.resource_id].append(usage)
        
        compute_items = [c for c in cost_items if c.resource_type in [ResourceType.CPU, ResourceType.MEMORY]]
        
        for cost_item in compute_items:
            usage_list = resource_usage.get(cost_item.resource_id, [])
            
            if usage_list:
                avg_usage = np.mean([u.usage_percentage for u in usage_list])
                
                # If consistently low usage, recommend reserved or spot instances
                if avg_usage < 60:
                    current_cost = cost_item.total_cost
                    
                    # Reserved instances savings
                    reserved_savings = current_cost * 0.4
                    
                    # Spot instances savings (higher but more risk)
                    spot_savings = current_cost * 0.6
                    
                    # Recommend reserved instances for stable workloads
                    if avg_usage > 30:  # Stable enough for reserved
                        recommendation = OptimizationRecommendation(
                            recommendation_id=f"reserved_{cost_item.item_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                            optimization_type=OptimizationType.RESERVED_INSTANCES,
                            resource_id=cost_item.resource_id,
                            resource_name=cost_item.resource_name,
                            current_cost=current_cost,
                            projected_cost=current_cost - reserved_savings,
                            potential_savings=reserved_savings,
                            savings_percentage=40.0,
                            priority=Priority.HIGH,
                            confidence=0.9,
                            description=f"Resource {cost_item.resource_name} shows consistent usage ({avg_usage:.1f}%). "
                                       f"Reserved instances could provide significant savings.",
                            implementation_steps=[
                                "Analyze long-term usage commitments",
                                "Calculate reserved instance pricing",
                                "Purchase appropriate reserved capacity",
                                "Monitor usage vs. reservations",
                                "Optimize reservation portfolio"
                            ],
                            estimated_effort_hours=4.0,
                            risks=[
                                "Committed spend regardless of usage",
                                "Technology changes affecting needs",
                                "Difficulty in rightsizing reservations"
                            ],
                            prerequisites=[
                                "Stable workload patterns",
                                "Long-term commitment capability",
                                "Financial approval for upfront costs"
                            ]
                        )
                        
                        recommendations.append(recommendation)
                    
                    # Recommend spot instances for fault-tolerant workloads
                    else:
                        recommendation = OptimizationRecommendation(
                            recommendation_id=f"spot_{cost_item.item_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                            optimization_type=OptimizationType.SPOT_INSTANCES,
                            resource_id=cost_item.resource_id,
                            resource_name=cost_item.resource_name,
                            current_cost=current_cost,
                            projected_cost=current_cost - spot_savings,
                            potential_savings=spot_savings,
                            savings_percentage=60.0,
                            priority=Priority.MEDIUM,
                            confidence=0.7,
                            description=f"Resource {cost_item.resource_name} has variable usage ({avg_usage:.1f}%). "
                                       f"Spot instances could provide substantial savings for fault-tolerant workloads.",
                            implementation_steps=[
                                "Identify fault-tolerant workloads",
                                "Implement spot instance automation",
                                "Configure interruption handling",
                                "Set up mixed instance types",
                                "Monitor spot availability and pricing"
                            ],
                            estimated_effort_hours=12.0,
                            risks=[
                                "Instance interruptions",
                                "Application fault tolerance requirements",
                                "Spot price volatility"
                            ],
                            prerequisites=[
                                "Fault-tolerant application design",
                                "Automated deployment pipeline",
                                "Monitoring and alerting systems"
                            ]
                        )
                        
                        recommendations.append(recommendation)
        
        return recommendations

class BudgetManager:
    def __init__(self):
        self.budgets: Dict[str, CostBudget] = {}
        
    def create_budget(self, budget: CostBudget) -> str:
        """Create a new cost budget"""
        self.budgets[budget.budget_id] = budget
        logger.info(f"Created budget: {budget.name}")
        return budget.budget_id
    
    def update_budget_spend(self, budget_id: str, current_spend: float) -> CostAlert:
        """Update budget spending and check for alerts"""
        budget = self.budgets.get(budget_id)
        if not budget:
            return None
        
        budget.current_spend = current_spend
        
        # Check thresholds
        percentage_used = (current_spend / budget.budget_amount) * 100
        
        alert = None
        for threshold_name, threshold_value in budget.alert_thresholds.items():
            if percentage_used >= threshold_value:
                severity = "critical" if threshold_value >= 90 else "warning"
                
                alert = CostAlert(
                    alert_id=f"budget_alert_{budget_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    alert_type="budget_threshold",
                    message=f"Budget '{budget.name}' has reached {percentage_used:.1f}% of allocated amount",
                    severity=severity,
                    resource_id=budget_id,
                    current_value=percentage_used,
                    threshold_value=threshold_value,
                    timestamp=datetime.now()
                )
                break
        
        # Update budget status
        if percentage_used >= 100:
            budget.status = "over_budget"
        elif percentage_used >= 90:
            budget.status = "at_risk"
        else:
            budget.status = "under_budget"
        
        return alert
    
    def get_budget_summary(self) -> Dict[str, Any]:
        """Get summary of all budgets"""
        summary = {
            "total_budgets": len(self.budgets),
            "total_budget_amount": sum(b.budget_amount for b in self.budgets.values()),
            "total_current_spend": sum(b.current_spend for b in self.budgets.values()),
            "budgets_over": len([b for b in self.budgets.values() if b.status == "over_budget"]),
            "budgets_at_risk": len([b for b in self.budgets.values() if b.status == "at_risk"]),
            "budgets": [asdict(b) for b in self.budgets.values()]
        }
        
        return summary

class CostAnalyticsSystem:
    def __init__(self):
        self.cost_calculator = CostCalculator()
        self.usage_analyzer = UsageAnalyzer()
        self.optimization_engine = OptimizationEngine(self.cost_calculator, self.usage_analyzer)
        self.budget_manager = BudgetManager()
        self.redis_client = None
        self.cost_history: List[CostItem] = []
        self.usage_history: List[ResourceUsage] = []
        self.recommendations: List[OptimizationRecommendation] = []
        
    async def initialize(self):
        """Initialize the cost analytics system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        # Create default budgets
        self._create_default_budgets()
        
        logger.info("Cost analytics system initialized")
    
    def _create_default_budgets(self):
        """Create default budgets"""
        monthly_budget = CostBudget(
            budget_id="monthly_infrastructure",
            name="Monthly Infrastructure Budget",
            budget_amount=5000.0,
            period="monthly",
            cost_categories=[CostCategory.COMPUTE, CostCategory.STORAGE, CostCategory.NETWORK],
            alert_thresholds={"warning": 80.0, "critical": 95.0},
            current_spend=0.0,
            forecast_spend=0.0,
            status="under_budget"
        )
        
        self.budget_manager.create_budget(monthly_budget)
    
    async def collect_cost_data(self) -> Dict[str, Any]:
        """Simulate cost data collection"""
        try:
            # Generate simulated cost data
            cost_items = await self._generate_cost_data()
            usage_data = await self._generate_usage_data()
            
            # Add to history
            self.cost_history.extend(cost_items)
            self.usage_history.extend(usage_data)
            
            # Keep only last 30 days
            cutoff_date = datetime.now() - timedelta(days=30)
            self.cost_history = [c for c in self.cost_history if c.billing_period >= cutoff_date]
            self.usage_history = [u for u in self.usage_history if u.timestamp >= cutoff_date]
            
            # Calculate totals
            total_cost = sum(c.total_cost for c in cost_items)
            
            # Update budgets
            budget_alerts = []
            for budget in self.budget_manager.budgets.values():
                alert = self.budget_manager.update_budget_spend(budget.budget_id, total_cost)
                if alert:
                    budget_alerts.append(alert)
            
            # Generate optimization recommendations
            self.recommendations = self.optimization_engine.generate_optimization_recommendations(
                self.cost_history, self.usage_history
            )
            
            return {
                "cost_items_collected": len(cost_items),
                "usage_data_points": len(usage_data),
                "total_cost": total_cost,
                "budget_alerts": len(budget_alerts),
                "optimization_recommendations": len(self.recommendations),
                "potential_savings": sum(r.potential_savings for r in self.recommendations)
            }
            
        except Exception as e:
            logger.error(f"Error collecting cost data: {str(e)}")
            raise
    
    async def _generate_cost_data(self) -> List[CostItem]:
        """Generate simulated cost data"""
        cost_items = []
        timestamp = datetime.now()
        
        # Compute costs
        nodes = ["node-1", "node-2", "node-3"]
        for i, node in enumerate(nodes):
            # CPU cost
            cpu_hours = 24.0
            cpu_cores = [4, 8, 16][i]
            cpu_cost = self.cost_calculator.calculate_resource_cost(
                ResourceType.CPU, cpu_cores, cpu_hours
            )
            
            cost_items.append(CostItem(
                item_id=f"cpu_{node}_{timestamp.strftime('%Y%m%d')}",
                resource_type=ResourceType.CPU,
                cost_category=CostCategory.COMPUTE,
                resource_name=f"{node} CPU",
                resource_id=node,
                cost_per_hour=cpu_cost / cpu_hours,
                usage_hours=cpu_hours,
                total_cost=cpu_cost,
                currency="USD",
                billing_period=timestamp,
                tags={"node": node, "type": "compute"},
                region="eu-central",
                provider="hetzner"
            ))
            
            # Memory cost
            memory_gb = [8, 16, 32][i]
            memory_cost = self.cost_calculator.calculate_resource_cost(
                ResourceType.MEMORY, memory_gb, cpu_hours
            )
            
            cost_items.append(CostItem(
                item_id=f"memory_{node}_{timestamp.strftime('%Y%m%d')}",
                resource_type=ResourceType.MEMORY,
                cost_category=CostCategory.COMPUTE,
                resource_name=f"{node} Memory",
                resource_id=node,
                cost_per_hour=memory_cost / cpu_hours,
                usage_hours=cpu_hours,
                total_cost=memory_cost,
                currency="USD",
                billing_period=timestamp,
                tags={"node": node, "type": "compute"},
                region="eu-central",
                provider="hetzner"
            ))
        
        # Storage costs
        storage_items = [
            ("persistent-volume-1", 100, "ssd"),
            ("persistent-volume-2", 500, "hdd"),
            ("backup-storage", 1000, "archive")
        ]
        
        for storage_id, size_gb, storage_type in storage_items:
            storage_cost = self.cost_calculator.calculate_storage_cost(
                size_gb, storage_type, 24.0
            )
            
            cost_items.append(CostItem(
                item_id=f"storage_{storage_id}_{timestamp.strftime('%Y%m%d')}",
                resource_type=ResourceType.STORAGE,
                cost_category=CostCategory.STORAGE,
                resource_name=f"Storage {storage_id}",
                resource_id=storage_id,
                cost_per_hour=storage_cost / 24.0,
                usage_hours=24.0,
                total_cost=storage_cost,
                currency="USD",
                billing_period=timestamp,
                tags={"storage_type": storage_type, "size": str(size_gb)},
                region="eu-central",
                provider="hetzner"
            ))
        
        return cost_items
    
    async def _generate_usage_data(self) -> List[ResourceUsage]:
        """Generate simulated usage data"""
        usage_data = []
        timestamp = datetime.now()
        
        resources = [
            ("node-1", ResourceType.CPU, 0.012, 4.0),
            ("node-1", ResourceType.MEMORY, 0.0018, 8.0),
            ("node-2", ResourceType.CPU, 0.012, 8.0),
            ("node-2", ResourceType.MEMORY, 0.0018, 16.0),
            ("persistent-volume-1", ResourceType.STORAGE, 0.0001, 100.0)
        ]
        
        for resource_id, resource_type, cost_per_unit, allocated in resources:
            # Generate varying usage percentages
            usage_percentage = np.random.uniform(30, 80)
            used_amount = allocated * (usage_percentage / 100)
            
            usage_data.append(ResourceUsage(
                resource_id=resource_id,
                resource_type=resource_type,
                timestamp=timestamp,
                usage_percentage=usage_percentage,
                allocated_amount=allocated,
                used_amount=used_amount,
                unit="cores" if resource_type == ResourceType.CPU else "GB",
                cost_per_unit=cost_per_unit
            ))
        
        return usage_data
    
    async def get_cost_analysis(self) -> Dict[str, Any]:
        """Get comprehensive cost analysis"""
        try:
            # Calculate cost trends
            daily_costs = {}
            for cost_item in self.cost_history:
                date_key = cost_item.billing_period.date().isoformat()
                if date_key not in daily_costs:
                    daily_costs[date_key] = 0
                daily_costs[date_key] += cost_item.total_cost
            
            # Analyze by category
            category_costs = {}
            for cost_item in self.cost_history:
                category = cost_item.cost_category.value
                if category not in category_costs:
                    category_costs[category] = 0
                category_costs[category] += cost_item.total_cost
            
            # Get efficiency analysis
            efficiency_analysis = self.usage_analyzer.analyze_resource_efficiency(self.usage_history)
            
            # Get budget summary
            budget_summary = self.budget_manager.get_budget_summary()
            
            analysis = {
                "cost_trends": {
                    "daily_costs": daily_costs,
                    "total_cost": sum(daily_costs.values()),
                    "average_daily_cost": np.mean(list(daily_costs.values())) if daily_costs else 0
                },
                "cost_by_category": category_costs,
                "efficiency_analysis": efficiency_analysis,
                "budget_summary": budget_summary,
                "optimization_recommendations": [asdict(r) for r in self.recommendations[:10]],  # Top 10
                "potential_total_savings": sum(r.potential_savings for r in self.recommendations),
                "timestamp": datetime.now().isoformat()
            }
            
            # Cache results
            await self._cache_analysis_results(analysis)
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error in cost analysis: {str(e)}")
            raise
    
    async def _cache_analysis_results(self, analysis: Dict[str, Any]):
        """Cache analysis results"""
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    "cost_analysis_results",
                    3600,  # 1 hour TTL
                    json.dumps(analysis, default=str)
                )
            except Exception as e:
                logger.error(f"Error caching analysis results: {e}")
    
    async def get_recommendations_by_type(self, optimization_type: OptimizationType) -> List[OptimizationRecommendation]:
        """Get recommendations by optimization type"""
        return [r for r in self.recommendations if r.optimization_type == optimization_type]
    
    async def get_high_priority_recommendations(self) -> List[OptimizationRecommendation]:
        """Get high priority recommendations"""
        return [r for r in self.recommendations if r.priority in [Priority.HIGH, Priority.CRITICAL]]

# FastAPI application
app = FastAPI(title="Cost Analytics System", version="1.0.0")
cost_system = CostAnalyticsSystem()

@app.on_event("startup")
async def startup():
    await cost_system.initialize()

class BudgetRequest(BaseModel):
    name: str
    budget_amount: float
    period: str
    cost_categories: List[str]
    alert_thresholds: Dict[str, float]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "cost-analytics"}

@app.post("/collect")
async def collect_cost_data(background_tasks: BackgroundTasks):
    """Trigger cost data collection"""
    try:
        background_tasks.add_task(cost_system.collect_cost_data)
        return {"status": "collection_started", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analysis")
async def get_cost_analysis():
    """Get comprehensive cost analysis"""
    try:
        analysis = await cost_system.get_cost_analysis()
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recommendations")
async def get_optimization_recommendations(
    optimization_type: Optional[str] = None,
    priority: Optional[str] = None
):
    """Get optimization recommendations"""
    try:
        recommendations = cost_system.recommendations
        
        if optimization_type:
            opt_type = OptimizationType(optimization_type)
            recommendations = await cost_system.get_recommendations_by_type(opt_type)
        
        if priority == "high":
            recommendations = await cost_system.get_high_priority_recommendations()
        
        return {
            "recommendations": [asdict(r) for r in recommendations],
            "count": len(recommendations),
            "total_potential_savings": sum(r.potential_savings for r in recommendations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/budgets")
async def get_budgets():
    """Get budget summary"""
    try:
        summary = cost_system.budget_manager.get_budget_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/budgets")
async def create_budget(request: BudgetRequest):
    """Create a new budget"""
    try:
        budget_id = f"budget_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        budget = CostBudget(
            budget_id=budget_id,
            name=request.name,
            budget_amount=request.budget_amount,
            period=request.period,
            cost_categories=[CostCategory(cat) for cat in request.cost_categories],
            alert_thresholds=request.alert_thresholds,
            current_spend=0.0,
            forecast_spend=0.0,
            status="under_budget"
        )
        
        created_id = cost_system.budget_manager.create_budget(budget)
        
        return {
            "budget_id": created_id,
            "status": "created",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/efficiency")
async def get_efficiency_analysis():
    """Get resource efficiency analysis"""
    try:
        efficiency = cost_system.usage_analyzer.analyze_resource_efficiency(cost_system.usage_history)
        return {
            "efficiency_analysis": efficiency,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)