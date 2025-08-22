#!/usr/bin/env python3
"""
Cloud Cost Comparison Engine
Provides comprehensive cost analysis, comparison, and optimization across multiple cloud providers
"""

import os
import json
import hashlib
import time
import requests
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from collections import defaultdict
import threading
import asyncio

class PricingModel(Enum):
    """Cloud pricing models"""
    ON_DEMAND = "on_demand"
    RESERVED = "reserved"
    SPOT = "spot"
    SAVINGS_PLAN = "savings_plan"
    COMMITTED_USE = "committed_use"
    PREEMPTIBLE = "preemptible"
    DEDICATED = "dedicated"
    SERVERLESS = "serverless"

class ResourceCategory(Enum):
    """Resource categories for cost analysis"""
    COMPUTE = "compute"
    STORAGE = "storage"
    NETWORK = "network"
    DATABASE = "database"
    CONTAINER = "container"
    SERVERLESS = "serverless"
    AI_ML = "ai_ml"
    ANALYTICS = "analytics"
    SECURITY = "security"
    MANAGEMENT = "management"
    DEVELOPER_TOOLS = "developer_tools"

class CostMetric(Enum):
    """Cost metrics"""
    HOURLY = "hourly"
    MONTHLY = "monthly"
    ANNUAL = "annual"
    PER_REQUEST = "per_request"
    PER_GB = "per_gb"
    PER_TRANSACTION = "per_transaction"
    PER_SECOND = "per_second"

@dataclass
class ResourceSpec:
    """Resource specification for cost calculation"""
    category: ResourceCategory
    name: str
    cpu_cores: Optional[float] = None
    memory_gb: Optional[float] = None
    storage_gb: Optional[float] = None
    network_gb: Optional[float] = None
    requests_per_month: Optional[int] = None
    operating_system: Optional[str] = None
    region: Optional[str] = None
    availability_zone: Optional[str] = None
    usage_hours_per_month: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class PricingOption:
    """Pricing option for a resource"""
    provider: str
    region: str
    service_name: str
    instance_type: str
    pricing_model: PricingModel
    cost_per_unit: float
    unit: CostMetric
    currency: str
    minimum_commitment: Optional[str] = None
    contract_length: Optional[str] = None
    upfront_cost: Optional[float] = None
    features: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)
    effective_date: datetime = field(default_factory=datetime.now)
    expiry_date: Optional[datetime] = None

@dataclass
class CostEstimate:
    """Cost estimate for a resource configuration"""
    resource_spec: ResourceSpec
    pricing_option: PricingOption
    estimated_cost: float
    cost_breakdown: Dict[str, float]
    period: str  # hourly, monthly, annual
    assumptions: List[str]
    savings_vs_baseline: Optional[float] = None
    confidence_level: float = 1.0  # 0.0 to 1.0

@dataclass
class CostComparison:
    """Comparison between multiple cost estimates"""
    resource_spec: ResourceSpec
    estimates: List[CostEstimate]
    recommendations: List[str]
    best_option: Optional[CostEstimate] = None
    potential_savings: Optional[float] = None
    comparison_date: datetime = field(default_factory=datetime.now)

@dataclass
class CostOptimization:
    """Cost optimization recommendation"""
    id: str
    title: str
    description: str
    category: ResourceCategory
    current_cost: float
    optimized_cost: float
    savings_amount: float
    savings_percentage: float
    implementation_effort: str  # low, medium, high
    risk_level: str  # low, medium, high
    time_to_implement: str
    prerequisites: List[str]
    steps: List[str]
    impact_assessment: str
    confidence: float

