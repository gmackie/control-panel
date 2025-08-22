import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import json
from collections import defaultdict, deque
import heapq

class ResourceType(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"
    GPU = "gpu"
    INSTANCE = "instance"
    CONTAINER = "container"
    DATABASE = "database"

class OptimizationObjective(Enum):
    COST_MINIMIZE = "cost_minimize"
    PERFORMANCE_MAXIMIZE = "performance_maximize"
    EFFICIENCY_MAXIMIZE = "efficiency_maximize"
    BALANCED = "balanced"
    SUSTAINABILITY = "sustainability"

class OptimizationStrategy(Enum):
    RIGHT_SIZING = "right_sizing"
    WORKLOAD_CONSOLIDATION = "workload_consolidation"
    RESOURCE_SCHEDULING = "resource_scheduling"
    AUTO_SCALING = "auto_scaling"
    CAPACITY_PLANNING = "capacity_planning"
    COST_OPTIMIZATION = "cost_optimization"

class ResourceState(Enum):
    UNDERUTILIZED = "underutilized"
    OPTIMAL = "optimal"
    OVERUTILIZED = "overutilized"
    IDLE = "idle"
    CRITICAL = "critical"

@dataclass
class ResourceUsage:
    resource_id: str
    resource_type: ResourceType
    timestamp: datetime
    allocated: float
    used: float
    available: float
    utilization: float
    cost_per_hour: float
    performance_metrics: Dict[str, float]
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class WorkloadProfile:
    workload_id: str
    name: str
    resource_requirements: Dict[ResourceType, float]
    performance_requirements: Dict[str, float]
    priority: int  # 1-10, 10 being highest
    flexibility: float  # 0-1, how flexible the workload is
    scheduled_times: List[Tuple[datetime, datetime]]
    dependencies: List[str] = field(default_factory=list)
    constraints: Dict[str, Any] = field(default_factory=dict)

@dataclass
class OptimizationRecommendation:
    recommendation_id: str
    strategy: OptimizationStrategy
    resource_id: str
    resource_type: ResourceType
    current_allocation: float
    recommended_allocation: float
    expected_savings: float
    expected_performance_impact: float
    implementation_effort: str  # low, medium, high
    risk_level: str  # low, medium, high
    justification: str
    implementation_steps: List[str]
    validation_metrics: List[str]
    rollback_plan: str
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class OptimizationResult:
    optimization_id: str
    objective: OptimizationObjective
    total_cost_savings: float
    total_performance_impact: float
    efficiency_improvement: float
    recommendations: List[OptimizationRecommendation]
    implementation_timeline: Dict[str, datetime]
    risk_assessment: Dict[str, Any]
    validation_plan: List[str]

@dataclass
class ResourceCluster:
    cluster_id: str
    cluster_type: str
    resources: List[str]
    average_utilization: float
    total_capacity: float
    workload_patterns: Dict[str, Any]
    optimization_potential: float

class WorkloadAnalyzer:
    def __init__(self):
        self.workload_profiles = {}
        self.usage_patterns = defaultdict(list)
        self.clustering_model = None
        
    async def analyze_workload_patterns(self, usage_data: List[ResourceUsage]) -> Dict[str, Any]:
        """Analyze workload patterns to identify optimization opportunities"""
        
        # Group usage data by resource
        resource_usage = defaultdict(list)
        for usage in usage_data:
            resource_usage[usage.resource_id].append(usage)
        
        patterns = {}
        for resource_id, usages in resource_usage.items():
            if len(usages) >= 24:  # Need at least 24 hours of data
                pattern = await self._analyze_single_resource_pattern(resource_id, usages)
                patterns[resource_id] = pattern
        
        return patterns
    
    async def _analyze_single_resource_pattern(self, resource_id: str, 
                                             usages: List[ResourceUsage]) -> Dict[str, Any]:
        """Analyze usage pattern for a single resource"""
        # Sort by timestamp
        usages.sort(key=lambda x: x.timestamp)
        
        # Extract time series data
        timestamps = [u.timestamp for u in usages]
        utilizations = [u.utilization for u in usages]
        
        # Calculate basic statistics
        avg_utilization = np.mean(utilizations)
        peak_utilization = np.max(utilizations)
        min_utilization = np.min(utilizations)
        std_utilization = np.std(utilizations)
        
        # Detect patterns
        hourly_pattern = self._extract_hourly_pattern(timestamps, utilizations)
        daily_pattern = self._extract_daily_pattern(timestamps, utilizations)
        weekly_pattern = self._extract_weekly_pattern(timestamps, utilizations)
        
        # Identify idle periods
        idle_threshold = 0.1
        idle_periods = self._identify_idle_periods(timestamps, utilizations, idle_threshold)
        
        # Calculate efficiency metrics
        efficiency_score = self._calculate_efficiency_score(utilizations)
        waste_percentage = self._calculate_waste_percentage(utilizations)
        
        # Determine resource state
        state = self._determine_resource_state(avg_utilization, peak_utilization, std_utilization)
        
        return {
            'resource_id': resource_id,
            'avg_utilization': avg_utilization,
            'peak_utilization': peak_utilization,
            'min_utilization': min_utilization,
            'std_utilization': std_utilization,
            'efficiency_score': efficiency_score,
            'waste_percentage': waste_percentage,
            'state': state.value,
            'hourly_pattern': hourly_pattern,
            'daily_pattern': daily_pattern,
            'weekly_pattern': weekly_pattern,
            'idle_periods': idle_periods,
            'optimization_potential': self._calculate_optimization_potential(
                avg_utilization, peak_utilization, std_utilization
            )
        }
    
    def _extract_hourly_pattern(self, timestamps: List[datetime], 
                               utilizations: List[float]) -> List[float]:
        """Extract 24-hour usage pattern"""
        hourly_usage = [[] for _ in range(24)]
        
        for timestamp, utilization in zip(timestamps, utilizations):
            hour = timestamp.hour
            hourly_usage[hour].append(utilization)
        
        # Calculate average for each hour
        pattern = []
        for hour_data in hourly_usage:
            if hour_data:
                pattern.append(np.mean(hour_data))
            else:
                pattern.append(0.0)
        
        return pattern
    
    def _extract_daily_pattern(self, timestamps: List[datetime], 
                              utilizations: List[float]) -> List[float]:
        """Extract 7-day weekly pattern"""
        daily_usage = [[] for _ in range(7)]
        
        for timestamp, utilization in zip(timestamps, utilizations):
            day = timestamp.weekday()
            daily_usage[day].append(utilization)
        
        pattern = []
        for day_data in daily_usage:
            if day_data:
                pattern.append(np.mean(day_data))
            else:
                pattern.append(0.0)
        
        return pattern
    
    def _extract_weekly_pattern(self, timestamps: List[datetime], 
                               utilizations: List[float]) -> Dict[str, float]:
        """Extract monthly/weekly trends"""
        # Group by week number
        weekly_data = defaultdict(list)
        for timestamp, utilization in zip(timestamps, utilizations):
            week = timestamp.isocalendar()[1]  # ISO week number
            weekly_data[week].append(utilization)
        
        # Calculate trend
        weeks = sorted(weekly_data.keys())
        if len(weeks) >= 2:
            week_averages = [np.mean(weekly_data[week]) for week in weeks]
            # Simple linear trend
            coeffs = np.polyfit(range(len(week_averages)), week_averages, 1)
            trend = coeffs[0]  # Slope
        else:
            trend = 0.0
        
        return {
            'trend': trend,
            'weekly_averages': {week: np.mean(data) for week, data in weekly_data.items()}
        }
    
    def _identify_idle_periods(self, timestamps: List[datetime], 
                              utilizations: List[float], threshold: float) -> List[Dict[str, Any]]:
        """Identify periods when resource is idle"""
        idle_periods = []
        current_idle_start = None
        
        for timestamp, utilization in zip(timestamps, utilizations):
            if utilization <= threshold:
                if current_idle_start is None:
                    current_idle_start = timestamp
            else:
                if current_idle_start is not None:
                    # End of idle period
                    duration = timestamp - current_idle_start
                    if duration.total_seconds() >= 3600:  # At least 1 hour
                        idle_periods.append({
                            'start': current_idle_start,
                            'end': timestamp,
                            'duration_hours': duration.total_seconds() / 3600
                        })
                    current_idle_start = None
        
        return idle_periods
    
    def _calculate_efficiency_score(self, utilizations: List[float]) -> float:
        """Calculate efficiency score (0-1)"""
        if not utilizations:
            return 0.0
        
        # Ideal utilization range is 70-85%
        optimal_range = (0.70, 0.85)
        
        in_range_count = sum(
            1 for u in utilizations 
            if optimal_range[0] <= u <= optimal_range[1]
        )
        
        efficiency = in_range_count / len(utilizations)
        return efficiency
    
    def _calculate_waste_percentage(self, utilizations: List[float]) -> float:
        """Calculate percentage of wasted resources"""
        if not utilizations:
            return 0.0
        
        # Consider anything below 20% as waste
        waste_threshold = 0.20
        wasted_capacity = sum(max(0, waste_threshold - u) for u in utilizations)
        total_potential = len(utilizations) * waste_threshold
        
        if total_potential == 0:
            return 0.0
        
        return (wasted_capacity / total_potential) * 100
    
    def _determine_resource_state(self, avg_util: float, peak_util: float, 
                                 std_util: float) -> ResourceState:
        """Determine the current state of a resource"""
        if avg_util < 0.1:
            return ResourceState.IDLE
        elif avg_util < 0.3:
            return ResourceState.UNDERUTILIZED
        elif avg_util > 0.9 or peak_util > 0.95:
            return ResourceState.CRITICAL
        elif avg_util > 0.8:
            return ResourceState.OVERUTILIZED
        else:
            return ResourceState.OPTIMAL
    
    def _calculate_optimization_potential(self, avg_util: float, peak_util: float, 
                                        std_util: float) -> float:
        """Calculate optimization potential (0-1)"""
        # Higher potential for underutilized or highly variable resources
        underutil_factor = max(0, 0.7 - avg_util) / 0.7  # Higher if less utilized
        variability_factor = min(std_util / 0.3, 1.0)  # Higher if more variable
        
        potential = (underutil_factor + variability_factor) / 2
        return min(potential, 1.0)

class ResourceClustering:
    def __init__(self):
        self.scaler = StandardScaler()
        self.kmeans = None
        self.cluster_profiles = {}
        
    async def cluster_resources(self, usage_patterns: Dict[str, Any]) -> Dict[str, ResourceCluster]:
        """Cluster resources based on usage patterns"""
        if len(usage_patterns) < 3:
            return {}
        
        # Prepare feature matrix
        features = []
        resource_ids = []
        
        for resource_id, pattern in usage_patterns.items():
            feature_vector = [
                pattern['avg_utilization'],
                pattern['peak_utilization'],
                pattern['std_utilization'],
                pattern['efficiency_score'],
                pattern['waste_percentage'] / 100,
                pattern['optimization_potential']
            ]
            
            # Add hourly pattern features (simplified)
            hourly = pattern.get('hourly_pattern', [0] * 24)
            feature_vector.extend([
                np.mean(hourly[:6]),   # Night average
                np.mean(hourly[6:12]), # Morning average
                np.mean(hourly[12:18]), # Afternoon average
                np.mean(hourly[18:24])  # Evening average
            ])
            
            features.append(feature_vector)
            resource_ids.append(resource_id)
        
        # Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # Determine optimal number of clusters
        n_clusters = min(max(2, len(features) // 3), 8)
        
        # Perform clustering
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = self.kmeans.fit_predict(features_scaled)
        
        # Group resources by cluster
        clusters = defaultdict(list)
        for resource_id, label in zip(resource_ids, cluster_labels):
            clusters[label].append(resource_id)
        
        # Create cluster objects
        resource_clusters = {}
        for cluster_id, resource_list in clusters.items():
            cluster = await self._create_cluster_profile(
                cluster_id, resource_list, usage_patterns
            )
            resource_clusters[f"cluster_{cluster_id}"] = cluster
        
        return resource_clusters
    
    async def _create_cluster_profile(self, cluster_id: int, resource_ids: List[str],
                                    usage_patterns: Dict[str, Any]) -> ResourceCluster:
        """Create profile for a resource cluster"""
        cluster_patterns = [usage_patterns[rid] for rid in resource_ids]
        
        # Calculate cluster statistics
        avg_utilizations = [p['avg_utilization'] for p in cluster_patterns]
        optimization_potentials = [p['optimization_potential'] for p in cluster_patterns]
        
        # Determine cluster type based on characteristics
        avg_cluster_util = np.mean(avg_utilizations)
        avg_optimization_potential = np.mean(optimization_potentials)
        
        if avg_cluster_util < 0.2:
            cluster_type = "idle_resources"
        elif avg_cluster_util < 0.5:
            cluster_type = "underutilized_resources"
        elif avg_cluster_util > 0.8:
            cluster_type = "high_utilization_resources"
        elif avg_optimization_potential > 0.6:
            cluster_type = "variable_workload_resources"
        else:
            cluster_type = "stable_resources"
        
        # Aggregate workload patterns
        hourly_patterns = [p.get('hourly_pattern', [0] * 24) for p in cluster_patterns]
        avg_hourly_pattern = np.mean(hourly_patterns, axis=0).tolist()
        
        workload_patterns = {
            'hourly_pattern': avg_hourly_pattern,
            'avg_utilization': avg_cluster_util,
            'utilization_std': np.std(avg_utilizations),
            'peak_hours': self._identify_peak_hours(avg_hourly_pattern)
        }
        
        return ResourceCluster(
            cluster_id=f"cluster_{cluster_id}",
            cluster_type=cluster_type,
            resources=resource_ids,
            average_utilization=avg_cluster_util,
            total_capacity=len(resource_ids),  # Simplified
            workload_patterns=workload_patterns,
            optimization_potential=avg_optimization_potential
        )
    
    def _identify_peak_hours(self, hourly_pattern: List[float]) -> List[int]:
        """Identify peak usage hours"""
        if not hourly_pattern:
            return []
        
        mean_usage = np.mean(hourly_pattern)
        threshold = mean_usage * 1.2  # 20% above average
        
        peak_hours = [
            hour for hour, usage in enumerate(hourly_pattern)
            if usage > threshold
        ]
        
        return peak_hours

class OptimizationEngine:
    def __init__(self):
        self.workload_analyzer = WorkloadAnalyzer()
        self.clustering = ResourceClustering()
        self.optimization_history = []
        
    async def optimize_resources(self, usage_data: List[ResourceUsage],
                               workloads: List[WorkloadProfile],
                               objective: OptimizationObjective) -> OptimizationResult:
        """Main optimization function"""
        
        # Analyze workload patterns
        usage_patterns = await self.workload_analyzer.analyze_workload_patterns(usage_data)
        
        # Cluster similar resources
        clusters = await self.clustering.cluster_resources(usage_patterns)
        
        # Generate recommendations by strategy
        recommendations = []
        
        # Right-sizing recommendations
        sizing_recs = await self._generate_rightsizing_recommendations(
            usage_patterns, objective
        )
        recommendations.extend(sizing_recs)
        
        # Workload consolidation recommendations
        consolidation_recs = await self._generate_consolidation_recommendations(
            clusters, workloads, objective
        )
        recommendations.extend(consolidation_recs)
        
        # Auto-scaling recommendations
        autoscaling_recs = await self._generate_autoscaling_recommendations(
            usage_patterns, objective
        )
        recommendations.extend(autoscaling_recs)
        
        # Scheduling recommendations
        scheduling_recs = await self._generate_scheduling_recommendations(
            workloads, usage_patterns, objective
        )
        recommendations.extend(scheduling_recs)
        
        # Calculate total impact
        total_savings = sum(rec.expected_savings for rec in recommendations)
        avg_performance_impact = np.mean([rec.expected_performance_impact for rec in recommendations])
        efficiency_improvement = await self._calculate_efficiency_improvement(
            recommendations, usage_patterns
        )
        
        # Create implementation timeline
        timeline = await self._create_implementation_timeline(recommendations)
        
        # Risk assessment
        risk_assessment = await self._assess_implementation_risks(recommendations)
        
        # Validation plan
        validation_plan = await self._create_validation_plan(recommendations)
        
        result = OptimizationResult(
            optimization_id=str(uuid.uuid4()),
            objective=objective,
            total_cost_savings=total_savings,
            total_performance_impact=avg_performance_impact,
            efficiency_improvement=efficiency_improvement,
            recommendations=recommendations,
            implementation_timeline=timeline,
            risk_assessment=risk_assessment,
            validation_plan=validation_plan
        )
        
        self.optimization_history.append(result)
        return result
    
    async def _generate_rightsizing_recommendations(self, usage_patterns: Dict[str, Any],
                                                  objective: OptimizationObjective) -> List[OptimizationRecommendation]:
        """Generate right-sizing recommendations"""
        recommendations = []
        
        for resource_id, pattern in usage_patterns.items():
            if pattern['state'] in ['underutilized', 'idle']:
                # Calculate optimal size
                peak_util = pattern['peak_utilization']
                avg_util = pattern['avg_utilization']
                
                # Conservative sizing: peak + 20% buffer
                optimal_utilization = 0.75
                size_factor = (peak_util * 1.2) / optimal_utilization
                
                # Don't recommend sizing below 50% of current
                size_factor = max(size_factor, 0.5)
                
                if size_factor < 0.9:  # Only recommend if significant savings
                    current_allocation = 100.0  # Simplified
                    recommended_allocation = current_allocation * size_factor
                    savings = (current_allocation - recommended_allocation) * 0.10 * 24 * 30  # Monthly
                    
                    recommendations.append(OptimizationRecommendation(
                        recommendation_id=str(uuid.uuid4()),
                        strategy=OptimizationStrategy.RIGHT_SIZING,
                        resource_id=resource_id,
                        resource_type=ResourceType.CPU,  # Simplified
                        current_allocation=current_allocation,
                        recommended_allocation=recommended_allocation,
                        expected_savings=savings,
                        expected_performance_impact=self._calculate_performance_impact(size_factor),
                        implementation_effort="medium",
                        risk_level="low" if size_factor > 0.7 else "medium",
                        justification=f"Resource is {pattern['state']} with {avg_util:.1%} average utilization",
                        implementation_steps=[
                            "Analyze workload requirements",
                            "Schedule maintenance window",
                            "Resize resource gradually",
                            "Monitor performance metrics",
                            "Validate cost savings"
                        ],
                        validation_metrics=[
                            "CPU utilization stays below 85%",
                            "Response time within SLA",
                            "No increase in error rate"
                        ],
                        rollback_plan="Revert to original size if performance degrades"
                    ))
        
        return recommendations
    
    async def _generate_consolidation_recommendations(self, clusters: Dict[str, ResourceCluster],
                                                    workloads: List[WorkloadProfile],
                                                    objective: OptimizationObjective) -> List[OptimizationRecommendation]:
        """Generate workload consolidation recommendations"""
        recommendations = []
        
        for cluster_name, cluster in clusters.items():
            if (cluster.cluster_type == "underutilized_resources" and 
                len(cluster.resources) >= 2 and 
                cluster.optimization_potential > 0.5):
                
                # Calculate consolidation potential
                total_resources = len(cluster.resources)
                target_utilization = 0.75
                consolidated_count = max(1, int(cluster.average_utilization * total_resources / target_utilization))
                
                if consolidated_count < total_resources:
                    resources_to_remove = total_resources - consolidated_count
                    savings_per_resource = 100.0 * 0.10 * 24 * 30  # Monthly cost per resource
                    total_savings = resources_to_remove * savings_per_resource
                    
                    recommendations.append(OptimizationRecommendation(
                        recommendation_id=str(uuid.uuid4()),
                        strategy=OptimizationStrategy.WORKLOAD_CONSOLIDATION,
                        resource_id=cluster_name,
                        resource_type=ResourceType.INSTANCE,
                        current_allocation=float(total_resources),
                        recommended_allocation=float(consolidated_count),
                        expected_savings=total_savings,
                        expected_performance_impact=0.05,  # Small positive impact from better utilization
                        implementation_effort="high",
                        risk_level="medium",
                        justification=f"Cluster has {cluster.average_utilization:.1%} average utilization across {total_resources} resources",
                        implementation_steps=[
                            "Analyze workload compatibility",
                            "Plan migration strategy",
                            "Gradually migrate workloads",
                            "Decommission unused resources",
                            "Update load balancing configuration"
                        ],
                        validation_metrics=[
                            "All workloads performing within SLA",
                            "Resource utilization below 85%",
                            "Cost reduction achieved"
                        ],
                        rollback_plan="Restore original resource allocation if issues arise",
                        metadata={
                            'cluster_type': cluster.cluster_type,
                            'resources_affected': cluster.resources,
                            'consolidation_ratio': consolidated_count / total_resources
                        }
                    ))
        
        return recommendations
    
    async def _generate_autoscaling_recommendations(self, usage_patterns: Dict[str, Any],
                                                  objective: OptimizationObjective) -> List[OptimizationRecommendation]:
        """Generate auto-scaling recommendations"""
        recommendations = []
        
        for resource_id, pattern in usage_patterns.items():
            # Check if resource has variable workload patterns
            hourly_pattern = pattern.get('hourly_pattern', [])
            if hourly_pattern and len(hourly_pattern) == 24:
                peak_hour_usage = max(hourly_pattern)
                min_hour_usage = min(hourly_pattern)
                variability = peak_hour_usage - min_hour_usage
                
                if variability > 0.3 and pattern['optimization_potential'] > 0.4:
                    # Calculate auto-scaling parameters
                    scale_up_threshold = peak_hour_usage * 0.8
                    scale_down_threshold = min_hour_usage * 1.5
                    
                    # Estimate savings from auto-scaling
                    avg_reduction = variability * 0.3  # Conservative estimate
                    monthly_savings = avg_reduction * 100.0 * 0.10 * 24 * 30
                    
                    recommendations.append(OptimizationRecommendation(
                        recommendation_id=str(uuid.uuid4()),
                        strategy=OptimizationStrategy.AUTO_SCALING,
                        resource_id=resource_id,
                        resource_type=ResourceType.CPU,
                        current_allocation=100.0,
                        recommended_allocation=100.0 - (avg_reduction * 100),
                        expected_savings=monthly_savings,
                        expected_performance_impact=0.0,  # Neutral if configured correctly
                        implementation_effort="medium",
                        risk_level="low",
                        justification=f"Resource shows {variability:.1%} usage variability throughout the day",
                        implementation_steps=[
                            "Configure auto-scaling policies",
                            "Set appropriate scaling thresholds",
                            "Test scaling behavior",
                            "Monitor scaling events",
                            "Fine-tune scaling parameters"
                        ],
                        validation_metrics=[
                            "Scaling events occur as expected",
                            "Response time remains stable",
                            "Cost reduction achieved"
                        ],
                        rollback_plan="Disable auto-scaling and return to fixed capacity",
                        metadata={
                            'scale_up_threshold': scale_up_threshold,
                            'scale_down_threshold': scale_down_threshold,
                            'peak_usage': peak_hour_usage,
                            'min_usage': min_hour_usage
                        }
                    ))
        
        return recommendations
    
    async def _generate_scheduling_recommendations(self, workloads: List[WorkloadProfile],
                                                 usage_patterns: Dict[str, Any],
                                                 objective: OptimizationObjective) -> List[OptimizationRecommendation]:
        """Generate workload scheduling recommendations"""
        recommendations = []
        
        # Find flexible workloads that can be rescheduled
        flexible_workloads = [w for w in workloads if w.flexibility > 0.5]
        
        if len(flexible_workloads) >= 2:
            # Analyze resource usage patterns to find optimal scheduling windows
            for workload in flexible_workloads:
                if workload.priority <= 7:  # Only recommend for non-critical workloads
                    # Find low-usage time windows
                    optimal_windows = self._find_optimal_scheduling_windows(usage_patterns)
                    
                    if optimal_windows:
                        potential_savings = len(optimal_windows) * 50.0  # Simplified calculation
                        
                        recommendations.append(OptimizationRecommendation(
                            recommendation_id=str(uuid.uuid4()),
                            strategy=OptimizationStrategy.RESOURCE_SCHEDULING,
                            resource_id=workload.workload_id,
                            resource_type=ResourceType.INSTANCE,
                            current_allocation=100.0,
                            recommended_allocation=100.0,
                            expected_savings=potential_savings,
                            expected_performance_impact=-0.1,  # Slight negative impact from scheduling
                            implementation_effort="low",
                            risk_level="low",
                            justification=f"Workload {workload.name} is flexible and can be scheduled during low-usage periods",
                            implementation_steps=[
                                "Identify optimal scheduling windows",
                                "Update workload scheduling configuration",
                                "Test scheduled execution",
                                "Monitor resource utilization",
                                "Adjust scheduling as needed"
                            ],
                            validation_metrics=[
                                "Workload completes within SLA",
                                "Resource utilization more even",
                                "Cost reduction achieved"
                            ],
                            rollback_plan="Revert to original scheduling if issues occur",
                            metadata={
                                'workload_name': workload.name,
                                'flexibility_score': workload.flexibility,
                                'optimal_windows': optimal_windows
                            }
                        ))
        
        return recommendations
    
    def _find_optimal_scheduling_windows(self, usage_patterns: Dict[str, Any]) -> List[Dict[str, int]]:
        """Find optimal time windows for workload scheduling"""
        # Aggregate hourly patterns across all resources
        all_hourly_patterns = []
        for pattern in usage_patterns.values():
            hourly = pattern.get('hourly_pattern', [])
            if hourly and len(hourly) == 24:
                all_hourly_patterns.append(hourly)
        
        if not all_hourly_patterns:
            return []
        
        # Calculate average usage by hour
        avg_hourly_usage = np.mean(all_hourly_patterns, axis=0)
        
        # Find hours with below-average usage
        overall_avg = np.mean(avg_hourly_usage)
        low_usage_hours = [
            hour for hour, usage in enumerate(avg_hourly_usage)
            if usage < overall_avg * 0.8
        ]
        
        # Group consecutive hours into windows
        windows = []
        if low_usage_hours:
            current_window_start = low_usage_hours[0]
            current_window_end = low_usage_hours[0]
            
            for hour in low_usage_hours[1:]:
                if hour == current_window_end + 1:
                    current_window_end = hour
                else:
                    if current_window_end - current_window_start >= 1:  # At least 2 hours
                        windows.append({
                            'start_hour': current_window_start,
                            'end_hour': current_window_end,
                            'duration_hours': current_window_end - current_window_start + 1
                        })
                    current_window_start = hour
                    current_window_end = hour
            
            # Add the last window
            if current_window_end - current_window_start >= 1:
                windows.append({
                    'start_hour': current_window_start,
                    'end_hour': current_window_end,
                    'duration_hours': current_window_end - current_window_start + 1
                })
        
        return windows
    
    def _calculate_performance_impact(self, size_factor: float) -> float:
        """Calculate expected performance impact of resource changes"""
        if size_factor >= 1.0:
            return 0.05  # Slight positive impact from more resources
        elif size_factor >= 0.8:
            return 0.0   # Neutral impact
        elif size_factor >= 0.6:
            return -0.05 # Small negative impact
        else:
            return -0.15 # Moderate negative impact
    
    async def _calculate_efficiency_improvement(self, recommendations: List[OptimizationRecommendation],
                                              usage_patterns: Dict[str, Any]) -> float:
        """Calculate overall efficiency improvement from recommendations"""
        if not recommendations:
            return 0.0
        
        # Calculate weighted efficiency improvement
        total_improvement = 0.0
        total_weight = 0.0
        
        for rec in recommendations:
            if rec.resource_id in usage_patterns:
                pattern = usage_patterns[rec.resource_id]
                current_efficiency = pattern['efficiency_score']
                
                # Estimate new efficiency based on strategy
                if rec.strategy == OptimizationStrategy.RIGHT_SIZING:
                    # Right-sizing should improve efficiency
                    new_efficiency = min(1.0, current_efficiency + 0.2)
                elif rec.strategy == OptimizationStrategy.AUTO_SCALING:
                    # Auto-scaling should significantly improve efficiency
                    new_efficiency = min(1.0, current_efficiency + 0.3)
                else:
                    # Other strategies have modest improvement
                    new_efficiency = min(1.0, current_efficiency + 0.1)
                
                improvement = new_efficiency - current_efficiency
                weight = rec.expected_savings
                
                total_improvement += improvement * weight
                total_weight += weight
        
        if total_weight > 0:
            return (total_improvement / total_weight) * 100  # Convert to percentage
        else:
            return 0.0
    
    async def _create_implementation_timeline(self, recommendations: List[OptimizationRecommendation]) -> Dict[str, datetime]:
        """Create implementation timeline for recommendations"""
        timeline = {}
        current_date = datetime.now()
        
        # Sort recommendations by effort and risk
        effort_order = {"low": 1, "medium": 2, "high": 3}
        risk_order = {"low": 1, "medium": 2, "high": 3}
        
        sorted_recs = sorted(
            recommendations,
            key=lambda r: (effort_order.get(r.implementation_effort, 2), 
                          risk_order.get(r.risk_level, 2))
        )
        
        # Schedule implementations
        for i, rec in enumerate(sorted_recs):
            if rec.implementation_effort == "low":
                days_offset = i * 3  # 3 days apart
            elif rec.implementation_effort == "medium":
                days_offset = i * 7  # 1 week apart
            else:
                days_offset = i * 14  # 2 weeks apart
            
            implementation_date = current_date + timedelta(days=days_offset)
            timeline[rec.recommendation_id] = implementation_date
        
        return timeline
    
    async def _assess_implementation_risks(self, recommendations: List[OptimizationRecommendation]) -> Dict[str, Any]:
        """Assess risks of implementing recommendations"""
        risk_assessment = {
            'overall_risk': 'low',
            'high_risk_recommendations': [],
            'risk_factors': [],
            'mitigation_strategies': []
        }
        
        high_risk_count = sum(1 for rec in recommendations if rec.risk_level == "high")
        medium_risk_count = sum(1 for rec in recommendations if rec.risk_level == "medium")
        
        # Determine overall risk level
        if high_risk_count > 0:
            risk_assessment['overall_risk'] = 'high'
        elif medium_risk_count > len(recommendations) // 2:
            risk_assessment['overall_risk'] = 'medium'
        
        # Identify high-risk recommendations
        risk_assessment['high_risk_recommendations'] = [
            rec.recommendation_id for rec in recommendations if rec.risk_level == "high"
        ]
        
        # Common risk factors
        if any(rec.strategy == OptimizationStrategy.WORKLOAD_CONSOLIDATION for rec in recommendations):
            risk_assessment['risk_factors'].append("Workload consolidation may impact performance")
            risk_assessment['mitigation_strategies'].append("Implement gradual migration with rollback plan")
        
        if any(rec.expected_performance_impact < -0.1 for rec in recommendations):
            risk_assessment['risk_factors'].append("Some recommendations may negatively impact performance")
            risk_assessment['mitigation_strategies'].append("Monitor performance metrics closely during implementation")
        
        return risk_assessment
    
    async def _create_validation_plan(self, recommendations: List[OptimizationRecommendation]) -> List[str]:
        """Create validation plan for optimization recommendations"""
        validation_steps = [
            "Establish baseline metrics before implementation",
            "Monitor resource utilization during implementation",
            "Validate cost savings after each recommendation",
            "Check performance metrics against SLA thresholds",
            "Verify workload functionality and user experience",
            "Measure efficiency improvements",
            "Document lessons learned and optimization impact"
        ]
        
        # Add strategy-specific validations
        strategies = set(rec.strategy for rec in recommendations)
        
        if OptimizationStrategy.AUTO_SCALING in strategies:
            validation_steps.append("Test auto-scaling behavior under load")
        
        if OptimizationStrategy.WORKLOAD_CONSOLIDATION in strategies:
            validation_steps.append("Verify workload isolation and resource sharing")
        
        if OptimizationStrategy.RIGHT_SIZING in strategies:
            validation_steps.append("Confirm resource capacity meets peak demand")
        
        return validation_steps

# Example usage
async def main():
    optimizer = OptimizationEngine()
    
    # Create sample usage data
    usage_data = []
    resource_types = [ResourceType.CPU, ResourceType.MEMORY, ResourceType.STORAGE]
    
    for i in range(3):  # 3 resources
        for hour in range(24):  # 24 hours of data
            # Simulate different usage patterns
            if i == 0:  # Underutilized resource
                base_usage = 20 + 10 * np.sin(hour * np.pi / 12)  # Daily pattern
            elif i == 1:  # Variable workload
                base_usage = 40 + 30 * np.sin(hour * np.pi / 12) + np.random.normal(0, 5)
            else:  # Stable workload
                base_usage = 60 + np.random.normal(0, 3)
            
            usage = ResourceUsage(
                resource_id=f"resource-{i}",
                resource_type=resource_types[i % len(resource_types)],
                timestamp=datetime.now() - timedelta(hours=24-hour),
                allocated=100.0,
                used=max(0, min(100, base_usage)),
                available=100.0 - max(0, min(100, base_usage)),
                utilization=max(0, min(1.0, base_usage / 100)),
                cost_per_hour=0.10,
                performance_metrics={"response_time": 100 + base_usage}
            )
            usage_data.append(usage)
    
    # Create sample workloads
    workloads = [
        WorkloadProfile(
            workload_id="workload-1",
            name="Batch Processing",
            resource_requirements={ResourceType.CPU: 50, ResourceType.MEMORY: 80},
            performance_requirements={"completion_time": 3600},
            priority=5,
            flexibility=0.8,
            scheduled_times=[(datetime.now(), datetime.now() + timedelta(hours=2))]
        ),
        WorkloadProfile(
            workload_id="workload-2",
            name="Web Application",
            resource_requirements={ResourceType.CPU: 30, ResourceType.MEMORY: 40},
            performance_requirements={"response_time": 200},
            priority=9,
            flexibility=0.2,
            scheduled_times=[]
        )
    ]
    
    # Run optimization
    result = await optimizer.optimize_resources(
        usage_data, workloads, OptimizationObjective.BALANCED
    )
    
    print("Resource Optimization Results:")
    print("=" * 50)
    print(f"Total Cost Savings: ${result.total_cost_savings:.2f}/month")
    print(f"Efficiency Improvement: {result.efficiency_improvement:.1f}%")
    print(f"Performance Impact: {result.total_performance_impact:.1%}")
    print(f"Number of Recommendations: {len(result.recommendations)}")
    print(f"Overall Risk: {result.risk_assessment['overall_risk']}")
    
    print("\nTop Recommendations:")
    for i, rec in enumerate(result.recommendations[:3], 1):
        print(f"\n{i}. {rec.strategy.value.replace('_', ' ').title()}")
        print(f"   Resource: {rec.resource_id}")
        print(f"   Savings: ${rec.expected_savings:.2f}/month")
        print(f"   Risk: {rec.risk_level}")
        print(f"   Justification: {rec.justification}")
    
    print(f"\nImplementation Timeline: {len(result.implementation_timeline)} items scheduled")
    print(f"Validation Plan: {len(result.validation_plan)} steps")

if __name__ == "__main__":
    asyncio.run(main())