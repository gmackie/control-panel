import asyncio
import numpy as np
import json
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import pickle
import hashlib
from collections import deque, defaultdict
import heapq

class IncidentSeverity(Enum):
    CRITICAL = "critical"  # Service down, data loss risk
    HIGH = "high"  # Significant degradation
    MEDIUM = "medium"  # Noticeable issues
    LOW = "low"  # Minor issues
    INFO = "info"  # Informational

class IncidentType(Enum):
    OUTAGE = "outage"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    SECURITY_BREACH = "security_breach"
    DATA_CORRUPTION = "data_corruption"
    CAPACITY_EXHAUSTION = "capacity_exhaustion"
    NETWORK_FAILURE = "network_failure"
    CONFIGURATION_ERROR = "configuration_error"
    DEPENDENCY_FAILURE = "dependency_failure"

class PredictionConfidence(Enum):
    HIGH = "high"  # > 85% confidence
    MEDIUM = "medium"  # 60-85% confidence
    LOW = "low"  # < 60% confidence

class FeatureType(Enum):
    METRIC = "metric"
    LOG_PATTERN = "log_pattern"
    EVENT = "event"
    CONFIGURATION = "configuration"
    DEPENDENCY = "dependency"

@dataclass
class SystemMetrics:
    timestamp: datetime
    cpu_usage: float
    memory_usage: float
    disk_io: float
    network_io: float
    request_rate: float
    error_rate: float
    response_time: float
    queue_depth: int
    active_connections: int
    cache_hit_rate: float
    database_connections: int
    thread_count: int
    gc_pause_time: float
    custom_metrics: Dict[str, float] = field(default_factory=dict)

@dataclass
class LogPattern:
    pattern_id: str
    pattern_text: str
    frequency: int
    severity: str
    first_seen: datetime
    last_seen: datetime
    associated_incidents: List[str] = field(default_factory=list)
    anomaly_score: float = 0.0

@dataclass
class SystemEvent:
    event_id: str
    event_type: str
    timestamp: datetime
    source: str
    description: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None

@dataclass
class IncidentPrediction:
    prediction_id: str
    incident_type: IncidentType
    severity: IncidentSeverity
    probability: float
    confidence: PredictionConfidence
    time_to_incident: timedelta
    affected_services: List[str]
    contributing_factors: List[Dict[str, Any]]
    recommended_actions: List[str]
    feature_importance: Dict[str, float]
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class HistoricalIncident:
    incident_id: str
    incident_type: IncidentType
    severity: IncidentSeverity
    occurred_at: datetime
    detected_at: datetime
    resolved_at: Optional[datetime]
    affected_services: List[str]
    root_cause: str
    resolution: str
    metrics_snapshot: SystemMetrics
    log_patterns: List[LogPattern]
    events: List[SystemEvent]
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ModelPerformance:
    model_id: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float
    false_negative_rate: float
    last_trained: datetime
    training_samples: int
    feature_count: int
    performance_by_type: Dict[str, Dict[str, float]] = field(default_factory=dict)