class CloudCostComparisonEngine:
    """Main cost comparison and optimization engine"""
    
    def __init__(self):
        self.pricing_data: Dict[str, Dict[str, List[PricingOption]]] = defaultdict(lambda: defaultdict(list))
        self.cost_cache: Dict[str, CostEstimate] = {}
        self.optimization_rules: List[Dict] = []
        self.region_mappings: Dict[str, Dict[str, str]] = {}
        self.exchange_rates: Dict[str, float] = {"USD": 1.0}
        
        # Initialize with sample pricing data
        self._initialize_pricing_data()
        self._initialize_optimization_rules()
    
    def _initialize_pricing_data(self):
        """Initialize sample pricing data for major cloud providers"""
        
        # AWS Pricing
        aws_compute_prices = [
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="EC2",
                instance_type="t3.medium",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.0416,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Burstable CPU", "EBS Optimized", "Enhanced Networking"],
                limitations=[]
            ),
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="EC2",
                instance_type="t3.medium",
                pricing_model=PricingModel.RESERVED,
                cost_per_unit=0.0267,
                unit=CostMetric.HOURLY,
                currency="USD",
                minimum_commitment="1 year",
                contract_length="1 year",
                upfront_cost=234.24,
                features=["Burstable CPU", "EBS Optimized", "Enhanced Networking"],
                limitations=["1-year commitment required"]
            ),
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="EC2",
                instance_type="t3.medium",
                pricing_model=PricingModel.SPOT,
                cost_per_unit=0.0125,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Burstable CPU", "EBS Optimized", "Enhanced Networking"],
                limitations=["Can be interrupted", "Variable pricing"]
            )
        ]
        
        # GCP Pricing
        gcp_compute_prices = [
            PricingOption(
                provider="GCP",
                region="us-central1",
                service_name="Compute Engine",
                instance_type="n1-standard-2",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.095,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Sustained Use Discounts", "Custom Machine Types"],
                limitations=[]
            ),
            PricingOption(
                provider="GCP",
                region="us-central1",
                service_name="Compute Engine",
                instance_type="n1-standard-2",
                pricing_model=PricingModel.COMMITTED_USE,
                cost_per_unit=0.065,
                unit=CostMetric.HOURLY,
                currency="USD",
                minimum_commitment="1 year",
                contract_length="1 year",
                features=["Sustained Use Discounts", "Custom Machine Types"],
                limitations=["1-year commitment required"]
            ),
            PricingOption(
                provider="GCP",
                region="us-central1",
                service_name="Compute Engine",
                instance_type="n1-standard-2",
                pricing_model=PricingModel.PREEMPTIBLE,
                cost_per_unit=0.020,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Up to 80% savings", "Sustained Use Discounts"],
                limitations=["24-hour max runtime", "Can be preempted"]
            )
        ]
        
        # Azure Pricing
        azure_compute_prices = [
            PricingOption(
                provider="Azure",
                region="East US",
                service_name="Virtual Machines",
                instance_type="Standard_B2s",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.0416,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Burstable CPU", "Premium Storage"],
                limitations=[]
            ),
            PricingOption(
                provider="Azure",
                region="East US",
                service_name="Virtual Machines",
                instance_type="Standard_B2s",
                pricing_model=PricingModel.RESERVED,
                cost_per_unit=0.0267,
                unit=CostMetric.HOURLY,
                currency="USD",
                minimum_commitment="1 year",
                contract_length="1 year",
                upfront_cost=234.24,
                features=["Burstable CPU", "Premium Storage"],
                limitations=["1-year commitment required"]
            )
        ]
        
        # Storage pricing
        aws_storage_prices = [
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="S3",
                instance_type="Standard",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.023,
                unit=CostMetric.PER_GB,
                currency="USD",
                features=["99.999999999% durability", "Lifecycle management"],
                limitations=[]
            ),
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="S3",
                instance_type="Intelligent-Tiering",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.0125,
                unit=CostMetric.PER_GB,
                currency="USD",
                features=["Automatic cost optimization", "No retrieval fees"],
                limitations=["Minimum 30-day storage"]
            )
        ]
        
        # Database pricing
        aws_database_prices = [
            PricingOption(
                provider="AWS",
                region="us-east-1",
                service_name="RDS PostgreSQL",
                instance_type="db.t3.medium",
                pricing_model=PricingModel.ON_DEMAND,
                cost_per_unit=0.068,
                unit=CostMetric.HOURLY,
                currency="USD",
                features=["Automated backups", "Multi-AZ deployment"],
                limitations=[]
            )
        ]
        
        # Store pricing data
        for price in aws_compute_prices:
            self.pricing_data["AWS"][price.service_name].append(price)
        
        for price in gcp_compute_prices:
            self.pricing_data["GCP"][price.service_name].append(price)
        
        for price in azure_compute_prices:
            self.pricing_data["Azure"][price.service_name].append(price)
        
        for price in aws_storage_prices:
            self.pricing_data["AWS"][price.service_name].append(price)
        
        for price in aws_database_prices:
            self.pricing_data["AWS"][price.service_name].append(price)
    
    def _initialize_optimization_rules(self):
        """Initialize cost optimization rules"""
        self.optimization_rules = [
            {
                "id": "rightsizing_oversized_instances",
                "name": "Right-size Oversized Instances",
                "description": "Identify and resize overprovisioned compute instances",
                "category": ResourceCategory.COMPUTE,
                "conditions": {
                    "cpu_utilization": {"max": 20},
                    "memory_utilization": {"max": 30}
                },
                "potential_savings": 0.4,  # 40% savings
                "implementation_effort": "medium",
                "risk_level": "low"
            },
            {
                "id": "reserved_instance_opportunities",
                "name": "Reserved Instance Opportunities",
                "description": "Convert stable workloads to reserved instances",
                "category": ResourceCategory.COMPUTE,
                "conditions": {
                    "uptime_percentage": {"min": 70},
                    "usage_consistency": {"min": 0.8}
                },
                "potential_savings": 0.5,  # 50% savings
                "implementation_effort": "low",
                "risk_level": "low"
            },
            {
                "id": "spot_instance_opportunities",
                "name": "Spot Instance Opportunities",
                "description": "Use spot instances for fault-tolerant workloads",
                "category": ResourceCategory.COMPUTE,
                "conditions": {
                    "fault_tolerance": True,
                    "flexibility": {"high": True}
                },
                "potential_savings": 0.7,  # 70% savings
                "implementation_effort": "high",
                "risk_level": "medium"
            },
            {
                "id": "storage_class_optimization",
                "name": "Storage Class Optimization",
                "description": "Move infrequently accessed data to cheaper storage classes",
                "category": ResourceCategory.STORAGE,
                "conditions": {
                    "access_frequency": {"max": 0.1},  # Less than 10% access
                    "data_age": {"min": 30}  # Older than 30 days
                },
                "potential_savings": 0.6,  # 60% savings
                "implementation_effort": "low",
                "risk_level": "low"
            },
            {
                "id": "unused_resources",
                "name": "Remove Unused Resources",
                "description": "Identify and remove completely unused resources",
                "category": ResourceCategory.COMPUTE,
                "conditions": {
                    "cpu_utilization": {"max": 1},
                    "network_utilization": {"max": 0.1}
                },
                "potential_savings": 1.0,  # 100% savings
                "implementation_effort": "low",
                "risk_level": "low"
            }
        ]
    
    def get_pricing_options(
        self, 
        resource_spec: ResourceSpec,
        providers: Optional[List[str]] = None,
        pricing_models: Optional[List[PricingModel]] = None
    ) -> List[PricingOption]:
        """Get pricing options for a resource specification"""
        
        providers = providers or ["AWS", "GCP", "Azure"]
        pricing_models = pricing_models or list(PricingModel)
        
        matching_options = []
        
        for provider in providers:
            if provider not in self.pricing_data:
                continue
            
            for service_name, options in self.pricing_data[provider].items():
                for option in options:
                    # Basic filtering
                    if option.pricing_model not in pricing_models:
                        continue
                    
                    # Region matching (simplified)
                    if resource_spec.region and not self._regions_compatible(
                        resource_spec.region, option.region, provider
                    ):
                        continue
                    
                    # Category matching
                    if self._matches_category(resource_spec.category, service_name):
                        matching_options.append(option)
        
        return matching_options
    
    def _regions_compatible(self, requested_region: str, option_region: str, provider: str) -> bool:
        """Check if regions are compatible"""
        # Simplified region compatibility check
        region_mappings = {
            "us-east": ["us-east-1", "us-central1", "East US"],
            "us-west": ["us-west-2", "us-west1", "West US"],
            "eu-west": ["eu-west-1", "europe-west1", "West Europe"]
        }
        
        for region_group, regions in region_mappings.items():
            if requested_region.startswith(region_group.split('-')[0]):
                return option_region in regions
        
        return requested_region == option_region
    
    def _matches_category(self, category: ResourceCategory, service_name: str) -> bool:
        """Check if service matches resource category"""
        service_category_mapping = {
            ResourceCategory.COMPUTE: ["EC2", "Compute Engine", "Virtual Machines"],
            ResourceCategory.STORAGE: ["S3", "Cloud Storage", "Blob Storage"],
            ResourceCategory.DATABASE: ["RDS", "Cloud SQL", "SQL Database"],
            ResourceCategory.CONTAINER: ["ECS", "GKE", "Container Instances"],
            ResourceCategory.SERVERLESS: ["Lambda", "Cloud Functions", "Functions"]
        }
        
        return service_name in service_category_mapping.get(category, [])
    
    def calculate_cost_estimate(
        self, 
        resource_spec: ResourceSpec, 
        pricing_option: PricingOption,
        usage_period: str = "monthly"
    ) -> CostEstimate:
        """Calculate cost estimate for a specific pricing option"""
        
        # Calculate base cost
        base_cost = 0.0
        cost_breakdown = {}
        assumptions = []
        
        if pricing_option.unit == CostMetric.HOURLY:
            if usage_period == "monthly":
                hours = resource_spec.usage_hours_per_month or 730  # Default full month
                base_cost = pricing_option.cost_per_unit * hours
                assumptions.append(f"Usage: {hours} hours/month")
            elif usage_period == "annual":
                hours = (resource_spec.usage_hours_per_month or 730) * 12
                base_cost = pricing_option.cost_per_unit * hours
                assumptions.append(f"Usage: {hours} hours/year")
            else:  # hourly
                base_cost = pricing_option.cost_per_unit
        
        elif pricing_option.unit == CostMetric.PER_GB:
            if resource_spec.storage_gb:
                base_cost = pricing_option.cost_per_unit * resource_spec.storage_gb
                assumptions.append(f"Storage: {resource_spec.storage_gb} GB")
        
        elif pricing_option.unit == CostMetric.PER_REQUEST:
            if resource_spec.requests_per_month:
                base_cost = pricing_option.cost_per_unit * resource_spec.requests_per_month
                assumptions.append(f"Requests: {resource_spec.requests_per_month}/month")
        
        cost_breakdown["base_cost"] = base_cost
        
        # Add upfront costs for reserved instances
        if pricing_option.upfront_cost:
            if usage_period == "monthly":
                # Amortize upfront cost over contract length
                contract_months = 12 if "1 year" in (pricing_option.contract_length or "") else 36
                upfront_monthly = pricing_option.upfront_cost / contract_months
                cost_breakdown["upfront_amortized"] = upfront_monthly
                base_cost += upfront_monthly
            elif usage_period == "annual":
                cost_breakdown["upfront_cost"] = pricing_option.upfront_cost
                base_cost += pricing_option.upfront_cost
        
        # Apply discounts for committed usage
        if pricing_option.pricing_model in [PricingModel.RESERVED, PricingModel.COMMITTED_USE]:
            assumptions.append(f"Committed usage: {pricing_option.minimum_commitment}")
        
        # Calculate confidence level based on pricing model
        confidence = 1.0
        if pricing_option.pricing_model == PricingModel.SPOT:
            confidence = 0.7  # Spot pricing is variable
        elif pricing_option.pricing_model == PricingModel.PREEMPTIBLE:
            confidence = 0.7
        
        return CostEstimate(
            resource_spec=resource_spec,
            pricing_option=pricing_option,
            estimated_cost=base_cost,
            cost_breakdown=cost_breakdown,
            period=usage_period,
            assumptions=assumptions,
            confidence_level=confidence
        )
    
    def compare_costs(
        self, 
        resource_spec: ResourceSpec,
        providers: Optional[List[str]] = None,
        pricing_models: Optional[List[PricingModel]] = None,
        usage_period: str = "monthly"
    ) -> CostComparison:
        """Compare costs across different providers and pricing models"""
        
        # Get pricing options
        pricing_options = self.get_pricing_options(resource_spec, providers, pricing_models)
        
        if not pricing_options:
            return CostComparison(
                resource_spec=resource_spec,
                estimates=[],
                recommendations=["No pricing options found for the specified criteria"],
                comparison_date=datetime.now()
            )
        
        # Calculate estimates for all options
        estimates = []
        for option in pricing_options:
            estimate = self.calculate_cost_estimate(resource_spec, option, usage_period)
            estimates.append(estimate)
        
        # Sort by cost (lowest first)
        estimates.sort(key=lambda x: x.estimated_cost)
        
        # Find best option
        best_option = estimates[0] if estimates else None
        
        # Calculate potential savings
        if len(estimates) > 1:
            highest_cost = estimates[-1].estimated_cost
            lowest_cost = estimates[0].estimated_cost
            potential_savings = highest_cost - lowest_cost
        else:
            potential_savings = None
        
        # Generate recommendations
        recommendations = self._generate_cost_recommendations(estimates)
        
        return CostComparison(
            resource_spec=resource_spec,
            estimates=estimates,
            recommendations=recommendations,
            best_option=best_option,
            potential_savings=potential_savings,
            comparison_date=datetime.now()
        )
    
    def _generate_cost_recommendations(self, estimates: List[CostEstimate]) -> List[str]:
        """Generate cost optimization recommendations"""
        recommendations = []
        
        if not estimates:
            return recommendations
        
        # Best overall option
        best = estimates[0]
        recommendations.append(
            f"Best option: {best.pricing_option.provider} {best.pricing_option.instance_type} "
            f"({best.pricing_option.pricing_model.value}) - ${best.estimated_cost:.2f}/month"
        )
        
        # Reserved instance recommendations
        on_demand_estimates = [e for e in estimates if e.pricing_option.pricing_model == PricingModel.ON_DEMAND]
        reserved_estimates = [e for e in estimates if e.pricing_option.pricing_model == PricingModel.RESERVED]
        
        if on_demand_estimates and reserved_estimates:
            od_best = min(on_demand_estimates, key=lambda x: x.estimated_cost)
            ri_best = min(reserved_estimates, key=lambda x: x.estimated_cost)
            
            if ri_best.estimated_cost < od_best.estimated_cost:
                savings = od_best.estimated_cost - ri_best.estimated_cost
                savings_pct = (savings / od_best.estimated_cost) * 100
                recommendations.append(
                    f"Reserved instances can save ${savings:.2f}/month ({savings_pct:.1f}%) "
                    f"for stable workloads"
                )
        
        # Spot instance recommendations
        spot_estimates = [e for e in estimates if e.pricing_option.pricing_model in [PricingModel.SPOT, PricingModel.PREEMPTIBLE]]
        if spot_estimates and on_demand_estimates:
            spot_best = min(spot_estimates, key=lambda x: x.estimated_cost)
            od_best = min(on_demand_estimates, key=lambda x: x.estimated_cost)
            
            if spot_best.estimated_cost < od_best.estimated_cost:
                savings = od_best.estimated_cost - spot_best.estimated_cost
                savings_pct = (savings / od_best.estimated_cost) * 100
                recommendations.append(
                    f"Spot/Preemptible instances can save ${savings:.2f}/month ({savings_pct:.1f}%) "
                    f"for fault-tolerant workloads"
                )
        
        # Multi-cloud recommendations
        providers = list(set(e.pricing_option.provider for e in estimates))
        if len(providers) > 1:
            provider_costs = {}
            for provider in providers:
                provider_estimates = [e for e in estimates if e.pricing_option.provider == provider]
                if provider_estimates:
                    provider_costs[provider] = min(provider_estimates, key=lambda x: x.estimated_cost).estimated_cost
            
            cheapest_provider = min(provider_costs.items(), key=lambda x: x[1])
            recommendations.append(
                f"Cheapest provider for this workload: {cheapest_provider[0]} "
                f"(${cheapest_provider[1]:.2f}/month)"
            )
        
        return recommendations
    
    def generate_optimizations(
        self, 
        current_resources: List[Dict[str, Any]],
        usage_data: Optional[Dict[str, Any]] = None
    ) -> List[CostOptimization]:
        """Generate cost optimization recommendations"""
        
        optimizations = []
        
        for resource in current_resources:
            resource_optimizations = self._analyze_resource_optimization(resource, usage_data)
            optimizations.extend(resource_optimizations)
        
        # Sort by potential savings
        optimizations.sort(key=lambda x: x.savings_amount, reverse=True)
        
        return optimizations
    
    def _analyze_resource_optimization(
        self, 
        resource: Dict[str, Any],
        usage_data: Optional[Dict[str, Any]] = None
    ) -> List[CostOptimization]:
        """Analyze optimization opportunities for a single resource"""
        
        optimizations = []
        resource_id = resource.get("id", "unknown")
        current_cost = resource.get("monthly_cost", 0)
        
        # Get usage metrics if available
        cpu_util = 50.0  # Default values
        memory_util = 60.0
        network_util = 30.0
        
        if usage_data and resource_id in usage_data:
            cpu_util = usage_data[resource_id].get("cpu_utilization", cpu_util)
            memory_util = usage_data[resource_id].get("memory_utilization", memory_util)
            network_util = usage_data[resource_id].get("network_utilization", network_util)
        
        # Check each optimization rule
        for rule in self.optimization_rules:
            applies = True
            
            # Check conditions
            conditions = rule.get("conditions", {})
            
            if "cpu_utilization" in conditions:
                cpu_cond = conditions["cpu_utilization"]
                if "max" in cpu_cond and cpu_util > cpu_cond["max"]:
                    applies = False
                if "min" in cpu_cond and cpu_util < cpu_cond["min"]:
                    applies = False
            
            if "memory_utilization" in conditions:
                mem_cond = conditions["memory_utilization"]
                if "max" in mem_cond and memory_util > mem_cond["max"]:
                    applies = False
                if "min" in mem_cond and memory_util < mem_cond["min"]:
                    applies = False
            
            # Apply fake usage patterns for demo
            if rule["id"] == "rightsizing_oversized_instances" and cpu_util < 20:
                applies = True
            elif rule["id"] == "reserved_instance_opportunities":
                applies = np.random.random() < 0.3  # 30% chance
            elif rule["id"] == "unused_resources" and cpu_util < 5:
                applies = True
            else:
                applies = np.random.random() < 0.2  # 20% chance for other rules
            
            if applies:
                potential_savings = current_cost * rule["potential_savings"]
                optimized_cost = current_cost - potential_savings
                
                optimization = CostOptimization(
                    id=f"{rule['id']}_{resource_id}",
                    title=rule["name"],
                    description=f"{rule['description']} for {resource.get('name', resource_id)}",
                    category=rule["category"],
                    current_cost=current_cost,
                    optimized_cost=optimized_cost,
                    savings_amount=potential_savings,
                    savings_percentage=rule["potential_savings"] * 100,
                    implementation_effort=rule["implementation_effort"],
                    risk_level=rule["risk_level"],
                    time_to_implement=self._get_implementation_time(rule["implementation_effort"]),
                    prerequisites=self._get_prerequisites(rule["id"]),
                    steps=self._get_implementation_steps(rule["id"]),
                    impact_assessment=self._get_impact_assessment(rule["risk_level"]),
                    confidence=np.random.uniform(0.7, 0.95)
                )
                
                optimizations.append(optimization)
        
        return optimizations
    
    def _get_implementation_time(self, effort: str) -> str:
        """Get estimated implementation time"""
        time_mapping = {
            "low": "1-2 hours",
            "medium": "1-2 days",
            "high": "1-2 weeks"
        }
        return time_mapping.get(effort, "Unknown")
    
    def _get_prerequisites(self, rule_id: str) -> List[str]:
        """Get prerequisites for optimization rule"""
        prereq_mapping = {
            "rightsizing_oversized_instances": [
                "Monitoring data for at least 2 weeks",
                "Understanding of application performance requirements"
            ],
            "reserved_instance_opportunities": [
                "Stable workload patterns",
                "Budget approval for upfront payments"
            ],
            "spot_instance_opportunities": [
                "Fault-tolerant application architecture",
                "Automated instance replacement capability"
            ],
            "storage_class_optimization": [
                "Storage access pattern analysis",
                "Data lifecycle policy design"
            ],
            "unused_resources": [
                "Resource inventory audit",
                "Stakeholder confirmation for resource removal"
            ]
        }
        return prereq_mapping.get(rule_id, [])
    
    def _get_implementation_steps(self, rule_id: str) -> List[str]:
        """Get implementation steps for optimization rule"""
        steps_mapping = {
            "rightsizing_oversized_instances": [
                "Analyze current resource utilization",
                "Identify appropriate smaller instance types",
                "Schedule maintenance window",
                "Resize instances during low-traffic period",
                "Monitor performance after resize"
            ],
            "reserved_instance_opportunities": [
                "Analyze usage patterns over 6+ months",
                "Calculate ROI for different RI options",
                "Purchase reserved instances",
                "Apply RIs to running instances",
                "Monitor utilization and savings"
            ],
            "spot_instance_opportunities": [
                "Design fault-tolerant architecture",
                "Implement auto-scaling with mixed instance types",
                "Test spot instance interruption handling",
                "Gradually increase spot instance usage",
                "Monitor cost savings and availability"
            ],
            "storage_class_optimization": [
                "Analyze data access patterns",
                "Design lifecycle policies",
                "Test data retrieval times",
                "Implement automated tiering",
                "Monitor cost savings and performance"
            ],
            "unused_resources": [
                "Generate resource inventory report",
                "Identify zero-utilization resources",
                "Confirm with stakeholders",
                "Create backups if needed",
                "Terminate unused resources"
            ]
        }
        return steps_mapping.get(rule_id, [])
    
    def _get_impact_assessment(self, risk_level: str) -> str:
        """Get impact assessment for risk level"""
        impact_mapping = {
            "low": "Minimal impact expected. Easy to revert if issues arise.",
            "medium": "Moderate impact possible. Requires testing and monitoring.",
            "high": "Significant impact potential. Requires careful planning and rollback strategy."
        }
        return impact_mapping.get(risk_level, "Impact assessment needed")
    
    def get_cost_trends(
        self, 
        time_period: str = "30d",
        providers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Get cost trends and projections"""
        
        # Simulate cost trend data
        providers = providers or ["AWS", "GCP", "Azure"]
        
        trends = {
            "period": time_period,
            "total_cost": 0,
            "by_provider": {},
            "by_category": {},
            "trend_direction": "increasing",
            "projected_monthly_cost": 0,
            "cost_anomalies": []
        }
        
        # Generate simulated cost data
        base_costs = {"AWS": 5000, "GCP": 3000, "Azure": 2000}
        
        for provider in providers:
            base_cost = base_costs.get(provider, 1000)
            current_cost = base_cost * np.random.uniform(0.9, 1.2)
            trends["by_provider"][provider] = {
                "current": current_cost,
                "previous_period": base_cost,
                "change_percentage": ((current_cost - base_cost) / base_cost) * 100,
                "trend": "increasing" if current_cost > base_cost else "decreasing"
            }
            trends["total_cost"] += current_cost
        
        # By category
        categories = ["compute", "storage", "network", "database"]
        for category in categories:
            cost = trends["total_cost"] * np.random.uniform(0.1, 0.4)
            trends["by_category"][category] = cost
        
        # Normalize category costs
        total_cat_cost = sum(trends["by_category"].values())
        for category in trends["by_category"]:
            trends["by_category"][category] = (trends["by_category"][category] / total_cat_cost) * trends["total_cost"]
        
        # Project monthly cost
        trends["projected_monthly_cost"] = trends["total_cost"] * 1.05  # 5% growth
        
        # Add some cost anomalies
        if np.random.random() < 0.3:
            trends["cost_anomalies"].append({
                "type": "spike",
                "provider": np.random.choice(providers),
                "category": np.random.choice(categories),
                "increase_percentage": np.random.uniform(50, 200),
                "date": (datetime.now() - timedelta(days=np.random.randint(1, 30))).isoformat()
            })
        
        return trends
    
    def generate_budget_recommendations(
        self, 
        current_spend: float,
        budget_target: float,
        time_horizon: str = "monthly"
    ) -> Dict[str, Any]:
        """Generate budget optimization recommendations"""
        
        overage = current_spend - budget_target
        overage_pct = (overage / budget_target) * 100 if budget_target > 0 else 0
        
        recommendations = {
            "current_spend": current_spend,
            "budget_target": budget_target,
            "overage_amount": overage,
            "overage_percentage": overage_pct,
            "status": "over_budget" if overage > 0 else "under_budget",
            "recommendations": []
        }
        
        if overage > 0:
            recommendations["recommendations"].extend([
                f"Need to reduce costs by ${overage:.2f} ({overage_pct:.1f}%) to meet budget",
                "Review largest cost categories for optimization opportunities",
                "Consider implementing automated budget alerts",
                "Evaluate unused and underutilized resources"
            ])
            
            # Suggest specific optimizations
            if overage_pct > 20:
                recommendations["recommendations"].append("Consider reserved instances for stable workloads")
            if overage_pct > 50:
                recommendations["recommendations"].append("Emergency cost reduction: pause non-critical resources")
        else:
            under_budget = abs(overage)
            recommendations["recommendations"].extend([
                f"Under budget by ${under_budget:.2f} ({abs(overage_pct):.1f}%)",
                "Consider investing in performance improvements or additional capacity",
                "Evaluate opportunities for innovation projects"
            ])
        
        return recommendations


def main():
    """Test cloud cost comparison engine"""
    print("💰 Cloud Cost Comparison Engine")
    print("=" * 50)
    
    # Initialize cost engine
    engine = CloudCostComparisonEngine()
    
    # Test resource specification
    test_resource = ResourceSpec(
        category=ResourceCategory.COMPUTE,
        name="Web Server",
        cpu_cores=2,
        memory_gb=4,
        region="us-east",
        usage_hours_per_month=730,  # Full month
        metadata={"environment": "production", "application": "web"}
    )
    
    print(f"\n🖥️ Resource Specification:")
    print(f"  Category: {test_resource.category.value}")
    print(f"  CPU: {test_resource.cpu_cores} cores")
    print(f"  Memory: {test_resource.memory_gb} GB")
    print(f"  Region: {test_resource.region}")
    print(f"  Usage: {test_resource.usage_hours_per_month} hours/month")
    
    # Compare costs across providers
    print(f"\n💸 Cost Comparison:")
    comparison = engine.compare_costs(test_resource)
    
    print(f"  Found {len(comparison.estimates)} pricing options")
    
    if comparison.best_option:
        best = comparison.best_option
        print(f"\n  🏆 Best Option:")
        print(f"    Provider: {best.pricing_option.provider}")
        print(f"    Instance: {best.pricing_option.instance_type}")
        print(f"    Pricing: {best.pricing_option.pricing_model.value}")
        print(f"    Cost: ${best.estimated_cost:.2f}/month")
        print(f"    Confidence: {best.confidence_level:.1%}")
    
    if comparison.potential_savings:
        print(f"\n  💡 Potential Savings: ${comparison.potential_savings:.2f}/month")
    
    print(f"\n  📋 Top 3 Options:")
    for i, estimate in enumerate(comparison.estimates[:3], 1):
        print(f"    {i}. {estimate.pricing_option.provider} {estimate.pricing_option.instance_type}")
        print(f"       ${estimate.estimated_cost:.2f}/month ({estimate.pricing_option.pricing_model.value})")
    
    print(f"\n  🎯 Recommendations:")
    for rec in comparison.recommendations[:3]:
        print(f"    - {rec}")
    
    # Test cost optimization
    print(f"\n⚡ Cost Optimization Analysis:")
    
    # Simulate current resources
    current_resources = [
        {
            "id": "web-server-1",
            "name": "Web Server",
            "type": "compute",
            "monthly_cost": 150.0,
            "provider": "AWS"
        },
        {
            "id": "database-1", 
            "name": "Database Server",
            "type": "database",
            "monthly_cost": 300.0,
            "provider": "AWS"
        },
        {
            "id": "storage-bucket-1",
            "name": "Data Storage",
            "type": "storage", 
            "monthly_cost": 50.0,
            "provider": "AWS"
        }
    ]
    
    # Simulate usage data
    usage_data = {
        "web-server-1": {"cpu_utilization": 15, "memory_utilization": 25},
        "database-1": {"cpu_utilization": 60, "memory_utilization": 70},
        "storage-bucket-1": {"access_frequency": 0.05}
    }
    
    optimizations = engine.generate_optimizations(current_resources, usage_data)
    
    print(f"  Found {len(optimizations)} optimization opportunities")
    
    total_potential_savings = sum(opt.savings_amount for opt in optimizations)
    print(f"  Total potential savings: ${total_potential_savings:.2f}/month")
    
    print(f"\n  🔧 Top Optimizations:")
    for i, opt in enumerate(optimizations[:3], 1):
        print(f"    {i}. {opt.title}")
        print(f"       Savings: ${opt.savings_amount:.2f}/month ({opt.savings_percentage:.1f}%)")
        print(f"       Effort: {opt.implementation_effort}, Risk: {opt.risk_level}")
        print(f"       Time: {opt.time_to_implement}")
    
    # Cost trends
    print(f"\n📈 Cost Trends:")
    trends = engine.get_cost_trends("30d")
    
    print(f"  Total monthly cost: ${trends['total_cost']:.2f}")
    print(f"  Projected next month: ${trends['projected_monthly_cost']:.2f}")
    
    print(f"\n  By Provider:")
    for provider, data in trends["by_provider"].items():
        change = data["change_percentage"]
        print(f"    {provider}: ${data['current']:.2f} ({change:+.1f}%)")
    
    print(f"\n  By Category:")
    for category, cost in trends["by_category"].items():
        percentage = (cost / trends["total_cost"]) * 100
        print(f"    {category}: ${cost:.2f} ({percentage:.1f}%)")
    
    if trends["cost_anomalies"]:
        print(f"\n  ⚠️ Cost Anomalies:")
        for anomaly in trends["cost_anomalies"]:
            print(f"    {anomaly['type']} in {anomaly['provider']} {anomaly['category']}: +{anomaly['increase_percentage']:.0f}%")
    
    # Budget recommendations
    print(f"\n🎯 Budget Analysis:")
    budget_rec = engine.generate_budget_recommendations(
        current_spend=trends["total_cost"],
        budget_target=8000,
        time_horizon="monthly"
    )
    
    print(f"  Status: {budget_rec['status']}")
    print(f"  Current spend: ${budget_rec['current_spend']:.2f}")
    print(f"  Budget target: ${budget_rec['budget_target']:.2f}")
    
    if budget_rec["overage_amount"] != 0:
        print(f"  Variance: ${budget_rec['overage_amount']:+.2f} ({budget_rec['overage_percentage']:+.1f}%)")
    
    print(f"\n  📝 Recommendations:")
    for rec in budget_rec["recommendations"][:3]:
        print(f"    - {rec}")
    
    print(f"\n✅ Cost comparison engine analysis completed!")


if __name__ == "__main__":
    main()