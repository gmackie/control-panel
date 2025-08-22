import asyncio
import json
import statistics
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
import numpy as np
import pandas as pd
from collections import defaultdict, Counter

class MetricType(Enum):
    SECURITY_EVENTS = "security_events"
    THREAT_DETECTION = "threat_detection"
    INCIDENT_RESPONSE = "incident_response"
    VULNERABILITY_METRICS = "vulnerability_metrics"
    COMPLIANCE_METRICS = "compliance_metrics"
    ACCESS_METRICS = "access_metrics"
    PATCH_METRICS = "patch_metrics"
    RISK_METRICS = "risk_metrics"

class ReportType(Enum):
    EXECUTIVE_DASHBOARD = "executive_dashboard"
    SECURITY_POSTURE = "security_posture"
    INCIDENT_SUMMARY = "incident_summary"
    VULNERABILITY_ASSESSMENT = "vulnerability_assessment"
    COMPLIANCE_STATUS = "compliance_status"
    THREAT_LANDSCAPE = "threat_landscape"
    OPERATIONAL_METRICS = "operational_metrics"
    RISK_ASSESSMENT = "risk_assessment"

class TimeRange(Enum):
    LAST_24_HOURS = "24h"
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    LAST_90_DAYS = "90d"
    LAST_YEAR = "365d"
    CUSTOM = "custom"

@dataclass
class SecurityMetric:
    id: str
    type: MetricType
    name: str
    value: float
    timestamp: datetime
    unit: str
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SecurityEvent:
    id: str
    timestamp: datetime
    event_type: str
    severity: str
    source: str
    target: Optional[str]
    user: Optional[str]
    outcome: str  # success, failure, blocked
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class AnalyticsQuery:
    id: str
    name: str
    description: str
    query_type: str
    parameters: Dict[str, Any]
    created_at: datetime
    last_run: Optional[datetime] = None
    schedule: Optional[str] = None  # cron expression
    alert_threshold: Optional[float] = None

@dataclass
class SecurityReport:
    id: str
    type: ReportType
    title: str
    generated_at: datetime
    time_range: TimeRange
    sections: Dict[str, Any]
    metrics: List[SecurityMetric]
    charts: List[Dict[str, Any]]
    recommendations: List[str]
    executive_summary: str

@dataclass
class SecurityTrend:
    metric_name: str
    time_series: List[Tuple[datetime, float]]
    trend_direction: str  # increasing, decreasing, stable
    change_percentage: float
    forecast: Optional[List[Tuple[datetime, float]]] = None
    anomalies: List[Tuple[datetime, float]] = field(default_factory=list)

class MetricsCollector:
    def __init__(self):
        self.metrics_buffer = []
        self.aggregation_rules = self._initialize_aggregation_rules()
        
    def _initialize_aggregation_rules(self) -> Dict[str, Dict]:
        return {
            'security_events': {
                'aggregation': 'count',
                'group_by': ['event_type', 'severity'],
                'time_bucket': '1h'
            },
            'threat_detection': {
                'aggregation': 'sum',
                'group_by': ['threat_type'],
                'time_bucket': '1h'
            },
            'response_time': {
                'aggregation': 'avg',
                'group_by': ['incident_type'],
                'time_bucket': '1d'
            }
        }
        
    async def collect_metric(self, metric: SecurityMetric):
        self.metrics_buffer.append(metric)
        
        # Keep buffer size manageable
        if len(self.metrics_buffer) > 100000:
            self.metrics_buffer = self.metrics_buffer[-50000:]
            
    async def get_metrics(self, metric_type: MetricType, 
                         time_range: TimeRange) -> List[SecurityMetric]:
        start_time = self._get_start_time(time_range)
        
        return [
            m for m in self.metrics_buffer
            if m.type == metric_type and m.timestamp >= start_time
        ]
        
    def _get_start_time(self, time_range: TimeRange) -> datetime:
        now = datetime.now()
        
        if time_range == TimeRange.LAST_24_HOURS:
            return now - timedelta(hours=24)
        elif time_range == TimeRange.LAST_7_DAYS:
            return now - timedelta(days=7)
        elif time_range == TimeRange.LAST_30_DAYS:
            return now - timedelta(days=30)
        elif time_range == TimeRange.LAST_90_DAYS:
            return now - timedelta(days=90)
        elif time_range == TimeRange.LAST_YEAR:
            return now - timedelta(days=365)
        else:
            return now - timedelta(days=30)
            
    async def aggregate_metrics(self, metrics: List[SecurityMetric], 
                              aggregation_type: str = 'sum') -> float:
        if not metrics:
            return 0.0
            
        values = [m.value for m in metrics]
        
        if aggregation_type == 'sum':
            return sum(values)
        elif aggregation_type == 'avg':
            return statistics.mean(values)
        elif aggregation_type == 'max':
            return max(values)
        elif aggregation_type == 'min':
            return min(values)
        elif aggregation_type == 'count':
            return len(values)
        else:
            return 0.0

