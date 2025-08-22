#!/usr/bin/env python3
"""
AI-Powered Anomaly Detection System
Detects unusual patterns and behaviors in system metrics using machine learning
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score
import joblib
from scipy import stats
from scipy.signal import find_peaks
import requests
import warnings
warnings.filterwarnings('ignore')

@dataclass
class Anomaly:
    """Data class for detected anomalies"""
    timestamp: datetime
    metric_name: str
    actual_value: float
    expected_value: float
    anomaly_score: float
    severity: str  # low, medium, high, critical
    description: str
    confidence: float
    context: Dict[str, Any]
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data

@dataclass
class AnomalyPattern:
    """Data class for anomaly patterns"""
    pattern_type: str
    frequency: str
    description: str
    affected_metrics: List[str]
    correlation_score: float
    business_impact: str

class AnomalyDetector:
    """Advanced anomaly detection using multiple ML techniques"""
    
    def __init__(self, prometheus_url: str = "http://prometheus:9090"):
        self.prometheus_url = prometheus_url
        self.models = {}
        self.scalers = {}
        self.baselines = {}
        self.model_path = "/models/anomaly_detection"
        self.anomaly_history = []
        
        # Detection parameters
        self.contamination_rate = 0.1  # Expected proportion of anomalies
        self.sensitivity_threshold = 0.7  # Anomaly score threshold
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Initialize detection methods
        self.detection_methods = {
            'isolation_forest': self._isolation_forest_detection,
            'statistical': self._statistical_detection,
            'clustering': self._clustering_detection,
            'time_series': self._time_series_detection,
            'multivariate': self._multivariate_detection
        }
        
        # Load existing models
        self._load_models()
    
    def collect_real_time_data(self) -> pd.DataFrame:
        """Collect real-time metrics for anomaly detection"""
        current_time = datetime.now()
        
        # Define comprehensive metrics to monitor
        metrics_queries = {
            'cpu_usage': 'avg(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory_usage': 'avg(container_memory_usage_bytes{container="control-panel"}) / 1024 / 1024 / 1024',
            'request_rate': 'sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'response_time_p50': 'histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'response_time_p95': 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'response_time_p99': 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'error_rate': 'sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'db_connections_active': 'pg_stat_database_numbackends{datname="control_panel",state="active"}',
            'db_connections_idle': 'pg_stat_database_numbackends{datname="control_panel",state="idle"}',
            'db_query_time': 'avg(pg_stat_statements_mean_time_seconds)',
            'disk_usage': 'avg(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))',
            'network_in': 'avg(rate(container_network_receive_bytes_total{name="control-panel"}[5m]))',
            'network_out': 'avg(rate(container_network_transmit_bytes_total{name="control-panel"}[5m]))',
            'pod_restarts': 'increase(kube_pod_container_status_restarts_total{pod=~"control-panel.*"}[5m])',
            'active_sessions': 'sum(control_panel_active_sessions)',
            'cache_hit_rate': 'sum(rate(control_panel_cache_hits[5m])) / sum(rate(control_panel_cache_requests[5m]))',
            'integration_health': 'avg(control_panel_integration_health)',
        }
        
        # Collect current values
        data_point = {'timestamp': current_time}
        
        for metric_name, query in metrics_queries.items():
            try:
                value = self._query_prometheus(query)
                data_point[metric_name] = value
            except Exception as e:
                print(f"Warning: Could not fetch {metric_name}: {e}")
                data_point[metric_name] = self._simulate_metric_value(metric_name)
        
        # Add contextual information
        data_point.update(self._extract_contextual_features(current_time))
        
        return pd.DataFrame([data_point])
    
    def detect_anomalies(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies using multiple methods and ensemble them"""
        all_anomalies = []
        
        # Apply each detection method
        for method_name, method_func in self.detection_methods.items():
            try:
                method_anomalies = method_func(data)
                for anomaly in method_anomalies:
                    anomaly.description += f" (detected by {method_name})"
                all_anomalies.extend(method_anomalies)
            except Exception as e:
                print(f"Error in {method_name} detection: {e}")
        
        # Ensemble and deduplicate anomalies
        ensemble_anomalies = self._ensemble_anomalies(all_anomalies)
        
        # Store in history
        self.anomaly_history.extend(ensemble_anomalies)
        
        # Keep only recent history (last 24 hours)
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.anomaly_history = [
            a for a in self.anomaly_history 
            if a.timestamp > cutoff_time
        ]
        
        return ensemble_anomalies
    
    def _isolation_forest_detection(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies using Isolation Forest"""
        anomalies = []
        
        # Prepare numeric features
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        if len(numeric_columns) == 0:
            return anomalies
        
        X = data[numeric_columns].values
        
        # Handle missing values
        X = np.nan_to_num(X, nan=0.0)
        
        # Scale features
        scaler = RobustScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Fit Isolation Forest
        iso_forest = IsolationForest(
            contamination=self.contamination_rate,
            random_state=42,
            n_estimators=100
        )
        
        predictions = iso_forest.fit_predict(X_scaled)
        anomaly_scores = iso_forest.decision_function(X_scaled)
        
        # Process results
        for i, (pred, score) in enumerate(zip(predictions, anomaly_scores)):
            if pred == -1:  # Anomaly detected
                # Find the most anomalous feature
                feature_scores = []
                for j, feature in enumerate(numeric_columns):
                    feature_value = X_scaled[i, j]
                    feature_scores.append((feature, abs(feature_value)))
                
                # Sort by most anomalous
                feature_scores.sort(key=lambda x: x[1], reverse=True)
                most_anomalous_feature = feature_scores[0][0]
                
                anomaly = Anomaly(
                    timestamp=data.iloc[i]['timestamp'],
                    metric_name=most_anomalous_feature,
                    actual_value=data.iloc[i][most_anomalous_feature],
                    expected_value=self._get_expected_value(most_anomalous_feature, data.iloc[i]['timestamp']),
                    anomaly_score=abs(score),
                    severity=self._calculate_severity(abs(score)),
                    description=f"Unusual {most_anomalous_feature} pattern detected",
                    confidence=min(abs(score) / 0.5, 1.0),
                    context={'method': 'isolation_forest', 'all_features': dict(feature_scores[:3])}
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _statistical_detection(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies using statistical methods"""
        anomalies = []
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        for column in numeric_columns:
            values = data[column].dropna()
            if len(values) == 0:
                continue
            
            # Z-score detection
            z_scores = np.abs(stats.zscore(values))
            z_threshold = 3.0
            
            # Modified Z-score (more robust)
            median = np.median(values)
            mad = np.median(np.abs(values - median))
            modified_z_scores = 0.6745 * (values - median) / mad if mad != 0 else np.zeros_like(values)
            
            # IQR-based detection
            Q1 = values.quantile(0.25)
            Q3 = values.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            for i, (idx, value) in enumerate(values.items()):
                is_anomaly = False
                anomaly_score = 0
                reason = ""
                
                if z_scores.iloc[i] > z_threshold:
                    is_anomaly = True
                    anomaly_score = z_scores.iloc[i] / z_threshold
                    reason = f"High Z-score ({z_scores.iloc[i]:.2f})"
                
                elif abs(modified_z_scores.iloc[i]) > 3.5:
                    is_anomaly = True
                    anomaly_score = abs(modified_z_scores.iloc[i]) / 3.5
                    reason = f"High modified Z-score ({modified_z_scores.iloc[i]:.2f})"
                
                elif value < lower_bound or value > upper_bound:
                    is_anomaly = True
                    anomaly_score = max(
                        (lower_bound - value) / IQR if value < lower_bound else 0,
                        (value - upper_bound) / IQR if value > upper_bound else 0
                    )
                    reason = f"Outside IQR bounds ({lower_bound:.3f}, {upper_bound:.3f})"
                
                if is_anomaly:
                    anomaly = Anomaly(
                        timestamp=data.iloc[idx]['timestamp'],
                        metric_name=column,
                        actual_value=value,
                        expected_value=median,
                        anomaly_score=anomaly_score,
                        severity=self._calculate_severity(anomaly_score),
                        description=f"Statistical anomaly in {column}: {reason}",
                        confidence=min(anomaly_score / 2.0, 1.0),
                        context={'method': 'statistical', 'reason': reason}
                    )
                    anomalies.append(anomaly)
        
        return anomalies
    
    def _clustering_detection(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies using density-based clustering"""
        anomalies = []
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        if len(numeric_columns) < 2 or len(data) < 10:
            return anomalies
        
        X = data[numeric_columns].values
        X = np.nan_to_num(X, nan=0.0)
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Apply DBSCAN clustering
        dbscan = DBSCAN(eps=0.5, min_samples=max(2, len(data) // 10))
        cluster_labels = dbscan.fit_predict(X_scaled)
        
        # Points labeled as -1 are outliers
        outlier_indices = np.where(cluster_labels == -1)[0]
        
        for idx in outlier_indices:
            # Find the most unusual feature for this outlier
            point = X_scaled[idx]
            distances = np.abs(point)
            most_unusual_feature_idx = np.argmax(distances)
            most_unusual_feature = numeric_columns[most_unusual_feature_idx]
            
            anomaly = Anomaly(
                timestamp=data.iloc[idx]['timestamp'],
                metric_name=most_unusual_feature,
                actual_value=data.iloc[idx][most_unusual_feature],
                expected_value=self._get_expected_value(most_unusual_feature, data.iloc[idx]['timestamp']),
                anomaly_score=distances[most_unusual_feature_idx],
                severity=self._calculate_severity(distances[most_unusual_feature_idx]),
                description=f"Clustering outlier detected in {most_unusual_feature}",
                confidence=min(distances[most_unusual_feature_idx] / 2.0, 1.0),
                context={'method': 'clustering', 'cluster_id': -1}
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def _time_series_detection(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies in time series patterns"""
        anomalies = []
        
        # This method requires historical data, so we'll simulate it for now
        # In a real implementation, you would collect recent historical data
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        for column in numeric_columns:
            current_value = data[column].iloc[0] if len(data) > 0 else 0
            
            # Get baseline/expected value for this time
            expected_value = self._get_expected_value(column, data.iloc[0]['timestamp'])
            
            # Calculate relative deviation
            if expected_value != 0:
                relative_deviation = abs(current_value - expected_value) / expected_value
            else:
                relative_deviation = abs(current_value)
            
            # Detect significant deviations
            if relative_deviation > 0.3:  # 30% deviation threshold
                anomaly = Anomaly(
                    timestamp=data.iloc[0]['timestamp'],
                    metric_name=column,
                    actual_value=current_value,
                    expected_value=expected_value,
                    anomaly_score=relative_deviation,
                    severity=self._calculate_severity(relative_deviation * 2),
                    description=f"Time series deviation in {column}: {relative_deviation:.1%} from expected",
                    confidence=min(relative_deviation / 0.5, 1.0),
                    context={'method': 'time_series', 'deviation_percent': relative_deviation * 100}
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _multivariate_detection(self, data: pd.DataFrame) -> List[Anomaly]:
        """Detect anomalies using multivariate analysis"""
        anomalies = []
        
        numeric_columns = data.select_dtypes(include=[np.number]).columns
        numeric_columns = [col for col in numeric_columns if col not in ['timestamp']]
        
        if len(numeric_columns) < 3:
            return anomalies
        
        X = data[numeric_columns].values
        X = np.nan_to_num(X, nan=0.0)
        
        # Use PCA to detect multivariate outliers
        try:
            pca = PCA(n_components=min(3, len(numeric_columns)))
            X_pca = pca.fit_transform(X)
            
            # Calculate reconstruction error
            X_reconstructed = pca.inverse_transform(X_pca)
            reconstruction_errors = np.sum((X - X_reconstructed) ** 2, axis=1)
            
            # Find outliers based on reconstruction error
            error_threshold = np.percentile(reconstruction_errors, 95)
            
            for i, error in enumerate(reconstruction_errors):
                if error > error_threshold:
                    # Find the most contributing feature to the error
                    feature_errors = (X[i] - X_reconstructed[i]) ** 2
                    most_error_feature_idx = np.argmax(feature_errors)
                    most_error_feature = numeric_columns[most_error_feature_idx]
                    
                    anomaly = Anomaly(
                        timestamp=data.iloc[i]['timestamp'],
                        metric_name=most_error_feature,
                        actual_value=data.iloc[i][most_error_feature],
                        expected_value=X_reconstructed[i][most_error_feature_idx],
                        anomaly_score=error / error_threshold,
                        severity=self._calculate_severity(error / error_threshold),
                        description=f"Multivariate anomaly in {most_error_feature}",
                        confidence=min(error / (error_threshold * 2), 1.0),
                        context={'method': 'multivariate', 'reconstruction_error': error}
                    )
                    anomalies.append(anomaly)
        
        except Exception as e:
            print(f"Error in multivariate detection: {e}")
        
        return anomalies
    
    def _ensemble_anomalies(self, anomalies: List[Anomaly]) -> List[Anomaly]:
        """Combine and deduplicate anomalies from multiple methods"""
        if not anomalies:
            return []
        
        # Group anomalies by timestamp and metric
        grouped = {}
        for anomaly in anomalies:
            key = (anomaly.timestamp, anomaly.metric_name)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(anomaly)
        
        # Ensemble each group
        ensemble_anomalies = []
        for (timestamp, metric_name), group in grouped.items():
            if len(group) == 1:
                ensemble_anomalies.append(group[0])
            else:
                # Combine multiple detections of the same anomaly
                combined_score = np.mean([a.anomaly_score for a in group])
                combined_confidence = np.mean([a.confidence for a in group])
                methods = [a.context.get('method', 'unknown') for a in group]
                
                # Use the anomaly with highest confidence as base
                base_anomaly = max(group, key=lambda x: x.confidence)
                
                ensemble_anomaly = Anomaly(
                    timestamp=timestamp,
                    metric_name=metric_name,
                    actual_value=base_anomaly.actual_value,
                    expected_value=base_anomaly.expected_value,
                    anomaly_score=combined_score,
                    severity=self._calculate_severity(combined_score),
                    description=f"Anomaly in {metric_name} (detected by {', '.join(set(methods))})",
                    confidence=combined_confidence,
                    context={
                        'methods': methods,
                        'detection_count': len(group),
                        'ensemble': True
                    }
                )
                ensemble_anomalies.append(ensemble_anomaly)
        
        # Filter by confidence threshold
        return [a for a in ensemble_anomalies if a.confidence >= 0.3]
    
    def detect_anomaly_patterns(self) -> List[AnomalyPattern]:
        """Detect patterns in anomaly history"""
        if len(self.anomaly_history) < 10:
            return []
        
        patterns = []
        
        # Convert to DataFrame for analysis
        anomaly_data = []
        for anomaly in self.anomaly_history:
            anomaly_data.append({
                'timestamp': anomaly.timestamp,
                'metric_name': anomaly.metric_name,
                'severity': anomaly.severity,
                'anomaly_score': anomaly.anomaly_score,
                'hour': anomaly.timestamp.hour,
                'day_of_week': anomaly.timestamp.weekday()
            })
        
        df = pd.DataFrame(anomaly_data)
        
        # Detect temporal patterns
        patterns.extend(self._detect_temporal_patterns(df))
        
        # Detect metric correlation patterns
        patterns.extend(self._detect_correlation_patterns(df))
        
        # Detect severity patterns
        patterns.extend(self._detect_severity_patterns(df))
        
        return patterns
    
    def _detect_temporal_patterns(self, df: pd.DataFrame) -> List[AnomalyPattern]:
        """Detect temporal patterns in anomalies"""
        patterns = []
        
        # Hourly patterns
        hourly_counts = df.groupby('hour').size()
        if len(hourly_counts) > 0:
            peak_hours = hourly_counts.nlargest(3).index.tolist()
            if hourly_counts.max() > hourly_counts.mean() + 2 * hourly_counts.std():
                patterns.append(AnomalyPattern(
                    pattern_type="temporal_hourly",
                    frequency="hourly",
                    description=f"Anomalies spike during hours: {peak_hours}",
                    affected_metrics=df[df['hour'].isin(peak_hours)]['metric_name'].unique().tolist(),
                    correlation_score=0.8,
                    business_impact="Potential scheduled job or traffic pattern issues"
                ))
        
        # Daily patterns
        daily_counts = df.groupby('day_of_week').size()
        if len(daily_counts) > 0:
            peak_days = daily_counts.nlargest(2).index.tolist()
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            peak_day_names = [day_names[day] for day in peak_days]
            
            if daily_counts.max() > daily_counts.mean() + daily_counts.std():
                patterns.append(AnomalyPattern(
                    pattern_type="temporal_daily",
                    frequency="daily",
                    description=f"Anomalies spike on: {', '.join(peak_day_names)}",
                    affected_metrics=df[df['day_of_week'].isin(peak_days)]['metric_name'].unique().tolist(),
                    correlation_score=0.7,
                    business_impact="Weekly pattern suggests business process correlation"
                ))
        
        return patterns
    
    def _detect_correlation_patterns(self, df: pd.DataFrame) -> List[AnomalyPattern]:
        """Detect correlation patterns between metrics"""
        patterns = []
        
        # Find metrics that often have anomalies together
        metric_combinations = df.groupby('timestamp')['metric_name'].apply(list)
        
        # Count co-occurrences
        co_occurrence = {}
        for metrics_list in metric_combinations:
            if len(metrics_list) > 1:
                for i, metric1 in enumerate(metrics_list):
                    for metric2 in metrics_list[i+1:]:
                        pair = tuple(sorted([metric1, metric2]))
                        co_occurrence[pair] = co_occurrence.get(pair, 0) + 1
        
        # Find significant correlations
        total_anomalies = len(df)
        for (metric1, metric2), count in co_occurrence.items():
            correlation_score = count / total_anomalies
            if correlation_score > 0.3:  # 30% co-occurrence threshold
                patterns.append(AnomalyPattern(
                    pattern_type="metric_correlation",
                    frequency="various",
                    description=f"Anomalies in {metric1} and {metric2} often occur together",
                    affected_metrics=[metric1, metric2],
                    correlation_score=correlation_score,
                    business_impact="Suggests underlying system dependency or common cause"
                ))
        
        return patterns
    
    def _detect_severity_patterns(self, df: pd.DataFrame) -> List[AnomalyPattern]:
        """Detect patterns in anomaly severity"""
        patterns = []
        
        severity_counts = df['severity'].value_counts()
        total_anomalies = len(df)
        
        if 'critical' in severity_counts and severity_counts['critical'] / total_anomalies > 0.2:
            critical_metrics = df[df['severity'] == 'critical']['metric_name'].value_counts()
            patterns.append(AnomalyPattern(
                pattern_type="high_severity",
                frequency="various",
                description=f"High rate of critical anomalies ({severity_counts['critical']} out of {total_anomalies})",
                affected_metrics=critical_metrics.head(3).index.tolist(),
                correlation_score=severity_counts['critical'] / total_anomalies,
                business_impact="System stability concerns - immediate attention required"
            ))
        
        return patterns
    
    def _query_prometheus(self, query: str) -> float:
        """Query Prometheus for current value"""
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
            
            # Fallback to simulated data
            return self._simulate_metric_value(query)
            
        except Exception:
            return self._simulate_metric_value(query)
    
    def _simulate_metric_value(self, metric_name: str) -> float:
        """Simulate realistic metric values with occasional anomalies"""
        base_values = {
            'cpu_usage': 0.4 + 0.1 * np.sin(datetime.now().hour * np.pi / 12),
            'memory_usage': 1.5 + 0.3 * np.random.normal(),
            'request_rate': 50 + 15 * np.sin(datetime.now().hour * np.pi / 12),
            'response_time_p50': np.random.lognormal(np.log(0.1), 0.2),
            'response_time_p95': np.random.lognormal(np.log(0.2), 0.3),
            'response_time_p99': np.random.lognormal(np.log(0.3), 0.4),
            'error_rate': np.random.exponential(0.005),
            'db_connections_active': np.random.poisson(25),
            'db_connections_idle': np.random.poisson(15),
            'db_query_time': np.random.lognormal(np.log(0.02), 0.3),
            'disk_usage': 0.6 + 0.1 * np.random.normal(),
            'network_in': np.random.normal(1000000, 200000),
            'network_out': np.random.normal(800000, 150000),
            'pod_restarts': np.random.poisson(0.1),
            'active_sessions': np.random.poisson(100),
            'cache_hit_rate': 0.85 + 0.1 * np.random.normal(),
            'integration_health': np.random.choice([0.0, 1.0], p=[0.05, 0.95])
        }
        
        # Add some anomalies (5% chance)
        if np.random.random() < 0.05:
            # Create anomaly
            for key in base_values:
                if key in metric_name.lower():
                    return base_values[key] * np.random.uniform(2.0, 5.0)  # 2-5x normal value
        
        # Return normal value
        for key, value in base_values.items():
            if key in metric_name.lower():
                return max(0, value)
        
        return np.random.normal(1.0, 0.2)
    
    def _extract_contextual_features(self, timestamp: datetime) -> Dict:
        """Extract contextual features that might influence anomalies"""
        return {
            'hour': timestamp.hour,
            'day_of_week': timestamp.weekday(),
            'is_weekend': timestamp.weekday() >= 5,
            'is_business_hours': 9 <= timestamp.hour <= 17,
            'is_peak_hours': timestamp.hour in [9, 10, 14, 15],
            'day_of_month': timestamp.day,
            'month': timestamp.month
        }
    
    def _get_expected_value(self, metric_name: str, timestamp: datetime) -> float:
        """Get expected value for a metric at a given time"""
        # This would normally use historical baselines
        # For now, we'll return simulated baseline values
        
        hour_factor = np.sin(timestamp.hour * np.pi / 12)
        day_factor = 1.2 if timestamp.weekday() < 5 else 0.8  # Higher on weekdays
        
        base_expectations = {
            'cpu_usage': 0.4 + 0.1 * hour_factor * day_factor,
            'memory_usage': 1.5 + 0.2 * hour_factor,
            'request_rate': 50 + 20 * hour_factor * day_factor,
            'response_time_p95': 0.15 + 0.05 * hour_factor,
            'error_rate': 0.005,
            'db_connections_active': 25 + 5 * hour_factor,
            'disk_usage': 0.6,
            'cache_hit_rate': 0.85
        }
        
        for key, value in base_expectations.items():
            if key in metric_name:
                return value
        
        return 1.0
    
    def _calculate_severity(self, anomaly_score: float) -> str:
        """Calculate anomaly severity based on score"""
        if anomaly_score >= 2.0:
            return "critical"
        elif anomaly_score >= 1.5:
            return "high"
        elif anomaly_score >= 1.0:
            return "medium"
        else:
            return "low"
    
    def _save_models(self):
        """Save trained models and baselines"""
        models_file = f"{self.model_path}/anomaly_models.pkl"
        baselines_file = f"{self.model_path}/baselines.json"
        
        with open(models_file, 'wb') as f:
            pickle.dump({
                'models': self.models,
                'scalers': self.scalers
            }, f)
        
        with open(baselines_file, 'w') as f:
            json.dump(self.baselines, f, indent=2)
    
    def _load_models(self):
        """Load trained models and baselines"""
        try:
            models_file = f"{self.model_path}/anomaly_models.pkl"
            baselines_file = f"{self.model_path}/baselines.json"
            
            if os.path.exists(models_file):
                with open(models_file, 'rb') as f:
                    data = pickle.load(f)
                    self.models = data.get('models', {})
                    self.scalers = data.get('scalers', {})
            
            if os.path.exists(baselines_file):
                with open(baselines_file, 'r') as f:
                    self.baselines = json.load(f)
            
            print(f"Loaded anomaly detection models and baselines")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_anomaly_summary(self) -> Dict:
        """Get summary of recent anomalies and patterns"""
        recent_anomalies = [a for a in self.anomaly_history if a.timestamp > datetime.now() - timedelta(hours=1)]
        patterns = self.detect_anomaly_patterns()
        
        severity_counts = {}
        metric_counts = {}
        
        for anomaly in recent_anomalies:
            severity_counts[anomaly.severity] = severity_counts.get(anomaly.severity, 0) + 1
            metric_counts[anomaly.metric_name] = metric_counts.get(anomaly.metric_name, 0) + 1
        
        return {
            'recent_anomalies_count': len(recent_anomalies),
            'total_anomalies_24h': len(self.anomaly_history),
            'severity_distribution': severity_counts,
            'top_affected_metrics': dict(sorted(metric_counts.items(), key=lambda x: x[1], reverse=True)[:5]),
            'patterns_detected': len(patterns),
            'pattern_summary': [
                {
                    'type': p.pattern_type,
                    'description': p.description,
                    'business_impact': p.business_impact
                } for p in patterns
            ]
        }


def main():
    """Main execution function for testing"""
    print("🤖 Starting AI-Powered Anomaly Detection System...")
    
    # Initialize the detector
    detector = AnomalyDetector()
    
    # Simulate real-time anomaly detection
    for i in range(10):
        print(f"\n📊 Detection cycle {i+1}/10")
        
        # Collect real-time data
        current_data = detector.collect_real_time_data()
        print(f"Collected {len(current_data)} data points")
        
        # Detect anomalies
        anomalies = detector.detect_anomalies(current_data)
        
        if anomalies:
            print(f"🚨 Detected {len(anomalies)} anomalies:")
            for anomaly in anomalies:
                print(f"  - {anomaly.severity.upper()}: {anomaly.description}")
                print(f"    Metric: {anomaly.metric_name}, Score: {anomaly.anomaly_score:.3f}")
                print(f"    Confidence: {anomaly.confidence:.2f}")
        else:
            print("✅ No anomalies detected")
        
        # Add some delay to simulate real-time processing
        import time
        time.sleep(1)
    
    # Detect patterns
    print("\n🔍 Analyzing anomaly patterns...")
    patterns = detector.detect_anomaly_patterns()
    
    if patterns:
        print(f"📈 Detected {len(patterns)} patterns:")
        for pattern in patterns:
            print(f"  - {pattern.pattern_type}: {pattern.description}")
            print(f"    Business Impact: {pattern.business_impact}")
    else:
        print("ℹ️ No significant patterns detected yet")
    
    # Get summary
    print("\n📋 Anomaly Summary:")
    summary = detector.get_anomaly_summary()
    print(json.dumps(summary, indent=2))
    
    print("\n✅ Anomaly Detection completed!")


if __name__ == "__main__":
    main()