class FeatureExtractor:
    def __init__(self):
        self.feature_history = deque(maxlen=1000)
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def extract_metric_features(self, metrics: SystemMetrics) -> np.ndarray:
        """Extract features from system metrics"""
        features = [
            metrics.cpu_usage,
            metrics.memory_usage,
            metrics.disk_io,
            metrics.network_io,
            metrics.request_rate,
            metrics.error_rate,
            metrics.response_time,
            float(metrics.queue_depth),
            float(metrics.active_connections),
            metrics.cache_hit_rate,
            float(metrics.database_connections),
            float(metrics.thread_count),
            metrics.gc_pause_time
        ]
        
        # Add custom metrics
        for key in sorted(metrics.custom_metrics.keys()):
            features.append(metrics.custom_metrics[key])
        
        # Add derived features
        features.extend([
            metrics.cpu_usage * metrics.memory_usage,  # Resource pressure
            metrics.error_rate / max(metrics.request_rate, 1),  # Error ratio
            metrics.response_time * metrics.request_rate,  # Load factor
            metrics.queue_depth / max(metrics.active_connections, 1),  # Queue ratio
        ])
        
        return np.array(features)
    
    def extract_temporal_features(self, metrics_history: List[SystemMetrics]) -> np.ndarray:
        """Extract temporal features from metrics history"""
        if len(metrics_history) < 2:
            return np.zeros(10)
        
        # Calculate trends and volatility
        cpu_values = [m.cpu_usage for m in metrics_history]
        memory_values = [m.memory_usage for m in metrics_history]
        error_rates = [m.error_rate for m in metrics_history]
        response_times = [m.response_time for m in metrics_history]
        
        features = [
            np.mean(cpu_values),
            np.std(cpu_values),
            np.max(cpu_values) - np.min(cpu_values),
            self._calculate_trend(cpu_values),
            np.mean(memory_values),
            np.std(memory_values),
            np.mean(error_rates),
            np.std(error_rates),
            np.mean(response_times),
            np.std(response_times)
        ]
        
        return np.array(features)
    
    def extract_log_features(self, log_patterns: List[LogPattern]) -> np.ndarray:
        """Extract features from log patterns"""
        if not log_patterns:
            return np.zeros(8)
        
        error_count = sum(1 for p in log_patterns if p.severity in ['ERROR', 'CRITICAL'])
        warning_count = sum(1 for p in log_patterns if p.severity == 'WARNING')
        total_frequency = sum(p.frequency for p in log_patterns)
        max_anomaly_score = max((p.anomaly_score for p in log_patterns), default=0)
        avg_anomaly_score = np.mean([p.anomaly_score for p in log_patterns]) if log_patterns else 0
        
        # Pattern diversity
        unique_patterns = len(set(p.pattern_text for p in log_patterns))
        pattern_entropy = self._calculate_entropy([p.frequency for p in log_patterns])
        
        # Temporal clustering
        timestamps = [p.last_seen for p in log_patterns]
        temporal_density = self._calculate_temporal_density(timestamps) if timestamps else 0
        
        features = [
            float(error_count),
            float(warning_count),
            float(total_frequency),
            max_anomaly_score,
            avg_anomaly_score,
            float(unique_patterns),
            pattern_entropy,
            temporal_density
        ]
        
        return np.array(features)
    
    def extract_event_features(self, events: List[SystemEvent]) -> np.ndarray:
        """Extract features from system events"""
        if not events:
            return np.zeros(6)
        
        event_count = len(events)
        event_types = defaultdict(int)
        for event in events:
            event_types[event.event_type] += 1
        
        # Event diversity and frequency
        event_diversity = len(event_types)
        max_event_frequency = max(event_types.values()) if event_types else 0
        
        # Temporal features
        timestamps = [e.timestamp for e in events]
        event_rate = self._calculate_event_rate(timestamps)
        burst_score = self._detect_event_bursts(timestamps)
        
        # Source diversity
        unique_sources = len(set(e.source for e in events))
        
        features = [
            float(event_count),
            float(event_diversity),
            float(max_event_frequency),
            event_rate,
            burst_score,
            float(unique_sources)
        ]
        
        return np.array(features)
    
    def combine_features(self, metrics: SystemMetrics, metrics_history: List[SystemMetrics],
                        log_patterns: List[LogPattern], events: List[SystemEvent]) -> np.ndarray:
        """Combine all features into a single feature vector"""
        metric_features = self.extract_metric_features(metrics)
        temporal_features = self.extract_temporal_features(metrics_history)
        log_features = self.extract_log_features(log_patterns)
        event_features = self.extract_event_features(events)
        
        combined = np.concatenate([
            metric_features,
            temporal_features,
            log_features,
            event_features
        ])
        
        return combined
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend coefficient"""
        if len(values) < 2:
            return 0.0
        x = np.arange(len(values))
        coefficients = np.polyfit(x, values, 1)
        return coefficients[0]
    
    def _calculate_entropy(self, frequencies: List[int]) -> float:
        """Calculate Shannon entropy"""
        total = sum(frequencies)
        if total == 0:
            return 0.0
        probabilities = [f / total for f in frequencies]
        entropy = -sum(p * np.log2(p) for p in probabilities if p > 0)
        return entropy
    
    def _calculate_temporal_density(self, timestamps: List[datetime]) -> float:
        """Calculate temporal density of events"""
        if len(timestamps) < 2:
            return 0.0
        sorted_times = sorted(timestamps)
        intervals = [(sorted_times[i+1] - sorted_times[i]).total_seconds() 
                     for i in range(len(sorted_times)-1)]
        if not intervals:
            return 0.0
        return 1.0 / (np.mean(intervals) + 1)
    
    def _calculate_event_rate(self, timestamps: List[datetime]) -> float:
        """Calculate event rate per minute"""
        if len(timestamps) < 2:
            return 0.0
        time_span = (max(timestamps) - min(timestamps)).total_seconds() / 60
        if time_span == 0:
            return float(len(timestamps))
        return len(timestamps) / time_span
    
    def _detect_event_bursts(self, timestamps: List[datetime]) -> float:
        """Detect burst patterns in events"""
        if len(timestamps) < 3:
            return 0.0
        
        sorted_times = sorted(timestamps)
        intervals = [(sorted_times[i+1] - sorted_times[i]).total_seconds() 
                     for i in range(len(sorted_times)-1)]
        
        if not intervals:
            return 0.0
        
        mean_interval = np.mean(intervals)
        std_interval = np.std(intervals)
        
        if std_interval == 0:
            return 0.0
        
        # Calculate burst score based on interval variability
        burst_score = std_interval / (mean_interval + 1)
        return min(burst_score, 10.0)  # Cap at 10

class IncidentPredictor:
    def __init__(self):
        self.models = {}  # incident_type -> model
        self.feature_extractor = FeatureExtractor()
        self.performance_metrics = {}
        self.prediction_history = deque(maxlen=1000)
        self.is_trained = False
        
    async def train_models(self, historical_incidents: List[HistoricalIncident]):
        """Train prediction models on historical incident data"""
        if len(historical_incidents) < 10:
            logging.warning("Insufficient historical data for training")
            return
        
        # Prepare training data
        X, y_type, y_severity = await self._prepare_training_data(historical_incidents)
        
        # Train incident type classifier
        self.models['incident_type'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        # Train severity classifier
        self.models['severity'] = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        
        # Split data
        X_train, X_test, y_type_train, y_type_test, y_sev_train, y_sev_test = train_test_split(
            X, y_type, y_severity, test_size=0.2, random_state=42
        )
        
        # Fit models
        self.models['incident_type'].fit(X_train, y_type_train)
        self.models['severity'].fit(X_train, y_sev_train)
        
        # Train anomaly detector
        self.models['anomaly'] = IsolationForest(
            contamination=0.1,
            random_state=42
        )
        self.models['anomaly'].fit(X_train)
        
        # Calculate performance metrics
        await self._calculate_performance_metrics(X_test, y_type_test, y_sev_test)
        
        self.is_trained = True
        logging.info("Models trained successfully")
    
    async def predict_incident(self, current_metrics: SystemMetrics,
                              metrics_history: List[SystemMetrics],
                              log_patterns: List[LogPattern],
                              events: List[SystemEvent]) -> Optional[IncidentPrediction]:
        """Predict potential incidents based on current system state"""
        if not self.is_trained:
            logging.warning("Models not trained yet")
            return None
        
        # Extract features
        features = self.feature_extractor.combine_features(
            current_metrics, metrics_history, log_patterns, events
        )
        
        # Reshape for prediction
        X = features.reshape(1, -1)
        
        # Check for anomalies
        anomaly_score = self.models['anomaly'].decision_function(X)[0]
        if anomaly_score > -0.1:  # Not anomalous enough
            return None
        
        # Predict incident type and probability
        incident_type_proba = self.models['incident_type'].predict_proba(X)[0]
        incident_type_idx = np.argmax(incident_type_proba)
        incident_type = list(IncidentType)[incident_type_idx]
        
        # Predict severity
        severity_proba = self.models['severity'].predict_proba(X)[0]
        severity_idx = np.argmax(severity_proba)
        severity = list(IncidentSeverity)[severity_idx]
        
        # Calculate confidence
        max_proba = max(incident_type_proba)
        confidence = self._calculate_confidence(max_proba, anomaly_score)
        
        # Estimate time to incident
        time_to_incident = await self._estimate_time_to_incident(
            features, incident_type, severity
        )
        
        # Get feature importance
        feature_importance = self._get_feature_importance(incident_type)
        
        # Identify contributing factors
        contributing_factors = await self._identify_contributing_factors(
            features, feature_importance, current_metrics, log_patterns, events
        )
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(
            incident_type, severity, contributing_factors
        )
        
        # Identify affected services
        affected_services = await self._identify_affected_services(
            incident_type, current_metrics, events
        )
        
        prediction = IncidentPrediction(
            prediction_id=str(uuid.uuid4()),
            incident_type=incident_type,
            severity=severity,
            probability=max_proba,
            confidence=confidence,
            time_to_incident=time_to_incident,
            affected_services=affected_services,
            contributing_factors=contributing_factors,
            recommended_actions=recommendations,
            feature_importance=feature_importance
        )
        
        self.prediction_history.append(prediction)
        return prediction
    
    async def _prepare_training_data(self, incidents: List[HistoricalIncident]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Prepare training data from historical incidents"""
        X = []
        y_type = []
        y_severity = []
        
        for incident in incidents:
            # Extract features
            features = self.feature_extractor.combine_features(
                incident.metrics_snapshot,
                [],  # Would need historical metrics
                incident.log_patterns,
                incident.events
            )
            
            X.append(features)
            y_type.append(list(IncidentType).index(incident.incident_type))
            y_severity.append(list(IncidentSeverity).index(incident.severity))
        
        return np.array(X), np.array(y_type), np.array(y_severity)
    
    async def _calculate_performance_metrics(self, X_test, y_type_test, y_sev_test):
        """Calculate model performance metrics"""
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        
        # Predict on test set
        y_type_pred = self.models['incident_type'].predict(X_test)
        y_sev_pred = self.models['severity'].predict(X_test)
        
        # Calculate metrics for incident type
        type_accuracy = accuracy_score(y_type_test, y_type_pred)
        type_precision = precision_score(y_type_test, y_type_pred, average='weighted')
        type_recall = recall_score(y_type_test, y_type_pred, average='weighted')
        type_f1 = f1_score(y_type_test, y_type_pred, average='weighted')
        
        # Calculate metrics for severity
        sev_accuracy = accuracy_score(y_sev_test, y_sev_pred)
        sev_precision = precision_score(y_sev_test, y_sev_pred, average='weighted')
        sev_recall = recall_score(y_sev_test, y_sev_pred, average='weighted')
        sev_f1 = f1_score(y_sev_test, y_sev_pred, average='weighted')
        
        self.performance_metrics = {
            'incident_type': {
                'accuracy': type_accuracy,
                'precision': type_precision,
                'recall': type_recall,
                'f1_score': type_f1
            },
            'severity': {
                'accuracy': sev_accuracy,
                'precision': sev_precision,
                'recall': sev_recall,
                'f1_score': sev_f1
            }
        }
    
    def _calculate_confidence(self, probability: float, anomaly_score: float) -> PredictionConfidence:
        """Calculate prediction confidence"""
        # Combine probability and anomaly score
        confidence_score = probability * abs(anomaly_score)
        
        if confidence_score > 0.85:
            return PredictionConfidence.HIGH
        elif confidence_score > 0.60:
            return PredictionConfidence.MEDIUM
        else:
            return PredictionConfidence.LOW
    
    async def _estimate_time_to_incident(self, features: np.ndarray, 
                                        incident_type: IncidentType,
                                        severity: IncidentSeverity) -> timedelta:
        """Estimate time until incident occurs"""
        # Simplified estimation based on severity and feature trends
        base_minutes = {
            IncidentSeverity.CRITICAL: 5,
            IncidentSeverity.HIGH: 15,
            IncidentSeverity.MEDIUM: 30,
            IncidentSeverity.LOW: 60,
            IncidentSeverity.INFO: 120
        }
        
        minutes = base_minutes.get(severity, 30)
        
        # Adjust based on feature acceleration
        # This would be more sophisticated in production
        if len(features) > 10:
            trend_factor = features[3]  # CPU trend
            if trend_factor > 0:
                minutes = int(minutes * (1 - min(trend_factor, 0.5)))
        
        return timedelta(minutes=minutes)
    
    def _get_feature_importance(self, incident_type: IncidentType) -> Dict[str, float]:
        """Get feature importance for the prediction"""
        if 'incident_type' not in self.models:
            return {}
        
        importances = self.models['incident_type'].feature_importances_
        
        # Map to feature names (simplified)
        feature_names = [
            'cpu_usage', 'memory_usage', 'disk_io', 'network_io',
            'request_rate', 'error_rate', 'response_time', 'queue_depth',
            'active_connections', 'cache_hit_rate', 'database_connections',
            'thread_count', 'gc_pause_time', 'resource_pressure',
            'error_ratio', 'load_factor', 'queue_ratio'
        ]
        
        importance_dict = {}
        for i, importance in enumerate(importances[:len(feature_names)]):
            if importance > 0.01:  # Only include significant features
                importance_dict[feature_names[i]] = float(importance)
        
        return importance_dict
    
    async def _identify_contributing_factors(self, features: np.ndarray,
                                            feature_importance: Dict[str, float],
                                            metrics: SystemMetrics,
                                            log_patterns: List[LogPattern],
                                            events: List[SystemEvent]) -> List[Dict[str, Any]]:
        """Identify main contributing factors to the prediction"""
        factors = []
        
        # Top important features
        top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:5]
        
        for feature_name, importance in top_features:
            factor = {
                'type': FeatureType.METRIC.value,
                'name': feature_name,
                'importance': importance,
                'current_value': getattr(metrics, feature_name, 0),
                'threshold_exceeded': False
            }
            
            # Check if threshold exceeded (simplified)
            if feature_name == 'cpu_usage' and metrics.cpu_usage > 80:
                factor['threshold_exceeded'] = True
            elif feature_name == 'memory_usage' and metrics.memory_usage > 85:
                factor['threshold_exceeded'] = True
            elif feature_name == 'error_rate' and metrics.error_rate > 5:
                factor['threshold_exceeded'] = True
            
            factors.append(factor)
        
        # Add significant log patterns
        critical_patterns = [p for p in log_patterns if p.severity in ['ERROR', 'CRITICAL']]
        if critical_patterns:
            factors.append({
                'type': FeatureType.LOG_PATTERN.value,
                'name': 'critical_log_patterns',
                'count': len(critical_patterns),
                'patterns': [p.pattern_text for p in critical_patterns[:3]]
            })
        
        # Add recent events
        recent_events = sorted(events, key=lambda e: e.timestamp, reverse=True)[:3]
        if recent_events:
            factors.append({
                'type': FeatureType.EVENT.value,
                'name': 'recent_events',
                'events': [{'type': e.event_type, 'source': e.source} for e in recent_events]
            })
        
        return factors
    
    async def _generate_recommendations(self, incident_type: IncidentType,
                                       severity: IncidentSeverity,
                                       contributing_factors: List[Dict[str, Any]]) -> List[str]:
        """Generate recommended actions based on prediction"""
        recommendations = []
        
        # Type-specific recommendations
        if incident_type == IncidentType.CAPACITY_EXHAUSTION:
            recommendations.extend([
                "Scale up resources immediately",
                "Review and optimize resource-intensive queries",
                "Enable auto-scaling if not already active",
                "Clear unnecessary caches and temporary files"
            ])
        elif incident_type == IncidentType.PERFORMANCE_DEGRADATION:
            recommendations.extend([
                "Review recent configuration changes",
                "Check for resource bottlenecks",
                "Analyze slow queries and optimize",
                "Consider enabling caching layers"
            ])
        elif incident_type == IncidentType.SECURITY_BREACH:
            recommendations.extend([
                "Review security logs immediately",
                "Check for unauthorized access attempts",
                "Rotate credentials and API keys",
                "Enable additional security monitoring"
            ])
        elif incident_type == IncidentType.NETWORK_FAILURE:
            recommendations.extend([
                "Check network connectivity to critical services",
                "Review firewall and security group rules",
                "Verify DNS resolution",
                "Check for DDoS attacks"
            ])
        
        # Severity-specific recommendations
        if severity in [IncidentSeverity.CRITICAL, IncidentSeverity.HIGH]:
            recommendations.insert(0, "Alert on-call team immediately")
            recommendations.insert(1, "Prepare rollback plan")
        
        # Factor-specific recommendations
        for factor in contributing_factors:
            if factor.get('type') == FeatureType.METRIC.value:
                if factor.get('name') == 'cpu_usage' and factor.get('threshold_exceeded'):
                    recommendations.append("Identify and optimize CPU-intensive processes")
                elif factor.get('name') == 'memory_usage' and factor.get('threshold_exceeded'):
                    recommendations.append("Check for memory leaks and increase heap size")
                elif factor.get('name') == 'error_rate' and factor.get('threshold_exceeded'):
                    recommendations.append("Review error logs and fix critical issues")
        
        return recommendations[:10]  # Limit to top 10 recommendations
    
    async def _identify_affected_services(self, incident_type: IncidentType,
                                         metrics: SystemMetrics,
                                         events: List[SystemEvent]) -> List[str]:
        """Identify services that will be affected by the incident"""
        affected = set()
        
        # Extract services from events
        for event in events:
            if 'service' in event.metadata:
                affected.add(event.metadata['service'])
            affected.add(event.source)
        
        # Add services based on incident type
        if incident_type == IncidentType.DATABASE_FAILURE:
            affected.update(['database', 'api', 'backend'])
        elif incident_type == IncidentType.NETWORK_FAILURE:
            affected.update(['loadbalancer', 'cdn', 'api-gateway'])
        elif incident_type == IncidentType.CAPACITY_EXHAUSTION:
            affected.update(['compute', 'storage', 'cache'])
        
        return list(affected)[:10]  # Limit to 10 services

