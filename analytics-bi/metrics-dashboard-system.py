"""
Comprehensive Metrics Dashboard and Reporting System
Advanced analytics and visualization for infrastructure metrics
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import aiohttp
import aioredis
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MetricType(Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"

class AggregationType(Enum):
    SUM = "sum"
    AVERAGE = "average"
    MAX = "max"
    MIN = "min"
    PERCENTILE = "percentile"
    RATE = "rate"
    COUNT = "count"

class DashboardType(Enum):
    INFRASTRUCTURE = "infrastructure"
    APPLICATION = "application"
    BUSINESS = "business"
    SECURITY = "security"
    CUSTOM = "custom"

class ReportFormat(Enum):
    JSON = "json"
    CSV = "csv"
    PDF = "pdf"
    HTML = "html"
    EXCEL = "excel"

@dataclass
class MetricDefinition:
    name: str
    metric_type: MetricType
    description: str
    unit: str
    labels: List[str]
    aggregation_rules: Dict[str, AggregationType]
    retention_days: int = 30
    alert_thresholds: Optional[Dict[str, float]] = None

@dataclass
class MetricDataPoint:
    timestamp: datetime
    metric_name: str
    value: float
    labels: Dict[str, str]
    instance: str

@dataclass
class DashboardWidget:
    widget_id: str
    widget_type: str  # chart, table, metric, gauge, heatmap
    title: str
    metric_queries: List[str]
    visualization_config: Dict[str, Any]
    position: Dict[str, int]  # x, y, width, height
    refresh_interval: int = 300  # seconds

@dataclass
class Dashboard:
    dashboard_id: str
    name: str
    dashboard_type: DashboardType
    description: str
    widgets: List[DashboardWidget]
    layout: Dict[str, Any]
    created_by: str
    created_at: datetime
    last_modified: datetime
    is_public: bool = False

@dataclass
class Report:
    report_id: str
    name: str
    description: str
    dashboard_id: str
    report_format: ReportFormat
    schedule_cron: Optional[str]
    recipients: List[str]
    parameters: Dict[str, Any]
    created_at: datetime
    last_generated: Optional[datetime]

class MetricsCollector:
    def __init__(self):
        self.metric_definitions: Dict[str, MetricDefinition] = {}
        self.collected_metrics: List[MetricDataPoint] = []
        
    def register_metric(self, metric_def: MetricDefinition):
        """Register a new metric definition"""
        self.metric_definitions[metric_def.name] = metric_def
        logger.info(f"Registered metric: {metric_def.name}")
    
    async def collect_infrastructure_metrics(self) -> List[MetricDataPoint]:
        """Collect infrastructure metrics from various sources"""
        metrics = []
        timestamp = datetime.now()
        
        try:
            # CPU metrics
            cpu_metrics = await self._collect_cpu_metrics(timestamp)
            metrics.extend(cpu_metrics)
            
            # Memory metrics
            memory_metrics = await self._collect_memory_metrics(timestamp)
            metrics.extend(memory_metrics)
            
            # Disk metrics
            disk_metrics = await self._collect_disk_metrics(timestamp)
            metrics.extend(disk_metrics)
            
            # Network metrics
            network_metrics = await self._collect_network_metrics(timestamp)
            metrics.extend(network_metrics)
            
            # Pod metrics
            pod_metrics = await self._collect_pod_metrics(timestamp)
            metrics.extend(pod_metrics)
            
            logger.info(f"Collected {len(metrics)} infrastructure metrics")
            
        except Exception as e:
            logger.error(f"Error collecting infrastructure metrics: {str(e)}")
            
        return metrics
    
    async def _collect_cpu_metrics(self, timestamp: datetime) -> List[MetricDataPoint]:
        """Collect CPU-related metrics"""
        metrics = []
        
        # Simulate CPU metrics collection
        nodes = ["node-1", "node-2", "node-3"]
        
        for node in nodes:
            # CPU usage percentage
            cpu_usage = np.random.uniform(20, 80)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="cpu_usage_percent",
                value=cpu_usage,
                labels={"node": node, "type": "system"},
                instance=node
            ))
            
            # CPU load average
            load_avg = np.random.uniform(0.5, 4.0)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="cpu_load_average",
                value=load_avg,
                labels={"node": node, "period": "1m"},
                instance=node
            ))
            
            # CPU cores count
            cpu_cores = np.random.choice([4, 8, 16, 32])
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="cpu_cores_total",
                value=float(cpu_cores),
                labels={"node": node},
                instance=node
            ))
            
        return metrics
    
    async def _collect_memory_metrics(self, timestamp: datetime) -> List[MetricDataPoint]:
        """Collect memory-related metrics"""
        metrics = []
        
        nodes = ["node-1", "node-2", "node-3"]
        
        for node in nodes:
            # Memory usage
            memory_usage = np.random.uniform(30, 85)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="memory_usage_percent",
                value=memory_usage,
                labels={"node": node, "type": "used"},
                instance=node
            ))
            
            # Memory total
            memory_total = np.random.choice([8, 16, 32, 64]) * 1024 * 1024 * 1024  # GB to bytes
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="memory_total_bytes",
                value=float(memory_total),
                labels={"node": node},
                instance=node
            ))
            
            # Memory available
            memory_available = memory_total * (1 - memory_usage / 100)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="memory_available_bytes",
                value=memory_available,
                labels={"node": node},
                instance=node
            ))
            
        return metrics
    
    async def _collect_disk_metrics(self, timestamp: datetime) -> List[MetricDataPoint]:
        """Collect disk-related metrics"""
        metrics = []
        
        disks = [("sda", "node-1"), ("sdb", "node-1"), ("nvme0n1", "node-2")]
        
        for disk, node in disks:
            # Disk usage
            disk_usage = np.random.uniform(40, 90)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="disk_usage_percent",
                value=disk_usage,
                labels={"device": disk, "node": node, "mountpoint": "/"},
                instance=f"{node}:{disk}"
            ))
            
            # Disk I/O read rate
            read_rate = np.random.uniform(10, 100)  # MB/s
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="disk_read_rate_mbps",
                value=read_rate,
                labels={"device": disk, "node": node},
                instance=f"{node}:{disk}"
            ))
            
            # Disk I/O write rate
            write_rate = np.random.uniform(5, 50)  # MB/s
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="disk_write_rate_mbps",
                value=write_rate,
                labels={"device": disk, "node": node},
                instance=f"{node}:{disk}"
            ))
            
        return metrics
    
    async def _collect_network_metrics(self, timestamp: datetime) -> List[MetricDataPoint]:
        """Collect network-related metrics"""
        metrics = []
        
        interfaces = [("eth0", "node-1"), ("eth0", "node-2"), ("eth1", "node-1")]
        
        for interface, node in interfaces:
            # Network receive rate
            rx_rate = np.random.uniform(10, 1000)  # Mbps
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="network_receive_rate_mbps",
                value=rx_rate,
                labels={"interface": interface, "node": node},
                instance=f"{node}:{interface}"
            ))
            
            # Network transmit rate
            tx_rate = np.random.uniform(5, 500)  # Mbps
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="network_transmit_rate_mbps",
                value=tx_rate,
                labels={"interface": interface, "node": node},
                instance=f"{node}:{interface}"
            ))
            
            # Network errors
            errors = np.random.poisson(0.1)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="network_errors_total",
                value=float(errors),
                labels={"interface": interface, "node": node, "type": "rx"},
                instance=f"{node}:{interface}"
            ))
            
        return metrics
    
    async def _collect_pod_metrics(self, timestamp: datetime) -> List[MetricDataPoint]:
        """Collect pod-related metrics"""
        metrics = []
        
        pods = [
            ("frontend-pod-1", "default", "node-1"),
            ("backend-pod-1", "default", "node-2"),
            ("database-pod-1", "database", "node-3")
        ]
        
        for pod, namespace, node in pods:
            # Pod CPU usage
            cpu_usage = np.random.uniform(10, 200)  # millicores
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="pod_cpu_usage_millicores",
                value=cpu_usage,
                labels={"pod": pod, "namespace": namespace, "node": node},
                instance=f"{namespace}/{pod}"
            ))
            
            # Pod memory usage
            memory_usage = np.random.uniform(50, 500)  # MB
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="pod_memory_usage_mb",
                value=memory_usage,
                labels={"pod": pod, "namespace": namespace, "node": node},
                instance=f"{namespace}/{pod}"
            ))
            
            # Pod restart count
            restart_count = np.random.poisson(0.1)
            metrics.append(MetricDataPoint(
                timestamp=timestamp,
                metric_name="pod_restart_count",
                value=float(restart_count),
                labels={"pod": pod, "namespace": namespace, "node": node},
                instance=f"{namespace}/{pod}"
            ))
            
        return metrics

class MetricsProcessor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)  # Keep 95% variance
        self.kmeans = KMeans(n_clusters=5, random_state=42)
        
    def aggregate_metrics(self, metrics: List[MetricDataPoint], 
                         aggregation: AggregationType, 
                         time_window: timedelta) -> Dict[str, float]:
        """Aggregate metrics over a time window"""
        if not metrics:
            return {}
        
        # Group metrics by name
        grouped_metrics = {}
        for metric in metrics:
            if metric.metric_name not in grouped_metrics:
                grouped_metrics[metric.metric_name] = []
            grouped_metrics[metric.metric_name].append(metric.value)
        
        # Apply aggregation
        aggregated = {}
        for metric_name, values in grouped_metrics.items():
            if aggregation == AggregationType.SUM:
                aggregated[metric_name] = sum(values)
            elif aggregation == AggregationType.AVERAGE:
                aggregated[metric_name] = np.mean(values)
            elif aggregation == AggregationType.MAX:
                aggregated[metric_name] = max(values)
            elif aggregation == AggregationType.MIN:
                aggregated[metric_name] = min(values)
            elif aggregation == AggregationType.COUNT:
                aggregated[metric_name] = len(values)
            elif aggregation == AggregationType.PERCENTILE:
                aggregated[metric_name] = np.percentile(values, 95)
            elif aggregation == AggregationType.RATE:
                # Calculate rate per second
                if len(values) > 1:
                    time_diff = (metrics[-1].timestamp - metrics[0].timestamp).total_seconds()
                    aggregated[metric_name] = (values[-1] - values[0]) / time_diff if time_diff > 0 else 0
                else:
                    aggregated[metric_name] = 0
        
        return aggregated
    
    def calculate_correlations(self, metrics: List[MetricDataPoint]) -> Dict[str, Dict[str, float]]:
        """Calculate correlations between different metrics"""
        if len(metrics) < 2:
            return {}
        
        # Create DataFrame
        df_data = []
        for metric in metrics:
            df_data.append({
                'timestamp': metric.timestamp,
                'metric_name': metric.metric_name,
                'value': metric.value,
                'instance': metric.instance
            })
        
        df = pd.DataFrame(df_data)
        
        # Pivot to get metrics as columns
        pivot_df = df.pivot_table(
            index=['timestamp', 'instance'], 
            columns='metric_name', 
            values='value', 
            aggfunc='mean'
        ).fillna(0)
        
        if pivot_df.empty:
            return {}
        
        # Calculate correlation matrix
        correlation_matrix = pivot_df.corr()
        
        # Convert to dictionary
        correlations = {}
        for metric1 in correlation_matrix.columns:
            correlations[metric1] = {}
            for metric2 in correlation_matrix.columns:
                if not pd.isna(correlation_matrix.loc[metric1, metric2]):
                    correlations[metric1][metric2] = float(correlation_matrix.loc[metric1, metric2])
        
        return correlations
    
    def detect_anomalies_in_metrics(self, metrics: List[MetricDataPoint]) -> List[MetricDataPoint]:
        """Detect anomalous metric values"""
        if len(metrics) < 10:
            return []
        
        # Group by metric name
        metric_groups = {}
        for metric in metrics:
            if metric.metric_name not in metric_groups:
                metric_groups[metric.metric_name] = []
            metric_groups[metric.metric_name].append(metric)
        
        anomalies = []
        
        for metric_name, metric_list in metric_groups.items():
            if len(metric_list) < 10:
                continue
                
            values = [m.value for m in metric_list]
            
            # Use statistical method to detect anomalies
            q1 = np.percentile(values, 25)
            q3 = np.percentile(values, 75)
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            
            for metric in metric_list:
                if metric.value < lower_bound or metric.value > upper_bound:
                    anomalies.append(metric)
        
        return anomalies
    
    def generate_insights(self, metrics: List[MetricDataPoint]) -> Dict[str, Any]:
        """Generate insights from metrics data"""
        insights = {
            "total_metrics": len(metrics),
            "unique_metric_types": len(set(m.metric_name for m in metrics)),
            "time_range": {},
            "top_metrics": {},
            "trends": {},
            "anomalies": []
        }
        
        if not metrics:
            return insights
        
        # Time range analysis
        timestamps = [m.timestamp for m in metrics]
        insights["time_range"] = {
            "start": min(timestamps).isoformat(),
            "end": max(timestamps).isoformat(),
            "duration_hours": (max(timestamps) - min(timestamps)).total_seconds() / 3600
        }
        
        # Top metrics by value
        metric_values = {}
        for metric in metrics:
            if metric.metric_name not in metric_values:
                metric_values[metric.metric_name] = []
            metric_values[metric.metric_name].append(metric.value)
        
        for metric_name, values in metric_values.items():
            insights["top_metrics"][metric_name] = {
                "max": max(values),
                "min": min(values),
                "avg": np.mean(values),
                "std": np.std(values)
            }
        
        # Detect anomalies
        anomalies = self.detect_anomalies_in_metrics(metrics)
        insights["anomalies"] = [
            {
                "metric_name": a.metric_name,
                "value": a.value,
                "timestamp": a.timestamp.isoformat(),
                "instance": a.instance
            }
            for a in anomalies
        ]
        
        return insights

class VisualizationEngine:
    def __init__(self):
        self.color_palette = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ]
    
    def create_time_series_chart(self, metrics: List[MetricDataPoint], 
                               metric_names: List[str]) -> Dict[str, Any]:
        """Create time series chart for specified metrics"""
        fig = go.Figure()
        
        # Group metrics by name
        metric_groups = {}
        for metric in metrics:
            if metric.metric_name in metric_names:
                if metric.metric_name not in metric_groups:
                    metric_groups[metric.metric_name] = {'timestamps': [], 'values': []}
                metric_groups[metric.metric_name]['timestamps'].append(metric.timestamp)
                metric_groups[metric.metric_name]['values'].append(metric.value)
        
        # Add traces for each metric
        for i, (metric_name, data) in enumerate(metric_groups.items()):
            color = self.color_palette[i % len(self.color_palette)]
            
            fig.add_trace(go.Scatter(
                x=data['timestamps'],
                y=data['values'],
                mode='lines+markers',
                name=metric_name,
                line=dict(color=color),
                hovertemplate=f'{metric_name}<br>Value: %{{y}}<br>Time: %{{x}}<extra></extra>'
            ))
        
        fig.update_layout(
            title="Metrics Time Series",
            xaxis_title="Time",
            yaxis_title="Value",
            hovermode='x unified',
            showlegend=True
        )
        
        return fig.to_dict()
    
    def create_heatmap(self, correlation_matrix: Dict[str, Dict[str, float]]) -> Dict[str, Any]:
        """Create correlation heatmap"""
        if not correlation_matrix:
            return {}
        
        metrics = list(correlation_matrix.keys())
        z_values = []
        
        for metric1 in metrics:
            row = []
            for metric2 in metrics:
                value = correlation_matrix.get(metric1, {}).get(metric2, 0)
                row.append(value)
            z_values.append(row)
        
        fig = go.Figure(data=go.Heatmap(
            z=z_values,
            x=metrics,
            y=metrics,
            colorscale='RdBu',
            zmid=0,
            hoverongaps=False,
            hovertemplate='%{y} vs %{x}<br>Correlation: %{z:.3f}<extra></extra>'
        ))
        
        fig.update_layout(
            title="Metric Correlations Heatmap",
            xaxis_title="Metrics",
            yaxis_title="Metrics"
        )
        
        return fig.to_dict()
    
    def create_distribution_chart(self, metrics: List[MetricDataPoint], 
                                metric_name: str) -> Dict[str, Any]:
        """Create distribution chart for a specific metric"""
        values = [m.value for m in metrics if m.metric_name == metric_name]
        
        if not values:
            return {}
        
        fig = go.Figure()
        
        # Histogram
        fig.add_trace(go.Histogram(
            x=values,
            nbinsx=30,
            name="Distribution",
            opacity=0.7
        ))
        
        # Add mean line
        mean_value = np.mean(values)
        fig.add_vline(
            x=mean_value,
            line_dash="dash",
            line_color="red",
            annotation_text=f"Mean: {mean_value:.2f}"
        )
        
        # Add percentile lines
        p95 = np.percentile(values, 95)
        fig.add_vline(
            x=p95,
            line_dash="dot",
            line_color="orange",
            annotation_text=f"95th percentile: {p95:.2f}"
        )
        
        fig.update_layout(
            title=f"Distribution of {metric_name}",
            xaxis_title="Value",
            yaxis_title="Frequency",
            showlegend=True
        )
        
        return fig.to_dict()
    
    def create_gauge_chart(self, current_value: float, max_value: float, 
                          title: str, thresholds: Dict[str, float] = None) -> Dict[str, Any]:
        """Create gauge chart for a single metric"""
        if thresholds is None:
            thresholds = {"warning": max_value * 0.7, "critical": max_value * 0.9}
        
        fig = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=current_value,
            domain={'x': [0, 1], 'y': [0, 1]},
            title={'text': title},
            delta={'reference': thresholds.get("warning", max_value * 0.7)},
            gauge={
                'axis': {'range': [None, max_value]},
                'bar': {'color': "darkblue"},
                'steps': [
                    {'range': [0, thresholds.get("warning", max_value * 0.7)], 'color': "lightgray"},
                    {'range': [thresholds.get("warning", max_value * 0.7), thresholds.get("critical", max_value * 0.9)], 'color': "yellow"},
                    {'range': [thresholds.get("critical", max_value * 0.9), max_value], 'color': "red"}
                ],
                'threshold': {
                    'line': {'color': "red", 'width': 4},
                    'thickness': 0.75,
                    'value': current_value
                }
            }
        ))
        
        fig.update_layout(height=400)
        
        return fig.to_dict()

class DashboardManager:
    def __init__(self):
        self.dashboards: Dict[str, Dashboard] = {}
        self.reports: Dict[str, Report] = {}
        
    def create_dashboard(self, dashboard: Dashboard) -> str:
        """Create a new dashboard"""
        self.dashboards[dashboard.dashboard_id] = dashboard
        logger.info(f"Created dashboard: {dashboard.name}")
        return dashboard.dashboard_id
    
    def get_dashboard(self, dashboard_id: str) -> Optional[Dashboard]:
        """Get dashboard by ID"""
        return self.dashboards.get(dashboard_id)
    
    def update_dashboard(self, dashboard_id: str, updates: Dict[str, Any]) -> bool:
        """Update dashboard configuration"""
        if dashboard_id not in self.dashboards:
            return False
        
        dashboard = self.dashboards[dashboard_id]
        
        if 'name' in updates:
            dashboard.name = updates['name']
        if 'description' in updates:
            dashboard.description = updates['description']
        if 'widgets' in updates:
            dashboard.widgets = [DashboardWidget(**w) for w in updates['widgets']]
        if 'layout' in updates:
            dashboard.layout = updates['layout']
        
        dashboard.last_modified = datetime.now()
        
        return True
    
    def delete_dashboard(self, dashboard_id: str) -> bool:
        """Delete dashboard"""
        if dashboard_id in self.dashboards:
            del self.dashboards[dashboard_id]
            logger.info(f"Deleted dashboard: {dashboard_id}")
            return True
        return False
    
    def create_default_dashboards(self):
        """Create default dashboards"""
        # Infrastructure dashboard
        infra_widgets = [
            DashboardWidget(
                widget_id="cpu_usage",
                widget_type="time_series",
                title="CPU Usage",
                metric_queries=["cpu_usage_percent"],
                visualization_config={"yAxis": {"max": 100}},
                position={"x": 0, "y": 0, "width": 6, "height": 4}
            ),
            DashboardWidget(
                widget_id="memory_usage",
                widget_type="gauge",
                title="Memory Usage",
                metric_queries=["memory_usage_percent"],
                visualization_config={"max": 100, "thresholds": {"warning": 80, "critical": 90}},
                position={"x": 6, "y": 0, "width": 6, "height": 4}
            ),
            DashboardWidget(
                widget_id="disk_io",
                widget_type="time_series",
                title="Disk I/O",
                metric_queries=["disk_read_rate_mbps", "disk_write_rate_mbps"],
                visualization_config={"stacked": False},
                position={"x": 0, "y": 4, "width": 12, "height": 4}
            )
        ]
        
        infra_dashboard = Dashboard(
            dashboard_id="infrastructure",
            name="Infrastructure Overview",
            dashboard_type=DashboardType.INFRASTRUCTURE,
            description="Overview of infrastructure metrics",
            widgets=infra_widgets,
            layout={"columns": 12, "rows": 8},
            created_by="system",
            created_at=datetime.now(),
            last_modified=datetime.now(),
            is_public=True
        )
        
        self.create_dashboard(infra_dashboard)
        
        # Application dashboard
        app_widgets = [
            DashboardWidget(
                widget_id="pod_cpu",
                widget_type="time_series",
                title="Pod CPU Usage",
                metric_queries=["pod_cpu_usage_millicores"],
                visualization_config={"groupBy": "namespace"},
                position={"x": 0, "y": 0, "width": 8, "height": 4}
            ),
            DashboardWidget(
                widget_id="pod_memory",
                widget_type="time_series",
                title="Pod Memory Usage",
                metric_queries=["pod_memory_usage_mb"],
                visualization_config={"groupBy": "namespace"},
                position={"x": 8, "y": 0, "width": 4, "height": 4}
            ),
            DashboardWidget(
                widget_id="restart_count",
                widget_type="table",
                title="Pod Restart Count",
                metric_queries=["pod_restart_count"],
                visualization_config={"sortBy": "value", "order": "desc"},
                position={"x": 0, "y": 4, "width": 12, "height": 4}
            )
        ]
        
        app_dashboard = Dashboard(
            dashboard_id="applications",
            name="Application Metrics",
            dashboard_type=DashboardType.APPLICATION,
            description="Application and pod metrics",
            widgets=app_widgets,
            layout={"columns": 12, "rows": 8},
            created_by="system",
            created_at=datetime.now(),
            last_modified=datetime.now(),
            is_public=True
        )
        
        self.create_dashboard(app_dashboard)

class MetricsDashboardSystem:
    def __init__(self):
        self.collector = MetricsCollector()
        self.processor = MetricsProcessor()
        self.visualizer = VisualizationEngine()
        self.dashboard_manager = DashboardManager()
        self.redis_client = None
        self.metrics_cache: List[MetricDataPoint] = []
        
    async def initialize(self):
        """Initialize the dashboard system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        # Register default metrics
        self._register_default_metrics()
        
        # Create default dashboards
        self.dashboard_manager.create_default_dashboards()
        
        logger.info("Metrics dashboard system initialized")
    
    def _register_default_metrics(self):
        """Register default metric definitions"""
        default_metrics = [
            MetricDefinition(
                name="cpu_usage_percent",
                metric_type=MetricType.GAUGE,
                description="CPU usage percentage",
                unit="percent",
                labels=["node", "type"],
                aggregation_rules={"default": AggregationType.AVERAGE},
                alert_thresholds={"warning": 80.0, "critical": 90.0}
            ),
            MetricDefinition(
                name="memory_usage_percent",
                metric_type=MetricType.GAUGE,
                description="Memory usage percentage",
                unit="percent",
                labels=["node", "type"],
                aggregation_rules={"default": AggregationType.AVERAGE},
                alert_thresholds={"warning": 85.0, "critical": 95.0}
            ),
            MetricDefinition(
                name="disk_usage_percent",
                metric_type=MetricType.GAUGE,
                description="Disk usage percentage",
                unit="percent",
                labels=["device", "node", "mountpoint"],
                aggregation_rules={"default": AggregationType.AVERAGE},
                alert_thresholds={"warning": 80.0, "critical": 90.0}
            ),
            MetricDefinition(
                name="network_receive_rate_mbps",
                metric_type=MetricType.GAUGE,
                description="Network receive rate",
                unit="mbps",
                labels=["interface", "node"],
                aggregation_rules={"default": AggregationType.SUM}
            ),
            MetricDefinition(
                name="pod_cpu_usage_millicores",
                metric_type=MetricType.GAUGE,
                description="Pod CPU usage in millicores",
                unit="millicores",
                labels=["pod", "namespace", "node"],
                aggregation_rules={"default": AggregationType.SUM}
            )
        ]
        
        for metric_def in default_metrics:
            self.collector.register_metric(metric_def)
    
    async def collect_and_process_metrics(self) -> Dict[str, Any]:
        """Collect and process all metrics"""
        try:
            # Collect metrics
            new_metrics = await self.collector.collect_infrastructure_metrics()
            
            # Add to cache (keep last 1000 metrics)
            self.metrics_cache.extend(new_metrics)
            self.metrics_cache = self.metrics_cache[-1000:]
            
            # Process metrics
            aggregated = self.processor.aggregate_metrics(
                self.metrics_cache, 
                AggregationType.AVERAGE, 
                timedelta(minutes=5)
            )
            
            correlations = self.processor.calculate_correlations(self.metrics_cache)
            insights = self.processor.generate_insights(self.metrics_cache)
            
            # Cache results
            await self._cache_results({
                "aggregated_metrics": aggregated,
                "correlations": correlations,
                "insights": insights,
                "timestamp": datetime.now().isoformat()
            })
            
            return {
                "metrics_collected": len(new_metrics),
                "total_cached": len(self.metrics_cache),
                "aggregated_metrics": len(aggregated),
                "correlations_calculated": len(correlations),
                "insights": insights
            }
            
        except Exception as e:
            logger.error(f"Error in metrics collection and processing: {str(e)}")
            raise
    
    async def _cache_results(self, results: Dict[str, Any]):
        """Cache processing results"""
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    "metrics_dashboard_results",
                    3600,  # 1 hour TTL
                    json.dumps(results, default=str)
                )
            except Exception as e:
                logger.error(f"Error caching results: {e}")
    
    async def get_dashboard_data(self, dashboard_id: str) -> Dict[str, Any]:
        """Get data for a specific dashboard"""
        dashboard = self.dashboard_manager.get_dashboard(dashboard_id)
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} not found")
        
        dashboard_data = {
            "dashboard": asdict(dashboard),
            "widgets_data": {}
        }
        
        # Get data for each widget
        for widget in dashboard.widgets:
            widget_data = await self._get_widget_data(widget)
            dashboard_data["widgets_data"][widget.widget_id] = widget_data
        
        return dashboard_data
    
    async def _get_widget_data(self, widget: DashboardWidget) -> Dict[str, Any]:
        """Get data for a specific widget"""
        widget_data = {
            "widget_config": asdict(widget),
            "data": {},
            "visualization": {}
        }
        
        # Filter metrics for this widget
        relevant_metrics = [
            m for m in self.metrics_cache 
            if m.metric_name in widget.metric_queries
        ]
        
        if widget.widget_type == "time_series":
            widget_data["visualization"] = self.visualizer.create_time_series_chart(
                relevant_metrics, widget.metric_queries
            )
        elif widget.widget_type == "gauge":
            if relevant_metrics:
                latest_metric = max(relevant_metrics, key=lambda m: m.timestamp)
                max_val = widget.visualization_config.get("max", 100)
                widget_data["visualization"] = self.visualizer.create_gauge_chart(
                    latest_metric.value, max_val, widget.title,
                    widget.visualization_config.get("thresholds")
                )
        elif widget.widget_type == "heatmap":
            correlations = self.processor.calculate_correlations(relevant_metrics)
            widget_data["visualization"] = self.visualizer.create_heatmap(correlations)
        elif widget.widget_type == "distribution":
            if widget.metric_queries:
                widget_data["visualization"] = self.visualizer.create_distribution_chart(
                    relevant_metrics, widget.metric_queries[0]
                )
        
        return widget_data

