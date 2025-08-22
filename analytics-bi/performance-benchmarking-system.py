"""
Performance Benchmarking and Comparison System
Advanced performance analysis, benchmarking, and comparison tools
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
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.decomposition import PCA
import aiohttp
import aioredis
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
import uvicorn
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BenchmarkType(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    DISK = "disk"
    NETWORK = "network"
    APPLICATION = "application"
    DATABASE = "database"
    LOAD_TEST = "load_test"
    STRESS_TEST = "stress_test"

class MetricType(Enum):
    THROUGHPUT = "throughput"
    LATENCY = "latency"
    UTILIZATION = "utilization"
    ERRORS = "errors"
    AVAILABILITY = "availability"
    RESPONSE_TIME = "response_time"

class ComparisonType(Enum):
    HISTORICAL = "historical"
    BASELINE = "baseline"
    PEER = "peer"
    INDUSTRY = "industry"
    TARGET = "target"

class PerformanceGrade(Enum):
    EXCELLENT = "excellent"  # 90-100%
    GOOD = "good"           # 75-89%
    AVERAGE = "average"     # 60-74%
    POOR = "poor"           # 40-59%
    CRITICAL = "critical"   # 0-39%

@dataclass
class BenchmarkMetric:
    metric_id: str
    benchmark_id: str
    metric_type: MetricType
    name: str
    value: float
    unit: str
    timestamp: datetime
    labels: Dict[str, str]
    target_value: Optional[float] = None
    baseline_value: Optional[float] = None

@dataclass
class BenchmarkResult:
    benchmark_id: str
    benchmark_type: BenchmarkType
    name: str
    description: str
    start_time: datetime
    end_time: datetime
    duration: float
    metrics: List[BenchmarkMetric]
    environment: Dict[str, Any]
    configuration: Dict[str, Any]
    status: str
    score: Optional[float] = None
    grade: Optional[PerformanceGrade] = None

@dataclass
class PerformanceBaseline:
    baseline_id: str
    name: str
    benchmark_type: BenchmarkType
    metrics: Dict[str, float]  # metric_name -> value
    environment: Dict[str, Any]
    created_at: datetime
    is_active: bool = True

@dataclass
class ComparisonResult:
    comparison_id: str
    comparison_type: ComparisonType
    benchmark_id: str
    reference_id: str
    metrics_comparison: Dict[str, Dict[str, float]]  # metric_name -> {current, reference, difference, percentage}
    overall_score: float
    improvement_areas: List[str]
    regression_areas: List[str]
    created_at: datetime

@dataclass
class PerformanceProfile:
    profile_id: str
    name: str
    description: str
    resource_patterns: Dict[str, Dict[str, float]]
    performance_characteristics: Dict[str, float]
    optimal_configurations: Dict[str, Any]
    cluster_label: Optional[int] = None
    similar_profiles: List[str] = None

class BenchmarkRunner:
    def __init__(self):
        self.benchmark_configs = {
            BenchmarkType.CPU: self._get_cpu_benchmark_config(),
            BenchmarkType.MEMORY: self._get_memory_benchmark_config(),
            BenchmarkType.DISK: self._get_disk_benchmark_config(),
            BenchmarkType.NETWORK: self._get_network_benchmark_config(),
            BenchmarkType.APPLICATION: self._get_application_benchmark_config(),
            BenchmarkType.DATABASE: self._get_database_benchmark_config()
        }
        
    def _get_cpu_benchmark_config(self) -> Dict[str, Any]:
        """Get CPU benchmark configuration"""
        return {
            "tests": [
                {"name": "integer_operations", "duration": 60, "threads": 1},
                {"name": "floating_point", "duration": 60, "threads": 1},
                {"name": "multi_core", "duration": 60, "threads": "auto"},
                {"name": "vectorization", "duration": 60, "threads": 1}
            ],
            "metrics": ["operations_per_second", "cpu_utilization", "temperature"],
            "target_values": {
                "operations_per_second": 1000000,
                "cpu_utilization": 95.0,
                "temperature": 70.0
            }
        }
    
    def _get_memory_benchmark_config(self) -> Dict[str, Any]:
        """Get memory benchmark configuration"""
        return {
            "tests": [
                {"name": "sequential_read", "size": "1GB", "duration": 60},
                {"name": "sequential_write", "size": "1GB", "duration": 60},
                {"name": "random_access", "size": "512MB", "duration": 60},
                {"name": "bandwidth_test", "size": "2GB", "duration": 60}
            ],
            "metrics": ["throughput_mbps", "latency_ns", "utilization_percent"],
            "target_values": {
                "throughput_mbps": 10000,
                "latency_ns": 100,
                "utilization_percent": 85.0
            }
        }
    
    def _get_disk_benchmark_config(self) -> Dict[str, Any]:
        """Get disk benchmark configuration"""
        return {
            "tests": [
                {"name": "sequential_read", "block_size": "1MB", "duration": 120},
                {"name": "sequential_write", "block_size": "1MB", "duration": 120},
                {"name": "random_read", "block_size": "4KB", "duration": 120},
                {"name": "random_write", "block_size": "4KB", "duration": 120},
                {"name": "mixed_workload", "ratio": "70r_30w", "duration": 120}
            ],
            "metrics": ["iops", "throughput_mbps", "latency_ms", "queue_depth"],
            "target_values": {
                "iops": 10000,
                "throughput_mbps": 500,
                "latency_ms": 10.0,
                "queue_depth": 32
            }
        }
    
    def _get_network_benchmark_config(self) -> Dict[str, Any]:
        """Get network benchmark configuration"""
        return {
            "tests": [
                {"name": "bandwidth_test", "duration": 60, "connections": 1},
                {"name": "latency_test", "duration": 60, "packet_size": 64},
                {"name": "concurrent_connections", "duration": 60, "connections": 100},
                {"name": "packet_loss_test", "duration": 60, "rate": "1Gbps"}
            ],
            "metrics": ["bandwidth_mbps", "latency_ms", "packet_loss_percent", "jitter_ms"],
            "target_values": {
                "bandwidth_mbps": 1000,
                "latency_ms": 5.0,
                "packet_loss_percent": 0.1,
                "jitter_ms": 1.0
            }
        }
    
    def _get_application_benchmark_config(self) -> Dict[str, Any]:
        """Get application benchmark configuration"""
        return {
            "tests": [
                {"name": "http_requests", "duration": 300, "concurrent_users": 100},
                {"name": "websocket_connections", "duration": 300, "connections": 1000},
                {"name": "api_throughput", "duration": 300, "requests_per_second": 1000},
                {"name": "static_content", "duration": 180, "file_sizes": ["1KB", "100KB", "1MB"]}
            ],
            "metrics": ["requests_per_second", "response_time_ms", "error_rate_percent", "cpu_utilization"],
            "target_values": {
                "requests_per_second": 1000,
                "response_time_ms": 100,
                "error_rate_percent": 0.1,
                "cpu_utilization": 70.0
            }
        }
    
    def _get_database_benchmark_config(self) -> Dict[str, Any]:
        """Get database benchmark configuration"""
        return {
            "tests": [
                {"name": "read_heavy", "duration": 300, "read_ratio": 0.8},
                {"name": "write_heavy", "duration": 300, "write_ratio": 0.7},
                {"name": "mixed_workload", "duration": 300, "operations": 1000},
                {"name": "connection_pooling", "duration": 180, "connections": 100}
            ],
            "metrics": ["transactions_per_second", "query_time_ms", "connection_time_ms", "deadlocks"],
            "target_values": {
                "transactions_per_second": 1000,
                "query_time_ms": 50,
                "connection_time_ms": 10,
                "deadlocks": 0
            }
        }
    
    async def run_benchmark(self, benchmark_type: BenchmarkType, 
                           custom_config: Optional[Dict[str, Any]] = None) -> BenchmarkResult:
        """Run a specific benchmark"""
        benchmark_id = f"{benchmark_type.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        config = self.benchmark_configs.get(benchmark_type, {})
        if custom_config:
            config.update(custom_config)
        
        start_time = datetime.now()
        
        # Simulate running benchmark (in real implementation, would run actual tests)
        metrics = await self._simulate_benchmark_execution(benchmark_type, config)
        
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        # Calculate overall score
        score = self._calculate_benchmark_score(metrics, config.get("target_values", {}))
        grade = self._determine_performance_grade(score)
        
        result = BenchmarkResult(
            benchmark_id=benchmark_id,
            benchmark_type=benchmark_type,
            name=f"{benchmark_type.value.title()} Benchmark",
            description=f"Comprehensive {benchmark_type.value} performance benchmark",
            start_time=start_time,
            end_time=end_time,
            duration=duration,
            metrics=metrics,
            environment=await self._get_environment_info(),
            configuration=config,
            status="completed",
            score=score,
            grade=grade
        )
        
        logger.info(f"Completed benchmark {benchmark_id} with score {score:.2f}")
        
        return result
    
    async def _simulate_benchmark_execution(self, benchmark_type: BenchmarkType, 
                                          config: Dict[str, Any]) -> List[BenchmarkMetric]:
        """Simulate benchmark execution and generate metrics"""
        metrics = []
        timestamp = datetime.now()
        benchmark_id = f"{benchmark_type.value}_{timestamp.strftime('%Y%m%d_%H%M%S')}"
        
        if benchmark_type == BenchmarkType.CPU:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"cpu_ops_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="operations_per_second",
                    value=np.random.uniform(800000, 1200000),
                    unit="ops/sec",
                    timestamp=timestamp,
                    labels={"test": "integer_operations", "threads": "1"},
                    target_value=1000000
                ),
                BenchmarkMetric(
                    metric_id=f"cpu_util_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.UTILIZATION,
                    name="cpu_utilization",
                    value=np.random.uniform(85, 98),
                    unit="percent",
                    timestamp=timestamp,
                    labels={"test": "multi_core"},
                    target_value=95.0
                )
            ])
            
        elif benchmark_type == BenchmarkType.MEMORY:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"mem_throughput_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="throughput_mbps",
                    value=np.random.uniform(8000, 12000),
                    unit="MB/s",
                    timestamp=timestamp,
                    labels={"test": "sequential_read"},
                    target_value=10000
                ),
                BenchmarkMetric(
                    metric_id=f"mem_latency_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.LATENCY,
                    name="latency_ns",
                    value=np.random.uniform(80, 120),
                    unit="ns",
                    timestamp=timestamp,
                    labels={"test": "random_access"},
                    target_value=100
                )
            ])
            
        elif benchmark_type == BenchmarkType.DISK:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"disk_iops_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="iops",
                    value=np.random.uniform(8000, 15000),
                    unit="IOPS",
                    timestamp=timestamp,
                    labels={"test": "random_read", "block_size": "4KB"},
                    target_value=10000
                ),
                BenchmarkMetric(
                    metric_id=f"disk_throughput_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="throughput_mbps",
                    value=np.random.uniform(400, 600),
                    unit="MB/s",
                    timestamp=timestamp,
                    labels={"test": "sequential_read"},
                    target_value=500
                )
            ])
            
        elif benchmark_type == BenchmarkType.NETWORK:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"net_bandwidth_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="bandwidth_mbps",
                    value=np.random.uniform(800, 1100),
                    unit="Mbps",
                    timestamp=timestamp,
                    labels={"test": "bandwidth_test"},
                    target_value=1000
                ),
                BenchmarkMetric(
                    metric_id=f"net_latency_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.LATENCY,
                    name="latency_ms",
                    value=np.random.uniform(3, 7),
                    unit="ms",
                    timestamp=timestamp,
                    labels={"test": "latency_test"},
                    target_value=5.0
                )
            ])
            
        elif benchmark_type == BenchmarkType.APPLICATION:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"app_rps_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="requests_per_second",
                    value=np.random.uniform(800, 1200),
                    unit="req/sec",
                    timestamp=timestamp,
                    labels={"test": "http_requests", "users": "100"},
                    target_value=1000
                ),
                BenchmarkMetric(
                    metric_id=f"app_response_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.RESPONSE_TIME,
                    name="response_time_ms",
                    value=np.random.uniform(80, 120),
                    unit="ms",
                    timestamp=timestamp,
                    labels={"test": "api_throughput"},
                    target_value=100
                )
            ])
            
        elif benchmark_type == BenchmarkType.DATABASE:
            metrics.extend([
                BenchmarkMetric(
                    metric_id=f"db_tps_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.THROUGHPUT,
                    name="transactions_per_second",
                    value=np.random.uniform(800, 1200),
                    unit="TPS",
                    timestamp=timestamp,
                    labels={"test": "mixed_workload"},
                    target_value=1000
                ),
                BenchmarkMetric(
                    metric_id=f"db_query_time_{timestamp.strftime('%Y%m%d%H%M%S')}",
                    benchmark_id=benchmark_id,
                    metric_type=MetricType.LATENCY,
                    name="query_time_ms",
                    value=np.random.uniform(30, 70),
                    unit="ms",
                    timestamp=timestamp,
                    labels={"test": "read_heavy"},
                    target_value=50
                )
            ])
        
        return metrics
    
    def _calculate_benchmark_score(self, metrics: List[BenchmarkMetric], 
                                 targets: Dict[str, float]) -> float:
        """Calculate overall benchmark score"""
        if not metrics:
            return 0.0
        
        total_score = 0.0
        scored_metrics = 0
        
        for metric in metrics:
            if metric.target_value is not None:
                # Calculate score based on how close to target
                target = metric.target_value
                actual = metric.value
                
                # For latency metrics, lower is better
                if metric.metric_type in [MetricType.LATENCY, MetricType.RESPONSE_TIME]:
                    if actual <= target:
                        score = 100.0
                    else:
                        score = max(0, 100 - ((actual - target) / target) * 100)
                else:
                    # For throughput metrics, higher is better
                    score = min(100, (actual / target) * 100)
                
                total_score += score
                scored_metrics += 1
        
        return total_score / scored_metrics if scored_metrics > 0 else 0.0
    
    def _determine_performance_grade(self, score: float) -> PerformanceGrade:
        """Determine performance grade based on score"""
        if score >= 90:
            return PerformanceGrade.EXCELLENT
        elif score >= 75:
            return PerformanceGrade.GOOD
        elif score >= 60:
            return PerformanceGrade.AVERAGE
        elif score >= 40:
            return PerformanceGrade.POOR
        else:
            return PerformanceGrade.CRITICAL
    
    async def _get_environment_info(self) -> Dict[str, Any]:
        """Get environment information"""
        return {
            "timestamp": datetime.now().isoformat(),
            "cluster_info": {
                "nodes": 3,
                "total_cpu": 24,
                "total_memory": "96GB",
                "kubernetes_version": "1.28.0"
            },
            "system_info": {
                "os": "Ubuntu 22.04",
                "kernel": "5.15.0",
                "architecture": "x86_64"
            },
            "hardware_info": {
                "cpu_model": "Intel Xeon E5-2686 v4",
                "memory_type": "DDR4",
                "storage_type": "NVMe SSD",
                "network": "10Gbps"
            }
        }

class PerformanceAnalyzer:
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)
        self.kmeans = KMeans(n_clusters=5, random_state=42)
        
    def analyze_performance_trends(self, benchmarks: List[BenchmarkResult]) -> Dict[str, Any]:
        """Analyze performance trends over time"""
        if len(benchmarks) < 2:
            return {"error": "Insufficient data for trend analysis"}
        
        # Sort by timestamp
        sorted_benchmarks = sorted(benchmarks, key=lambda b: b.start_time)
        
        trends = {}
        
        # Group by benchmark type
        type_groups = {}
        for benchmark in sorted_benchmarks:
            if benchmark.benchmark_type not in type_groups:
                type_groups[benchmark.benchmark_type] = []
            type_groups[benchmark.benchmark_type].append(benchmark)
        
        for bench_type, bench_list in type_groups.items():
            if len(bench_list) < 2:
                continue
                
            # Extract scores over time
            timestamps = [b.start_time for b in bench_list]
            scores = [b.score for b in bench_list if b.score is not None]
            
            if len(scores) < 2:
                continue
            
            # Calculate trend
            x = np.arange(len(scores))
            trend_slope = np.polyfit(x, scores, 1)[0]
            
            # Calculate statistics
            trends[bench_type.value] = {
                "current_score": scores[-1],
                "previous_score": scores[-2] if len(scores) > 1 else scores[0],
                "trend_slope": float(trend_slope),
                "trend_direction": "improving" if trend_slope > 0 else "declining" if trend_slope < 0 else "stable",
                "score_variance": float(np.var(scores)),
                "min_score": float(min(scores)),
                "max_score": float(max(scores)),
                "avg_score": float(np.mean(scores)),
                "data_points": len(scores)
            }
        
        return trends
    
    def create_performance_profile(self, benchmarks: List[BenchmarkResult]) -> PerformanceProfile:
        """Create performance profile from benchmark results"""
        if not benchmarks:
            return None
        
        profile_id = hashlib.md5(
            "".join([b.benchmark_id for b in benchmarks]).encode()
        ).hexdigest()[:12]
        
        # Aggregate metrics by type
        metric_aggregates = {}
        resource_patterns = {}
        
        for benchmark in benchmarks:
            bench_type = benchmark.benchmark_type.value
            
            if bench_type not in resource_patterns:
                resource_patterns[bench_type] = {}
            
            for metric in benchmark.metrics:
                metric_name = metric.name
                
                if metric_name not in metric_aggregates:
                    metric_aggregates[metric_name] = []
                metric_aggregates[metric_name].append(metric.value)
                
                if metric_name not in resource_patterns[bench_type]:
                    resource_patterns[bench_type][metric_name] = []
                resource_patterns[bench_type][metric_name].append(metric.value)
        
        # Calculate performance characteristics
        performance_characteristics = {}
        for metric_name, values in metric_aggregates.items():
            performance_characteristics[metric_name] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values)),
                "min": float(min(values)),
                "max": float(max(values)),
                "percentile_95": float(np.percentile(values, 95))
            }
        
        # Calculate resource pattern statistics
        for bench_type, metrics in resource_patterns.items():
            for metric_name, values in metrics.items():
                resource_patterns[bench_type][metric_name] = {
                    "mean": float(np.mean(values)),
                    "coefficient_of_variation": float(np.std(values) / np.mean(values)) if np.mean(values) > 0 else 0
                }
        
        # Generate optimal configurations (simplified)
        optimal_configurations = self._generate_optimal_config(performance_characteristics)
        
        profile = PerformanceProfile(
            profile_id=profile_id,
            name=f"Profile_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            description=f"Performance profile based on {len(benchmarks)} benchmark results",
            resource_patterns=resource_patterns,
            performance_characteristics=performance_characteristics,
            optimal_configurations=optimal_configurations
        )
        
        return profile
    
    def _generate_optimal_config(self, characteristics: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
        """Generate optimal configuration recommendations"""
        config = {
            "resource_allocation": {},
            "performance_tuning": {},
            "scaling_parameters": {}
        }
        
        # CPU optimization
        if "operations_per_second" in characteristics:
            ops_mean = characteristics["operations_per_second"]["mean"]
            if ops_mean > 1000000:
                config["resource_allocation"]["cpu_cores"] = "high"
                config["performance_tuning"]["cpu_governor"] = "performance"
            else:
                config["resource_allocation"]["cpu_cores"] = "medium"
                config["performance_tuning"]["cpu_governor"] = "balanced"
        
        # Memory optimization
        if "throughput_mbps" in characteristics:
            throughput = characteristics["throughput_mbps"]["mean"]
            if throughput > 10000:
                config["resource_allocation"]["memory_channels"] = "all"
                config["performance_tuning"]["memory_prefetch"] = "aggressive"
            else:
                config["resource_allocation"]["memory_channels"] = "balanced"
                config["performance_tuning"]["memory_prefetch"] = "conservative"
        
        # Scaling parameters
        if "response_time_ms" in characteristics:
            response_time = characteristics["response_time_ms"]["mean"]
            config["scaling_parameters"]["scale_up_threshold"] = min(80, max(50, 100 - response_time))
            config["scaling_parameters"]["scale_down_threshold"] = max(20, min(40, 60 - response_time))
        
        return config
    
    def cluster_performance_profiles(self, profiles: List[PerformanceProfile]) -> Dict[str, Any]:
        """Cluster similar performance profiles"""
        if len(profiles) < 3:
            return {"error": "Need at least 3 profiles for clustering"}
        
        # Prepare feature matrix
        features = []
        profile_ids = []
        
        for profile in profiles:
            feature_vector = []
            
            # Extract key performance metrics
            characteristics = profile.performance_characteristics
            
            metrics_of_interest = [
                "operations_per_second", "throughput_mbps", "iops", 
                "response_time_ms", "latency_ms", "transactions_per_second"
            ]
            
            for metric in metrics_of_interest:
                if metric in characteristics:
                    feature_vector.append(characteristics[metric]["mean"])
                else:
                    feature_vector.append(0.0)
            
            if len(feature_vector) > 0:
                features.append(feature_vector)
                profile_ids.append(profile.profile_id)
        
        if len(features) < 3:
            return {"error": "Insufficient feature data for clustering"}
        
        # Normalize features
        features_normalized = self.scaler.fit_transform(features)
        
        # Determine optimal number of clusters
        optimal_clusters = min(5, len(features) // 2)
        self.kmeans = KMeans(n_clusters=optimal_clusters, random_state=42)
        
        # Perform clustering
        cluster_labels = self.kmeans.fit_predict(features_normalized)
        silhouette_avg = silhouette_score(features_normalized, cluster_labels)
        
        # Assign cluster labels to profiles
        for i, profile in enumerate(profiles):
            if i < len(cluster_labels):
                profile.cluster_label = int(cluster_labels[i])
        
        # Group profiles by cluster
        clusters = {}
        for i, label in enumerate(cluster_labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(profile_ids[i])
        
        # Find similar profiles within clusters
        for profile in profiles:
            if profile.cluster_label is not None:
                similar_profiles = [
                    pid for pid in clusters[profile.cluster_label]
                    if pid != profile.profile_id
                ]
                profile.similar_profiles = similar_profiles[:5]  # Top 5 similar
        
        return {
            "clusters": clusters,
            "silhouette_score": float(silhouette_avg),
            "optimal_clusters": optimal_clusters,
            "cluster_centers": self.kmeans.cluster_centers_.tolist()
        }

class ComparisonEngine:
    def __init__(self):
        pass
        
    def compare_with_baseline(self, benchmark: BenchmarkResult, 
                            baseline: PerformanceBaseline) -> ComparisonResult:
        """Compare benchmark result with baseline"""
        comparison_id = f"baseline_comp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        metrics_comparison = {}
        improvement_areas = []
        regression_areas = []
        total_score = 0
        scored_metrics = 0
        
        for metric in benchmark.metrics:
            metric_name = metric.name
            current_value = metric.value
            
            if metric_name in baseline.metrics:
                baseline_value = baseline.metrics[metric_name]
                difference = current_value - baseline_value
                percentage = (difference / baseline_value) * 100 if baseline_value != 0 else 0
                
                metrics_comparison[metric_name] = {
                    "current": current_value,
                    "baseline": baseline_value,
                    "difference": difference,
                    "percentage": percentage
                }
                
                # Determine if this is improvement or regression
                is_improvement = False
                
                if metric.metric_type in [MetricType.LATENCY, MetricType.RESPONSE_TIME]:
                    # Lower is better for latency metrics
                    is_improvement = difference < 0
                else:
                    # Higher is better for throughput metrics
                    is_improvement = difference > 0
                
                if is_improvement:
                    improvement_areas.append(metric_name)
                    score = min(100, 50 + abs(percentage) / 2)  # Bonus for improvement
                else:
                    regression_areas.append(metric_name)
                    score = max(0, 50 - abs(percentage) / 2)  # Penalty for regression
                
                total_score += score
                scored_metrics += 1
        
        overall_score = total_score / scored_metrics if scored_metrics > 0 else 50
        
        return ComparisonResult(
            comparison_id=comparison_id,
            comparison_type=ComparisonType.BASELINE,
            benchmark_id=benchmark.benchmark_id,
            reference_id=baseline.baseline_id,
            metrics_comparison=metrics_comparison,
            overall_score=overall_score,
            improvement_areas=improvement_areas,
            regression_areas=regression_areas,
            created_at=datetime.now()
        )
    
    def compare_historical(self, current_benchmark: BenchmarkResult, 
                         historical_benchmarks: List[BenchmarkResult]) -> ComparisonResult:
        """Compare with historical benchmarks"""
        if not historical_benchmarks:
            return None
        
        comparison_id = f"historical_comp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Calculate historical averages for each metric
        historical_averages = {}
        for benchmark in historical_benchmarks:
            for metric in benchmark.metrics:
                if metric.name not in historical_averages:
                    historical_averages[metric.name] = []
                historical_averages[metric.name].append(metric.value)
        
        # Calculate means
        for metric_name, values in historical_averages.items():
            historical_averages[metric_name] = np.mean(values)
        
        metrics_comparison = {}
        improvement_areas = []
        regression_areas = []
        total_score = 0
        scored_metrics = 0
        
        for metric in current_benchmark.metrics:
            metric_name = metric.name
            current_value = metric.value
            
            if metric_name in historical_averages:
                historical_value = historical_averages[metric_name]
                difference = current_value - historical_value
                percentage = (difference / historical_value) * 100 if historical_value != 0 else 0
                
                metrics_comparison[metric_name] = {
                    "current": current_value,
                    "historical_average": historical_value,
                    "difference": difference,
                    "percentage": percentage
                }
                
                # Determine improvement or regression
                is_improvement = False
                
                if metric.metric_type in [MetricType.LATENCY, MetricType.RESPONSE_TIME]:
                    is_improvement = difference < 0
                else:
                    is_improvement = difference > 0
                
                if is_improvement:
                    improvement_areas.append(metric_name)
                    score = min(100, 50 + abs(percentage) / 2)
                else:
                    regression_areas.append(metric_name)
                    score = max(0, 50 - abs(percentage) / 2)
                
                total_score += score
                scored_metrics += 1
        
        overall_score = total_score / scored_metrics if scored_metrics > 0 else 50
        
        return ComparisonResult(
            comparison_id=comparison_id,
            comparison_type=ComparisonType.HISTORICAL,
            benchmark_id=current_benchmark.benchmark_id,
            reference_id="historical_average",
            metrics_comparison=metrics_comparison,
            overall_score=overall_score,
            improvement_areas=improvement_areas,
            regression_areas=regression_areas,
            created_at=datetime.now()
        )
    
    def compare_peer_to_peer(self, benchmark1: BenchmarkResult, 
                           benchmark2: BenchmarkResult) -> ComparisonResult:
        """Compare two benchmark results"""
        comparison_id = f"peer_comp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        metrics_comparison = {}
        improvement_areas = []
        regression_areas = []
        total_score = 0
        scored_metrics = 0
        
        # Create metric lookup for benchmark2
        benchmark2_metrics = {m.name: m.value for m in benchmark2.metrics}
        
        for metric in benchmark1.metrics:
            metric_name = metric.name
            value1 = metric.value
            
            if metric_name in benchmark2_metrics:
                value2 = benchmark2_metrics[metric_name]
                difference = value1 - value2
                percentage = (difference / value2) * 100 if value2 != 0 else 0
                
                metrics_comparison[metric_name] = {
                    "benchmark1": value1,
                    "benchmark2": value2,
                    "difference": difference,
                    "percentage": percentage
                }
                
                # Determine which is better
                is_benchmark1_better = False
                
                if metric.metric_type in [MetricType.LATENCY, MetricType.RESPONSE_TIME]:
                    is_benchmark1_better = value1 < value2
                else:
                    is_benchmark1_better = value1 > value2
                
                if is_benchmark1_better:
                    improvement_areas.append(metric_name)
                    score = min(100, 50 + abs(percentage) / 2)
                else:
                    regression_areas.append(metric_name)
                    score = max(0, 50 - abs(percentage) / 2)
                
                total_score += score
                scored_metrics += 1
        
        overall_score = total_score / scored_metrics if scored_metrics > 0 else 50
        
        return ComparisonResult(
            comparison_id=comparison_id,
            comparison_type=ComparisonType.PEER,
            benchmark_id=benchmark1.benchmark_id,
            reference_id=benchmark2.benchmark_id,
            metrics_comparison=metrics_comparison,
            overall_score=overall_score,
            improvement_areas=improvement_areas,
            regression_areas=regression_areas,
            created_at=datetime.now()
        )

class PerformanceBenchmarkingSystem:
    def __init__(self):
        self.benchmark_runner = BenchmarkRunner()
        self.analyzer = PerformanceAnalyzer()
        self.comparison_engine = ComparisonEngine()
        self.redis_client = None
        self.benchmark_history: List[BenchmarkResult] = []
        self.baselines: Dict[str, PerformanceBaseline] = {}
        self.performance_profiles: List[PerformanceProfile] = []
        self.comparison_results: List[ComparisonResult] = []
        
    async def initialize(self):
        """Initialize the benchmarking system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        # Create default baselines
        await self._create_default_baselines()
        
        logger.info("Performance benchmarking system initialized")
    
    async def _create_default_baselines(self):
        """Create default performance baselines"""
        baselines_config = {
            "cpu_baseline": {
                "benchmark_type": BenchmarkType.CPU,
                "metrics": {
                    "operations_per_second": 1000000,
                    "cpu_utilization": 95.0
                }
            },
            "memory_baseline": {
                "benchmark_type": BenchmarkType.MEMORY,
                "metrics": {
                    "throughput_mbps": 10000,
                    "latency_ns": 100
                }
            },
            "disk_baseline": {
                "benchmark_type": BenchmarkType.DISK,
                "metrics": {
                    "iops": 10000,
                    "throughput_mbps": 500
                }
            }
        }
        
        for baseline_name, config in baselines_config.items():
            baseline = PerformanceBaseline(
                baseline_id=baseline_name,
                name=baseline_name.replace("_", " ").title(),
                benchmark_type=config["benchmark_type"],
                metrics=config["metrics"],
                environment={"type": "default", "created": "system"},
                created_at=datetime.now(),
                is_active=True
            )
            
            self.baselines[baseline_name] = baseline
    
    async def run_comprehensive_benchmark(self, 
                                        benchmark_types: List[BenchmarkType] = None) -> Dict[str, Any]:
        """Run comprehensive benchmarking suite"""
        if benchmark_types is None:
            benchmark_types = list(BenchmarkType)
        
        results = []
        errors = []
        
        for benchmark_type in benchmark_types:
            try:
                result = await self.benchmark_runner.run_benchmark(benchmark_type)
                results.append(result)
                self.benchmark_history.append(result)
                
                logger.info(f"Completed {benchmark_type.value} benchmark")
                
            except Exception as e:
                error_msg = f"Failed to run {benchmark_type.value} benchmark: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # Keep only last 100 benchmark results
        self.benchmark_history = self.benchmark_history[-100:]
        
        # Generate performance profile
        if results:
            profile = self.analyzer.create_performance_profile(results)
            if profile:
                self.performance_profiles.append(profile)
                self.performance_profiles = self.performance_profiles[-20:]  # Keep last 20
        
        # Analyze trends
        trends = self.analyzer.analyze_performance_trends(self.benchmark_history)
        
        # Cache results
        await self._cache_benchmark_results({
            "benchmarks": [asdict(r) for r in results],
            "trends": trends,
            "profile": asdict(profile) if profile else None,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "benchmarks_completed": len(results),
            "errors": errors,
            "overall_score": np.mean([r.score for r in results if r.score is not None]) if results else 0,
            "performance_grade": self._get_overall_grade(results),
            "trends": trends,
            "profile_id": profile.profile_id if profile else None
        }
    
    def _get_overall_grade(self, results: List[BenchmarkResult]) -> str:
        """Get overall performance grade"""
        if not results:
            return "unknown"
        
        scores = [r.score for r in results if r.score is not None]
        if not scores:
            return "unknown"
        
        avg_score = np.mean(scores)
        grade = self.benchmark_runner._determine_performance_grade(avg_score)
        return grade.value
    
    async def _cache_benchmark_results(self, results: Dict[str, Any]):
        """Cache benchmark results"""
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    "benchmark_results",
                    7200,  # 2 hours TTL
                    json.dumps(results, default=str)
                )
            except Exception as e:
                logger.error(f"Error caching benchmark results: {e}")
    
    async def compare_with_baseline(self, benchmark_id: str, 
                                  baseline_id: str) -> ComparisonResult:
        """Compare benchmark with baseline"""
        benchmark = next((b for b in self.benchmark_history if b.benchmark_id == benchmark_id), None)
        baseline = self.baselines.get(baseline_id)
        
        if not benchmark or not baseline:
            raise ValueError("Benchmark or baseline not found")
        
        comparison = self.comparison_engine.compare_with_baseline(benchmark, baseline)
        self.comparison_results.append(comparison)
        
        return comparison
    
    async def compare_historical(self, benchmark_id: str, 
                               days_back: int = 30) -> ComparisonResult:
        """Compare with historical benchmarks"""
        current_benchmark = next((b for b in self.benchmark_history if b.benchmark_id == benchmark_id), None)
        if not current_benchmark:
            raise ValueError("Benchmark not found")
        
        cutoff_date = datetime.now() - timedelta(days=days_back)
        historical_benchmarks = [
            b for b in self.benchmark_history 
            if (b.benchmark_type == current_benchmark.benchmark_type and 
                b.start_time >= cutoff_date and 
                b.benchmark_id != benchmark_id)
        ]
        
        comparison = self.comparison_engine.compare_historical(current_benchmark, historical_benchmarks)
        if comparison:
            self.comparison_results.append(comparison)
        
        return comparison
    
    async def get_performance_insights(self) -> Dict[str, Any]:
        """Get comprehensive performance insights"""
        if not self.benchmark_history:
            return {"error": "No benchmark data available"}
        
        # Analyze trends
        trends = self.analyzer.analyze_performance_trends(self.benchmark_history)
        
        # Cluster profiles
        clustering_result = {}
        if len(self.performance_profiles) >= 3:
            clustering_result = self.analyzer.cluster_performance_profiles(self.performance_profiles)
        
        # Get recent comparisons
        recent_comparisons = sorted(
            self.comparison_results,
            key=lambda c: c.created_at,
            reverse=True
        )[:10]
        
        insights = {
            "summary": {
                "total_benchmarks": len(self.benchmark_history),
                "benchmark_types": list(set(b.benchmark_type.value for b in self.benchmark_history)),
                "performance_profiles": len(self.performance_profiles),
                "recent_comparisons": len(recent_comparisons)
            },
            "trends": trends,
            "clustering": clustering_result,
            "recent_comparisons": [asdict(c) for c in recent_comparisons],
            "recommendations": await self._generate_performance_recommendations()
        }
        
        return insights
    
    async def _generate_performance_recommendations(self) -> List[Dict[str, str]]:
        """Generate performance improvement recommendations"""
        recommendations = []
        
        if not self.benchmark_history:
            return recommendations
        
        # Analyze recent benchmarks for poor performance
        recent_benchmarks = sorted(self.benchmark_history, key=lambda b: b.start_time, reverse=True)[:10]
        
        for benchmark in recent_benchmarks:
            if benchmark.score and benchmark.score < 60:  # Poor performance
                if benchmark.benchmark_type == BenchmarkType.CPU:
                    recommendations.append({
                        "type": "cpu_optimization",
                        "priority": "high",
                        "description": "CPU performance is below target. Consider CPU governor tuning or workload optimization.",
                        "action": "Review CPU-intensive processes and optimize algorithms"
                    })
                elif benchmark.benchmark_type == BenchmarkType.MEMORY:
                    recommendations.append({
                        "type": "memory_optimization",
                        "priority": "medium",
                        "description": "Memory performance could be improved. Consider memory allocation strategies.",
                        "action": "Analyze memory usage patterns and implement caching strategies"
                    })
                elif benchmark.benchmark_type == BenchmarkType.DISK:
                    recommendations.append({
                        "type": "storage_optimization",
                        "priority": "high",
                        "description": "Disk I/O performance is suboptimal. Consider storage optimization.",
                        "action": "Evaluate storage configuration and consider NVMe or RAID optimization"
                    })
        
        return recommendations