class IncidentPredictionSystem:
    def __init__(self):
        self.predictor = IncidentPredictor()
        self.active_predictions = {}
        self.prediction_accuracy = defaultdict(list)
        self.metrics_buffer = deque(maxlen=100)
        self.event_buffer = deque(maxlen=500)
        self.log_pattern_cache = {}
        
    async def initialize(self, historical_incidents: List[HistoricalIncident]):
        """Initialize the prediction system with historical data"""
        await self.predictor.train_models(historical_incidents)
        logging.info("Incident prediction system initialized")
    
    async def process_metrics(self, metrics: SystemMetrics):
        """Process incoming metrics and update predictions"""
        self.metrics_buffer.append(metrics)
        
        # Run prediction every 10 metrics
        if len(self.metrics_buffer) % 10 == 0:
            await self._run_prediction()
    
    async def process_event(self, event: SystemEvent):
        """Process system events"""
        self.event_buffer.append(event)
    
    async def process_log_pattern(self, pattern: LogPattern):
        """Process log patterns"""
        self.log_pattern_cache[pattern.pattern_id] = pattern
    
    async def _run_prediction(self):
        """Run incident prediction"""
        if not self.metrics_buffer:
            return
        
        current_metrics = self.metrics_buffer[-1]
        metrics_history = list(self.metrics_buffer)
        
        # Get recent log patterns
        recent_patterns = [
            p for p in self.log_pattern_cache.values()
            if (datetime.now() - p.last_seen).total_seconds() < 300  # Last 5 minutes
        ]
        
        # Get recent events
        recent_events = [
            e for e in self.event_buffer
            if (datetime.now() - e.timestamp).total_seconds() < 300
        ]
        
        # Run prediction
        prediction = await self.predictor.predict_incident(
            current_metrics,
            metrics_history,
            recent_patterns,
            recent_events
        )
        
        if prediction:
            self.active_predictions[prediction.prediction_id] = prediction
            await self._handle_prediction(prediction)
    
    async def _handle_prediction(self, prediction: IncidentPrediction):
        """Handle new incident prediction"""
        logging.warning(f"Incident predicted: {prediction.incident_type.value} "
                       f"with {prediction.confidence.value} confidence")
        
        # Take automated actions for high confidence predictions
        if prediction.confidence == PredictionConfidence.HIGH:
            await self._take_preventive_action(prediction)
        
        # Alert relevant teams
        await self._send_alerts(prediction)
    
    async def _take_preventive_action(self, prediction: IncidentPrediction):
        """Take automated preventive actions"""
        if prediction.incident_type == IncidentType.CAPACITY_EXHAUSTION:
            logging.info("Triggering auto-scaling due to capacity prediction")
            # Trigger auto-scaling
        elif prediction.incident_type == IncidentType.PERFORMANCE_DEGRADATION:
            logging.info("Adjusting rate limits due to performance prediction")
            # Adjust rate limits
    
    async def _send_alerts(self, prediction: IncidentPrediction):
        """Send alerts for predictions"""
        alert_data = {
            'prediction_id': prediction.prediction_id,
            'type': prediction.incident_type.value,
            'severity': prediction.severity.value,
            'confidence': prediction.confidence.value,
            'time_to_incident': str(prediction.time_to_incident),
            'affected_services': prediction.affected_services,
            'recommendations': prediction.recommended_actions
        }
        
        logging.info(f"Alert sent: {json.dumps(alert_data, indent=2)}")
    
    async def validate_prediction(self, prediction_id: str, actual_incident: Optional[HistoricalIncident]):
        """Validate a prediction against actual outcome"""
        if prediction_id not in self.active_predictions:
            return
        
        prediction = self.active_predictions[prediction_id]
        
        if actual_incident:
            # Calculate accuracy
            type_match = prediction.incident_type == actual_incident.incident_type
            severity_match = prediction.severity == actual_incident.severity
            time_accuracy = abs((prediction.time_to_incident - 
                               (actual_incident.occurred_at - prediction.created_at)).total_seconds()) / 60
            
            accuracy_score = {
                'type_correct': type_match,
                'severity_correct': severity_match,
                'time_error_minutes': time_accuracy,
                'services_overlap': len(set(prediction.affected_services) & 
                                      set(actual_incident.affected_services))
            }
        else:
            # False positive
            accuracy_score = {
                'false_positive': True,
                'confidence': prediction.confidence.value
            }
        
        self.prediction_accuracy[prediction.incident_type.value].append(accuracy_score)
        
        # Remove from active predictions
        del self.active_predictions[prediction_id]
    
    async def get_system_health_score(self) -> float:
        """Calculate overall system health score"""
        if not self.metrics_buffer:
            return 100.0
        
        recent_metrics = list(self.metrics_buffer)[-10:]
        
        # Calculate health factors
        avg_cpu = np.mean([m.cpu_usage for m in recent_metrics])
        avg_memory = np.mean([m.memory_usage for m in recent_metrics])
        avg_error_rate = np.mean([m.error_rate for m in recent_metrics])
        avg_response_time = np.mean([m.response_time for m in recent_metrics])
        
        # Calculate health score (0-100)
        health_score = 100.0
        health_score -= min(avg_cpu / 2, 30)  # Max 30 point deduction for CPU
        health_score -= min(avg_memory / 3, 20)  # Max 20 point deduction for memory
        health_score -= min(avg_error_rate * 5, 25)  # Max 25 point deduction for errors
        health_score -= min(avg_response_time / 100, 25)  # Max 25 point deduction for response time
        
        # Factor in active predictions
        for prediction in self.active_predictions.values():
            if prediction.severity == IncidentSeverity.CRITICAL:
                health_score -= 20
            elif prediction.severity == IncidentSeverity.HIGH:
                health_score -= 10
            elif prediction.severity == IncidentSeverity.MEDIUM:
                health_score -= 5
        
        return max(0, min(100, health_score))
    
    async def get_prediction_report(self) -> Dict[str, Any]:
        """Generate prediction system report"""
        active_predictions = []
        for prediction in self.active_predictions.values():
            active_predictions.append({
                'id': prediction.prediction_id,
                'type': prediction.incident_type.value,
                'severity': prediction.severity.value,
                'confidence': prediction.confidence.value,
                'time_to_incident': str(prediction.time_to_incident),
                'affected_services': prediction.affected_services
            })
        
        # Calculate accuracy metrics
        accuracy_summary = {}
        for incident_type, scores in self.prediction_accuracy.items():
            if scores:
                true_positives = sum(1 for s in scores if s.get('type_correct', False))
                false_positives = sum(1 for s in scores if s.get('false_positive', False))
                total = len(scores)
                
                accuracy_summary[incident_type] = {
                    'accuracy': (true_positives / total * 100) if total > 0 else 0,
                    'false_positive_rate': (false_positives / total * 100) if total > 0 else 0,
                    'total_predictions': total
                }
        
        return {
            'system_health_score': await self.get_system_health_score(),
            'active_predictions': active_predictions,
            'model_performance': self.predictor.performance_metrics,
            'accuracy_summary': accuracy_summary,
            'is_trained': self.predictor.is_trained
        }