# FastAPI application
app = FastAPI(title="Metrics Dashboard System", version="1.0.0")
dashboard_system = MetricsDashboardSystem()

@app.on_event("startup")
async def startup():
    await dashboard_system.initialize()

class DashboardRequest(BaseModel):
    name: str
    dashboard_type: str
    description: str
    widgets: List[Dict[str, Any]]
    layout: Dict[str, Any]
    is_public: bool = False

class MetricsQuery(BaseModel):
    metric_names: List[str]
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    aggregation: str = "average"

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "metrics-dashboard"}

@app.post("/collect")
async def collect_metrics(background_tasks: BackgroundTasks):
    """Trigger metrics collection and processing"""
    try:
        background_tasks.add_task(dashboard_system.collect_and_process_metrics)
        return {"status": "collection_started", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboards")
async def list_dashboards():
    """List all available dashboards"""
    dashboards = []
    for dashboard in dashboard_system.dashboard_manager.dashboards.values():
        dashboards.append({
            "dashboard_id": dashboard.dashboard_id,
            "name": dashboard.name,
            "dashboard_type": dashboard.dashboard_type.value,
            "description": dashboard.description,
            "created_at": dashboard.created_at.isoformat(),
            "is_public": dashboard.is_public
        })
    
    return {"dashboards": dashboards}

@app.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str):
    """Get dashboard configuration and data"""
    try:
        dashboard_data = await dashboard_system.get_dashboard_data(dashboard_id)
        return dashboard_data
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/dashboards")
async def create_dashboard(request: DashboardRequest):
    """Create a new dashboard"""
    try:
        dashboard_id = f"dashboard_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        widgets = [DashboardWidget(**w) for w in request.widgets]
        
        dashboard = Dashboard(
            dashboard_id=dashboard_id,
            name=request.name,
            dashboard_type=DashboardType(request.dashboard_type),
            description=request.description,
            widgets=widgets,
            layout=request.layout,
            created_by="user",
            created_at=datetime.now(),
            last_modified=datetime.now(),
            is_public=request.is_public
        )
        
        created_id = dashboard_system.dashboard_manager.create_dashboard(dashboard)
        
        return {
            "dashboard_id": created_id,
            "status": "created",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, updates: Dict[str, Any]):
    """Update dashboard configuration"""
    try:
        success = dashboard_system.dashboard_manager.update_dashboard(dashboard_id, updates)
        if not success:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        return {
            "dashboard_id": dashboard_id,
            "status": "updated",
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str):
    """Delete a dashboard"""
    try:
        success = dashboard_system.dashboard_manager.delete_dashboard(dashboard_id)
        if not success:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        
        return {
            "dashboard_id": dashboard_id,
            "status": "deleted",
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/metrics/query")
async def query_metrics(query: MetricsQuery):
    """Query metrics data"""
    try:
        # Filter metrics by names
        filtered_metrics = [
            m for m in dashboard_system.metrics_cache
            if m.metric_name in query.metric_names
        ]
        
        # Apply time filtering if specified
        if query.start_time:
            start_dt = datetime.fromisoformat(query.start_time)
            filtered_metrics = [m for m in filtered_metrics if m.timestamp >= start_dt]
        
        if query.end_time:
            end_dt = datetime.fromisoformat(query.end_time)
            filtered_metrics = [m for m in filtered_metrics if m.timestamp <= end_dt]
        
        # Apply aggregation
        aggregation_type = AggregationType(query.aggregation)
        aggregated = dashboard_system.processor.aggregate_metrics(
            filtered_metrics, aggregation_type, timedelta(hours=1)
        )
        
        return {
            "metrics": [asdict(m) for m in filtered_metrics],
            "aggregated": aggregated,
            "count": len(filtered_metrics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/insights")
async def get_insights():
    """Get insights from metrics data"""
    try:
        insights = dashboard_system.processor.generate_insights(dashboard_system.metrics_cache)
        return insights
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)