# FastAPI application
app = FastAPI(title="Performance Benchmarking System", version="1.0.0")
benchmark_system = PerformanceBenchmarkingSystem()

@app.on_event("startup")
async def startup():
    await benchmark_system.initialize()

class BenchmarkRequest(BaseModel):
    benchmark_types: List[str]
    custom_config: Optional[Dict[str, Any]] = None

class ComparisonRequest(BaseModel):
    benchmark_id: str
    comparison_type: str
    reference_id: Optional[str] = None
    days_back: Optional[int] = 30

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "performance-benchmarking"}

@app.post("/benchmark/run")
async def run_benchmark(request: BenchmarkRequest, background_tasks: BackgroundTasks):
    """Run performance benchmarks"""
    try:
        benchmark_types = [BenchmarkType(bt) for bt in request.benchmark_types]
        
        background_tasks.add_task(
            benchmark_system.run_comprehensive_benchmark,
            benchmark_types
        )
        
        return {
            "status": "benchmark_started",
            "benchmark_types": request.benchmark_types,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/benchmark/results")
async def get_benchmark_results(limit: int = Query(10, ge=1, le=100)):
    """Get recent benchmark results"""
    try:
        recent_results = sorted(
            benchmark_system.benchmark_history,
            key=lambda b: b.start_time,
            reverse=True
        )[:limit]
        
        return {
            "results": [asdict(r) for r in recent_results],
            "count": len(recent_results)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/benchmark/{benchmark_id}")
async def get_benchmark_detail(benchmark_id: str):
    """Get detailed benchmark result"""
    try:
        benchmark = next(
            (b for b in benchmark_system.benchmark_history if b.benchmark_id == benchmark_id),
            None
        )
        
        if not benchmark:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        
        return asdict(benchmark)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/comparison")
async def create_comparison(request: ComparisonRequest):
    """Create performance comparison"""
    try:
        comparison_type = ComparisonType(request.comparison_type)
        
        if comparison_type == ComparisonType.BASELINE:
            if not request.reference_id:
                raise HTTPException(status_code=400, detail="Reference ID required for baseline comparison")
            comparison = await benchmark_system.compare_with_baseline(
                request.benchmark_id, request.reference_id
            )
        elif comparison_type == ComparisonType.HISTORICAL:
            comparison = await benchmark_system.compare_historical(
                request.benchmark_id, request.days_back or 30
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported comparison type")
        
        return asdict(comparison) if comparison else {"error": "Could not create comparison"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/baselines")
async def get_baselines():
    """Get available performance baselines"""
    try:
        baselines = [asdict(b) for b in benchmark_system.baselines.values()]
        return {"baselines": baselines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profiles")
async def get_performance_profiles():
    """Get performance profiles"""
    try:
        profiles = [asdict(p) for p in benchmark_system.performance_profiles]
        return {"profiles": profiles, "count": len(profiles)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/insights")
async def get_insights():
    """Get comprehensive performance insights"""
    try:
        insights = await benchmark_system.get_performance_insights()
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/trends")
async def get_performance_trends():
    """Get performance trends analysis"""
    try:
        trends = benchmark_system.analyzer.analyze_performance_trends(
            benchmark_system.benchmark_history
        )
        return {"trends": trends, "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)