# Example usage
async def main():
    # Create prediction system
    prediction_system = IncidentPredictionSystem()
    
    # Create sample historical incidents for training
    historical_incidents = []
    for i in range(50):
        incident = HistoricalIncident(
            incident_id=f"INC-{i:04d}",
            incident_type=IncidentType.PERFORMANCE_DEGRADATION if i % 3 == 0 else IncidentType.CAPACITY_EXHAUSTION,
            severity=IncidentSeverity.HIGH if i % 2 == 0 else IncidentSeverity.MEDIUM,
            occurred_at=datetime.now() - timedelta(days=i),
            detected_at=datetime.now() - timedelta(days=i, minutes=5),
            resolved_at=datetime.now() - timedelta(days=i, hours=-1),
            affected_services=['api', 'database'],
            root_cause="High load",
            resolution="Scaled resources",
            metrics_snapshot=SystemMetrics(
                timestamp=datetime.now() - timedelta(days=i),
                cpu_usage=80 + (i % 20),
                memory_usage=75 + (i % 15),
                disk_io=50 + (i % 30),
                network_io=60 + (i % 25),
                request_rate=1000 + (i * 10),
                error_rate=5 + (i % 10),
                response_time=200 + (i * 5),
                queue_depth=50 + i,
                active_connections=100 + (i * 2),
                cache_hit_rate=0.8 - (i * 0.01),
                database_connections=20 + (i % 10),
                thread_count=50 + (i % 20),
                gc_pause_time=100 + (i * 2)
            ),
            log_patterns=[],
            events=[]
        )
        historical_incidents.append(incident)
    
    # Initialize with historical data
    await prediction_system.initialize(historical_incidents)
    
    # Simulate incoming metrics
    for i in range(20):
        metrics = SystemMetrics(
            timestamp=datetime.now(),
            cpu_usage=70 + (i * 2),
            memory_usage=65 + (i * 1.5),
            disk_io=40 + i,
            network_io=50 + (i * 1.2),
            request_rate=900 + (i * 20),
            error_rate=2 + (i * 0.5),
            response_time=150 + (i * 10),
            queue_depth=30 + (i * 2),
            active_connections=80 + (i * 3),
            cache_hit_rate=0.85 - (i * 0.02),
            database_connections=15 + (i % 5),
            thread_count=40 + (i % 10),
            gc_pause_time=80 + (i * 3)
        )
        
        await prediction_system.process_metrics(metrics)
        await asyncio.sleep(0.1)
    
    # Get prediction report
    report = await prediction_system.get_prediction_report()
    print(f"Prediction Report: {json.dumps(report, indent=2, default=str)}")

if __name__ == "__main__":
    asyncio.run(main())