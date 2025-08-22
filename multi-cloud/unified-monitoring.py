#!/usr/bin/env python3
"""
Unified Multi-Cloud Monitoring System
Provides comprehensive monitoring across all cloud providers and edge locations
"""

import os
import json
import asyncio
import hashlib
import time
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import threading
import queue
import requests
import websocket
from concurrent.futures import ThreadPoolExecutor

class MetricType(Enum):
    """Types of monitoring metrics"""
    SYSTEM = "system"
    APPLICATION = "application"
    NETWORK = "network"
    STORAGE = "storage"
    DATABASE = "database"
    SECURITY = "security"
    BUSINESS = "business"
    CUSTOM = "custom"

class AlertSeverity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class MonitoringProvider(Enum):
    """Monitoring data sources"""
    CLOUDWATCH = "cloudwatch"
    STACKDRIVER = "stackdriver"
    AZURE_MONITOR = "azure_monitor"
    PROMETHEUS = "prometheus"
    GRAFANA = "grafana"
    DATADOG = "datadog"
    NEW_RELIC = "new_relic"
    SPLUNK = "splunk"
    ELASTIC = "elastic"
    CUSTOM = "custom"

@dataclass
class MetricDefinition:
    """Definition of a monitoring metric"""
    id: str
    name: str
    type: MetricType
    unit: str
    description: str
    provider: MonitoringProvider
    query: str
    resource_id: Optional[str]
    labels: Dict[str, str]
    aggregation: str  # sum, avg, min, max, count
    interval: int  # seconds
    retention_days: int
    alert_rules: List[str]
    created_at: datetime

@dataclass
class MetricDataPoint:
    """Single metric data point"""
    metric_id: str
    timestamp: datetime
    value: float
    labels: Dict[str, str]
    resource_id: Optional[str]
    provider: MonitoringProvider

@dataclass
class AlertRule:
    """Alert rule definition"""
    id: str
    name: str
    metric_id: str
    condition: str  # >, <, ==, !=, contains, etc.
    threshold: float
    duration: int  # seconds
    severity: AlertSeverity
    enabled: bool
    notification_channels: List[str]
    conditions: Dict[str, Any]
    created_at: datetime
    last_triggered: Optional[datetime]
    trigger_count: int

@dataclass
class Alert:
    """Triggered alert"""
    id: str
    rule_id: str
    metric_id: str
    severity: AlertSeverity
    title: str
    description: str
    current_value: float
    threshold: float
    resource_id: Optional[str]
    provider: MonitoringProvider
    labels: Dict[str, str]
    triggered_at: datetime
    resolved_at: Optional[datetime]
    acknowledged_at: Optional[datetime]
    acknowledged_by: Optional[str]
    status: str  # triggered, acknowledged, resolved
    annotations: Dict[str, str]

@dataclass
class Dashboard:
    """Monitoring dashboard"""
    id: str
    name: str
    description: str
    panels: List[Dict[str, Any]]
    layout: Dict[str, Any]
    variables: Dict[str, Any]
    time_range: Dict[str, Any]
    refresh_interval: int
    tags: List[str]
    shared: bool
    created_by: str
    created_at: datetime
    updated_at: datetime

