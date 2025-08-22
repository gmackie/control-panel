"""
Predictive Maintenance System for Infrastructure
Predicts and prevents infrastructure failures through advanced analytics
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
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN
from sklearn.metrics import mean_squared_error
import aiohttp
import aioredis
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MaintenanceType(Enum):
    PREVENTIVE = "preventive"
    PREDICTIVE = "predictive"
    CORRECTIVE = "corrective"
    EMERGENCY = "emergency"

class HealthStatus(Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    FAILING = "failing"

class ComponentType(Enum):
    NODE = "node"
    DISK = "disk"
    NETWORK = "network"
    MEMORY = "memory"
    CPU = "cpu"
    POD = "pod"
    SERVICE = "service"
    STORAGE = "storage"

@dataclass
class HealthMetric:
    timestamp: datetime
    component_id: str
    component_type: ComponentType
    metric_name: str
    value: float
    unit: str
    threshold_warning: Optional[float] = None
    threshold_critical: Optional[float] = None

@dataclass
class MaintenanceRecommendation:
    component_id: str
    component_type: ComponentType
    maintenance_type: MaintenanceType
    priority: int  # 1-10, 10 being highest
    predicted_failure_time: Optional[datetime]
    confidence: float
    description: str
    actions: List[str]
    estimated_downtime: Optional[timedelta]
    cost_impact: Optional[float]

@dataclass
class ComponentHealth:
    component_id: str
    component_type: ComponentType
    health_status: HealthStatus
    health_score: float  # 0-100
    degradation_rate: float
    mean_time_to_failure: Optional[timedelta]
    last_maintenance: Optional[datetime]
    next_recommended_maintenance: Optional[datetime]
    metrics: List[HealthMetric]

class PredictiveMaintenanceEngine:
    def __init__(self):
        self.scaler = StandardScaler()
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.degradation_model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.clustering_model = DBSCAN(eps=0.5, min_samples=5)
        self.is_trained = False
        self.component_baselines: Dict[str, Dict[str, float]] = {}
        self.failure_patterns: Dict[str, List[Dict[str, Any]]] = {}
        
    async def collect_metrics(self) -> List[HealthMetric]:
        """Collect health metrics from various sources"""
        metrics = []
        
        try:
            # Collect node metrics
            node_metrics = await self._collect_node_metrics()
            metrics.extend(node_metrics)
            
            # Collect disk metrics
            disk_metrics = await self._collect_disk_metrics()
            metrics.extend(disk_metrics)
            
            # Collect network metrics
            network_metrics = await self._collect_network_metrics()
            metrics.extend(network_metrics)
            
            # Collect pod metrics
            pod_metrics = await self._collect_pod_metrics()
            metrics.extend(pod_metrics)
            
            logger.info(f"Collected {len(metrics)} health metrics")
            
        except Exception as e:
            logger.error(f"Error collecting metrics: {str(e)}")
            
        return metrics
    
    async def _collect_node_metrics(self) -> List[HealthMetric]:
        """Collect node-level health metrics"""
        metrics = []
        
        # Simulate node metrics collection (replace with actual Kubernetes API calls)
        nodes = ["node-1", "node-2", "node-3"]
        
        for node in nodes:
            timestamp = datetime.now()
            
            # CPU metrics
            cpu_usage = np.random.uniform(20, 80)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=node,
                component_type=ComponentType.CPU,
                metric_name="cpu_usage_percent",
                value=cpu_usage,
                unit="percent",
                threshold_warning=80.0,
                threshold_critical=90.0
            ))
            
            # Memory metrics
            memory_usage = np.random.uniform(30, 85)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=node,
                component_type=ComponentType.MEMORY,
                metric_name="memory_usage_percent",
                value=memory_usage,
                unit="percent",
                threshold_warning=85.0,
                threshold_critical=95.0
            ))
            
            # Disk I/O metrics
            disk_io_wait = np.random.uniform(0, 20)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=node,
                component_type=ComponentType.DISK,
                metric_name="disk_io_wait_percent",
                value=disk_io_wait,
                unit="percent",
                threshold_warning=15.0,
                threshold_critical=25.0
            ))
            
        return metrics
    
    async def _collect_disk_metrics(self) -> List[HealthMetric]:
        """Collect disk health metrics"""
        metrics = []
        
        disks = ["sda", "sdb", "nvme0n1"]
        
        for disk in disks:
            timestamp = datetime.now()
            
            # Disk usage
            disk_usage = np.random.uniform(40, 90)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=disk,
                component_type=ComponentType.DISK,
                metric_name="disk_usage_percent",
                value=disk_usage,
                unit="percent",
                threshold_warning=80.0,
                threshold_critical=90.0
            ))
            
            # SMART metrics simulation
            temperature = np.random.uniform(35, 60)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=disk,
                component_type=ComponentType.DISK,
                metric_name="temperature_celsius",
                value=temperature,
                unit="celsius",
                threshold_warning=55.0,
                threshold_critical=65.0
            ))
            
            # Read/Write errors
            read_errors = np.random.poisson(0.1)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=disk,
                component_type=ComponentType.DISK,
                metric_name="read_errors_count",
                value=float(read_errors),
                unit="count",
                threshold_warning=1.0,
                threshold_critical=5.0
            ))
            
        return metrics
    
    async def _collect_network_metrics(self) -> List[HealthMetric]:
        """Collect network health metrics"""
        metrics = []
        
        interfaces = ["eth0", "eth1", "lo"]
        
        for interface in interfaces:
            timestamp = datetime.now()
            
            # Packet loss
            packet_loss = np.random.uniform(0, 2)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=interface,
                component_type=ComponentType.NETWORK,
                metric_name="packet_loss_percent",
                value=packet_loss,
                unit="percent",
                threshold_warning=1.0,
                threshold_critical=5.0
            ))
            
            # Latency
            latency = np.random.uniform(1, 10)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=interface,
                component_type=ComponentType.NETWORK,
                metric_name="latency_ms",
                value=latency,
                unit="milliseconds",
                threshold_warning=5.0,
                threshold_critical=10.0
            ))
            
        return metrics
    
    async def _collect_pod_metrics(self) -> List[HealthMetric]:
        """Collect pod health metrics"""
        metrics = []
        
        pods = ["frontend-pod-1", "backend-pod-1", "database-pod-1"]
        
        for pod in pods:
            timestamp = datetime.now()
            
            # Restart count
            restart_count = np.random.poisson(0.5)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=pod,
                component_type=ComponentType.POD,
                metric_name="restart_count",
                value=float(restart_count),
                unit="count",
                threshold_warning=5.0,
                threshold_critical=10.0
            ))
            
            # Response time
            response_time = np.random.uniform(50, 500)
            metrics.append(HealthMetric(
                timestamp=timestamp,
                component_id=pod,
                component_type=ComponentType.POD,
                metric_name="response_time_ms",
                value=response_time,
                unit="milliseconds",
                threshold_warning=200.0,
                threshold_critical=500.0
            ))
            
        return metrics
    
    def calculate_health_score(self, metrics: List[HealthMetric]) -> float:
        """Calculate overall health score for a component"""
        if not metrics:
            return 50.0  # Neutral score if no metrics
        
        total_score = 0.0
        metric_count = 0
        
        for metric in metrics:
            if metric.threshold_warning and metric.threshold_critical:
                if metric.value >= metric.threshold_critical:
                    score = 0.0
                elif metric.value >= metric.threshold_warning:
                    # Linear interpolation between warning and critical
                    ratio = (metric.value - metric.threshold_warning) / (metric.threshold_critical - metric.threshold_warning)
                    score = 30.0 * (1 - ratio)  # Score between 0-30
                else:
                    # Score between 30-100 based on how far below warning
                    max_good_value = metric.threshold_warning * 0.8
                    if metric.value <= max_good_value:
                        score = 100.0
                    else:
                        ratio = (metric.value - max_good_value) / (metric.threshold_warning - max_good_value)
                        score = 100.0 - 70.0 * ratio  # Score between 30-100
                
                total_score += score
                metric_count += 1
        
        return total_score / metric_count if metric_count > 0 else 50.0
    
    def detect_anomalies(self, metrics: List[HealthMetric]) -> List[HealthMetric]:
        """Detect anomalous metrics using machine learning"""
        if not metrics or not self.is_trained:
            return []
        
        # Prepare data for anomaly detection
        data = []
        metric_objects = []
        
        for metric in metrics:
            data.append([metric.value])
            metric_objects.append(metric)
        
        if len(data) < 2:
            return []
        
        # Normalize data
        normalized_data = self.scaler.transform(data)
        
        # Detect anomalies
        anomaly_scores = self.anomaly_detector.decision_function(normalized_data)
        is_anomaly = self.anomaly_detector.predict(normalized_data)
        
        anomalies = []
        for i, (score, is_anom) in enumerate(zip(anomaly_scores, is_anomaly)):
            if is_anom == -1:  # Anomaly detected
                anomalies.append(metric_objects[i])
        
        return anomalies
    
    def predict_degradation(self, component_id: str, metrics: List[HealthMetric]) -> Tuple[float, Optional[datetime]]:
        """Predict component degradation rate and failure time"""
        if not metrics or len(metrics) < 10:
            return 0.0, None
        
        # Sort metrics by timestamp
        sorted_metrics = sorted(metrics, key=lambda m: m.timestamp)
        
        # Calculate degradation rate
        health_scores = []
        timestamps = []
        
        for metric in sorted_metrics:
            health_score = self.calculate_health_score([metric])
            health_scores.append(health_score)
            timestamps.append(metric.timestamp.timestamp())
        
        if len(health_scores) < 2:
            return 0.0, None
        
        # Linear regression to find degradation trend
        time_diffs = np.array(timestamps) - timestamps[0]
        degradation_rate = np.polyfit(time_diffs, health_scores, 1)[0]  # Slope
        
        # Predict failure time if degradation is negative
        failure_time = None
        if degradation_rate < 0 and health_scores[-1] > 20:
            # Time to reach critical health (20% or below)
            time_to_failure = (health_scores[-1] - 20) / abs(degradation_rate)
            failure_time = datetime.now() + timedelta(seconds=time_to_failure)
        
        return abs(degradation_rate), failure_time
    
    async def generate_maintenance_recommendations(self, component_health: ComponentHealth) -> List[MaintenanceRecommendation]:
        """Generate maintenance recommendations based on component health"""
        recommendations = []
        
        # Determine maintenance type and priority based on health status
        if component_health.health_status == HealthStatus.CRITICAL:
            maintenance_type = MaintenanceType.EMERGENCY
            priority = 10
        elif component_health.health_status == HealthStatus.FAILING:
            maintenance_type = MaintenanceType.CORRECTIVE
            priority = 8
        elif component_health.health_status == HealthStatus.WARNING:
            maintenance_type = MaintenanceType.PREDICTIVE
            priority = 6
        else:
            maintenance_type = MaintenanceType.PREVENTIVE
            priority = 3
        
        # Generate component-specific recommendations
        actions = self._get_maintenance_actions(component_health.component_type, component_health.health_status)
        
        recommendation = MaintenanceRecommendation(
            component_id=component_health.component_id,
            component_type=component_health.component_type,
            maintenance_type=maintenance_type,
            priority=priority,
            predicted_failure_time=component_health.mean_time_to_failure and 
                                   datetime.now() + component_health.mean_time_to_failure,
            confidence=min(0.95, component_health.health_score / 100.0),
            description=self._get_maintenance_description(component_health),
            actions=actions,
            estimated_downtime=self._estimate_downtime(component_health.component_type, maintenance_type),
            cost_impact=self._estimate_cost_impact(component_health.component_type, maintenance_type)
        )
        
        recommendations.append(recommendation)
        
        return recommendations
    
    def _get_maintenance_actions(self, component_type: ComponentType, health_status: HealthStatus) -> List[str]:
        """Get specific maintenance actions for component type and health status"""
        actions_map = {
            ComponentType.CPU: {
                HealthStatus.CRITICAL: [
                    "Immediately reduce CPU workload",
                    "Scale out to additional nodes",
                    "Investigate high CPU processes",
                    "Check for CPU throttling"
                ],
                HealthStatus.WARNING: [
                    "Monitor CPU usage trends",
                    "Consider workload redistribution",
                    "Review resource limits"
                ],
                HealthStatus.HEALTHY: [
                    "Regular performance monitoring",
                    "Periodic workload analysis"
                ]
            },
            ComponentType.MEMORY: {
                HealthStatus.CRITICAL: [
                    "Free up memory immediately",
                    "Restart memory-intensive pods",
                    "Check for memory leaks",
                    "Add memory to node if possible"
                ],
                HealthStatus.WARNING: [
                    "Monitor memory usage patterns",
                    "Review memory limits and requests",
                    "Identify memory-hungry applications"
                ],
                HealthStatus.HEALTHY: [
                    "Regular memory usage monitoring",
                    "Periodic garbage collection analysis"
                ]
            },
            ComponentType.DISK: {
                HealthStatus.CRITICAL: [
                    "Immediately free disk space",
                    "Move data to other disks",
                    "Check disk health with SMART tools",
                    "Replace disk if necessary"
                ],
                HealthStatus.WARNING: [
                    "Clean up old logs and temporary files",
                    "Monitor disk usage growth",
                    "Schedule disk maintenance"
                ],
                HealthStatus.HEALTHY: [
                    "Regular disk space monitoring",
                    "Periodic SMART status checks"
                ]
            },
            ComponentType.NETWORK: {
                HealthStatus.CRITICAL: [
                    "Check network connectivity",
                    "Restart network services",
                    "Investigate packet loss",
                    "Check cable connections"
                ],
                HealthStatus.WARNING: [
                    "Monitor network latency",
                    "Check bandwidth usage",
                    "Review network configuration"
                ],
                HealthStatus.HEALTHY: [
                    "Regular network performance monitoring",
                    "Periodic connectivity tests"
                ]
            },
            ComponentType.POD: {
                HealthStatus.CRITICAL: [
                    "Restart pod immediately",
                    "Check pod logs for errors",
                    "Verify resource availability",
                    "Check readiness and liveness probes"
                ],
                HealthStatus.WARNING: [
                    "Monitor pod restart frequency",
                    "Review pod resource usage",
                    "Check application health"
                ],
                HealthStatus.HEALTHY: [
                    "Regular pod health monitoring",
                    "Periodic configuration review"
                ]
            }
        }
        
        component_actions = actions_map.get(component_type, {})
        return component_actions.get(health_status, ["Monitor component health"])
    
    def _get_maintenance_description(self, component_health: ComponentHealth) -> str:
        """Generate maintenance description"""
        return f"{component_health.component_type.value.title()} {component_health.component_id} " \
               f"has health score {component_health.health_score:.1f} and status {component_health.health_status.value}"
    
    def _estimate_downtime(self, component_type: ComponentType, maintenance_type: MaintenanceType) -> timedelta:
        """Estimate maintenance downtime"""
        downtime_map = {
            MaintenanceType.PREVENTIVE: {
                ComponentType.CPU: timedelta(minutes=5),
                ComponentType.MEMORY: timedelta(minutes=10),
                ComponentType.DISK: timedelta(minutes=30),
                ComponentType.NETWORK: timedelta(minutes=15),
                ComponentType.POD: timedelta(minutes=2)
            },
            MaintenanceType.PREDICTIVE: {
                ComponentType.CPU: timedelta(minutes=10),
                ComponentType.MEMORY: timedelta(minutes=15),
                ComponentType.DISK: timedelta(hours=1),
                ComponentType.NETWORK: timedelta(minutes=30),
                ComponentType.POD: timedelta(minutes=5)
            },
            MaintenanceType.CORRECTIVE: {
                ComponentType.CPU: timedelta(minutes=30),
                ComponentType.MEMORY: timedelta(minutes=30),
                ComponentType.DISK: timedelta(hours=2),
                ComponentType.NETWORK: timedelta(hours=1),
                ComponentType.POD: timedelta(minutes=10)
            },
            MaintenanceType.EMERGENCY: {
                ComponentType.CPU: timedelta(hours=1),
                ComponentType.MEMORY: timedelta(hours=1),
                ComponentType.DISK: timedelta(hours=4),
                ComponentType.NETWORK: timedelta(hours=2),
                ComponentType.POD: timedelta(minutes=15)
            }
        }
        
        return downtime_map.get(maintenance_type, {}).get(component_type, timedelta(minutes=30))
    
    def _estimate_cost_impact(self, component_type: ComponentType, maintenance_type: MaintenanceType) -> float:
        """Estimate cost impact of maintenance"""
        base_costs = {
            ComponentType.CPU: 100.0,
            ComponentType.MEMORY: 80.0,
            ComponentType.DISK: 200.0,
            ComponentType.NETWORK: 150.0,
            ComponentType.POD: 50.0
        }
        
        multipliers = {
            MaintenanceType.PREVENTIVE: 1.0,
            MaintenanceType.PREDICTIVE: 1.5,
            MaintenanceType.CORRECTIVE: 3.0,
            MaintenanceType.EMERGENCY: 5.0
        }
        
        base_cost = base_costs.get(component_type, 100.0)
        multiplier = multipliers.get(maintenance_type, 1.0)
        
        return base_cost * multiplier
    
    async def train_models(self, historical_metrics: List[HealthMetric]):
        """Train machine learning models with historical data"""
        if len(historical_metrics) < 100:
            logger.warning("Insufficient historical data for training")
            return
        
        # Prepare training data
        training_data = []
        for metric in historical_metrics:
            training_data.append([metric.value])
        
        # Train anomaly detection model
        normalized_data = self.scaler.fit_transform(training_data)
        self.anomaly_detector.fit(normalized_data)
        
        # Train degradation prediction model (simplified)
        # In practice, this would use more sophisticated features
        X = normalized_data[:-1]  # Features
        y = np.array([m.value for m in historical_metrics[1:]])  # Target (next values)
        
        if len(X) > 0:
            self.degradation_model.fit(X, y)
        
        self.is_trained = True
        logger.info("Models trained successfully")
    
    async def analyze_component_health(self, component_id: str, metrics: List[HealthMetric]) -> ComponentHealth:
        """Analyze health of a specific component"""
        if not metrics:
            return ComponentHealth(
                component_id=component_id,
                component_type=ComponentType.NODE,
                health_status=HealthStatus.HEALTHY,
                health_score=50.0,
                degradation_rate=0.0,
                mean_time_to_failure=None,
                last_maintenance=None,
                next_recommended_maintenance=None,
                metrics=[]
            )
        
        # Calculate health score
        health_score = self.calculate_health_score(metrics)
        
        # Determine health status
        if health_score >= 80:
            health_status = HealthStatus.HEALTHY
        elif health_score >= 60:
            health_status = HealthStatus.WARNING
        elif health_score >= 30:
            health_status = HealthStatus.CRITICAL
        else:
            health_status = HealthStatus.FAILING
        
        # Calculate degradation rate and predict failure
        degradation_rate, failure_time = self.predict_degradation(component_id, metrics)
        
        # Estimate mean time to failure
        mean_time_to_failure = None
        if failure_time:
            mean_time_to_failure = failure_time - datetime.now()
        
        # Determine component type from metrics
        component_type = metrics[0].component_type if metrics else ComponentType.NODE
        
        return ComponentHealth(
            component_id=component_id,
            component_type=component_type,
            health_status=health_status,
            health_score=health_score,
            degradation_rate=degradation_rate,
            mean_time_to_failure=mean_time_to_failure,
            last_maintenance=None,  # Would be retrieved from maintenance history
            next_recommended_maintenance=datetime.now() + timedelta(days=7),
            metrics=metrics
        )

class PredictiveMaintenanceSystem:
    def __init__(self):
        self.engine = PredictiveMaintenanceEngine()
        self.redis_client = None
        self.maintenance_history: List[MaintenanceRecommendation] = []
        self.component_states: Dict[str, ComponentHealth] = {}
        
    async def initialize(self):
        """Initialize the system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
    
    async def run_maintenance_analysis(self) -> Dict[str, Any]:
        """Run comprehensive maintenance analysis"""
        try:
            # Collect current metrics
            metrics = await self.engine.collect_metrics()
            
            # Group metrics by component
            component_metrics = {}
            for metric in metrics:
                if metric.component_id not in component_metrics:
                    component_metrics[metric.component_id] = []
                component_metrics[metric.component_id].append(metric)
            
            # Analyze each component
            component_health_list = []
            all_recommendations = []
            
            for component_id, comp_metrics in component_metrics.items():
                health = await self.engine.analyze_component_health(component_id, comp_metrics)
                component_health_list.append(health)
                self.component_states[component_id] = health
                
                # Generate recommendations
                recommendations = await self.engine.generate_maintenance_recommendations(health)
                all_recommendations.extend(recommendations)
            
            # Detect anomalies
            anomalies = self.engine.detect_anomalies(metrics)
            
            # Store results in cache
            await self._store_results({
                "components": component_health_list,
                "recommendations": all_recommendations,
                "anomalies": anomalies,
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "total_components": len(component_health_list),
                "healthy_components": len([c for c in component_health_list if c.health_status == HealthStatus.HEALTHY]),
                "warning_components": len([c for c in component_health_list if c.health_status == HealthStatus.WARNING]),
                "critical_components": len([c for c in component_health_list if c.health_status == HealthStatus.CRITICAL]),
                "failing_components": len([c for c in component_health_list if c.health_status == HealthStatus.FAILING]),
                "total_recommendations": len(all_recommendations),
                "high_priority_recommendations": len([r for r in all_recommendations if r.priority >= 8]),
                "anomalies_detected": len(anomalies),
                "average_health_score": np.mean([c.health_score for c in component_health_list]) if component_health_list else 0
            }
            
        except Exception as e:
            logger.error(f"Error in maintenance analysis: {str(e)}")
            raise
    
    async def _store_results(self, results: Dict[str, Any]):
        """Store analysis results in cache"""
        if self.redis_client:
            try:
                # Convert dataclasses to dictionaries for JSON serialization
                serializable_results = self._make_serializable(results)
                await self.redis_client.setex(
                    "maintenance_analysis_results",
                    3600,  # 1 hour TTL
                    json.dumps(serializable_results, default=str)
                )
            except Exception as e:
                logger.error(f"Error storing results: {e}")
    
    def _make_serializable(self, obj):
        """Convert dataclasses and other objects to JSON-serializable format"""
        if isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif hasattr(obj, '__dict__'):
            return asdict(obj) if hasattr(obj, '__dataclass_fields__') else obj.__dict__
        else:
            return obj
    
    async def get_component_health(self, component_id: str) -> Optional[ComponentHealth]:
        """Get health status of a specific component"""
        return self.component_states.get(component_id)
    
    async def get_maintenance_recommendations(self, priority_threshold: int = 5) -> List[MaintenanceRecommendation]:
        """Get maintenance recommendations above priority threshold"""
        return [rec for rec in self.maintenance_history if rec.priority >= priority_threshold]
    
    async def schedule_maintenance(self, component_id: str, maintenance_type: MaintenanceType, scheduled_time: datetime) -> bool:
        """Schedule maintenance for a component"""
        try:
            # In a real implementation, this would integrate with a maintenance scheduling system
            logger.info(f"Scheduled {maintenance_type.value} maintenance for {component_id} at {scheduled_time}")
            return True
        except Exception as e:
            logger.error(f"Error scheduling maintenance: {e}")
            return False

# FastAPI application
app = FastAPI(title="Predictive Maintenance System", version="1.0.0")
maintenance_system = PredictiveMaintenanceSystem()

@app.on_event("startup")
async def startup():
    await maintenance_system.initialize()

class AnalysisRequest(BaseModel):
    force_retrain: bool = False

class ComponentHealthResponse(BaseModel):
    component_id: str
    health_status: str
    health_score: float
    recommendations: List[Dict[str, Any]]

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "predictive-maintenance"}

