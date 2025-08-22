#!/usr/bin/env python3
"""
Intelligent Alerting System with Noise Reduction
Uses ML to reduce alert fatigue and improve alert quality through intelligent correlation and filtering
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import pickle
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, accuracy_score
import joblib
from collections import defaultdict, Counter
import requests
import warnings
warnings.filterwarnings('ignore')

@dataclass
class Alert:
    """Data class for system alerts"""
    id: str
    timestamp: datetime
    source: str  # prometheus, application, system, etc.
    severity: str  # low, medium, high, critical
    title: str
    description: str
    labels: Dict[str, str]
    metric_name: str
    value: float
    threshold: float
    duration: timedelta
    raw_score: float
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        data['duration'] = str(self.duration)
        return data

@dataclass
class IntelligentAlert:
    """Enhanced alert with ML-based insights"""
    alert: Alert
    noise_score: float  # 0.0 = definitely noise, 1.0 = definitely actionable
    correlation_score: float  # How correlated with other alerts
    priority_score: float  # Final priority after ML processing
    recommended_action: str
    similar_alerts: List[str]  # IDs of similar recent alerts
    root_cause_probability: float  # Likelihood this is root cause vs symptom
    business_impact: str
    escalation_needed: bool
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['alert'] = self.alert.to_dict()
        return data

class IntelligentAlertingSystem:
    """Advanced alerting system with ML-based noise reduction and correlation"""
    
    def __init__(self, prometheus_url: str = "http://prometheus:9090"):
        self.prometheus_url = prometheus_url
        self.models = {}
        self.scalers = {}
        self.alert_history = []
        self.correlation_rules = {}
        self.noise_patterns = {}
        self.model_path = "/models/intelligent_alerting"
        
        # Alert processing parameters
        self.noise_threshold = 0.3  # Below this score, consider as noise
        self.correlation_window = timedelta(minutes=30)  # Time window for correlation
        self.max_history_size = 10000  # Maximum alerts to keep in memory
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Load existing models and patterns
        self._load_models()
        self._initialize_noise_patterns()
    
    def process_raw_alerts(self, raw_alerts: List[Dict]) -> List[IntelligentAlert]:
        """Process raw alerts and convert to intelligent alerts"""
        alerts = []
        
        for raw_alert in raw_alerts:
            # Convert raw alert to Alert object
            alert = self._parse_raw_alert(raw_alert)
            
            # Process with ML intelligence
            intelligent_alert = self._enhance_alert_with_ml(alert)
            
            # Add to history
            self.alert_history.append(intelligent_alert)
            alerts.append(intelligent_alert)
        
        # Trim history if needed
        if len(self.alert_history) > self.max_history_size:
            self.alert_history = self.alert_history[-self.max_history_size:]
        
        # Correlate alerts within time window
        correlated_alerts = self._correlate_alerts(alerts)
        
        # Apply noise reduction
        filtered_alerts = self._filter_noise(correlated_alerts)
        
        # Prioritize remaining alerts
        prioritized_alerts = self._prioritize_alerts(filtered_alerts)
        
        return prioritized_alerts
    
    def _parse_raw_alert(self, raw_alert: Dict) -> Alert:
        """Parse raw alert data into Alert object"""
        # Handle different alert sources (Prometheus, custom, etc.)
        
        # Default values
        alert_id = raw_alert.get('id', f"alert_{datetime.now().timestamp()}")
        timestamp = datetime.now()
        source = raw_alert.get('source', 'unknown')
        severity = raw_alert.get('severity', 'medium')
        title = raw_alert.get('alertname', raw_alert.get('title', 'Unknown Alert'))
        description = raw_alert.get('description', raw_alert.get('message', 'No description'))
        labels = raw_alert.get('labels', {})
        metric_name = raw_alert.get('metric', labels.get('__name__', 'unknown'))
        value = float(raw_alert.get('value', 0))
        threshold = float(raw_alert.get('threshold', 0))
        duration_seconds = raw_alert.get('duration', 0)
        duration = timedelta(seconds=duration_seconds)
        
        # Calculate raw score based on severity and value deviation
        severity_weights = {'low': 0.25, 'medium': 0.5, 'high': 0.75, 'critical': 1.0}
        raw_score = severity_weights.get(severity, 0.5)
        
        if threshold > 0:
            deviation = abs(value - threshold) / threshold
            raw_score *= (1 + deviation)
        
        return Alert(
            id=alert_id,
            timestamp=timestamp,
            source=source,
            severity=severity,
            title=title,
            description=description,
            labels=labels,
            metric_name=metric_name,
            value=value,
            threshold=threshold,
            duration=duration,
            raw_score=raw_score
        )
    
    def _enhance_alert_with_ml(self, alert: Alert) -> IntelligentAlert:
        """Enhance alert with ML-based intelligence"""
        
        # Calculate noise score
        noise_score = self._calculate_noise_score(alert)
        
        # Find similar alerts
        similar_alerts = self._find_similar_alerts(alert)
        
        # Calculate correlation score
        correlation_score = self._calculate_correlation_score(alert, similar_alerts)
        
        # Determine if this is likely a root cause
        root_cause_probability = self._calculate_root_cause_probability(alert)
        
        # Assess business impact
        business_impact = self._assess_business_impact(alert)
        
        # Generate recommended action
        recommended_action = self._generate_recommended_action(alert, noise_score)
        
        # Calculate final priority score
        priority_score = self._calculate_priority_score(
            alert, noise_score, correlation_score, root_cause_probability
        )
        
        # Determine if escalation is needed
        escalation_needed = self._should_escalate(alert, priority_score, business_impact)
        
        return IntelligentAlert(
            alert=alert,
            noise_score=noise_score,
            correlation_score=correlation_score,
            priority_score=priority_score,
            recommended_action=recommended_action,
            similar_alerts=[a.alert.id for a in similar_alerts],
            root_cause_probability=root_cause_probability,
            business_impact=business_impact,
            escalation_needed=escalation_needed
        )
    
    def _calculate_noise_score(self, alert: Alert) -> float:
        """Calculate probability that alert is actionable (not noise)"""
        
        # Start with base score
        score = 0.5
        
        # Check against known noise patterns
        for pattern_name, pattern in self.noise_patterns.items():
            if self._matches_pattern(alert, pattern):
                score *= pattern.get('noise_multiplier', 0.5)
        
        # Frequency-based noise detection
        recent_similar = self._count_recent_similar_alerts(alert, hours=1)
        if recent_similar > 5:  # Too many similar alerts
            score *= 0.3
        elif recent_similar > 2:
            score *= 0.7
        
        # Duration-based scoring
        if alert.duration.total_seconds() < 60:  # Very short alerts are often noise
            score *= 0.6
        elif alert.duration.total_seconds() > 3600:  # Long duration alerts are more serious
            score *= 1.3
        
        # Value deviation from threshold
        if alert.threshold > 0:
            deviation_ratio = abs(alert.value - alert.threshold) / alert.threshold
            if deviation_ratio < 0.1:  # Very close to threshold
                score *= 0.7
            elif deviation_ratio > 1.0:  # Far from threshold
                score *= 1.4
        
        # Source reliability
        source_reliability = {
            'prometheus': 0.9,
            'application': 0.8,
            'system': 0.85,
            'custom': 0.7,
            'unknown': 0.5
        }
        score *= source_reliability.get(alert.source, 0.7)
        
        # Time-based patterns (e.g., known maintenance windows)
        hour = alert.timestamp.hour
        day_of_week = alert.timestamp.weekday()
        
        # Reduce score during maintenance windows (early morning weekends)
        if day_of_week >= 5 and 2 <= hour <= 6:  # Weekend early morning
            score *= 0.6
        
        # Business hours get higher priority
        if 9 <= hour <= 17 and day_of_week < 5:  # Business hours
            score *= 1.2
        
        return max(0.0, min(1.0, score))
    
    def _find_similar_alerts(self, alert: Alert, hours: int = 24) -> List[IntelligentAlert]:
        """Find similar alerts in recent history"""
        cutoff_time = alert.timestamp - timedelta(hours=hours)
        
        similar_alerts = []
        for hist_alert in self.alert_history:
            if hist_alert.alert.timestamp < cutoff_time:
                continue
            
            similarity = self._calculate_alert_similarity(alert, hist_alert.alert)
            if similarity > 0.7:  # 70% similarity threshold
                similar_alerts.append(hist_alert)
        
        return similar_alerts
    
    def _calculate_alert_similarity(self, alert1: Alert, alert2: Alert) -> float:
        """Calculate similarity between two alerts"""
        similarity = 0.0
        
        # Metric name similarity
        if alert1.metric_name == alert2.metric_name:
            similarity += 0.4
        
        # Severity similarity
        severity_scores = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
        sev1 = severity_scores.get(alert1.severity, 2)
        sev2 = severity_scores.get(alert2.severity, 2)
        severity_sim = 1 - abs(sev1 - sev2) / 3
        similarity += 0.2 * severity_sim
        
        # Source similarity
        if alert1.source == alert2.source:
            similarity += 0.2
        
        # Labels similarity
        common_labels = set(alert1.labels.keys()) & set(alert2.labels.keys())
        if common_labels:
            matching_labels = sum(1 for label in common_labels 
                                if alert1.labels[label] == alert2.labels[label])
            label_similarity = matching_labels / len(common_labels)
            similarity += 0.2 * label_similarity
        
        return similarity
    
    def _calculate_correlation_score(self, alert: Alert, similar_alerts: List[IntelligentAlert]) -> float:
        """Calculate how correlated this alert is with others"""
        if not similar_alerts:
            return 0.0
        
        # Check for time-based correlation
        time_correlations = 0
        for similar in similar_alerts:
            time_diff = abs((alert.timestamp - similar.alert.timestamp).total_seconds())
            if time_diff < 300:  # Within 5 minutes
                time_correlations += 1
        
        time_correlation_score = min(1.0, time_correlations / 5)
        
        # Check for metric correlation
        metric_types = [s.alert.metric_name for s in similar_alerts]
        metric_diversity = len(set(metric_types))
        
        # Higher diversity suggests broader issue
        diversity_score = min(1.0, metric_diversity / 3)
        
        return (time_correlation_score + diversity_score) / 2
    
    def _calculate_root_cause_probability(self, alert: Alert) -> float:
        """Calculate probability that this alert represents a root cause"""
        
        # Infrastructure-level alerts are more likely root causes
        infrastructure_keywords = ['cpu', 'memory', 'disk', 'network', 'node', 'pod']
        is_infrastructure = any(keyword in alert.metric_name.lower() 
                             for keyword in infrastructure_keywords)
        
        if is_infrastructure:
            base_probability = 0.7
        else:
            base_probability = 0.4
        
        # Severity affects root cause probability
        severity_multipliers = {
            'critical': 1.3,
            'high': 1.1,
            'medium': 1.0,
            'low': 0.8
        }
        
        probability = base_probability * severity_multipliers.get(alert.severity, 1.0)
        
        # Long-duration alerts are more likely root causes
        duration_hours = alert.duration.total_seconds() / 3600
        if duration_hours > 1:
            probability *= 1.2
        elif duration_hours < 0.1:  # Less than 6 minutes
            probability *= 0.7
        
        # Check if this metric type often precedes others
        if self._is_leading_indicator(alert.metric_name):
            probability *= 1.4
        
        return max(0.0, min(1.0, probability))
    
    def _assess_business_impact(self, alert: Alert) -> str:
        """Assess the business impact of the alert"""
        
        # Critical system components
        critical_components = ['database', 'auth', 'api', 'gateway', 'load_balancer']
        high_impact_metrics = ['error_rate', 'response_time', 'availability']
        
        is_critical_component = any(comp in alert.metric_name.lower() 
                                  for comp in critical_components)
        is_high_impact_metric = any(metric in alert.metric_name.lower() 
                                  for metric in high_impact_metrics)
        
        if alert.severity == 'critical' and (is_critical_component or is_high_impact_metric):
            return "high"
        elif alert.severity in ['critical', 'high'] and (is_critical_component or is_high_impact_metric):
            return "medium"
        elif alert.severity == 'critical':
            return "medium"
        else:
            return "low"
    
    def _generate_recommended_action(self, alert: Alert, noise_score: float) -> str:
        """Generate recommended action for the alert"""
        
        if noise_score < self.noise_threshold:
            return "Monitor - likely noise, but track for patterns"
        
        action_templates = {
            'cpu_usage': "Check CPU utilization and consider scaling",
            'memory_usage': "Investigate memory usage and potential leaks",
            'error_rate': "Review application logs and error patterns",
            'response_time': "Analyze performance bottlenecks",
            'database': "Check database performance and connections",
            'network': "Investigate network connectivity issues",
            'disk': "Monitor disk usage and cleanup if needed"
        }
        
        # Find matching template
        for keyword, template in action_templates.items():
            if keyword in alert.metric_name.lower():
                if alert.severity == 'critical':
                    return f"URGENT: {template}"
                else:
                    return template
        
        # Default action based on severity
        if alert.severity == 'critical':
            return "Immediate investigation required - system impact detected"
        elif alert.severity == 'high':
            return "Investigate within 1 hour - potential service impact"
        elif alert.severity == 'medium':
            return "Review within 4 hours - monitor for escalation"
        else:
            return "Monitor - review during next maintenance window"
    
    def _calculate_priority_score(self, alert: Alert, noise_score: float, 
                                correlation_score: float, root_cause_probability: float) -> float:
        """Calculate final priority score for the alert"""
        
        # Start with noise score (how actionable it is)
        priority = noise_score
        
        # Boost priority for high correlation (indicates broader issue)
        priority += correlation_score * 0.3
        
        # Boost priority for likely root causes
        priority += root_cause_probability * 0.2
        
        # Severity multiplier
        severity_multipliers = {
            'critical': 1.5,
            'high': 1.2,
            'medium': 1.0,
            'low': 0.8
        }
        priority *= severity_multipliers.get(alert.severity, 1.0)
        
        # Business hours boost
        hour = alert.timestamp.hour
        day_of_week = alert.timestamp.weekday()
        if 9 <= hour <= 17 and day_of_week < 5:
            priority *= 1.1
        
        return max(0.0, min(2.0, priority))  # Cap at 2.0
    
    def _should_escalate(self, alert: Alert, priority_score: float, business_impact: str) -> bool:
        """Determine if alert should be escalated immediately"""
        
        # Always escalate critical alerts with high priority
        if alert.severity == 'critical' and priority_score > 1.0:
            return True
        
        # Escalate high business impact alerts
        if business_impact == 'high' and priority_score > 0.8:
            return True
        
        # Escalate if multiple similar alerts in short time
        recent_similar = self._count_recent_similar_alerts(alert, hours=1)
        if recent_similar > 3 and priority_score > 0.7:
            return True
        
        return False
    
    def _correlate_alerts(self, alerts: List[IntelligentAlert]) -> List[IntelligentAlert]:
        """Apply correlation analysis to group related alerts"""
        
        if len(alerts) < 2:
            return alerts
        
        # Group alerts that are likely related
        correlation_groups = []
        ungrouped_alerts = alerts.copy()
        
        while ungrouped_alerts:
            current_alert = ungrouped_alerts.pop(0)
            group = [current_alert]
            
            # Find alerts that correlate with current alert
            to_remove = []
            for i, other_alert in enumerate(ungrouped_alerts):
                if self._alerts_are_correlated(current_alert.alert, other_alert.alert):
                    group.append(other_alert)
                    to_remove.append(i)
            
            # Remove correlated alerts from ungrouped list
            for i in reversed(to_remove):
                ungrouped_alerts.pop(i)
            
            correlation_groups.append(group)
        
        # Process each correlation group
        processed_alerts = []
        for group in correlation_groups:
            if len(group) == 1:
                processed_alerts.extend(group)
            else:
                # Create a summary alert for the group
                processed_alerts.extend(self._create_correlation_summary(group))
        
        return processed_alerts
    
    def _alerts_are_correlated(self, alert1: Alert, alert2: Alert) -> bool:
        """Check if two alerts are correlated"""
        
        # Time-based correlation (within correlation window)
        time_diff = abs((alert1.timestamp - alert2.timestamp).total_seconds())
        if time_diff > self.correlation_window.total_seconds():
            return False
        
        # Check for known correlation patterns
        correlation_patterns = [
            (['cpu_usage', 'memory_usage'], 'resource_pressure'),
            (['error_rate', 'response_time'], 'performance_degradation'),
            (['database', 'connection'], 'database_issues'),
            (['network', 'connectivity'], 'network_issues')
        ]
        
        for pattern_metrics, pattern_name in correlation_patterns:
            if (any(metric in alert1.metric_name.lower() for metric in pattern_metrics) and
                any(metric in alert2.metric_name.lower() for metric in pattern_metrics)):
                return True
        
        # Similar metric names
        if alert1.metric_name == alert2.metric_name:
            return True
        
        # Same source and similar labels
        if (alert1.source == alert2.source and 
            len(set(alert1.labels.keys()) & set(alert2.labels.keys())) > 0):
            return True
        
        return False
    
    def _create_correlation_summary(self, correlated_alerts: List[IntelligentAlert]) -> List[IntelligentAlert]:
        """Create summary for correlated alerts"""
        
        # Keep the highest priority alert as the main one
        main_alert = max(correlated_alerts, key=lambda x: x.priority_score)
        
        # Update main alert with correlation information
        main_alert.correlation_score = 1.0
        main_alert.recommended_action = f"CORRELATED ISSUE: {main_alert.recommended_action}"
        main_alert.similar_alerts = [a.alert.id for a in correlated_alerts if a != main_alert]
        
        # Suppress lower priority correlated alerts or mark them as related
        other_alerts = [a for a in correlated_alerts if a != main_alert]
        for alert in other_alerts:
            if alert.priority_score < main_alert.priority_score * 0.7:
                # Suppress this alert
                alert.noise_score = 0.1
                alert.recommended_action = f"Suppressed - related to {main_alert.alert.id}"
        
        return correlated_alerts
    
    def _filter_noise(self, alerts: List[IntelligentAlert]) -> List[IntelligentAlert]:
        """Filter out alerts identified as noise"""
        
        filtered_alerts = []
        
        for alert in alerts:
            # Apply noise threshold
            if alert.noise_score >= self.noise_threshold:
                filtered_alerts.append(alert)
            else:
                # Log suppressed alert for learning
                self._log_suppressed_alert(alert)
        
        return filtered_alerts
    
    def _prioritize_alerts(self, alerts: List[IntelligentAlert]) -> List[IntelligentAlert]:
        """Sort alerts by priority and apply final processing"""
        
        # Sort by priority score (highest first)
        prioritized = sorted(alerts, key=lambda x: x.priority_score, reverse=True)
        
        # Apply rate limiting for non-critical alerts
        rate_limited = self._apply_rate_limiting(prioritized)
        
        return rate_limited
    
    def _apply_rate_limiting(self, alerts: List[IntelligentAlert]) -> List[IntelligentAlert]:
        """Apply rate limiting to prevent alert floods"""
        
        rate_limited = []
        alert_counts = defaultdict(int)
        
        for alert in alerts:
            # Count alerts by metric and severity
            key = (alert.alert.metric_name, alert.alert.severity)
            alert_counts[key] += 1
            
            # Rate limiting rules
            max_alerts = {
                'critical': 10,  # Allow more critical alerts
                'high': 5,
                'medium': 3,
                'low': 1
            }
            
            max_allowed = max_alerts.get(alert.alert.severity, 1)
            
            if alert_counts[key] <= max_allowed:
                rate_limited.append(alert)
            else:
                # Create a summary alert if we're hitting rate limits
                if alert_counts[key] == max_allowed + 1:
                    summary_alert = self._create_rate_limit_summary(alert, alert_counts[key])
                    rate_limited.append(summary_alert)
        
        return rate_limited
    
    def _create_rate_limit_summary(self, sample_alert: IntelligentAlert, count: int) -> IntelligentAlert:
        """Create summary alert for rate-limited alerts"""
        
        # Create a new alert that summarizes the rate-limited ones
        summary_alert_data = Alert(
            id=f"rate_limit_summary_{datetime.now().timestamp()}",
            timestamp=sample_alert.alert.timestamp,
            source=sample_alert.alert.source,
            severity=sample_alert.alert.severity,
            title=f"Multiple {sample_alert.alert.metric_name} alerts",
            description=f"Rate limited: {count} similar alerts in short timeframe",
            labels=sample_alert.alert.labels,
            metric_name=sample_alert.alert.metric_name,
            value=sample_alert.alert.value,
            threshold=sample_alert.alert.threshold,
            duration=sample_alert.alert.duration,
            raw_score=sample_alert.alert.raw_score
        )
        
        return IntelligentAlert(
            alert=summary_alert_data,
            noise_score=sample_alert.noise_score,
            correlation_score=sample_alert.correlation_score,
            priority_score=sample_alert.priority_score * 1.2,  # Boost priority for summary
            recommended_action=f"MULTIPLE ALERTS: {sample_alert.recommended_action}",
            similar_alerts=[],
            root_cause_probability=sample_alert.root_cause_probability,
            business_impact=sample_alert.business_impact,
            escalation_needed=sample_alert.escalation_needed
        )
    
    def _matches_pattern(self, alert: Alert, pattern: Dict) -> bool:
        """Check if alert matches a noise pattern"""
        
        # Check metric name pattern
        if 'metric_pattern' in pattern:
            if pattern['metric_pattern'] not in alert.metric_name.lower():
                return False
        
        # Check time pattern
        if 'time_pattern' in pattern:
            hour = alert.timestamp.hour
            if hour not in pattern['time_pattern']:
                return False
        
        # Check duration pattern
        if 'max_duration' in pattern:
            if alert.duration.total_seconds() > pattern['max_duration']:
                return False
        
        # Check value pattern
        if 'value_range' in pattern:
            min_val, max_val = pattern['value_range']
            if not (min_val <= alert.value <= max_val):
                return False
        
        return True
    
    def _count_recent_similar_alerts(self, alert: Alert, hours: int = 1) -> int:
        """Count similar alerts in recent history"""
        cutoff_time = alert.timestamp - timedelta(hours=hours)
        
        count = 0
        for hist_alert in self.alert_history:
            if (hist_alert.alert.timestamp >= cutoff_time and
                hist_alert.alert.metric_name == alert.metric_name and
                hist_alert.alert.severity == alert.severity):
                count += 1
        
        return count
    
    def _is_leading_indicator(self, metric_name: str) -> bool:
        """Check if this metric type is often a leading indicator"""
        
        leading_indicators = [
            'cpu_usage', 'memory_usage', 'disk_usage',
            'network_latency', 'database_connections',
            'error_rate', 'queue_depth'
        ]
        
        return any(indicator in metric_name.lower() for indicator in leading_indicators)
    
    def _log_suppressed_alert(self, alert: IntelligentAlert):
        """Log suppressed alert for model improvement"""
        # In a real implementation, this would help train the noise detection model
        pass
    
    def _initialize_noise_patterns(self):
        """Initialize known noise patterns"""
        self.noise_patterns = {
            'short_cpu_spikes': {
                'metric_pattern': 'cpu',
                'max_duration': 120,  # 2 minutes
                'noise_multiplier': 0.3
            },
            'maintenance_window': {
                'time_pattern': list(range(2, 6)),  # 2-6 AM
                'noise_multiplier': 0.4
            },
            'deployment_noise': {
                'metric_pattern': 'restart',
                'max_duration': 300,  # 5 minutes
                'noise_multiplier': 0.5
            },
            'minor_threshold_breach': {
                'value_range': (0.95, 1.05),  # Near threshold
                'noise_multiplier': 0.6
            }
        }
    
    def _save_models(self):
        """Save models and patterns"""
        models_file = f"{self.model_path}/alerting_models.pkl"
        patterns_file = f"{self.model_path}/patterns.json"
        
        with open(models_file, 'wb') as f:
            pickle.dump({
                'models': self.models,
                'scalers': self.scalers,
                'correlation_rules': self.correlation_rules
            }, f)
        
        with open(patterns_file, 'w') as f:
            json.dump(self.noise_patterns, f, indent=2)
    
    def _load_models(self):
        """Load models and patterns"""
        try:
            models_file = f"{self.model_path}/alerting_models.pkl"
            patterns_file = f"{self.model_path}/patterns.json"
            
            if os.path.exists(models_file):
                with open(models_file, 'rb') as f:
                    data = pickle.load(f)
                    self.models = data.get('models', {})
                    self.scalers = data.get('scalers', {})
                    self.correlation_rules = data.get('correlation_rules', {})
            
            if os.path.exists(patterns_file):
                with open(patterns_file, 'r') as f:
                    self.noise_patterns.update(json.load(f))
            
            print(f"Loaded intelligent alerting models and patterns")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_alerting_statistics(self) -> Dict:
        """Get statistics about alert processing"""
        if not self.alert_history:
            return {"message": "No alert history available"}
        
        total_alerts = len(self.alert_history)
        
        # Calculate noise reduction effectiveness
        high_noise = sum(1 for a in self.alert_history if a.noise_score < self.noise_threshold)
        noise_reduction_rate = high_noise / total_alerts if total_alerts > 0 else 0
        
        # Severity distribution
        severity_counts = Counter(a.alert.severity for a in self.alert_history)
        
        # Business impact distribution
        impact_counts = Counter(a.business_impact for a in self.alert_history)
        
        # Average priority score by severity
        avg_priority_by_severity = {}
        for severity in ['low', 'medium', 'high', 'critical']:
            alerts_of_severity = [a for a in self.alert_history if a.alert.severity == severity]
            if alerts_of_severity:
                avg_priority_by_severity[severity] = sum(a.priority_score for a in alerts_of_severity) / len(alerts_of_severity)
        
        return {
            'total_alerts_processed': total_alerts,
            'noise_reduction_rate': f"{noise_reduction_rate:.1%}",
            'severity_distribution': dict(severity_counts),
            'business_impact_distribution': dict(impact_counts),
            'average_priority_by_severity': avg_priority_by_severity,
            'escalation_rate': f"{sum(1 for a in self.alert_history if a.escalation_needed) / total_alerts:.1%}" if total_alerts > 0 else "0%"
        }


def main():
    """Main execution function for testing"""
    print("🤖 Starting Intelligent Alerting System...")
    
    # Initialize the system
    alerting_system = IntelligentAlertingSystem()
    
    # Simulate raw alerts from various sources
    raw_alerts = [
        {
            'id': 'alert_1',
            'alertname': 'HighCPUUsage',
            'severity': 'high',
            'source': 'prometheus',
            'description': 'CPU usage above 80%',
            'metric': 'cpu_usage',
            'value': 0.85,
            'threshold': 0.8,
            'duration': 300,  # 5 minutes
            'labels': {'instance': 'control-panel-1', 'job': 'control-panel'}
        },
        {
            'id': 'alert_2',
            'alertname': 'HighMemoryUsage',
            'severity': 'high',
            'source': 'prometheus',
            'description': 'Memory usage above 85%',
            'metric': 'memory_usage',
            'value': 0.87,
            'threshold': 0.85,
            'duration': 600,  # 10 minutes
            'labels': {'instance': 'control-panel-1', 'job': 'control-panel'}
        },
        {
            'id': 'alert_3',
            'alertname': 'HighErrorRate',
            'severity': 'critical',
            'source': 'application',
            'description': 'Error rate above 5%',
            'metric': 'error_rate',
            'value': 0.07,
            'threshold': 0.05,
            'duration': 180,  # 3 minutes
            'labels': {'service': 'api', 'endpoint': '/metrics'}
        },
        {
            'id': 'alert_4',
            'alertname': 'PodRestart',
            'severity': 'medium',
            'source': 'kubernetes',
            'description': 'Pod restarted',
            'metric': 'pod_restarts',
            'value': 1,
            'threshold': 0,
            'duration': 30,  # 30 seconds
            'labels': {'pod': 'control-panel-abc123', 'namespace': 'control-panel'}
        },
        {
            'id': 'alert_5',
            'alertname': 'MinorCPUSpike',
            'severity': 'low',
            'source': 'prometheus',
            'description': 'Brief CPU spike',
            'metric': 'cpu_usage',
            'value': 0.62,
            'threshold': 0.6,
            'duration': 45,  # 45 seconds - likely noise
            'labels': {'instance': 'control-panel-2', 'job': 'control-panel'}
        }
    ]
    
    print(f"📊 Processing {len(raw_alerts)} raw alerts...")
    
    # Process alerts
    intelligent_alerts = alerting_system.process_raw_alerts(raw_alerts)
    
    print(f"\n🔍 Processed alerts (showing top priority):")
    for i, alert in enumerate(intelligent_alerts[:3], 1):
        print(f"\n{i}. {alert.alert.title} ({alert.alert.severity.upper()})")
        print(f"   Priority Score: {alert.priority_score:.2f}")
        print(f"   Noise Score: {alert.noise_score:.2f}")
        print(f"   Business Impact: {alert.business_impact}")
        print(f"   Escalation Needed: {alert.escalation_needed}")
        print(f"   Recommended Action: {alert.recommended_action}")
        if alert.similar_alerts:
            print(f"   Similar Alerts: {len(alert.similar_alerts)}")
    
    # Show statistics
    print(f"\n📈 Alerting Statistics:")
    stats = alerting_system.get_alerting_statistics()
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    # Simulate additional alerts to show correlation
    print(f"\n🔄 Simulating additional correlated alerts...")
    additional_alerts = [
        {
            'id': 'alert_6',
            'alertname': 'DatabaseSlowQueries',
            'severity': 'high',
            'source': 'database',
            'description': 'Slow database queries detected',
            'metric': 'db_query_time',
            'value': 0.5,
            'threshold': 0.1,
            'duration': 420,
            'labels': {'database': 'control_panel', 'type': 'slow_query'}
        }
    ]
    
    new_intelligent_alerts = alerting_system.process_raw_alerts(additional_alerts)
    
    print(f"🔗 Correlation analysis:")
    for alert in new_intelligent_alerts:
        if alert.correlation_score > 0.5:
            print(f"   High correlation detected for {alert.alert.title}")
            print(f"   Correlation Score: {alert.correlation_score:.2f}")
            print(f"   Likely related to system performance issues")
    
    print("\n✅ Intelligent Alerting System testing completed!")


if __name__ == "__main__":
    main()