class TrendAnalyzer:
    def __init__(self):
        self.anomaly_threshold = 2.5  # Standard deviations
        
    def analyze_trend(self, metrics: List[SecurityMetric]) -> SecurityTrend:
        if not metrics:
            return SecurityTrend(
                metric_name="unknown",
                time_series=[],
                trend_direction="stable",
                change_percentage=0.0
            )
            
        # Sort by timestamp
        sorted_metrics = sorted(metrics, key=lambda m: m.timestamp)
        
        # Create time series
        time_series = [(m.timestamp, m.value) for m in sorted_metrics]
        
        # Calculate trend
        values = [v for _, v in time_series]
        
        if len(values) < 2:
            trend_direction = "stable"
            change_percentage = 0.0
        else:
            first_half_avg = statistics.mean(values[:len(values)//2])
            second_half_avg = statistics.mean(values[len(values)//2:])
            
            change_percentage = ((second_half_avg - first_half_avg) / first_half_avg * 100) if first_half_avg != 0 else 0
            
            if change_percentage > 10:
                trend_direction = "increasing"
            elif change_percentage < -10:
                trend_direction = "decreasing"
            else:
                trend_direction = "stable"
                
        # Detect anomalies
        anomalies = self._detect_anomalies(time_series)
        
        # Generate forecast
        forecast = self._generate_forecast(time_series)
        
        return SecurityTrend(
            metric_name=metrics[0].name if metrics else "unknown",
            time_series=time_series,
            trend_direction=trend_direction,
            change_percentage=change_percentage,
            forecast=forecast,
            anomalies=anomalies
        )
        
    def _detect_anomalies(self, time_series: List[Tuple[datetime, float]]) -> List[Tuple[datetime, float]]:
        if len(time_series) < 10:
            return []
            
        values = [v for _, v in time_series]
        mean = statistics.mean(values)
        std_dev = statistics.stdev(values)
        
        anomalies = []
        for timestamp, value in time_series:
            z_score = (value - mean) / std_dev if std_dev != 0 else 0
            if abs(z_score) > self.anomaly_threshold:
                anomalies.append((timestamp, value))
                
        return anomalies
        
    def _generate_forecast(self, time_series: List[Tuple[datetime, float]], 
                          periods: int = 7) -> List[Tuple[datetime, float]]:
        if len(time_series) < 3:
            return []
            
        # Simple linear regression forecast
        values = [v for _, v in time_series[-30:]]  # Use last 30 points
        
        # Calculate trend
        x = list(range(len(values)))
        y = values
        
        # Linear regression coefficients
        n = len(x)
        if n == 0:
            return []
            
        sum_x = sum(x)
        sum_y = sum(y)
        sum_xx = sum(xi * xi for xi in x)
        sum_xy = sum(xi * yi for xi, yi in zip(x, y))
        
        denominator = n * sum_xx - sum_x * sum_x
        if denominator == 0:
            return []
            
        slope = (n * sum_xy - sum_x * sum_y) / denominator
        intercept = (sum_y - slope * sum_x) / n
        
        # Generate forecast
        last_timestamp = time_series[-1][0]
        forecast = []
        
        for i in range(1, periods + 1):
            future_timestamp = last_timestamp + timedelta(days=i)
            future_value = slope * (n + i) + intercept
            forecast.append((future_timestamp, max(0, future_value)))  # Ensure non-negative
            
        return forecast

class RiskScoreCalculator:
    def __init__(self):
        self.risk_factors = {
            'critical_vulnerabilities': 10.0,
            'high_vulnerabilities': 5.0,
            'medium_vulnerabilities': 2.0,
            'low_vulnerabilities': 0.5,
            'active_incidents': 8.0,
            'failed_auth_attempts': 3.0,
            'policy_violations': 4.0,
            'unpatched_systems': 6.0,
            'compliance_gaps': 7.0
        }
        
    def calculate_overall_risk_score(self, metrics: Dict[str, float]) -> Dict[str, Any]:
        weighted_score = 0.0
        contributing_factors = {}
        
        for factor, weight in self.risk_factors.items():
            if factor in metrics:
                contribution = metrics[factor] * weight
                weighted_score += contribution
                contributing_factors[factor] = {
                    'value': metrics[factor],
                    'weight': weight,
                    'contribution': contribution
                }
                
        # Normalize to 0-100 scale
        normalized_score = min(100, weighted_score)
        
        # Determine risk level
        if normalized_score >= 80:
            risk_level = "critical"
        elif normalized_score >= 60:
            risk_level = "high"
        elif normalized_score >= 40:
            risk_level = "medium"
        elif normalized_score >= 20:
            risk_level = "low"
        else:
            risk_level = "minimal"
            
        return {
            'overall_score': normalized_score,
            'risk_level': risk_level,
            'contributing_factors': contributing_factors,
            'timestamp': datetime.now().isoformat()
        }
        
    def calculate_asset_risk_score(self, asset_metrics: Dict[str, Any]) -> float:
        base_score = 0.0
        
        # Vulnerability scoring
        vuln_score = (
            asset_metrics.get('critical_vulns', 0) * 4 +
            asset_metrics.get('high_vulns', 0) * 3 +
            asset_metrics.get('medium_vulns', 0) * 2 +
            asset_metrics.get('low_vulns', 0) * 1
        )
        
        # Exposure scoring
        exposure_score = 0.0
        if asset_metrics.get('internet_facing', False):
            exposure_score += 3.0
        if asset_metrics.get('contains_pii', False):
            exposure_score += 2.0
        if asset_metrics.get('business_critical', False):
            exposure_score += 2.5
            
        # Activity scoring
        activity_score = (
            asset_metrics.get('failed_logins', 0) * 0.5 +
            asset_metrics.get('suspicious_activities', 0) * 2
        )
        
        # Calculate final score
        base_score = vuln_score + exposure_score + activity_score
        
        # Apply time-based decay (newer issues are more critical)
        days_since_scan = asset_metrics.get('days_since_scan', 0)
        decay_factor = 1.0 + (days_since_scan * 0.01)  # 1% increase per day
        
        return min(100, base_score * decay_factor)

class ReportGenerator:
    def __init__(self, metrics_collector: MetricsCollector, 
                 trend_analyzer: TrendAnalyzer,
                 risk_calculator: RiskScoreCalculator):
        self.metrics_collector = metrics_collector
        self.trend_analyzer = trend_analyzer
        self.risk_calculator = risk_calculator
        self.report_templates = self._load_report_templates()
        
    def _load_report_templates(self) -> Dict[ReportType, Dict]:
        return {
            ReportType.EXECUTIVE_DASHBOARD: {
                'sections': [
                    'risk_overview',
                    'key_metrics',
                    'incident_summary',
                    'compliance_status',
                    'recommendations'
                ],
                'charts': ['risk_trend', 'incident_distribution', 'vulnerability_breakdown']
            },
            ReportType.SECURITY_POSTURE: {
                'sections': [
                    'overall_health',
                    'vulnerability_status',
                    'patch_status',
                    'configuration_compliance',
                    'security_controls'
                ],
                'charts': ['posture_score_trend', 'control_effectiveness', 'coverage_gaps']
            },
            ReportType.THREAT_LANDSCAPE: {
                'sections': [
                    'threat_overview',
                    'attack_patterns',
                    'targeted_assets',
                    'threat_actors',
                    'mitigation_status'
                ],
                'charts': ['threat_timeline', 'attack_vectors', 'geographic_distribution']
            }
        }
        
    async def generate_report(self, report_type: ReportType, 
                            time_range: TimeRange) -> SecurityReport:
        template = self.report_templates.get(report_type)
        
        # Collect relevant metrics
        all_metrics = []
        for metric_type in MetricType:
            metrics = await self.metrics_collector.get_metrics(metric_type, time_range)
            all_metrics.extend(metrics)
            
        # Generate sections
        sections = {}
        for section_name in template['sections']:
            sections[section_name] = await self._generate_section(
                section_name, all_metrics, time_range
            )
            
        # Generate charts
        charts = []
        for chart_name in template['charts']:
            chart_data = await self._generate_chart_data(
                chart_name, all_metrics, time_range
            )
            charts.append(chart_data)
            
        # Generate executive summary
        executive_summary = await self._generate_executive_summary(
            sections, all_metrics, time_range
        )
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(
            sections, all_metrics
        )
        
        return SecurityReport(
            id=str(uuid.uuid4()),
            type=report_type,
            title=f"{report_type.value.replace('_', ' ').title()} Report",
            generated_at=datetime.now(),
            time_range=time_range,
            sections=sections,
            metrics=all_metrics[:100],  # Include sample metrics
            charts=charts,
            recommendations=recommendations,
            executive_summary=executive_summary
        )
        
    async def _generate_section(self, section_name: str, 
                              metrics: List[SecurityMetric],
                              time_range: TimeRange) -> Dict[str, Any]:
        generators = {
            'risk_overview': self._generate_risk_overview,
            'key_metrics': self._generate_key_metrics,
            'incident_summary': self._generate_incident_summary,
            'compliance_status': self._generate_compliance_status,
            'overall_health': self._generate_overall_health,
            'vulnerability_status': self._generate_vulnerability_status,
            'threat_overview': self._generate_threat_overview
        }
        
        generator = generators.get(section_name, self._generate_default_section)
        return await generator(metrics, time_range)
        
    async def _generate_risk_overview(self, metrics: List[SecurityMetric], 
                                    time_range: TimeRange) -> Dict[str, Any]:
        # Calculate risk metrics
        risk_metrics = {
            'critical_vulnerabilities': len([m for m in metrics 
                                           if m.type == MetricType.VULNERABILITY_METRICS 
                                           and 'critical' in m.tags]),
            'active_incidents': len([m for m in metrics 
                                   if m.type == MetricType.INCIDENT_RESPONSE 
                                   and 'active' in m.tags]),
            'failed_auth_attempts': len([m for m in metrics 
                                       if m.type == MetricType.ACCESS_METRICS 
                                       and 'failed' in m.tags])
        }
        
        risk_score = self.risk_calculator.calculate_overall_risk_score(risk_metrics)
        
        # Analyze trend
        risk_trend = self.trend_analyzer.analyze_trend(
            [m for m in metrics if 'risk_score' in m.tags]
        )
        
        return {
            'current_risk_score': risk_score['overall_score'],
            'risk_level': risk_score['risk_level'],
            'risk_trend': risk_trend.trend_direction,
            'change_24h': risk_trend.change_percentage,
            'top_risk_factors': list(risk_score['contributing_factors'].keys())[:5]
        }
        
    async def _generate_key_metrics(self, metrics: List[SecurityMetric], 
                                  time_range: TimeRange) -> Dict[str, Any]:
        return {
            'total_events': len([m for m in metrics if m.type == MetricType.SECURITY_EVENTS]),
            'threats_detected': len([m for m in metrics if m.type == MetricType.THREAT_DETECTION]),
            'incidents_resolved': len([m for m in metrics 
                                    if m.type == MetricType.INCIDENT_RESPONSE 
                                    and 'resolved' in m.tags]),
            'mean_time_to_respond': await self._calculate_mttr(metrics),
            'patch_compliance': await self._calculate_patch_compliance(metrics),
            'security_score': await self._calculate_security_score(metrics)
        }
        
    async def _generate_incident_summary(self, metrics: List[SecurityMetric], 
                                       time_range: TimeRange) -> Dict[str, Any]:
        incident_metrics = [m for m in metrics if m.type == MetricType.INCIDENT_RESPONSE]
        
        severity_distribution = Counter()
        for metric in incident_metrics:
            if 'severity' in metric.metadata:
                severity_distribution[metric.metadata['severity']] += 1
                
        return {
            'total_incidents': len(incident_metrics),
            'critical_incidents': severity_distribution.get('critical', 0),
            'high_incidents': severity_distribution.get('high', 0),
            'resolved_incidents': len([m for m in incident_metrics if 'resolved' in m.tags]),
            'average_resolution_time': await self._calculate_avg_resolution_time(incident_metrics),
            'top_incident_types': dict(Counter([m.metadata.get('type', 'unknown') 
                                              for m in incident_metrics]).most_common(5))
        }
        
    async def _generate_compliance_status(self, metrics: List[SecurityMetric], 
                                        time_range: TimeRange) -> Dict[str, Any]:
        compliance_metrics = [m for m in metrics if m.type == MetricType.COMPLIANCE_METRICS]
        
        framework_scores = {}
        for metric in compliance_metrics:
            framework = metric.metadata.get('framework', 'unknown')
            if framework not in framework_scores:
                framework_scores[framework] = []
            framework_scores[framework].append(metric.value)
            
        framework_averages = {
            framework: statistics.mean(scores) if scores else 0
            for framework, scores in framework_scores.items()
        }
        
        return {
            'overall_compliance': statistics.mean(framework_averages.values()) if framework_averages else 0,
            'framework_scores': framework_averages,
            'compliance_gaps': len([m for m in compliance_metrics if m.value < 0.8]),
            'next_audit_date': (datetime.now() + timedelta(days=30)).isoformat()
        }
        
    async def _generate_overall_health(self, metrics: List[SecurityMetric], 
                                     time_range: TimeRange) -> Dict[str, Any]:
        health_score = await self._calculate_security_score(metrics)
        
        return {
            'security_health_score': health_score,
            'health_status': 'healthy' if health_score > 80 else 'needs_attention' if health_score > 60 else 'critical',
            'systems_monitored': len(set(m.metadata.get('system_id') for m in metrics if 'system_id' in m.metadata)),
            'coverage_percentage': 95.0,  # Placeholder
            'last_assessment': datetime.now().isoformat()
        }
        
    async def _generate_vulnerability_status(self, metrics: List[SecurityMetric], 
                                           time_range: TimeRange) -> Dict[str, Any]:
        vuln_metrics = [m for m in metrics if m.type == MetricType.VULNERABILITY_METRICS]
        
        severity_counts = Counter()
        for metric in vuln_metrics:
            if 'severity' in metric.metadata:
                severity_counts[metric.metadata['severity']] += 1
                
        return {
            'total_vulnerabilities': len(vuln_metrics),
            'critical': severity_counts.get('critical', 0),
            'high': severity_counts.get('high', 0),
            'medium': severity_counts.get('medium', 0),
            'low': severity_counts.get('low', 0),
            'patched_last_30_days': len([m for m in vuln_metrics 
                                       if 'patched' in m.tags and 
                                       m.timestamp > datetime.now() - timedelta(days=30)]),
            'mean_time_to_patch': await self._calculate_mean_time_to_patch(vuln_metrics)
        }
        
    async def _generate_threat_overview(self, metrics: List[SecurityMetric], 
                                      time_range: TimeRange) -> Dict[str, Any]:
        threat_metrics = [m for m in metrics if m.type == MetricType.THREAT_DETECTION]
        
        threat_types = Counter()
        for metric in threat_metrics:
            if 'threat_type' in metric.metadata:
                threat_types[metric.metadata['threat_type']] += 1
                
        return {
            'total_threats_detected': len(threat_metrics),
            'threats_blocked': len([m for m in threat_metrics if 'blocked' in m.tags]),
            'threat_types': dict(threat_types.most_common()),
            'top_targeted_assets': await self._get_top_targeted_assets(threat_metrics),
            'threat_trend': self.trend_analyzer.analyze_trend(threat_metrics).trend_direction
        }
        
    async def _generate_default_section(self, metrics: List[SecurityMetric], 
                                      time_range: TimeRange) -> Dict[str, Any]:
        return {
            'message': 'Section data not available',
            'metric_count': len(metrics)
        }
        
    async def _generate_chart_data(self, chart_name: str, 
                                 metrics: List[SecurityMetric],
                                 time_range: TimeRange) -> Dict[str, Any]:
        chart_generators = {
            'risk_trend': self._generate_risk_trend_chart,
            'incident_distribution': self._generate_incident_distribution_chart,
            'vulnerability_breakdown': self._generate_vulnerability_breakdown_chart,
            'threat_timeline': self._generate_threat_timeline_chart
        }
        
        generator = chart_generators.get(chart_name, self._generate_default_chart)
        return await generator(metrics, time_range)
        
    async def _generate_risk_trend_chart(self, metrics: List[SecurityMetric], 
                                       time_range: TimeRange) -> Dict[str, Any]:
        risk_metrics = [m for m in metrics if 'risk_score' in m.tags]
        trend = self.trend_analyzer.analyze_trend(risk_metrics)
        
        return {
            'type': 'line',
            'title': 'Risk Score Trend',
            'data': {
                'labels': [ts.isoformat() for ts, _ in trend.time_series[-30:]],
                'datasets': [{
                    'label': 'Risk Score',
                    'data': [value for _, value in trend.time_series[-30:]]
                }]
            }
        }
        
    async def _generate_incident_distribution_chart(self, metrics: List[SecurityMetric], 
                                                  time_range: TimeRange) -> Dict[str, Any]:
        incident_metrics = [m for m in metrics if m.type == MetricType.INCIDENT_RESPONSE]
        
        severity_counts = Counter()
        for metric in incident_metrics:
            severity_counts[metric.metadata.get('severity', 'unknown')] += 1
            
        return {
            'type': 'pie',
            'title': 'Incident Distribution by Severity',
            'data': {
                'labels': list(severity_counts.keys()),
                'datasets': [{
                    'data': list(severity_counts.values())
                }]
            }
        }
        
    async def _generate_vulnerability_breakdown_chart(self, metrics: List[SecurityMetric], 
                                                    time_range: TimeRange) -> Dict[str, Any]:
        vuln_metrics = [m for m in metrics if m.type == MetricType.VULNERABILITY_METRICS]
        
        severity_counts = Counter()
        for metric in vuln_metrics:
            severity_counts[metric.metadata.get('severity', 'unknown')] += 1
            
        return {
            'type': 'bar',
            'title': 'Vulnerability Breakdown',
            'data': {
                'labels': ['Critical', 'High', 'Medium', 'Low'],
                'datasets': [{
                    'label': 'Count',
                    'data': [
                        severity_counts.get('critical', 0),
                        severity_counts.get('high', 0),
                        severity_counts.get('medium', 0),
                        severity_counts.get('low', 0)
                    ]
                }]
            }
        }
        
    async def _generate_threat_timeline_chart(self, metrics: List[SecurityMetric], 
                                            time_range: TimeRange) -> Dict[str, Any]:
        threat_metrics = [m for m in metrics if m.type == MetricType.THREAT_DETECTION]
        
        # Group by day
        daily_counts = defaultdict(int)
        for metric in threat_metrics:
            day = metric.timestamp.date()
            daily_counts[day] += 1
            
        sorted_days = sorted(daily_counts.keys())[-30:]  # Last 30 days
        
        return {
            'type': 'line',
            'title': 'Threat Detection Timeline',
            'data': {
                'labels': [day.isoformat() for day in sorted_days],
                'datasets': [{
                    'label': 'Threats Detected',
                    'data': [daily_counts[day] for day in sorted_days]
                }]
            }
        }
        
    async def _generate_default_chart(self, metrics: List[SecurityMetric], 
                                    time_range: TimeRange) -> Dict[str, Any]:
        return {
            'type': 'empty',
            'title': 'Chart Not Available',
            'data': {}
        }
        
    async def _generate_executive_summary(self, sections: Dict[str, Any], 
                                        metrics: List[SecurityMetric],
                                        time_range: TimeRange) -> str:
        risk_level = sections.get('risk_overview', {}).get('risk_level', 'unknown')
        total_incidents = sections.get('incident_summary', {}).get('total_incidents', 0)
        compliance_score = sections.get('compliance_status', {}).get('overall_compliance', 0)
        
        summary = f"""
Security Executive Summary - {time_range.value}

Current Risk Level: {risk_level.upper()}

Key Highlights:
• Processed {len(metrics)} security events during the reporting period
• Detected and responded to {total_incidents} security incidents
• Overall compliance score: {compliance_score:.1%}
• Security posture trending: {sections.get('risk_overview', {}).get('risk_trend', 'stable')}

Areas requiring immediate attention have been identified in the recommendations section.
        """.strip()
        
        return summary
        
    async def _generate_recommendations(self, sections: Dict[str, Any], 
                                      metrics: List[SecurityMetric]) -> List[str]:
        recommendations = []
        
        # Risk-based recommendations
        risk_level = sections.get('risk_overview', {}).get('risk_level', 'low')
        if risk_level in ['critical', 'high']:
            recommendations.append("Immediate action required to address critical risk factors")
            
        # Vulnerability-based recommendations
        vuln_status = sections.get('vulnerability_status', {})
        if vuln_status.get('critical', 0) > 0:
            recommendations.append(f"Patch {vuln_status['critical']} critical vulnerabilities immediately")
            
        # Compliance-based recommendations
        compliance = sections.get('compliance_status', {})
        if compliance.get('overall_compliance', 100) < 80:
            recommendations.append("Review and address compliance gaps to meet regulatory requirements")
            
        # Incident-based recommendations
        incidents = sections.get('incident_summary', {})
        if incidents.get('average_resolution_time', 0) > 24:
            recommendations.append("Improve incident response processes to reduce resolution time")
            
        # Default recommendations if none specific
        if not recommendations:
            recommendations.append("Continue monitoring and maintain current security posture")
            recommendations.append("Schedule regular security assessments and reviews")
            
        return recommendations[:5]  # Limit to top 5 recommendations
        
    async def _calculate_mttr(self, metrics: List[SecurityMetric]) -> float:
        response_times = [m.value for m in metrics 
                         if m.type == MetricType.INCIDENT_RESPONSE 
                         and 'response_time' in m.tags]
        return statistics.mean(response_times) if response_times else 0.0
        
    async def _calculate_patch_compliance(self, metrics: List[SecurityMetric]) -> float:
        patch_metrics = [m for m in metrics if m.type == MetricType.PATCH_METRICS]
        if not patch_metrics:
            return 0.0
            
        patched = len([m for m in patch_metrics if 'deployed' in m.tags])
        total = len(patch_metrics)
        
        return (patched / total * 100) if total > 0 else 0.0
        
    async def _calculate_security_score(self, metrics: List[SecurityMetric]) -> float:
        # Weighted scoring based on different factors
        scores = {
            'vulnerability': 25.0,
            'compliance': 25.0,
            'incident': 20.0,
            'patch': 15.0,
            'threat': 15.0
        }
        
        total_score = 0.0
        
        # Calculate vulnerability score
        vuln_metrics = [m for m in metrics if m.type == MetricType.VULNERABILITY_METRICS]
        critical_vulns = len([m for m in vuln_metrics if 'critical' in m.tags])
        vuln_score = max(0, scores['vulnerability'] - (critical_vulns * 5))
        total_score += vuln_score
        
        # Calculate compliance score
        compliance_metrics = [m for m in metrics if m.type == MetricType.COMPLIANCE_METRICS]
        if compliance_metrics:
            avg_compliance = statistics.mean([m.value for m in compliance_metrics])
            total_score += scores['compliance'] * avg_compliance
            
        # Calculate incident score
        incident_metrics = [m for m in metrics if m.type == MetricType.INCIDENT_RESPONSE]
        unresolved = len([m for m in incident_metrics if 'active' in m.tags])
        incident_score = max(0, scores['incident'] - (unresolved * 2))
        total_score += incident_score
        
        # Calculate patch score
        patch_compliance = await self._calculate_patch_compliance(metrics)
        total_score += scores['patch'] * (patch_compliance / 100)
        
        # Calculate threat score
        threat_metrics = [m for m in metrics if m.type == MetricType.THREAT_DETECTION]
        blocked_threats = len([m for m in threat_metrics if 'blocked' in m.tags])
        total_threats = len(threat_metrics)
        if total_threats > 0:
            threat_score = scores['threat'] * (blocked_threats / total_threats)
            total_score += threat_score
            
        return min(100, total_score)
        
    async def _calculate_avg_resolution_time(self, metrics: List[SecurityMetric]) -> float:
        resolution_times = [m.value for m in metrics if 'resolution_time' in m.metadata]
        return statistics.mean(resolution_times) if resolution_times else 0.0
        
    async def _calculate_mean_time_to_patch(self, metrics: List[SecurityMetric]) -> float:
        patch_times = [m.metadata.get('time_to_patch', 0) for m in metrics 
                      if 'patched' in m.tags and 'time_to_patch' in m.metadata]
        return statistics.mean(patch_times) if patch_times else 0.0
        
    async def _get_top_targeted_assets(self, metrics: List[SecurityMetric], 
                                     limit: int = 5) -> List[str]:
        asset_counts = Counter()
        for metric in metrics:
            if 'target_asset' in metric.metadata:
                asset_counts[metric.metadata['target_asset']] += 1
                
        return [asset for asset, _ in asset_counts.most_common(limit)]

class SecurityAnalyticsReportingSystem:
    def __init__(self):
        self.metrics_collector = MetricsCollector()
        self.trend_analyzer = TrendAnalyzer()
        self.risk_calculator = RiskScoreCalculator()
        self.report_generator = ReportGenerator(
            self.metrics_collector,
            self.trend_analyzer,
            self.risk_calculator
        )
        self.scheduled_reports = {}
        self.queries = {}
        
    async def initialize(self):
        # Generate sample metrics for demonstration
        await self._generate_sample_metrics()
        
        # Schedule default reports
        await self._schedule_default_reports()
        
    async def _generate_sample_metrics(self):
        # Generate various types of metrics
        now = datetime.now()
        
        for i in range(100):
            # Security events
            await self.metrics_collector.collect_metric(SecurityMetric(
                id=str(uuid.uuid4()),
                type=MetricType.SECURITY_EVENTS,
                name="login_attempt",
                value=1.0,
                timestamp=now - timedelta(hours=i),
                unit="count",
                tags=["authentication", "success" if i % 3 != 0 else "failed"]
            ))
            
            # Vulnerability metrics
            if i % 5 == 0:
                await self.metrics_collector.collect_metric(SecurityMetric(
                    id=str(uuid.uuid4()),
                    type=MetricType.VULNERABILITY_METRICS,
                    name="vulnerability_discovered",
                    value=float(i % 10),
                    timestamp=now - timedelta(hours=i * 2),
                    unit="score",
                    tags=["critical" if i % 10 > 7 else "high" if i % 10 > 5 else "medium"],
                    metadata={'severity': 'critical' if i % 10 > 7 else 'high'}
                ))
                
            # Risk metrics
            await self.metrics_collector.collect_metric(SecurityMetric(
                id=str(uuid.uuid4()),
                type=MetricType.RISK_METRICS,
                name="risk_score",
                value=50 + (i % 30),
                timestamp=now - timedelta(hours=i),
                unit="score",
                tags=["risk_score"]
            ))
            
    async def _schedule_default_reports(self):
        # Schedule daily executive dashboard
        self.scheduled_reports['daily_executive'] = {
            'report_type': ReportType.EXECUTIVE_DASHBOARD,
            'time_range': TimeRange.LAST_24_HOURS,
            'schedule': 'daily',
            'next_run': datetime.now() + timedelta(days=1)
        }
        
        # Schedule weekly security posture report
        self.scheduled_reports['weekly_posture'] = {
            'report_type': ReportType.SECURITY_POSTURE,
            'time_range': TimeRange.LAST_7_DAYS,
            'schedule': 'weekly',
            'next_run': datetime.now() + timedelta(days=7)
        }
        
    async def collect_event(self, event: SecurityEvent):
        # Convert event to metric
        metric = SecurityMetric(
            id=str(uuid.uuid4()),
            type=MetricType.SECURITY_EVENTS,
            name=event.event_type,
            value=1.0,
            timestamp=event.timestamp,
            unit="count",
            tags=[event.severity, event.outcome],
            metadata={
                'source': event.source,
                'target': event.target,
                'user': event.user,
                'details': event.details
            }
        )
        
        await self.metrics_collector.collect_metric(metric)
        
    async def generate_report(self, report_type: ReportType, 
                            time_range: TimeRange = TimeRange.LAST_24_HOURS) -> SecurityReport:
        return await self.report_generator.generate_report(report_type, time_range)
        
    async def get_real_time_dashboard(self) -> Dict[str, Any]:
        # Get metrics for last hour
        recent_metrics = await self.metrics_collector.get_metrics(
            MetricType.SECURITY_EVENTS,
            TimeRange.LAST_24_HOURS
        )
        
        # Calculate real-time statistics
        last_hour_metrics = [
            m for m in recent_metrics 
            if m.timestamp > datetime.now() - timedelta(hours=1)
        ]
        
        # Calculate risk score
        risk_metrics = {
            'critical_vulnerabilities': len([m for m in recent_metrics 
                                           if m.type == MetricType.VULNERABILITY_METRICS 
                                           and 'critical' in m.tags]),
            'active_incidents': len([m for m in recent_metrics 
                                   if m.type == MetricType.INCIDENT_RESPONSE 
                                   and 'active' in m.tags]),
            'failed_auth_attempts': len([m for m in last_hour_metrics 
                                       if 'failed' in m.tags])
        }
        
        current_risk = self.risk_calculator.calculate_overall_risk_score(risk_metrics)
        
        return {
            'timestamp': datetime.now().isoformat(),
            'risk_score': current_risk['overall_score'],
            'risk_level': current_risk['risk_level'],
            'events_last_hour': len(last_hour_metrics),
            'active_threats': len([m for m in recent_metrics 
                                 if m.type == MetricType.THREAT_DETECTION 
                                 and 'active' in m.tags]),
            'systems_healthy': 95,  # Placeholder
            'alerts_triggered': len([m for m in last_hour_metrics if 'alert' in m.tags])
        }
        
    async def create_custom_query(self, name: str, description: str, 
                                query_type: str, parameters: Dict[str, Any]) -> str:
        query = AnalyticsQuery(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            query_type=query_type,
            parameters=parameters,
            created_at=datetime.now()
        )
        
        self.queries[query.id] = query
        return query.id
        
    async def execute_query(self, query_id: str) -> Dict[str, Any]:
        if query_id not in self.queries:
            return {'error': 'Query not found'}
            
        query = self.queries[query_id]
        query.last_run = datetime.now()
        
        # Execute based on query type
        if query.query_type == 'metric_aggregation':
            return await self._execute_metric_aggregation(query.parameters)
        elif query.query_type == 'trend_analysis':
            return await self._execute_trend_analysis(query.parameters)
        elif query.query_type == 'anomaly_detection':
            return await self._execute_anomaly_detection(query.parameters)
        else:
            return {'error': 'Unknown query type'}
            
    async def _execute_metric_aggregation(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        metric_type = MetricType(parameters.get('metric_type', 'security_events'))
        time_range = TimeRange(parameters.get('time_range', '24h'))
        aggregation = parameters.get('aggregation', 'sum')
        
        metrics = await self.metrics_collector.get_metrics(metric_type, time_range)
        result = await self.metrics_collector.aggregate_metrics(metrics, aggregation)
        
        return {
            'result': result,
            'metric_count': len(metrics),
            'aggregation_type': aggregation
        }
        
    async def _execute_trend_analysis(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        metric_type = MetricType(parameters.get('metric_type', 'security_events'))
        time_range = TimeRange(parameters.get('time_range', '7d'))
        
        metrics = await self.metrics_collector.get_metrics(metric_type, time_range)
        trend = self.trend_analyzer.analyze_trend(metrics)
        
        return {
            'trend_direction': trend.trend_direction,
            'change_percentage': trend.change_percentage,
            'anomalies_detected': len(trend.anomalies),
            'forecast_available': len(trend.forecast) > 0
        }
        
    async def _execute_anomaly_detection(self, parameters: Dict[str, Any]) -> Dict[str, Any]:
        metric_type = MetricType(parameters.get('metric_type', 'security_events'))
        time_range = TimeRange(parameters.get('time_range', '24h'))
        
        metrics = await self.metrics_collector.get_metrics(metric_type, time_range)
        trend = self.trend_analyzer.analyze_trend(metrics)
        
        return {
            'anomalies_found': len(trend.anomalies),
            'anomaly_timestamps': [ts.isoformat() for ts, _ in trend.anomalies],
            'anomaly_values': [value for _, value in trend.anomalies]
        }

# Example usage
async def main():
    analytics_system = SecurityAnalyticsReportingSystem()
    await analytics_system.initialize()
    
    # Generate executive dashboard report
    report = await analytics_system.generate_report(
        ReportType.EXECUTIVE_DASHBOARD,
        TimeRange.LAST_24_HOURS
    )
    print(f"Report Generated: {report.title}")
    print(f"Executive Summary:\n{report.executive_summary}")
    print(f"Recommendations: {report.recommendations}")
    
    # Get real-time dashboard
    dashboard = await analytics_system.get_real_time_dashboard()
    print(f"\nReal-time Dashboard: {dashboard}")
    
    # Create and execute custom query
    query_id = await analytics_system.create_custom_query(
        "High Risk Events",
        "Find all high-risk security events",
        "metric_aggregation",
        {
            'metric_type': 'security_events',
            'time_range': '24h',
            'aggregation': 'count'
        }
    )
    
    query_result = await analytics_system.execute_query(query_id)
    print(f"\nQuery Result: {query_result}")

if __name__ == "__main__":
    asyncio.run(main())