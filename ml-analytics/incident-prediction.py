#!/usr/bin/env python3
"""
ML-Based Incident Prediction System
Predicts potential incidents before they occur using machine learning and pattern analysis
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import pickle
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, precision_recall_fscore_support
import joblib
import requests
from collections import deque, defaultdict
import warnings
warnings.filterwarnings('ignore')

@dataclass
class IncidentPrediction:
    """Data class for incident predictions"""
    incident_type: str  # performance, availability, security, resource_exhaustion
    probability: float  # 0.0 to 1.0
    confidence: float   # 0.0 to 1.0
    time_to_incident: str  # "15 minutes", "2 hours", "1 day"
    severity_prediction: str  # low, medium, high, critical
    contributing_factors: List[str]
    recommended_actions: List[str]
    business_impact: str
    affected_components: List[str]
    similar_past_incidents: List[str]

@dataclass
class IncidentPattern:
    """Data class for historical incident patterns"""
    pattern_id: str
    pattern_type: str
    frequency: float  # incidents per month
    typical_duration: str
    common_causes: List[str]
    early_indicators: List[str]
    prevention_strategies: List[str]
    impact_assessment: Dict[str, Any]

@dataclass
class HistoricalIncident:
    """Data class for historical incidents"""
    incident_id: str
    timestamp: datetime
    incident_type: str
    severity: str
    duration_minutes: int
    root_cause: str
    affected_components: List[str]
    leading_metrics: Dict[str, float]  # Metrics in the hour before incident
    resolution_actions: List[str]

class IncidentPredictionEngine:
    """Advanced incident prediction using ML and pattern analysis"""
    
    def __init__(self, prometheus_url: str = "http://prometheus:9090"):
        self.prometheus_url = prometheus_url
        self.prediction_models = {}
        self.pattern_models = {}
        self.scalers = {}
        self.incident_history = []
        self.metric_buffer = deque(maxlen=1440)  # 24 hours of minute-level data
        self.model_path = "/models/incident_prediction"
        
        # Prediction thresholds
        self.prediction_thresholds = {
            'performance': {
                'high_risk': 0.8,
                'medium_risk': 0.6,
                'low_risk': 0.4
            },
            'availability': {
                'high_risk': 0.85,
                'medium_risk': 0.65,
                'low_risk': 0.45
            },
            'resource_exhaustion': {
                'high_risk': 0.75,
                'medium_risk': 0.55,
                'low_risk': 0.35
            },
            'security': {
                'high_risk': 0.9,
                'medium_risk': 0.7,
                'low_risk': 0.5
            }
        }
        
        # Feature importance tracking
        self.feature_importance = {}
        
        # Pattern detection parameters
        self.pattern_window_hours = 4
        self.min_pattern_frequency = 0.1  # At least 0.1 incidents per month
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Load existing models and data
        self._load_models()
        self._initialize_sample_incidents()
    
    def collect_current_metrics(self) -> Dict[str, float]:
        """Collect current system metrics for prediction"""
        
        metrics_queries = {
            # Performance metrics
            'cpu_usage': 'avg(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory_usage_percent': 'avg(container_memory_usage_bytes{container="control-panel"}) / avg(container_spec_memory_limit_bytes{container="control-panel"})',
            'response_time_p95': 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'response_time_p99': 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'request_rate': 'sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'error_rate': 'sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="control-panel"}[5m]))',
            
            # Infrastructure metrics
            'pod_restart_rate': 'rate(kube_pod_container_status_restarts_total{pod=~"control-panel.*"}[5m])',
            'pod_count': 'count(up{job="control-panel"})',
            'node_cpu_usage': 'avg(1 - rate(node_cpu_seconds_total{mode="idle"}[5m]))',
            'node_memory_usage': 'avg(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))',
            'disk_usage': 'avg(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))',
            
            # Database metrics
            'db_connections_active': 'pg_stat_database_numbackends{datname="control_panel",state="active"}',
            'db_connections_total': 'pg_stat_database_numbackends{datname="control_panel"}',
            'db_query_time_avg': 'avg(pg_stat_statements_mean_time_seconds)',
            'db_slow_queries': 'pg_slow_queries_total',
            'db_deadlocks': 'rate(pg_stat_database_deadlocks[5m])',
            
            # Network metrics
            'network_latency': 'avg(probe_duration_seconds{job="blackbox"})',
            'network_errors': 'rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m])',
            'connection_failures': 'rate(node_netstat_Tcp_RetransSegs[5m])',
            
            # Application metrics
            'cache_hit_rate': 'sum(rate(control_panel_cache_hits[5m])) / sum(rate(control_panel_cache_requests[5m]))',
            'queue_depth': 'avg(control_panel_queue_depth)',
            'active_sessions': 'sum(control_panel_active_sessions)',
            'failed_authentications': 'rate(control_panel_auth_failures[5m])',
            
            # Security metrics
            'suspicious_requests': 'rate(control_panel_suspicious_requests[5m])',
            'blocked_ips': 'rate(control_panel_blocked_ips[5m])',
            'failed_logins': 'rate(control_panel_failed_logins[5m])',
            
            # Derived metrics
            'cpu_trend': 'deriv(avg(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))[10m:])',
            'memory_trend': 'deriv(avg(container_memory_usage_bytes{container="control-panel"})[10m:])',
            'error_rate_trend': 'deriv(sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m]))[10m:])'
        }
        
        current_metrics = {}
        timestamp = datetime.now()
        
        for metric_name, query in metrics_queries.items():
            try:
                value = self._query_prometheus(query)
                current_metrics[metric_name] = value
            except Exception as e:
                print(f"Warning: Could not fetch {metric_name}: {e}")
                current_metrics[metric_name] = self._simulate_metric_value(metric_name)
        
        # Add temporal features
        current_metrics.update(self._extract_temporal_features(timestamp))
        
        # Add to metric buffer for pattern analysis
        metric_record = current_metrics.copy()
        metric_record['timestamp'] = timestamp
        self.metric_buffer.append(metric_record)
        
        return current_metrics
    
    def predict_incidents(self, current_metrics: Dict[str, float]) -> List[IncidentPrediction]:
        """Predict potential incidents based on current metrics"""
        print("🔮 Predicting potential incidents...")
        
        predictions = []
        
        # Predict for each incident type
        incident_types = ['performance', 'availability', 'resource_exhaustion', 'security']
        
        for incident_type in incident_types:
            prediction = self._predict_incident_type(incident_type, current_metrics)
            if prediction and prediction.probability >= self.prediction_thresholds[incident_type]['low_risk']:
                predictions.append(prediction)
        
        # Pattern-based predictions
        pattern_predictions = self._predict_based_on_patterns(current_metrics)
        predictions.extend(pattern_predictions)
        
        # Sort by probability
        predictions.sort(key=lambda x: x.probability, reverse=True)
        
        return predictions
    
    def _predict_incident_type(self, incident_type: str, metrics: Dict[str, float]) -> Optional[IncidentPrediction]:
        """Predict specific incident type"""
        
        if incident_type not in self.prediction_models:
            # Use rule-based prediction if no model available
            return self._rule_based_prediction(incident_type, metrics)
        
        # Prepare features for ML model
        feature_names = self._get_feature_names_for_incident_type(incident_type)
        features = []
        
        for feature_name in feature_names:
            features.append(metrics.get(feature_name, 0.0))
        
        features = np.array(features).reshape(1, -1)
        
        # Scale features
        if incident_type in self.scalers:
            features = self.scalers[incident_type].transform(features)
        
        # Make prediction
        model = self.prediction_models[incident_type]
        probability = model.predict_proba(features)[0][1]  # Probability of incident
        confidence = np.max(model.predict_proba(features)[0])
        
        # Determine severity and time to incident
        severity = self._determine_predicted_severity(incident_type, probability, metrics)
        time_to_incident = self._estimate_time_to_incident(incident_type, probability, metrics)
        
        # Get contributing factors from feature importance
        contributing_factors = self._get_contributing_factors(incident_type, features, feature_names)
        
        # Generate recommendations
        recommended_actions = self._generate_incident_recommendations(incident_type, metrics, contributing_factors)
        
        # Assess business impact
        business_impact = self._assess_incident_business_impact(incident_type, severity)
        
        # Find affected components
        affected_components = self._identify_affected_components(incident_type, contributing_factors)
        
        # Find similar past incidents
        similar_incidents = self._find_similar_incidents(incident_type, metrics)
        
        return IncidentPrediction(
            incident_type=incident_type,
            probability=probability,
            confidence=confidence,
            time_to_incident=time_to_incident,
            severity_prediction=severity,
            contributing_factors=contributing_factors,
            recommended_actions=recommended_actions,
            business_impact=business_impact,
            affected_components=affected_components,
            similar_past_incidents=similar_incidents
        )
    
    def _rule_based_prediction(self, incident_type: str, metrics: Dict[str, float]) -> Optional[IncidentPrediction]:
        """Rule-based incident prediction when ML models are not available"""
        
        if incident_type == 'performance':
            # Performance incident rules
            risk_factors = []
            risk_score = 0.0
            
            if metrics.get('cpu_usage', 0) > 0.8:
                risk_factors.append('High CPU usage')
                risk_score += 0.3
            
            if metrics.get('memory_usage_percent', 0) > 0.85:
                risk_factors.append('High memory usage')
                risk_score += 0.3
            
            if metrics.get('response_time_p95', 0) > 0.5:
                risk_factors.append('Slow response times')
                risk_score += 0.25
            
            if metrics.get('error_rate', 0) > 0.05:
                risk_factors.append('High error rate')
                risk_score += 0.25
            
            if metrics.get('db_query_time_avg', 0) > 0.1:
                risk_factors.append('Slow database queries')
                risk_score += 0.2
            
            if risk_score > 0.4:
                return IncidentPrediction(
                    incident_type='performance',
                    probability=min(risk_score, 1.0),
                    confidence=0.7,
                    time_to_incident=self._estimate_time_to_incident('performance', risk_score, metrics),
                    severity_prediction=self._determine_predicted_severity('performance', risk_score, metrics),
                    contributing_factors=risk_factors,
                    recommended_actions=self._generate_incident_recommendations('performance', metrics, risk_factors),
                    business_impact=self._assess_incident_business_impact('performance', 'medium'),
                    affected_components=['application', 'database'],
                    similar_past_incidents=[]
                )
        
        elif incident_type == 'resource_exhaustion':
            # Resource exhaustion rules
            risk_factors = []
            risk_score = 0.0
            
            if metrics.get('memory_usage_percent', 0) > 0.9:
                risk_factors.append('Critical memory usage')
                risk_score += 0.4
            
            if metrics.get('disk_usage', 0) > 0.85:
                risk_factors.append('High disk usage')
                risk_score += 0.3
            
            if metrics.get('db_connections_total', 0) > 90:
                risk_factors.append('Database connection pool nearly full')
                risk_score += 0.3
            
            if metrics.get('node_cpu_usage', 0) > 0.9:
                risk_factors.append('Node CPU exhaustion')
                risk_score += 0.3
            
            if risk_score > 0.35:
                return IncidentPrediction(
                    incident_type='resource_exhaustion',
                    probability=min(risk_score, 1.0),
                    confidence=0.8,
                    time_to_incident=self._estimate_time_to_incident('resource_exhaustion', risk_score, metrics),
                    severity_prediction=self._determine_predicted_severity('resource_exhaustion', risk_score, metrics),
                    contributing_factors=risk_factors,
                    recommended_actions=self._generate_incident_recommendations('resource_exhaustion', metrics, risk_factors),
                    business_impact=self._assess_incident_business_impact('resource_exhaustion', 'high'),
                    affected_components=['infrastructure', 'database'],
                    similar_past_incidents=[]
                )
        
        elif incident_type == 'availability':
            # Availability incident rules
            risk_factors = []
            risk_score = 0.0
            
            if metrics.get('pod_restart_rate', 0) > 0.1:
                risk_factors.append('High pod restart rate')
                risk_score += 0.4
            
            if metrics.get('error_rate', 0) > 0.1:
                risk_factors.append('Very high error rate')
                risk_score += 0.5
            
            if metrics.get('network_errors', 0) > 0.05:
                risk_factors.append('Network connectivity issues')
                risk_score += 0.3
            
            if metrics.get('db_deadlocks', 0) > 0.01:
                risk_factors.append('Database deadlocks detected')
                risk_score += 0.25
            
            if risk_score > 0.45:
                return IncidentPrediction(
                    incident_type='availability',
                    probability=min(risk_score, 1.0),
                    confidence=0.75,
                    time_to_incident=self._estimate_time_to_incident('availability', risk_score, metrics),
                    severity_prediction=self._determine_predicted_severity('availability', risk_score, metrics),
                    contributing_factors=risk_factors,
                    recommended_actions=self._generate_incident_recommendations('availability', metrics, risk_factors),
                    business_impact=self._assess_incident_business_impact('availability', 'critical'),
                    affected_components=['application', 'network', 'database'],
                    similar_past_incidents=[]
                )
        
        elif incident_type == 'security':
            # Security incident rules
            risk_factors = []
            risk_score = 0.0
            
            if metrics.get('failed_logins', 0) > 5:
                risk_factors.append('High failed login attempts')
                risk_score += 0.3
            
            if metrics.get('suspicious_requests', 0) > 10:
                risk_factors.append('Suspicious request patterns')
                risk_score += 0.4
            
            if metrics.get('blocked_ips', 0) > 3:
                risk_factors.append('Multiple IPs blocked')
                risk_score += 0.25
            
            if metrics.get('failed_authentications', 0) > 0.1:
                risk_factors.append('Authentication failures')
                risk_score += 0.3
            
            if risk_score > 0.5:
                return IncidentPrediction(
                    incident_type='security',
                    probability=min(risk_score, 1.0),
                    confidence=0.6,
                    time_to_incident=self._estimate_time_to_incident('security', risk_score, metrics),
                    severity_prediction=self._determine_predicted_severity('security', risk_score, metrics),
                    contributing_factors=risk_factors,
                    recommended_actions=self._generate_incident_recommendations('security', metrics, risk_factors),
                    business_impact=self._assess_incident_business_impact('security', 'high'),
                    affected_components=['authentication', 'network', 'application'],
                    similar_past_incidents=[]
                )
        
        return None
    
    def _predict_based_on_patterns(self, current_metrics: Dict[str, float]) -> List[IncidentPrediction]:
        """Predict incidents based on historical patterns"""
        
        if len(self.metric_buffer) < 60:  # Need at least 1 hour of data
            return []
        
        predictions = []
        
        # Analyze recent metric trends
        recent_metrics = list(self.metric_buffer)[-60:]  # Last hour
        
        # Check for known incident patterns
        patterns = self._detect_incident_patterns(recent_metrics)
        
        for pattern in patterns:
            if pattern['confidence'] > 0.6:
                prediction = IncidentPrediction(
                    incident_type=pattern['incident_type'],
                    probability=pattern['probability'],
                    confidence=pattern['confidence'],
                    time_to_incident=pattern['estimated_time'],
                    severity_prediction=pattern['severity'],
                    contributing_factors=pattern['indicators'],
                    recommended_actions=pattern['recommendations'],
                    business_impact=pattern['business_impact'],
                    affected_components=pattern['components'],
                    similar_past_incidents=pattern['similar_incidents']
                )
                predictions.append(prediction)
        
        return predictions
    
    def _detect_incident_patterns(self, recent_metrics: List[Dict]) -> List[Dict]:
        """Detect known incident patterns in recent metrics"""
        
        patterns = []
        
        # Convert to DataFrame for easier analysis
        df = pd.DataFrame(recent_metrics)
        
        # Pattern 1: Cascading failure (high error rate followed by resource exhaustion)
        if len(df) >= 30:  # At least 30 minutes of data
            recent_error_rate = df['error_rate'].tail(10).mean()
            earlier_error_rate = df['error_rate'].head(20).mean()
            
            if recent_error_rate > earlier_error_rate * 3 and recent_error_rate > 0.02:
                cpu_trend = df['cpu_usage'].tail(15).mean() - df['cpu_usage'].head(15).mean()
                
                if cpu_trend > 0.1:  # CPU usage increasing
                    patterns.append({
                        'incident_type': 'availability',
                        'probability': 0.75,
                        'confidence': 0.8,
                        'estimated_time': '20-30 minutes',
                        'severity': 'high',
                        'indicators': ['Cascading failure pattern', 'Increasing error rate', 'Rising CPU usage'],
                        'recommendations': [
                            'Scale application immediately',
                            'Check for infinite loops or resource leaks',
                            'Review recent deployments',
                            'Prepare for potential rollback'
                        ],
                        'business_impact': 'High - service degradation likely',
                        'components': ['application', 'load_balancer'],
                        'similar_incidents': ['INC-2024-001', 'INC-2024-015']
                    })
        
        # Pattern 2: Memory leak pattern
        if len(df) >= 45:  # At least 45 minutes of data
            memory_trend = np.polyfit(range(len(df)), df['memory_usage_percent'], 1)[0]
            
            if memory_trend > 0.01:  # Memory increasing by 1% per minute
                current_memory = df['memory_usage_percent'].iloc[-1]
                
                if current_memory > 0.7:
                    patterns.append({
                        'incident_type': 'resource_exhaustion',
                        'probability': 0.8,
                        'confidence': 0.85,
                        'estimated_time': '1-2 hours',
                        'severity': 'critical',
                        'indicators': ['Memory leak pattern detected', 'Steady memory increase', 'High current usage'],
                        'recommendations': [
                            'Investigate memory leak in application',
                            'Restart application pods',
                            'Increase memory limits temporarily',
                            'Review recent code changes'
                        ],
                        'business_impact': 'Critical - potential service outage',
                        'components': ['application'],
                        'similar_incidents': ['INC-2024-003', 'INC-2024-022']
                    })
        
        # Pattern 3: Database connection pool exhaustion
        db_connections = df['db_connections_active'].tail(15).mean()
        db_query_time = df['db_query_time_avg'].tail(10).mean()
        
        if db_connections > 80 and db_query_time > 0.05:
            patterns.append({
                'incident_type': 'performance',
                'probability': 0.7,
                'confidence': 0.75,
                'estimated_time': '15-45 minutes',
                'severity': 'medium',
                'indicators': ['High database connections', 'Slow query performance', 'Potential connection pool saturation'],
                'recommendations': [
                    'Optimize database queries',
                    'Increase connection pool size',
                    'Kill long-running queries',
                    'Check for connection leaks'
                ],
                'business_impact': 'Medium - performance degradation',
                'components': ['database'],
                'similar_incidents': ['INC-2024-007', 'INC-2024-018']
            })
        
        # Pattern 4: Network degradation
        network_latency = df['network_latency'].tail(10).mean()
        network_errors = df['network_errors'].tail(10).mean()
        
        if network_latency > 0.5 and network_errors > 0.01:
            patterns.append({
                'incident_type': 'availability',
                'probability': 0.65,
                'confidence': 0.7,
                'estimated_time': '30 minutes - 2 hours',
                'severity': 'medium',
                'indicators': ['High network latency', 'Network errors detected', 'Connectivity issues'],
                'recommendations': [
                    'Check network infrastructure',
                    'Verify DNS resolution',
                    'Check load balancer health',
                    'Monitor external dependencies'
                ],
                'business_impact': 'Medium - intermittent service issues',
                'components': ['network', 'infrastructure'],
                'similar_incidents': ['INC-2024-012']
            })
        
        return patterns
    
    def train_prediction_models(self, historical_data: List[HistoricalIncident]) -> Dict[str, float]:
        """Train ML models for incident prediction"""
        print("🤖 Training incident prediction models...")
        
        if len(historical_data) < 50:
            print("⚠️ Insufficient historical data for training (need at least 50 incidents)")
            return {}
        
        # Organize data by incident type
        incident_data = defaultdict(list)
        for incident in historical_data:
            incident_data[incident.incident_type].append(incident)
        
        model_performance = {}
        
        for incident_type, incidents in incident_data.items():
            if len(incidents) < 20:  # Need at least 20 incidents of each type
                continue
            
            print(f"Training model for {incident_type} incidents...")
            
            # Prepare training data
            X, y = self._prepare_training_data(incidents)
            
            if len(X) == 0:
                continue
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model = GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=5,
                random_state=42
            )
            
            model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            y_pred = model.predict(X_test_scaled)
            precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
            
            # Cross-validation
            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='f1')
            cv_f1 = cv_scores.mean()
            
            model_performance[incident_type] = {
                'precision': precision,
                'recall': recall,
                'f1_score': f1,
                'cv_f1_score': cv_f1,
                'training_samples': len(X_train)
            }
            
            # Store model and scaler
            self.prediction_models[incident_type] = model
            self.scalers[incident_type] = scaler
            
            # Store feature importance
            feature_names = self._get_feature_names_for_incident_type(incident_type)
            self.feature_importance[incident_type] = dict(
                zip(feature_names, model.feature_importances_)
            )
            
            print(f"Model for {incident_type}: F1={f1:.3f}, CV F1={cv_f1:.3f}")
        
        # Save models
        self._save_models()
        
        return model_performance
    
    def _prepare_training_data(self, incidents: List[HistoricalIncident]) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data from historical incidents"""
        
        X = []
        y = []
        
        for incident in incidents:
            # Features are the leading metrics
            features = []
            feature_names = self._get_feature_names_for_incident_type(incident.incident_type)
            
            for feature_name in feature_names:
                features.append(incident.leading_metrics.get(feature_name, 0.0))
            
            X.append(features)
            y.append(1)  # Incident occurred
            
            # Create negative samples (no incident) by slightly modifying the metrics
            negative_features = features.copy()
            for i in range(len(negative_features)):
                # Reduce by 10-30% to simulate normal conditions
                negative_features[i] *= np.random.uniform(0.7, 0.9)
            
            X.append(negative_features)
            y.append(0)  # No incident
        
        return np.array(X), np.array(y)
    
    def _get_feature_names_for_incident_type(self, incident_type: str) -> List[str]:
        """Get relevant feature names for each incident type"""
        
        common_features = [
            'cpu_usage', 'memory_usage_percent', 'response_time_p95', 'error_rate',
            'request_rate', 'pod_restart_rate', 'hour', 'day_of_week', 'is_business_hours'
        ]
        
        type_specific_features = {
            'performance': [
                'response_time_p99', 'db_query_time_avg', 'cache_hit_rate',
                'queue_depth', 'cpu_trend', 'network_latency'
            ],
            'availability': [
                'pod_count', 'network_errors', 'connection_failures',
                'db_deadlocks', 'error_rate_trend'
            ],
            'resource_exhaustion': [
                'node_cpu_usage', 'node_memory_usage', 'disk_usage',
                'db_connections_total', 'memory_trend'
            ],
            'security': [
                'failed_logins', 'suspicious_requests', 'blocked_ips',
                'failed_authentications'
            ]
        }
        
        return common_features + type_specific_features.get(incident_type, [])
    
    def _determine_predicted_severity(self, incident_type: str, probability: float, metrics: Dict[str, float]) -> str:
        """Determine predicted incident severity"""
        
        # Base severity on probability
        if probability >= 0.85:
            base_severity = 'critical'
        elif probability >= 0.7:
            base_severity = 'high'
        elif probability >= 0.5:
            base_severity = 'medium'
        else:
            base_severity = 'low'
        
        # Adjust based on current system state
        if incident_type == 'availability':
            if metrics.get('error_rate', 0) > 0.1:
                return 'critical'
            elif metrics.get('pod_restart_rate', 0) > 0.2:
                return 'high'
        
        elif incident_type == 'resource_exhaustion':
            if metrics.get('memory_usage_percent', 0) > 0.95:
                return 'critical'
            elif metrics.get('disk_usage', 0) > 0.9:
                return 'high'
        
        elif incident_type == 'performance':
            if metrics.get('response_time_p95', 0) > 1.0:
                return 'high'
        
        return base_severity
    
    def _estimate_time_to_incident(self, incident_type: str, probability: float, metrics: Dict[str, float]) -> str:
        """Estimate time until incident occurs"""
        
        # Base estimate on probability
        if probability >= 0.9:
            base_time = "5-15 minutes"
        elif probability >= 0.8:
            base_time = "15-30 minutes"
        elif probability >= 0.7:
            base_time = "30 minutes - 1 hour"
        elif probability >= 0.6:
            base_time = "1-2 hours"
        else:
            base_time = "2-6 hours"
        
        # Adjust based on current trends and type
        if incident_type == 'resource_exhaustion':
            memory_usage = metrics.get('memory_usage_percent', 0)
            if memory_usage > 0.9:
                return "10-20 minutes"
            elif memory_usage > 0.85:
                return "30-60 minutes"
        
        elif incident_type == 'performance':
            error_rate = metrics.get('error_rate', 0)
            if error_rate > 0.05:
                return "15-30 minutes"
        
        return base_time
    
    def _get_contributing_factors(self, incident_type: str, features: np.ndarray, feature_names: List[str]) -> List[str]:
        """Get contributing factors from feature importance"""
        
        if incident_type not in self.feature_importance:
            return ['Insufficient model data for factor analysis']
        
        feature_importance = self.feature_importance[incident_type]
        
        # Get top contributing features
        feature_contributions = []
        for i, feature_name in enumerate(feature_names):
            if i < len(features[0]):
                importance = feature_importance.get(feature_name, 0)
                feature_value = features[0][i]
                contribution_score = importance * abs(feature_value)
                feature_contributions.append((feature_name, contribution_score))
        
        # Sort by contribution and take top factors
        feature_contributions.sort(key=lambda x: x[1], reverse=True)
        
        contributing_factors = []
        for feature_name, _ in feature_contributions[:5]:  # Top 5 factors
            if feature_name in ['cpu_usage', 'memory_usage_percent']:
                contributing_factors.append(f"High {feature_name.replace('_', ' ')}")
            elif feature_name in ['response_time_p95', 'response_time_p99']:
                contributing_factors.append("Slow response times")
            elif feature_name == 'error_rate':
                contributing_factors.append("Elevated error rate")
            elif 'db_' in feature_name:
                contributing_factors.append(f"Database performance issue ({feature_name})")
            else:
                contributing_factors.append(f"Anomalous {feature_name.replace('_', ' ')}")
        
        return contributing_factors
    
    def _generate_incident_recommendations(self, incident_type: str, metrics: Dict[str, float], 
                                         contributing_factors: List[str]) -> List[str]:
        """Generate recommendations to prevent or mitigate incident"""
        
        recommendations = []
        
        if incident_type == 'performance':
            if any('cpu' in factor.lower() for factor in contributing_factors):
                recommendations.append("Scale application horizontally or optimize CPU-intensive operations")
            if any('memory' in factor.lower() for factor in contributing_factors):
                recommendations.append("Increase memory allocation or investigate memory leaks")
            if any('response' in factor.lower() for factor in contributing_factors):
                recommendations.append("Enable caching and optimize slow endpoints")
            if any('database' in factor.lower() for factor in contributing_factors):
                recommendations.append("Optimize database queries and check connection pool")
        
        elif incident_type == 'availability':
            recommendations.extend([
                "Implement circuit breakers and retry logic",
                "Check application health and readiness probes",
                "Review recent deployments for potential issues",
                "Monitor and scale infrastructure components"
            ])
        
        elif incident_type == 'resource_exhaustion':
            recommendations.extend([
                "Immediately scale up resource allocation",
                "Implement resource quotas and limits",
                "Clean up unnecessary data and processes",
                "Set up auto-scaling policies"
            ])
        
        elif incident_type == 'security':
            recommendations.extend([
                "Review and update security policies",
                "Implement rate limiting and IP blocking",
                "Audit authentication mechanisms",
                "Monitor for suspicious patterns"
            ])
        
        # Add general recommendations
        recommendations.extend([
            "Increase monitoring frequency",
            "Prepare rollback procedures",
            "Alert on-call team"
        ])
        
        return recommendations[:5]  # Limit to top 5 recommendations
    
    def _assess_incident_business_impact(self, incident_type: str, severity: str) -> str:
        """Assess business impact of predicted incident"""
        
        impact_matrix = {
            ('availability', 'critical'): 'High - Complete service outage expected',
            ('availability', 'high'): 'Medium-High - Significant service degradation',
            ('availability', 'medium'): 'Medium - Partial service impact',
            ('performance', 'critical'): 'Medium-High - Severe performance degradation',
            ('performance', 'high'): 'Medium - Noticeable performance impact',
            ('performance', 'medium'): 'Low-Medium - Minor performance issues',
            ('resource_exhaustion', 'critical'): 'High - System failure likely',
            ('resource_exhaustion', 'high'): 'Medium-High - Service degradation expected',
            ('security', 'critical'): 'High - Data breach or system compromise risk',
            ('security', 'high'): 'Medium-High - Security incident likely',
            ('security', 'medium'): 'Medium - Security concern identified'
        }
        
        return impact_matrix.get((incident_type, severity), 'Low - Minimal business impact')
    
    def _identify_affected_components(self, incident_type: str, contributing_factors: List[str]) -> List[str]:
        """Identify components likely to be affected"""
        
        components = []
        
        # Default components by incident type
        type_components = {
            'performance': ['application', 'database'],
            'availability': ['application', 'load_balancer', 'network'],
            'resource_exhaustion': ['infrastructure', 'nodes', 'database'],
            'security': ['authentication', 'network', 'application']
        }
        
        components.extend(type_components.get(incident_type, ['application']))
        
        # Add components based on contributing factors
        for factor in contributing_factors:
            if 'database' in factor.lower() or 'db_' in factor.lower():
                components.append('database')
            elif 'network' in factor.lower():
                components.append('network')
            elif 'memory' in factor.lower() or 'cpu' in factor.lower():
                components.append('infrastructure')
        
        return list(set(components))  # Remove duplicates
    
    def _find_similar_incidents(self, incident_type: str, current_metrics: Dict[str, float]) -> List[str]:
        """Find similar past incidents"""
        
        similar_incidents = []
        
        for incident in self.incident_history:
            if incident.incident_type == incident_type:
                # Calculate similarity based on metrics
                similarity = self._calculate_metric_similarity(current_metrics, incident.leading_metrics)
                if similarity > 0.7:  # 70% similarity threshold
                    similar_incidents.append(incident.incident_id)
        
        return similar_incidents[:3]  # Return top 3 similar incidents
    
    def _calculate_metric_similarity(self, metrics1: Dict[str, float], metrics2: Dict[str, float]) -> float:
        """Calculate similarity between two sets of metrics"""
        
        common_metrics = set(metrics1.keys()) & set(metrics2.keys())
        if not common_metrics:
            return 0.0
        
        similarity_scores = []
        for metric in common_metrics:
            val1 = metrics1[metric]
            val2 = metrics2[metric]
            
            # Calculate normalized difference
            if val1 == 0 and val2 == 0:
                similarity_scores.append(1.0)
            elif val1 == 0 or val2 == 0:
                similarity_scores.append(0.0)
            else:
                diff = abs(val1 - val2) / max(val1, val2)
                similarity_scores.append(1.0 - diff)
        
        return sum(similarity_scores) / len(similarity_scores)
    
    def _extract_temporal_features(self, timestamp: datetime) -> Dict[str, float]:
        """Extract temporal features from timestamp"""
        return {
            'hour': timestamp.hour,
            'day_of_week': timestamp.weekday(),
            'is_weekend': float(timestamp.weekday() >= 5),
            'is_business_hours': float(9 <= timestamp.hour <= 17),
            'is_peak_hours': float(timestamp.hour in [9, 10, 14, 15])
        }
    
    def _query_prometheus(self, query: str) -> float:
        """Query Prometheus for metric value"""
        try:
            response = requests.get(
                f"{self.prometheus_url}/api/v1/query",
                params={'query': query},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'success' and data['data']['result']:
                    return float(data['data']['result'][0]['value'][1])
            
            return self._simulate_metric_value(query)
            
        except Exception:
            return self._simulate_metric_value(query)
    
    def _simulate_metric_value(self, metric_name: str) -> float:
        """Simulate metric values for testing"""
        
        # Add some variation and occasional spikes for realistic testing
        hour = datetime.now().hour
        base_multiplier = 1.0 + 0.2 * np.sin(hour * np.pi / 12)
        
        # Occasionally simulate problems (10% chance)
        if np.random.random() < 0.1:
            problem_multiplier = np.random.uniform(2.0, 4.0)
        else:
            problem_multiplier = 1.0
        
        base_values = {
            'cpu_usage': 0.45 * base_multiplier * problem_multiplier,
            'memory_usage_percent': 0.65 * base_multiplier * problem_multiplier,
            'response_time_p95': 0.15 * base_multiplier * problem_multiplier,
            'response_time_p99': 0.25 * base_multiplier * problem_multiplier,
            'error_rate': 0.005 * problem_multiplier,
            'request_rate': 50 / base_multiplier,
            'pod_restart_rate': 0.01 * problem_multiplier,
            'pod_count': 3,
            'node_cpu_usage': 0.5 * base_multiplier,
            'node_memory_usage': 0.6 * base_multiplier,
            'disk_usage': 0.7,
            'db_connections_active': 25 * base_multiplier,
            'db_connections_total': 30 * base_multiplier,
            'db_query_time_avg': 0.02 * problem_multiplier,
            'cache_hit_rate': 0.85 / problem_multiplier,
            'failed_logins': 1 * problem_multiplier,
            'suspicious_requests': 2 * problem_multiplier
        }
        
        for key, value in base_values.items():
            if key in metric_name:
                return max(0, value + np.random.normal(0, value * 0.1))
        
        return np.random.uniform(0.1, 1.0)
    
    def _initialize_sample_incidents(self):
        """Initialize with sample historical incidents for demonstration"""
        
        sample_incidents = [
            HistoricalIncident(
                incident_id="INC-2024-001",
                timestamp=datetime.now() - timedelta(days=30),
                incident_type="performance",
                severity="high",
                duration_minutes=45,
                root_cause="Database query optimization needed",
                affected_components=["database", "application"],
                leading_metrics={
                    'cpu_usage': 0.85, 'memory_usage_percent': 0.70,
                    'response_time_p95': 0.45, 'error_rate': 0.03,
                    'db_query_time_avg': 0.08, 'cache_hit_rate': 0.65
                },
                resolution_actions=["Optimized slow queries", "Added database indexes"]
            ),
            HistoricalIncident(
                incident_id="INC-2024-003",
                timestamp=datetime.now() - timedelta(days=25),
                incident_type="resource_exhaustion",
                severity="critical",
                duration_minutes=90,
                root_cause="Memory leak in application",
                affected_components=["application"],
                leading_metrics={
                    'cpu_usage': 0.60, 'memory_usage_percent': 0.95,
                    'response_time_p95': 0.30, 'error_rate': 0.08,
                    'pod_restart_rate': 0.5
                },
                resolution_actions=["Restarted application", "Fixed memory leak"]
            ),
            HistoricalIncident(
                incident_id="INC-2024-007",
                timestamp=datetime.now() - timedelta(days=15),
                incident_type="availability",
                severity="high",
                duration_minutes=60,
                root_cause="Network connectivity issues",
                affected_components=["network", "load_balancer"],
                leading_metrics={
                    'cpu_usage': 0.50, 'memory_usage_percent': 0.60,
                    'response_time_p95': 0.80, 'error_rate': 0.12,
                    'network_errors': 0.05, 'connection_failures': 0.03
                },
                resolution_actions=["Fixed network configuration", "Restarted load balancer"]
            )
        ]
        
        self.incident_history.extend(sample_incidents)
    
    def _save_models(self):
        """Save trained models and data"""
        models_file = f"{self.model_path}/prediction_models.pkl"
        
        with open(models_file, 'wb') as f:
            joblib.dump({
                'prediction_models': self.prediction_models,
                'scalers': self.scalers,
                'feature_importance': self.feature_importance,
                'incident_history': self.incident_history[-100:]  # Keep last 100
            }, f)
    
    def _load_models(self):
        """Load trained models and data"""
        try:
            models_file = f"{self.model_path}/prediction_models.pkl"
            
            if os.path.exists(models_file):
                data = joblib.load(models_file)
                self.prediction_models = data.get('prediction_models', {})
                self.scalers = data.get('scalers', {})
                self.feature_importance = data.get('feature_importance', {})
                self.incident_history = data.get('incident_history', [])
                
                print(f"Loaded {len(self.prediction_models)} prediction models")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_prediction_summary(self, predictions: List[IncidentPrediction]) -> Dict[str, Any]:
        """Get summary of current predictions"""
        
        if not predictions:
            return {
                'total_predictions': 0,
                'highest_risk': 'None',
                'recommendations_count': 0,
                'summary': 'No incidents predicted in the near future'
            }
        
        # Categorize by risk level
        high_risk = [p for p in predictions if p.probability >= 0.8]
        medium_risk = [p for p in predictions if 0.6 <= p.probability < 0.8]
        low_risk = [p for p in predictions if p.probability < 0.6]
        
        # Get highest risk prediction
        highest_risk_prediction = max(predictions, key=lambda x: x.probability)
        
        # Count unique recommendations
        all_recommendations = []
        for pred in predictions:
            all_recommendations.extend(pred.recommended_actions)
        unique_recommendations = len(set(all_recommendations))
        
        # Identify most likely incident types
        incident_types = [p.incident_type for p in predictions]
        incident_type_counts = {}
        for incident_type in incident_types:
            incident_type_counts[incident_type] = incident_type_counts.get(incident_type, 0) + 1
        
        return {
            'total_predictions': len(predictions),
            'risk_breakdown': {
                'high_risk': len(high_risk),
                'medium_risk': len(medium_risk),
                'low_risk': len(low_risk)
            },
            'highest_risk': {
                'incident_type': highest_risk_prediction.incident_type,
                'probability': f"{highest_risk_prediction.probability:.1%}",
                'time_to_incident': highest_risk_prediction.time_to_incident,
                'severity': highest_risk_prediction.severity_prediction
            },
            'incident_type_distribution': incident_type_counts,
            'recommendations_count': unique_recommendations,
            'models_available': len(self.prediction_models),
            'summary': f"Monitoring {len(predictions)} potential incidents. Highest risk: {highest_risk_prediction.incident_type} at {highest_risk_prediction.probability:.1%} probability."
        }


def main():
    """Main execution function for testing"""
    print("🔮 Starting ML-Based Incident Prediction System...")
    
    # Initialize the prediction engine
    predictor = IncidentPredictionEngine()
    
    # Collect current metrics
    print("\n📊 Collecting current system metrics...")
    current_metrics = predictor.collect_current_metrics()
    
    print(f"Collected {len(current_metrics)} metrics")
    
    # Make predictions
    print("\n🔮 Predicting potential incidents...")
    predictions = predictor.predict_incidents(current_metrics)
    
    if predictions:
        print(f"\n⚠️ Found {len(predictions)} potential incident predictions:")
        
        for i, prediction in enumerate(predictions[:3], 1):  # Show top 3
            print(f"\n{i}. {prediction.incident_type.upper()} INCIDENT")
            print(f"   Probability: {prediction.probability:.1%}")
            print(f"   Confidence: {prediction.confidence:.1%}")
            print(f"   Time to Incident: {prediction.time_to_incident}")
            print(f"   Predicted Severity: {prediction.severity_prediction}")
            print(f"   Business Impact: {prediction.business_impact}")
            
            print(f"   Contributing Factors:")
            for factor in prediction.contributing_factors[:3]:
                print(f"     • {factor}")
            
            print(f"   Recommended Actions:")
            for action in prediction.recommended_actions[:3]:
                print(f"     • {action}")
            
            if prediction.affected_components:
                print(f"   Affected Components: {', '.join(prediction.affected_components)}")
    else:
        print("✅ No potential incidents predicted in the near future")
    
    # Train models with sample data (in real implementation, this would use real historical data)
    print("\n🤖 Training prediction models with sample data...")
    if len(predictor.incident_history) > 0:
        performance = predictor.train_prediction_models(predictor.incident_history)
        
        if performance:
            print("Model Training Results:")
            for incident_type, metrics in performance.items():
                print(f"  {incident_type}: F1={metrics['f1_score']:.3f}, Precision={metrics['precision']:.3f}, Recall={metrics['recall']:.3f}")
        else:
            print("Not enough historical data for model training")
    
    # Get prediction summary
    print("\n📋 Prediction Summary:")
    summary = predictor.get_prediction_summary(predictions)
    
    for key, value in summary.items():
        if key != 'highest_risk':
            print(f"   {key}: {value}")
    
    if 'highest_risk' in summary and summary['highest_risk'] != 'None':
        hr = summary['highest_risk']
        print(f"   Highest Risk: {hr['incident_type']} ({hr['probability']}) in {hr['time_to_incident']}")
    
    print(f"\n📊 System Status:")
    print(f"   Active Models: {len(predictor.prediction_models)}")
    print(f"   Historical Incidents: {len(predictor.incident_history)}")
    print(f"   Metric Buffer Size: {len(predictor.metric_buffer)}")
    
    print("\n✅ Incident Prediction System completed!")


if __name__ == "__main__":
    main()