@app.post("/analyze")
async def run_analysis(request: AnalysisRequest, background_tasks: BackgroundTasks):
    """Run maintenance analysis"""
    try:
        if request.force_retrain:
            # Generate synthetic historical data for training
            historical_metrics = []
            for i in range(1000):
                timestamp = datetime.now() - timedelta(hours=i)
                historical_metrics.append(HealthMetric(
                    timestamp=timestamp,
                    component_id=f"component-{i % 10}",
                    component_type=ComponentType.CPU,
                    metric_name="cpu_usage",
                    value=np.random.uniform(20, 80),
                    unit="percent"
                ))
            
            background_tasks.add_task(maintenance_system.engine.train_models, historical_metrics)
        
        results = await maintenance_system.run_maintenance_analysis()
        return {
            "status": "success",
            "analysis": results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/components/{component_id}")
async def get_component_health(component_id: str):
    """Get health status of a specific component"""
    health = await maintenance_system.get_component_health(component_id)
    if not health:
        raise HTTPException(status_code=404, detail="Component not found")
    
    recommendations = await maintenance_system.engine.generate_maintenance_recommendations(health)
    
    return ComponentHealthResponse(
        component_id=health.component_id,
        health_status=health.health_status.value,
        health_score=health.health_score,
        recommendations=[asdict(rec) for rec in recommendations]
    )

@app.get("/recommendations")
async def get_recommendations(priority: int = 5):
    """Get maintenance recommendations"""
    recommendations = await maintenance_system.get_maintenance_recommendations(priority)
    return {
        "recommendations": [asdict(rec) for rec in recommendations],
        "count": len(recommendations)
    }

@app.post("/schedule")
async def schedule_maintenance(
    component_id: str,
    maintenance_type: str,
    scheduled_time: str
):
    """Schedule maintenance for a component"""
    try:
        maint_type = MaintenanceType(maintenance_type)
        schedule_time = datetime.fromisoformat(scheduled_time)
        
        success = await maintenance_system.schedule_maintenance(
            component_id, maint_type, schedule_time
        )
        
        if success:
            return {"status": "scheduled", "component_id": component_id}
        else:
            raise HTTPException(status_code=500, detail="Failed to schedule maintenance")
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid parameter: {e}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)