class UnifiedMonitoringSystem:
    """Main unified monitoring system"""
    
    def __init__(self):
        self.metrics: Dict[str, MetricDefinition] = {}
        self.alert_rules: Dict[str, AlertRule] = {}
        self.alerts: Dict[str, Alert] = {}
        self.dashboards: Dict[str, Dashboard] = {}
        
        # Data storage
        self.metric_data: Dict[str, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.alert_history: deque = deque(maxlen=1000)
        
        # Provider clients
        self.provider_clients: Dict[MonitoringProvider, Any] = {}
        
        # Real-time data
        self.real_time_subscribers: List[Any] = []
        self.data_processing_queue = queue.Queue()
        
        # Background processing
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.collection_interval = 30  # seconds
        self.alert_check_interval = 10  # seconds
        self.running = False
        
        # Initialize sample monitoring setup
        self._initialize_sample_monitoring()
    
    def _initialize_sample_monitoring(self):
        """Initialize sample monitoring metrics and alerts"""
        
        # System metrics
        self.add_metric(MetricDefinition(
            id="cpu_utilization",
            name="CPU Utilization",
            type=MetricType.SYSTEM,
            unit="percent",
            description="CPU utilization across all instances",
            provider=MonitoringProvider.PROMETHEUS,
            query='avg(100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100))',
            resource_id=None,
            labels={"metric_type": "system", "category": "compute"},
            aggregation="avg",
            interval=30,
            retention_days=30,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        self.add_metric(MetricDefinition(
            id="memory_utilization",
            name="Memory Utilization",
            type=MetricType.SYSTEM,
            unit="percent",
            description="Memory utilization across all instances",
            provider=MonitoringProvider.PROMETHEUS,
            query='(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
            resource_id=None,
            labels={"metric_type": "system", "category": "memory"},
            aggregation="avg",
            interval=30,
            retention_days=30,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        # Application metrics
        self.add_metric(MetricDefinition(
            id="request_rate",
            name="Request Rate",
            type=MetricType.APPLICATION,
            unit="requests/sec",
            description="HTTP requests per second",
            provider=MonitoringProvider.PROMETHEUS,
            query='sum(rate(http_requests_total[5m]))',
            resource_id=None,
            labels={"metric_type": "application", "category": "performance"},
            aggregation="sum",
            interval=30,
            retention_days=7,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        self.add_metric(MetricDefinition(
            id="error_rate",
            name="Error Rate",
            type=MetricType.APPLICATION,
            unit="percent",
            description="HTTP error rate (4xx/5xx)",
            provider=MonitoringProvider.PROMETHEUS,
            query='sum(rate(http_requests_total{status=~"4..|5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100',
            resource_id=None,
            labels={"metric_type": "application", "category": "errors"},
            aggregation="avg",
            interval=30,
            retention_days=7,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        # Network metrics
        self.add_metric(MetricDefinition(
            id="network_latency",
            name="Network Latency",
            type=MetricType.NETWORK,
            unit="milliseconds",
            description="Network latency between endpoints",
            provider=MonitoringProvider.PROMETHEUS,
            query='avg(network_latency_seconds * 1000)',
            resource_id=None,
            labels={"metric_type": "network", "category": "latency"},
            aggregation="avg",
            interval=30,
            retention_days=7,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        # Database metrics
        self.add_metric(MetricDefinition(
            id="db_connections",
            name="Database Connections",
            type=MetricType.DATABASE,
            unit="connections",
            description="Active database connections",
            provider=MonitoringProvider.PROMETHEUS,
            query='sum(pg_stat_database_numbackends)',
            resource_id=None,
            labels={"metric_type": "database", "category": "connections"},
            aggregation="sum",
            interval=30,
            retention_days=30,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        # Storage metrics
        self.add_metric(MetricDefinition(
            id="disk_usage",
            name="Disk Usage",
            type=MetricType.STORAGE,
            unit="percent",
            description="Disk usage across all volumes",
            provider=MonitoringProvider.PROMETHEUS,
            query='avg((1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100)',
            resource_id=None,
            labels={"metric_type": "storage", "category": "capacity"},
            aggregation="avg",
            interval=60,
            retention_days=30,
            alert_rules=[],
            created_at=datetime.now()
        ))
        
        # Create sample alert rules
        self._create_sample_alert_rules()
        
        # Create sample dashboards
        self._create_sample_dashboards()
    
    def _create_sample_alert_rules(self):
        """Create sample alert rules"""
        
        # High CPU alert
        self.add_alert_rule(AlertRule(
            id="high_cpu_alert",
            name="High CPU Usage",
            metric_id="cpu_utilization",
            condition=">",
            threshold=80.0,
            duration=300,  # 5 minutes
            severity=AlertSeverity.HIGH,
            enabled=True,
            notification_channels=["slack", "email"],
            conditions={"consecutive_breaches": 3},
            created_at=datetime.now(),
            last_triggered=None,
            trigger_count=0
        ))
        
        # High memory alert
        self.add_alert_rule(AlertRule(
            id="high_memory_alert",
            name="High Memory Usage",
            metric_id="memory_utilization",
            condition=">",
            threshold=85.0,
            duration=300,
            severity=AlertSeverity.HIGH,
            enabled=True,
            notification_channels=["slack", "pagerduty"],
            conditions={"consecutive_breaches": 2},
            created_at=datetime.now(),
            last_triggered=None,
            trigger_count=0
        ))
        
        # High error rate alert
        self.add_alert_rule(AlertRule(
            id="high_error_rate_alert",
            name="High Error Rate",
            metric_id="error_rate",
            condition=">",
            threshold=5.0,
            duration=120,  # 2 minutes
            severity=AlertSeverity.CRITICAL,
            enabled=True,
            notification_channels=["slack", "pagerduty", "sms"],
            conditions={"consecutive_breaches": 2},
            created_at=datetime.now(),
            last_triggered=None,
            trigger_count=0
        ))
        
        # Database connection alert
        self.add_alert_rule(AlertRule(
            id="high_db_connections_alert",
            name="High Database Connections",
            metric_id="db_connections",
            condition=">",
            threshold=100.0,
            duration=180,
            severity=AlertSeverity.MEDIUM,
            enabled=True,
            notification_channels=["email"],
            conditions={"consecutive_breaches": 1},
            created_at=datetime.now(),
            last_triggered=None,
            trigger_count=0
        ))
        
        # Disk usage alert
        self.add_alert_rule(AlertRule(
            id="high_disk_usage_alert",
            name="High Disk Usage",
            metric_id="disk_usage",
            condition=">",
            threshold=90.0,
            duration=600,  # 10 minutes
            severity=AlertSeverity.HIGH,
            enabled=True,
            notification_channels=["slack", "email"],
            conditions={"consecutive_breaches": 1},
            created_at=datetime.now(),
            last_triggered=None,
            trigger_count=0
        ))
    
    def _create_sample_dashboards(self):
        """Create sample dashboards"""
        
        # System overview dashboard
        system_dashboard = Dashboard(
            id="system_overview",
            name="System Overview",
            description="High-level system metrics across all environments",
            panels=[
                {
                    "id": "cpu_panel",
                    "title": "CPU Utilization",
                    "type": "graph",
                    "metric_ids": ["cpu_utilization"],
                    "position": {"x": 0, "y": 0, "w": 6, "h": 4}
                },
                {
                    "id": "memory_panel",
                    "title": "Memory Utilization",
                    "type": "graph",
                    "metric_ids": ["memory_utilization"],
                    "position": {"x": 6, "y": 0, "w": 6, "h": 4}
                },
                {
                    "id": "disk_panel",
                    "title": "Disk Usage",
                    "type": "graph",
                    "metric_ids": ["disk_usage"],
                    "position": {"x": 0, "y": 4, "w": 12, "h": 4}
                }
            ],
            layout={"columns": 12, "rows": 8},
            variables={"environment": ["production", "staging", "development"]},
            time_range={"from": "now-1h", "to": "now"},
            refresh_interval=30,
            tags=["system", "overview"],
            shared=True,
            created_by="admin",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.add_dashboard(system_dashboard)
        
        # Application dashboard
        app_dashboard = Dashboard(
            id="application_metrics",
            name="Application Metrics",
            description="Application performance and error metrics",
            panels=[
                {
                    "id": "request_rate_panel",
                    "title": "Request Rate",
                    "type": "graph",
                    "metric_ids": ["request_rate"],
                    "position": {"x": 0, "y": 0, "w": 6, "h": 4}
                },
                {
                    "id": "error_rate_panel",
                    "title": "Error Rate",
                    "type": "graph",
                    "metric_ids": ["error_rate"],
                    "position": {"x": 6, "y": 0, "w": 6, "h": 4}
                },
                {
                    "id": "response_time_panel",
                    "title": "Response Time",
                    "type": "graph",
                    "metric_ids": ["network_latency"],
                    "position": {"x": 0, "y": 4, "w": 12, "h": 4}
                }
            ],
            layout={"columns": 12, "rows": 8},
            variables={"service": ["api", "web", "worker"]},
            time_range={"from": "now-2h", "to": "now"},
            refresh_interval=15,
            tags=["application", "performance"],
            shared=True,
            created_by="devops",
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        self.add_dashboard(app_dashboard)
    
    def add_metric(self, metric: MetricDefinition) -> bool:
        """Add a new metric definition"""
        self.metrics[metric.id] = metric
        print(f"✅ Added metric: {metric.name} ({metric.type.value})")
        return True
    
    def add_alert_rule(self, rule: AlertRule) -> bool:
        """Add a new alert rule"""
        self.alert_rules[rule.id] = rule
        
        # Update metric's alert rules
        if rule.metric_id in self.metrics:
            self.metrics[rule.metric_id].alert_rules.append(rule.id)
        
        print(f"✅ Added alert rule: {rule.name} ({rule.severity.value})")
        return True
    
    def add_dashboard(self, dashboard: Dashboard) -> bool:
        """Add a new dashboard"""
        self.dashboards[dashboard.id] = dashboard
        print(f"✅ Added dashboard: {dashboard.name}")
        return True
    
    def collect_metrics(self) -> Dict[str, List[MetricDataPoint]]:
        """Collect metrics from all providers"""
        collected_data = {}
        
        for metric_id, metric in self.metrics.items():
            try:
                # Simulate metric collection from different providers
                data_points = self._simulate_metric_collection(metric)
                collected_data[metric_id] = data_points
                
                # Store data points
                for point in data_points:
                    self.metric_data[metric_id].append(point)
                
            except Exception as e:
                print(f"❌ Error collecting metric {metric.name}: {e}")
        
        return collected_data
    
    def _simulate_metric_collection(self, metric: MetricDefinition) -> List[MetricDataPoint]:
        """Simulate metric data collection"""
        current_time = datetime.now()
        data_points = []
        
        # Generate realistic data based on metric type
        if metric.id == "cpu_utilization":
            # CPU usage with some variation
            base_value = 45.0
            value = base_value + np.random.normal(0, 10)
            value = max(0, min(100, value))
            
            # Simulate spikes occasionally
            if np.random.random() < 0.1:
                value = min(100, value + np.random.uniform(20, 40))
                
        elif metric.id == "memory_utilization":
            # Memory usage trending upward slowly
            base_value = 65.0 + (current_time.hour * 2)
            value = base_value + np.random.normal(0, 5)
            value = max(0, min(100, value))
            
        elif metric.id == "request_rate":
            # Request rate with diurnal pattern
            hour_factor = 1 + 0.5 * np.sin((current_time.hour - 6) * np.pi / 12)
            base_value = 1000 * hour_factor
            value = base_value + np.random.normal(0, 100)
            value = max(0, value)
            
        elif metric.id == "error_rate":
            # Low error rate with occasional spikes
            base_value = 1.5
            value = base_value + np.random.exponential(0.5)
            
            # Simulate error spikes
            if np.random.random() < 0.05:
                value += np.random.uniform(5, 15)
                
        elif metric.id == "network_latency":
            # Network latency with some jitter
            base_value = 25.0
            value = base_value + np.random.normal(0, 5)
            value = max(0, value)
            
        elif metric.id == "db_connections":
            # Database connections
            base_value = 50 + np.random.poisson(10)
            value = float(base_value)
            
            # Simulate connection leaks occasionally
            if np.random.random() < 0.03:
                value += np.random.uniform(30, 80)
                
        elif metric.id == "disk_usage":
            # Disk usage slowly increasing
            minutes_since_start = (current_time - datetime.now().replace(hour=0, minute=0, second=0)).total_seconds() / 60
            base_value = 70.0 + (minutes_since_start / 1440) * 2  # 2% per day
            value = base_value + np.random.normal(0, 2)
            value = max(0, min(100, value))
            
        else:
            # Default random value
            value = np.random.uniform(0, 100)
        
        # Create data point
        data_point = MetricDataPoint(
            metric_id=metric.id,
            timestamp=current_time,
            value=value,
            labels=metric.labels.copy(),
            resource_id=metric.resource_id,
            provider=metric.provider
        )
        
        data_points.append(data_point)
        return data_points
    
    def evaluate_alerts(self) -> List[Alert]:
        """Evaluate all alert rules against current data"""
        new_alerts = []
        
        for rule_id, rule in self.alert_rules.items():
            if not rule.enabled:
                continue
            
            try:
                # Get recent data for the metric
                metric_data = list(self.metric_data[rule.metric_id])
                if not metric_data:
                    continue
                
                # Get the latest value
                latest_point = metric_data[-1]
                current_value = latest_point.value
                
                # Check condition
                triggered = self._evaluate_condition(current_value, rule.condition, rule.threshold)
                
                if triggered:
                    # Check if we need consecutive breaches
                    consecutive_breaches = rule.conditions.get("consecutive_breaches", 1)
                    if consecutive_breaches > 1:
                        # Check last N values
                        recent_values = [p.value for p in metric_data[-consecutive_breaches:]]
                        if len(recent_values) < consecutive_breaches:
                            continue
                        
                        all_breached = all(
                            self._evaluate_condition(v, rule.condition, rule.threshold)
                            for v in recent_values
                        )
                        
                        if not all_breached:
                            continue
                    
                    # Check if alert already exists and is not resolved
                    existing_alert = None
                    for alert in self.alerts.values():
                        if (alert.rule_id == rule_id and 
                            alert.status in ["triggered", "acknowledged"]):
                            existing_alert = alert
                            break
                    
                    if not existing_alert:
                        # Create new alert
                        alert = Alert(
                            id=f"alert-{hashlib.md5(f'{rule_id}-{time.time()}'.encode()).hexdigest()[:8]}",
                            rule_id=rule_id,
                            metric_id=rule.metric_id,
                            severity=rule.severity,
                            title=rule.name,
                            description=f"{rule.name}: {current_value:.2f} {rule.condition} {rule.threshold}",
                            current_value=current_value,
                            threshold=rule.threshold,
                            resource_id=latest_point.resource_id,
                            provider=latest_point.provider,
                            labels=latest_point.labels,
                            triggered_at=datetime.now(),
                            resolved_at=None,
                            acknowledged_at=None,
                            acknowledged_by=None,
                            status="triggered",
                            annotations={}
                        )
                        
                        self.alerts[alert.id] = alert
                        self.alert_history.append(alert)
                        new_alerts.append(alert)
                        
                        # Update rule
                        rule.last_triggered = datetime.now()
                        rule.trigger_count += 1
                        
                        print(f"🚨 {rule.severity.value.upper()} Alert: {rule.name}")
                        print(f"   Value: {current_value:.2f} {rule.condition} {rule.threshold}")
                
                else:
                    # Check if we should resolve any existing alerts
                    for alert in list(self.alerts.values()):
                        if (alert.rule_id == rule_id and 
                            alert.status == "triggered" and
                            alert.resolved_at is None):
                            
                            alert.status = "resolved"
                            alert.resolved_at = datetime.now()
                            print(f"✅ Resolved alert: {alert.title}")
                
            except Exception as e:
                print(f"❌ Error evaluating alert rule {rule.name}: {e}")
        
        return new_alerts
    
    def _evaluate_condition(self, value: float, condition: str, threshold: float) -> bool:
        """Evaluate alert condition"""
        if condition == ">":
            return value > threshold
        elif condition == ">=":
            return value >= threshold
        elif condition == "<":
            return value < threshold
        elif condition == "<=":
            return value <= threshold
        elif condition == "==":
            return abs(value - threshold) < 0.01
        elif condition == "!=":
            return abs(value - threshold) >= 0.01
        else:
            return False
    
    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert"""
        if alert_id in self.alerts:
            alert = self.alerts[alert_id]
            alert.status = "acknowledged"
            alert.acknowledged_at = datetime.now()
            alert.acknowledged_by = acknowledged_by
            print(f"✅ Alert acknowledged: {alert.title}")
            return True
        return False
    
    def get_dashboard_data(self, dashboard_id: str, time_range: Optional[Dict] = None) -> Dict:
        """Get data for a dashboard"""
        if dashboard_id not in self.dashboards:
            return {"error": "Dashboard not found"}
        
        dashboard = self.dashboards[dashboard_id]
        time_range = time_range or dashboard.time_range
        
        dashboard_data = {
            "dashboard": {
                "id": dashboard.id,
                "name": dashboard.name,
                "description": dashboard.description,
                "time_range": time_range
            },
            "panels": []
        }
        
        for panel in dashboard.panels:
            panel_data = {
                "id": panel["id"],
                "title": panel["title"],
                "type": panel["type"],
                "position": panel["position"],
                "data": []
            }
            
            # Get data for each metric in the panel
            for metric_id in panel["metric_ids"]:
                if metric_id in self.metric_data:
                    # Get recent data points
                    recent_data = list(self.metric_data[metric_id])[-100:]  # Last 100 points
                    
                    metric_data = {
                        "metric_id": metric_id,
                        "metric_name": self.metrics[metric_id].name if metric_id in self.metrics else metric_id,
                        "unit": self.metrics[metric_id].unit if metric_id in self.metrics else "",
                        "datapoints": [
                            {
                                "timestamp": point.timestamp.isoformat(),
                                "value": point.value
                            } for point in recent_data
                        ]
                    }
                    
                    panel_data["data"].append(metric_data)
            
            dashboard_data["panels"].append(panel_data)
        
        return dashboard_data
    
    def get_alerts_summary(self, severity: Optional[AlertSeverity] = None) -> Dict:
        """Get alerts summary"""
        alerts_list = list(self.alerts.values())
        
        if severity:
            alerts_list = [a for a in alerts_list if a.severity == severity]
        
        # Group by status
        alerts_by_status = defaultdict(list)
        for alert in alerts_list:
            alerts_by_status[alert.status].append(alert)
        
        # Group by severity
        alerts_by_severity = defaultdict(int)
        for alert in alerts_list:
            alerts_by_severity[alert.severity.value] += 1
        
        summary = {
            "total_alerts": len(alerts_list),
            "by_status": {
                status: len(alerts) for status, alerts in alerts_by_status.items()
            },
            "by_severity": dict(alerts_by_severity),
            "recent_alerts": [
                {
                    "id": alert.id,
                    "title": alert.title,
                    "severity": alert.severity.value,
                    "status": alert.status,
                    "triggered_at": alert.triggered_at.isoformat(),
                    "current_value": alert.current_value
                }
                for alert in sorted(alerts_list, key=lambda x: x.triggered_at, reverse=True)[:10]
            ]
        }
        
        return summary
    
    def get_metrics_summary(self) -> Dict:
        """Get metrics summary"""
        summary = {
            "total_metrics": len(self.metrics),
            "by_type": defaultdict(int),
            "by_provider": defaultdict(int),
            "data_points": {
                metric_id: len(data) for metric_id, data in self.metric_data.items()
            },
            "recent_values": {}
        }
        
        for metric in self.metrics.values():
            summary["by_type"][metric.type.value] += 1
            summary["by_provider"][metric.provider.value] += 1
        
        # Get latest values
        for metric_id, data in self.metric_data.items():
            if data:
                latest_point = data[-1]
                summary["recent_values"][metric_id] = {
                    "value": latest_point.value,
                    "timestamp": latest_point.timestamp.isoformat(),
                    "unit": self.metrics[metric_id].unit if metric_id in self.metrics else ""
                }
        
        summary["by_type"] = dict(summary["by_type"])
        summary["by_provider"] = dict(summary["by_provider"])
        
        return summary
    
    def start_monitoring(self):
        """Start background monitoring processes"""
        self.running = True
        
        # Start metric collection thread
        collection_thread = threading.Thread(target=self._collection_worker)
        collection_thread.daemon = True
        collection_thread.start()
        
        # Start alert evaluation thread
        alert_thread = threading.Thread(target=self._alert_worker)
        alert_thread.daemon = True
        alert_thread.start()
        
        print("🚀 Monitoring system started")
    
    def stop_monitoring(self):
        """Stop background monitoring processes"""
        self.running = False
        print("⏹️ Monitoring system stopped")
    
    def _collection_worker(self):
        """Background worker for metric collection"""
        while self.running:
            try:
                self.collect_metrics()
                time.sleep(self.collection_interval)
            except Exception as e:
                print(f"❌ Error in collection worker: {e}")
                time.sleep(5)
    
    def _alert_worker(self):
        """Background worker for alert evaluation"""
        while self.running:
            try:
                self.evaluate_alerts()
                time.sleep(self.alert_check_interval)
            except Exception as e:
                print(f"❌ Error in alert worker: {e}")
                time.sleep(5)
    
    def get_system_health(self) -> Dict:
        """Get overall system health status"""
        # Count active alerts by severity
        active_alerts = [a for a in self.alerts.values() if a.status in ["triggered", "acknowledged"]]
        critical_alerts = len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL])
        high_alerts = len([a for a in active_alerts if a.severity == AlertSeverity.HIGH])
        
        # Determine overall health
        if critical_alerts > 0:
            overall_health = "critical"
        elif high_alerts > 2:
            overall_health = "degraded"
        elif len(active_alerts) > 5:
            overall_health = "warning"
        else:
            overall_health = "healthy"
        
        # Get key metric statuses
        key_metrics_status = {}
        key_metrics = ["cpu_utilization", "memory_utilization", "error_rate", "disk_usage"]
        
        for metric_id in key_metrics:
            if metric_id in self.metric_data and self.metric_data[metric_id]:
                latest_value = self.metric_data[metric_id][-1].value
                
                # Simple thresholds for health assessment
                thresholds = {
                    "cpu_utilization": 80,
                    "memory_utilization": 85,
                    "error_rate": 5,
                    "disk_usage": 90
                }
                
                threshold = thresholds.get(metric_id, 80)
                status = "warning" if latest_value > threshold else "healthy"
                
                key_metrics_status[metric_id] = {
                    "value": latest_value,
                    "status": status,
                    "threshold": threshold
                }
        
        return {
            "overall_health": overall_health,
            "active_alerts": len(active_alerts),
            "critical_alerts": critical_alerts,
            "high_alerts": high_alerts,
            "key_metrics": key_metrics_status,
            "monitoring_status": "running" if self.running else "stopped",
            "last_collection": max(
                [max(data, key=lambda x: x.timestamp).timestamp
                 for data in self.metric_data.values() if data],
                default=datetime.now()
            ).isoformat() if any(self.metric_data.values()) else None
        }


def main():
    """Test unified monitoring system"""
    print("📊 Unified Multi-Cloud Monitoring System")
    print("=" * 50)
    
    # Initialize monitoring system
    monitoring = UnifiedMonitoringSystem()
    
    # Display metrics
    print(f"\n📈 Registered Metrics ({len(monitoring.metrics)}):")
    for metric in list(monitoring.metrics.values())[:5]:
        print(f"  - {metric.name} ({metric.type.value})")
        print(f"    Provider: {metric.provider.value}, Unit: {metric.unit}")
        print(f"    Query: {metric.query[:50]}...")
    
    # Display alert rules
    print(f"\n🚨 Alert Rules ({len(monitoring.alert_rules)}):")
    for rule in monitoring.alert_rules.values():
        print(f"  - {rule.name} ({rule.severity.value})")
        print(f"    Condition: {rule.condition} {rule.threshold}")
        print(f"    Enabled: {rule.enabled}")
    
    # Display dashboards
    print(f"\n📋 Dashboards ({len(monitoring.dashboards)}):")
    for dashboard in monitoring.dashboards.values():
        print(f"  - {dashboard.name}")
        print(f"    Panels: {len(dashboard.panels)}, Shared: {dashboard.shared}")
    
    # Start monitoring
    print("\n🚀 Starting monitoring...")
    monitoring.start_monitoring()
    
    # Collect initial metrics
    print("\n📊 Collecting initial metrics...")
    collected_data = monitoring.collect_metrics()
    
    for metric_id, data_points in collected_data.items():
        if data_points:
            latest = data_points[-1]
            metric = monitoring.metrics[metric_id]
            print(f"  {metric.name}: {latest.value:.2f} {metric.unit}")
    
    # Simulate some time passing and collect more data
    print("\n⏰ Simulating data collection over time...")
    for i in range(5):
        time.sleep(2)
        collected_data = monitoring.collect_metrics()
        alerts = monitoring.evaluate_alerts()
        
        if alerts:
            print(f"  🚨 Generated {len(alerts)} new alerts")
    
    # Get system health
    print("\n💓 System Health Status:")
    health = monitoring.get_system_health()
    print(f"  Overall health: {health['overall_health']}")
    print(f"  Active alerts: {health['active_alerts']}")
    print(f"  Critical alerts: {health['critical_alerts']}")
    
    # Display key metrics
    print("\n  Key metrics:")
    for metric_id, status in health["key_metrics"].items():
        print(f"    {metric_id}: {status['value']:.1f} ({status['status']})")
    
    # Get alerts summary
    print("\n🔔 Alerts Summary:")
    alerts_summary = monitoring.get_alerts_summary()
    print(f"  Total alerts: {alerts_summary['total_alerts']}")
    
    for status, count in alerts_summary["by_status"].items():
        print(f"  {status}: {count}")
    
    if alerts_summary["recent_alerts"]:
        print("\n  Recent alerts:")
        for alert in alerts_summary["recent_alerts"][:3]:
            print(f"    - {alert['title']} ({alert['severity']})")
            print(f"      Value: {alert['current_value']:.2f}")
    
    # Get dashboard data
    print("\n📋 Dashboard Data:")
    dashboard_data = monitoring.get_dashboard_data("system_overview")
    
    if "error" not in dashboard_data:
        print(f"  Dashboard: {dashboard_data['dashboard']['name']}")
        print(f"  Panels: {len(dashboard_data['panels'])}")
        
        for panel in dashboard_data["panels"][:2]:
            print(f"    - {panel['title']}: {len(panel['data'])} metrics")
            for metric_data in panel["data"]:
                if metric_data["datapoints"]:
                    latest = metric_data["datapoints"][-1]
                    print(f"      {metric_data['metric_name']}: {latest['value']:.2f} {metric_data['unit']}")
    
    # Get metrics summary
    print("\n📈 Metrics Summary:")
    metrics_summary = monitoring.get_metrics_summary()
    print(f"  Total metrics: {metrics_summary['total_metrics']}")
    
    print("  By type:")
    for metric_type, count in metrics_summary["by_type"].items():
        print(f"    {metric_type}: {count}")
    
    print("  By provider:")
    for provider, count in metrics_summary["by_provider"].items():
        print(f"    {provider}: {count}")
    
    # Stop monitoring
    print("\n⏹️ Stopping monitoring...")
    monitoring.stop_monitoring()
    
    print("\n✅ Unified monitoring system test completed!")


if __name__ == "__main__":
    main()