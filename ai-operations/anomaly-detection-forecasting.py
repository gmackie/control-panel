import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
from sklearn.ensemble import IsolationForest
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from scipy import stats
from scipy.signal import find_peaks
import hashlib
from collections import defaultdict, deque
import heapq

class AnomalyType(Enum):
    POINT_ANOMALY = "point_anomaly"  # Single data point anomaly
    CONTEXTUAL_ANOMALY = "contextual_anomaly"  # Anomaly in specific context
    COLLECTIVE_ANOMALY = "collective_anomaly"  # Group of data points forming anomaly
    TREND_ANOMALY = "trend_anomaly"  # Deviation from expected trend
    SEASONAL_ANOMALY = "seasonal_anomaly"  # Deviation from seasonal pattern
    CORRELATION_ANOMALY = "correlation_anomaly"  # Broken correlation between metrics

class DetectionMethod(Enum):
    STATISTICAL = "statistical"
    MACHINE_LEARNING = "machine_learning"
    DEEP_LEARNING = "deep_learning"
    ENSEMBLE = "ensemble"
    RULE_BASED = "rule_based"

class ForecastModel(Enum):
    ARIMA = "arima"
    PROPHET = "prophet"
    LSTM = "lstm"
    RANDOM_FOREST = "random_forest"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    ENSEMBLE = "ensemble"

class AnomalySeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

@dataclass
class TimeSeriesData:
    metric_id: str
    metric_name: str
    service: str
    timestamp: datetime
    value: float
    tags: Dict[str, str] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Anomaly:
    anomaly_id: str
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    metric_id: str
    service: str
    timestamp: datetime
    value: float
    expected_value: float
    deviation: float
    z_score: float
    confidence: float
    detection_method: DetectionMethod
    context: Dict[str, Any] = field(default_factory=dict)
    related_anomalies: List[str] = field(default_factory=list)
    possible_causes: List[str] = field(default_factory=list)
    recommended_actions: List[str] = field(default_factory=list)

@dataclass
class Forecast:
    forecast_id: str
    metric_id: str
    service: str
    model_type: ForecastModel
    forecast_start: datetime
    forecast_end: datetime
    predicted_values: List[float]
    confidence_intervals: List[Tuple[float, float]]
    accuracy_metrics: Dict[str, float]
    anomaly_predictions: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Pattern:
    pattern_id: str
    pattern_type: str  # daily, weekly, monthly, custom
    metric_id: str
    pattern_values: List[float]
    confidence: float
    last_updated: datetime
    exceptions: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class MetricCorrelation:
    correlation_id: str
    metric1_id: str
    metric2_id: str
    correlation_coefficient: float
    lag: int  # Time lag in correlation
    confidence: float
    relationship_type: str  # linear, non-linear, inverse
    strength: str  # weak, moderate, strong

class StatisticalDetector:
    def __init__(self):
        self.baselines = {}
        self.thresholds = {}
        self.seasonal_patterns = {}
        
    async def detect_anomalies(self, time_series: List[TimeSeriesData]) -> List[Anomaly]:
        """Detect anomalies using statistical methods"""
        anomalies = []
        
        # Group by metric
        metric_groups = defaultdict(list)
        for data_point in time_series:
            metric_groups[data_point.metric_id].append(data_point)
        
        for metric_id, data_points in metric_groups.items():
            # Sort by timestamp
            data_points.sort(key=lambda x: x.timestamp)
            values = np.array([dp.value for dp in data_points])
            
            # Calculate baseline statistics
            mean = np.mean(values)
            std = np.std(values)
            median = np.median(values)
            mad = np.median(np.abs(values - median))  # Median Absolute Deviation
            
            # Store baseline
            self.baselines[metric_id] = {
                'mean': mean,
                'std': std,
                'median': median,
                'mad': mad
            }
            
            # Detect anomalies using multiple methods
            z_score_anomalies = await self._detect_zscore_anomalies(data_points, mean, std)
            anomalies.extend(z_score_anomalies)
            
            iqr_anomalies = await self._detect_iqr_anomalies(data_points, values)
            anomalies.extend(iqr_anomalies)
            
            mad_anomalies = await self._detect_mad_anomalies(data_points, median, mad)
            anomalies.extend(mad_anomalies)
            
            if len(values) >= 50:  # Need sufficient data for trend analysis
                trend_anomalies = await self._detect_trend_anomalies(data_points, values)
                anomalies.extend(trend_anomalies)
        
        return anomalies
    
    async def _detect_zscore_anomalies(self, data_points: List[TimeSeriesData], 
                                      mean: float, std: float) -> List[Anomaly]:
        """Detect anomalies using z-score method"""
        anomalies = []
        threshold = 3.0  # 3 standard deviations
        
        for dp in data_points:
            if std > 0:
                z_score = abs((dp.value - mean) / std)
                if z_score > threshold:
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.POINT_ANOMALY,
                        severity=self._calculate_severity(z_score),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=mean,
                        deviation=dp.value - mean,
                        z_score=z_score,
                        confidence=min(0.99, 1 - (1 / z_score)),
                        detection_method=DetectionMethod.STATISTICAL,
                        context={'method': 'z-score', 'threshold': threshold},
                        possible_causes=self._generate_possible_causes(dp, z_score)
                    ))
        
        return anomalies
    
    async def _detect_iqr_anomalies(self, data_points: List[TimeSeriesData], 
                                   values: np.ndarray) -> List[Anomaly]:
        """Detect anomalies using Interquartile Range method"""
        anomalies = []
        
        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        for dp in data_points:
            if dp.value < lower_bound or dp.value > upper_bound:
                deviation = min(abs(dp.value - lower_bound), abs(dp.value - upper_bound))
                z_score = deviation / (iqr + 1e-10)
                
                anomalies.append(Anomaly(
                    anomaly_id=str(uuid.uuid4()),
                    anomaly_type=AnomalyType.POINT_ANOMALY,
                    severity=self._calculate_severity(z_score),
                    metric_id=dp.metric_id,
                    service=dp.service,
                    timestamp=dp.timestamp,
                    value=dp.value,
                    expected_value=(q1 + q3) / 2,
                    deviation=deviation,
                    z_score=z_score,
                    confidence=0.85,
                    detection_method=DetectionMethod.STATISTICAL,
                    context={
                        'method': 'iqr',
                        'lower_bound': lower_bound,
                        'upper_bound': upper_bound
                    }
                ))
        
        return anomalies
    
    async def _detect_mad_anomalies(self, data_points: List[TimeSeriesData],
                                   median: float, mad: float) -> List[Anomaly]:
        """Detect anomalies using Median Absolute Deviation"""
        anomalies = []
        threshold = 3.5  # Modified z-score threshold for MAD
        
        for dp in data_points:
            if mad > 0:
                modified_z_score = 0.6745 * (dp.value - median) / mad
                if abs(modified_z_score) > threshold:
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.POINT_ANOMALY,
                        severity=self._calculate_severity(abs(modified_z_score)),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=median,
                        deviation=dp.value - median,
                        z_score=abs(modified_z_score),
                        confidence=0.90,
                        detection_method=DetectionMethod.STATISTICAL,
                        context={'method': 'mad', 'threshold': threshold}
                    ))
        
        return anomalies
    
    async def _detect_trend_anomalies(self, data_points: List[TimeSeriesData],
                                     values: np.ndarray) -> List[Anomaly]:
        """Detect anomalies in trends"""
        anomalies = []
        
        # Fit linear trend
        x = np.arange(len(values))
        coeffs = np.polyfit(x, values, 1)
        trend_line = np.polyval(coeffs, x)
        
        # Calculate residuals
        residuals = values - trend_line
        residual_std = np.std(residuals)
        
        # Detect significant deviations from trend
        for i, dp in enumerate(data_points):
            if residual_std > 0:
                deviation = abs(residuals[i])
                z_score = deviation / residual_std
                
                if z_score > 2.5:
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.TREND_ANOMALY,
                        severity=self._calculate_severity(z_score),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=trend_line[i],
                        deviation=residuals[i],
                        z_score=z_score,
                        confidence=0.80,
                        detection_method=DetectionMethod.STATISTICAL,
                        context={
                            'method': 'trend_analysis',
                            'trend_slope': coeffs[0],
                            'trend_intercept': coeffs[1]
                        }
                    ))
        
        return anomalies
    
    def _calculate_severity(self, z_score: float) -> AnomalySeverity:
        """Calculate anomaly severity based on z-score"""
        if z_score > 5:
            return AnomalySeverity.CRITICAL
        elif z_score > 4:
            return AnomalySeverity.HIGH
        elif z_score > 3:
            return AnomalySeverity.MEDIUM
        elif z_score > 2:
            return AnomalySeverity.LOW
        else:
            return AnomalySeverity.INFO
    
    def _generate_possible_causes(self, data_point: TimeSeriesData, z_score: float) -> List[str]:
        """Generate possible causes for anomaly"""
        causes = []
        
        if z_score > 4:
            causes.extend([
                "System failure or critical error",
                "External attack or malicious activity",
                "Major configuration change"
            ])
        elif z_score > 3:
            causes.extend([
                "Resource exhaustion",
                "Network congestion",
                "Database performance issue"
            ])
        else:
            causes.extend([
                "Normal variance",
                "Scheduled maintenance",
                "Traffic spike"
            ])
        
        return causes

class MachineLearningDetector:
    def __init__(self):
        self.models = {}
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)  # Keep 95% variance
        
    async def detect_anomalies(self, time_series: List[TimeSeriesData]) -> List[Anomaly]:
        """Detect anomalies using ML methods"""
        anomalies = []
        
        # Group by metric
        metric_groups = defaultdict(list)
        for data_point in time_series:
            metric_groups[data_point.metric_id].append(data_point)
        
        for metric_id, data_points in metric_groups.items():
            if len(data_points) < 50:  # Need minimum data for ML
                continue
            
            # Prepare features
            features = await self._prepare_features(data_points)
            
            if features.shape[0] < 10:
                continue
            
            # Isolation Forest
            iso_anomalies = await self._detect_isolation_forest(data_points, features)
            anomalies.extend(iso_anomalies)
            
            # DBSCAN clustering
            dbscan_anomalies = await self._detect_dbscan(data_points, features)
            anomalies.extend(dbscan_anomalies)
            
            # Local Outlier Factor (if more data available)
            if len(data_points) >= 100:
                lof_anomalies = await self._detect_lof(data_points, features)
                anomalies.extend(lof_anomalies)
        
        return anomalies
    
    async def _prepare_features(self, data_points: List[TimeSeriesData]) -> np.ndarray:
        """Prepare feature matrix for ML models"""
        features = []
        window_size = 5
        
        values = [dp.value for dp in data_points]
        
        for i in range(window_size, len(values)):
            window = values[i-window_size:i]
            
            # Statistical features
            feature_vector = [
                values[i],  # Current value
                np.mean(window),  # Window mean
                np.std(window),  # Window std
                np.max(window),  # Window max
                np.min(window),  # Window min
                values[i] - np.mean(window),  # Deviation from window mean
                (values[i] - values[i-1]) if i > 0 else 0,  # First difference
            ]
            
            # Time-based features
            timestamp = data_points[i].timestamp
            feature_vector.extend([
                timestamp.hour,
                timestamp.weekday(),
                timestamp.day,
                timestamp.month
            ])
            
            features.append(feature_vector)
        
        return np.array(features)
    
    async def _detect_isolation_forest(self, data_points: List[TimeSeriesData],
                                      features: np.ndarray) -> List[Anomaly]:
        """Detect anomalies using Isolation Forest"""
        anomalies = []
        
        # Train Isolation Forest
        iso_forest = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            random_state=42
        )
        
        # Fit and predict
        predictions = iso_forest.fit_predict(features)
        anomaly_scores = iso_forest.score_samples(features)
        
        # Process anomalies
        window_size = 5
        for i, pred in enumerate(predictions):
            if pred == -1:  # Anomaly detected
                actual_idx = i + window_size
                if actual_idx < len(data_points):
                    dp = data_points[actual_idx]
                    score = abs(anomaly_scores[i])
                    
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.POINT_ANOMALY,
                        severity=self._calculate_ml_severity(score),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=np.mean([data_points[j].value for j in range(max(0, actual_idx-5), actual_idx)]),
                        deviation=score,
                        z_score=score * 10,  # Convert to pseudo z-score
                        confidence=min(0.95, 0.5 + score),
                        detection_method=DetectionMethod.MACHINE_LEARNING,
                        context={'method': 'isolation_forest', 'anomaly_score': score}
                    ))
        
        return anomalies
    
    async def _detect_dbscan(self, data_points: List[TimeSeriesData],
                            features: np.ndarray) -> List[Anomaly]:
        """Detect anomalies using DBSCAN clustering"""
        anomalies = []
        
        # Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # Apply PCA if high dimensional
        if features_scaled.shape[1] > 10:
            features_scaled = self.pca.fit_transform(features_scaled)
        
        # DBSCAN clustering
        dbscan = DBSCAN(eps=0.5, min_samples=5)
        clusters = dbscan.fit_predict(features_scaled)
        
        # Outliers have label -1
        window_size = 5
        for i, cluster in enumerate(clusters):
            if cluster == -1:
                actual_idx = i + window_size
                if actual_idx < len(data_points):
                    dp = data_points[actual_idx]
                    
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.COLLECTIVE_ANOMALY,
                        severity=AnomalySeverity.MEDIUM,
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=np.mean([data_points[j].value for j in range(max(0, actual_idx-5), actual_idx)]),
                        deviation=1.0,
                        z_score=3.0,
                        confidence=0.75,
                        detection_method=DetectionMethod.MACHINE_LEARNING,
                        context={'method': 'dbscan', 'cluster': 'outlier'}
                    ))
        
        return anomalies
    
    async def _detect_lof(self, data_points: List[TimeSeriesData],
                         features: np.ndarray) -> List[Anomaly]:
        """Detect anomalies using Local Outlier Factor"""
        from sklearn.neighbors import LocalOutlierFactor
        
        anomalies = []
        
        # Train LOF
        lof = LocalOutlierFactor(n_neighbors=20, contamination=0.1)
        predictions = lof.fit_predict(features)
        scores = lof.negative_outlier_factor_
        
        # Process anomalies
        window_size = 5
        for i, pred in enumerate(predictions):
            if pred == -1:
                actual_idx = i + window_size
                if actual_idx < len(data_points):
                    dp = data_points[actual_idx]
                    score = abs(scores[i])
                    
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.CONTEXTUAL_ANOMALY,
                        severity=self._calculate_ml_severity(score / 10),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=np.mean([data_points[j].value for j in range(max(0, actual_idx-5), actual_idx)]),
                        deviation=score,
                        z_score=score,
                        confidence=0.80,
                        detection_method=DetectionMethod.MACHINE_LEARNING,
                        context={'method': 'lof', 'outlier_factor': score}
                    ))
        
        return anomalies
    
    def _calculate_ml_severity(self, score: float) -> AnomalySeverity:
        """Calculate severity for ML-detected anomalies"""
        if score > 0.8:
            return AnomalySeverity.HIGH
        elif score > 0.6:
            return AnomalySeverity.MEDIUM
        elif score > 0.4:
            return AnomalySeverity.LOW
        else:
            return AnomalySeverity.INFO

class PatternAnalyzer:
    def __init__(self):
        self.patterns = {}
        self.correlations = {}
        
    async def detect_pattern_anomalies(self, time_series: List[TimeSeriesData]) -> List[Anomaly]:
        """Detect anomalies in patterns and correlations"""
        anomalies = []
        
        # Group by metric
        metric_groups = defaultdict(list)
        for data_point in time_series:
            metric_groups[data_point.metric_id].append(data_point)
        
        # Detect seasonal anomalies
        for metric_id, data_points in metric_groups.items():
            if len(data_points) >= 168:  # At least 1 week of hourly data
                seasonal_anomalies = await self._detect_seasonal_anomalies(data_points)
                anomalies.extend(seasonal_anomalies)
        
        # Detect correlation anomalies
        if len(metric_groups) >= 2:
            correlation_anomalies = await self._detect_correlation_anomalies(metric_groups)
            anomalies.extend(correlation_anomalies)
        
        return anomalies
    
    async def _detect_seasonal_anomalies(self, data_points: List[TimeSeriesData]) -> List[Anomaly]:
        """Detect anomalies in seasonal patterns"""
        anomalies = []
        
        # Sort by timestamp
        data_points.sort(key=lambda x: x.timestamp)
        values = np.array([dp.value for dp in data_points])
        
        # Extract hourly pattern (24-hour cycle)
        hourly_pattern = self._extract_seasonal_pattern(data_points, 24)
        
        # Check for deviations from pattern
        for i, dp in enumerate(data_points):
            hour = dp.timestamp.hour
            expected = hourly_pattern[hour]
            
            if expected['std'] > 0:
                deviation = abs(dp.value - expected['mean'])
                z_score = deviation / expected['std']
                
                if z_score > 3:
                    anomalies.append(Anomaly(
                        anomaly_id=str(uuid.uuid4()),
                        anomaly_type=AnomalyType.SEASONAL_ANOMALY,
                        severity=self._calculate_severity_from_zscore(z_score),
                        metric_id=dp.metric_id,
                        service=dp.service,
                        timestamp=dp.timestamp,
                        value=dp.value,
                        expected_value=expected['mean'],
                        deviation=deviation,
                        z_score=z_score,
                        confidence=0.85,
                        detection_method=DetectionMethod.STATISTICAL,
                        context={
                            'pattern_type': 'hourly',
                            'hour': hour,
                            'expected_range': (expected['mean'] - 2*expected['std'], 
                                             expected['mean'] + 2*expected['std'])
                        }
                    ))
        
        return anomalies
    
    def _extract_seasonal_pattern(self, data_points: List[TimeSeriesData], 
                                 period: int) -> Dict[int, Dict[str, float]]:
        """Extract seasonal pattern from time series"""
        pattern_values = defaultdict(list)
        
        for dp in data_points:
            if period == 24:  # Hourly pattern
                key = dp.timestamp.hour
            elif period == 7:  # Daily pattern
                key = dp.timestamp.weekday()
            else:
                key = dp.timestamp.day % period
            
            pattern_values[key].append(dp.value)
        
        pattern = {}
        for key, values in pattern_values.items():
            pattern[key] = {
                'mean': np.mean(values),
                'std': np.std(values),
                'median': np.median(values)
            }
        
        return pattern
    
    async def _detect_correlation_anomalies(self, metric_groups: Dict[str, List[TimeSeriesData]]) -> List[Anomaly]:
        """Detect anomalies in metric correlations"""
        anomalies = []
        
        # Calculate correlations between metrics
        metric_ids = list(metric_groups.keys())
        
        for i in range(len(metric_ids)):
            for j in range(i + 1, len(metric_ids)):
                metric1_id = metric_ids[i]
                metric2_id = metric_ids[j]
                
                # Align time series
                aligned_data = self._align_time_series(
                    metric_groups[metric1_id],
                    metric_groups[metric2_id]
                )
                
                if len(aligned_data) >= 50:
                    # Calculate correlation
                    values1 = np.array([d[0] for d in aligned_data])
                    values2 = np.array([d[1] for d in aligned_data])
                    
                    correlation = np.corrcoef(values1, values2)[0, 1]
                    
                    # Store correlation
                    self.correlations[(metric1_id, metric2_id)] = correlation
                    
                    # Check for broken correlations
                    if abs(correlation) > 0.7:  # Strong correlation expected
                        # Check recent windows for correlation breaks
                        window_size = 20
                        for k in range(window_size, len(aligned_data)):
                            window1 = values1[k-window_size:k]
                            window2 = values2[k-window_size:k]
                            
                            window_corr = np.corrcoef(window1, window2)[0, 1]
                            
                            if abs(window_corr - correlation) > 0.5:
                                # Correlation broken
                                timestamp = metric_groups[metric1_id][k].timestamp
                                
                                anomalies.append(Anomaly(
                                    anomaly_id=str(uuid.uuid4()),
                                    anomaly_type=AnomalyType.CORRELATION_ANOMALY,
                                    severity=AnomalySeverity.MEDIUM,
                                    metric_id=metric1_id,
                                    service=metric_groups[metric1_id][0].service,
                                    timestamp=timestamp,
                                    value=values1[k],
                                    expected_value=values1[k-1],
                                    deviation=abs(window_corr - correlation),
                                    z_score=abs(window_corr - correlation) * 2,
                                    confidence=0.70,
                                    detection_method=DetectionMethod.STATISTICAL,
                                    context={
                                        'correlation_with': metric2_id,
                                        'expected_correlation': correlation,
                                        'actual_correlation': window_corr
                                    },
                                    related_anomalies=[metric2_id]
                                ))
        
        return anomalies
    
    def _align_time_series(self, series1: List[TimeSeriesData], 
                          series2: List[TimeSeriesData]) -> List[Tuple[float, float]]:
        """Align two time series by timestamp"""
        aligned = []
        
        # Create timestamp maps
        ts_map1 = {dp.timestamp: dp.value for dp in series1}
        ts_map2 = {dp.timestamp: dp.value for dp in series2}
        
        # Find common timestamps
        common_timestamps = set(ts_map1.keys()) & set(ts_map2.keys())
        
        for ts in sorted(common_timestamps):
            aligned.append((ts_map1[ts], ts_map2[ts]))
        
        return aligned
    
    def _calculate_severity_from_zscore(self, z_score: float) -> AnomalySeverity:
        """Calculate severity from z-score"""
        if z_score > 5:
            return AnomalySeverity.CRITICAL
        elif z_score > 4:
            return AnomalySeverity.HIGH
        elif z_score > 3:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW

class ForecastingEngine:
    def __init__(self):
        self.models = {}
        self.model_performance = {}
        
    async def generate_forecast(self, time_series: List[TimeSeriesData],
                               forecast_horizon: int,
                               model_type: ForecastModel = ForecastModel.ENSEMBLE) -> Forecast:
        """Generate forecast for time series"""
        
        # Sort by timestamp
        time_series.sort(key=lambda x: x.timestamp)
        values = np.array([dp.value for dp in time_series])
        
        if len(values) < 50:
            logging.warning("Insufficient data for forecasting")
            return None
        
        # Generate forecasts based on model type
        if model_type == ForecastModel.ENSEMBLE:
            forecast = await self._ensemble_forecast(values, forecast_horizon)
        elif model_type == ForecastModel.ARIMA:
            forecast = await self._arima_forecast(values, forecast_horizon)
        elif model_type == ForecastModel.EXPONENTIAL_SMOOTHING:
            forecast = await self._exp_smoothing_forecast(values, forecast_horizon)
        else:
            forecast = await self._simple_forecast(values, forecast_horizon)
        
        # Detect potential anomalies in forecast
        anomaly_predictions = await self._predict_anomalies(forecast['predictions'], values)
        
        # Calculate accuracy metrics
        accuracy_metrics = await self._calculate_accuracy_metrics(values, forecast)
        
        return Forecast(
            forecast_id=str(uuid.uuid4()),
            metric_id=time_series[0].metric_id,
            service=time_series[0].service,
            model_type=model_type,
            forecast_start=time_series[-1].timestamp + timedelta(hours=1),
            forecast_end=time_series[-1].timestamp + timedelta(hours=forecast_horizon),
            predicted_values=forecast['predictions'],
            confidence_intervals=forecast['confidence_intervals'],
            accuracy_metrics=accuracy_metrics,
            anomaly_predictions=anomaly_predictions,
            metadata=forecast.get('metadata', {})
        )
    
    async def _ensemble_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """Generate ensemble forecast combining multiple models"""
        forecasts = []
        
        # Simple moving average
        sma_forecast = await self._sma_forecast(values, horizon)
        forecasts.append(sma_forecast['predictions'])
        
        # Exponential smoothing
        exp_forecast = await self._exp_smoothing_forecast(values, horizon)
        forecasts.append(exp_forecast['predictions'])
        
        # Linear trend
        trend_forecast = await self._trend_forecast(values, horizon)
        forecasts.append(trend_forecast['predictions'])
        
        # Combine forecasts (weighted average)
        weights = [0.3, 0.4, 0.3]  # SMA, Exp Smoothing, Trend
        ensemble_predictions = np.average(forecasts, axis=0, weights=weights)
        
        # Calculate confidence intervals
        forecast_std = np.std(forecasts, axis=0)
        lower_bound = ensemble_predictions - 1.96 * forecast_std
        upper_bound = ensemble_predictions + 1.96 * forecast_std
        
        return {
            'predictions': ensemble_predictions.tolist(),
            'confidence_intervals': [(l, u) for l, u in zip(lower_bound, upper_bound)],
            'metadata': {'models_used': ['sma', 'exp_smoothing', 'trend']}
        }
    
    async def _arima_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """ARIMA forecast (simplified)"""
        # Simplified ARIMA using differencing and MA
        diff_values = np.diff(values)
        ma_window = 5
        
        predictions = []
        last_value = values[-1]
        
        for i in range(horizon):
            # Simple prediction based on recent trend
            recent_diff = np.mean(diff_values[-ma_window:])
            next_value = last_value + recent_diff
            predictions.append(next_value)
            last_value = next_value
            
            # Update diff_values for next prediction
            diff_values = np.append(diff_values, recent_diff)
        
        # Simple confidence intervals
        std = np.std(diff_values)
        confidence_intervals = [(p - 1.96*std, p + 1.96*std) for p in predictions]
        
        return {
            'predictions': predictions,
            'confidence_intervals': confidence_intervals,
            'metadata': {'order': (1, 1, 1)}
        }
    
    async def _exp_smoothing_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """Exponential smoothing forecast"""
        alpha = 0.3  # Smoothing parameter
        
        # Initialize
        smoothed = [values[0]]
        for i in range(1, len(values)):
            smoothed.append(alpha * values[i] + (1 - alpha) * smoothed[-1])
        
        # Forecast
        predictions = []
        last_smoothed = smoothed[-1]
        trend = (smoothed[-1] - smoothed[-10]) / 10 if len(smoothed) >= 10 else 0
        
        for i in range(horizon):
            next_value = last_smoothed + trend * (i + 1)
            predictions.append(next_value)
        
        # Confidence intervals
        residuals = values - smoothed[:len(values)]
        std = np.std(residuals)
        confidence_intervals = [(p - 1.96*std, p + 1.96*std) for p in predictions]
        
        return {
            'predictions': predictions,
            'confidence_intervals': confidence_intervals,
            'metadata': {'alpha': alpha}
        }
    
    async def _sma_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """Simple moving average forecast"""
        window = min(10, len(values) // 2)
        sma = np.mean(values[-window:])
        
        predictions = [sma] * horizon
        
        # Confidence intervals based on historical variance
        std = np.std(values[-window:])
        confidence_intervals = [(sma - 1.96*std, sma + 1.96*std)] * horizon
        
        return {
            'predictions': predictions,
            'confidence_intervals': confidence_intervals,
            'metadata': {'window': window}
        }
    
    async def _trend_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """Linear trend forecast"""
        x = np.arange(len(values))
        coeffs = np.polyfit(x, values, 1)
        
        predictions = []
        for i in range(horizon):
            next_x = len(values) + i
            next_value = coeffs[0] * next_x + coeffs[1]
            predictions.append(next_value)
        
        # Confidence intervals
        residuals = values - np.polyval(coeffs, x)
        std = np.std(residuals)
        confidence_intervals = [(p - 1.96*std, p + 1.96*std) for p in predictions]
        
        return {
            'predictions': predictions,
            'confidence_intervals': confidence_intervals,
            'metadata': {'slope': coeffs[0], 'intercept': coeffs[1]}
        }
    
    async def _simple_forecast(self, values: np.ndarray, horizon: int) -> Dict[str, Any]:
        """Simple forecast using last value"""
        last_value = values[-1]
        predictions = [last_value] * horizon
        
        std = np.std(values)
        confidence_intervals = [(last_value - 1.96*std, last_value + 1.96*std)] * horizon
        
        return {
            'predictions': predictions,
            'confidence_intervals': confidence_intervals,
            'metadata': {'method': 'last_value'}
        }
    
    async def _predict_anomalies(self, predictions: List[float], 
                                historical: np.ndarray) -> List[Dict[str, Any]]:
        """Predict potential anomalies in forecast"""
        anomaly_predictions = []
        
        historical_mean = np.mean(historical)
        historical_std = np.std(historical)
        
        for i, pred in enumerate(predictions):
            z_score = abs((pred - historical_mean) / (historical_std + 1e-10))
            
            if z_score > 3:
                anomaly_predictions.append({
                    'time_index': i,
                    'predicted_value': pred,
                    'z_score': z_score,
                    'probability': min(0.99, z_score / 10),
                    'type': 'high' if pred > historical_mean else 'low'
                })
        
        return anomaly_predictions
    
    async def _calculate_accuracy_metrics(self, historical: np.ndarray, 
                                         forecast: Dict[str, Any]) -> Dict[str, float]:
        """Calculate forecast accuracy metrics"""
        # For demonstration, using simple metrics
        # In production, would use backtesting
        
        return {
            'mean_absolute_error': 0.0,  # Would calculate from backtesting
            'mean_squared_error': 0.0,
            'mean_absolute_percentage_error': 0.0,
            'confidence': 0.85  # Based on model type and data quality
        }

class AnomalyDetectionSystem:
    def __init__(self):
        self.statistical_detector = StatisticalDetector()
        self.ml_detector = MachineLearningDetector()
        self.pattern_analyzer = PatternAnalyzer()
        self.forecasting_engine = ForecastingEngine()
        self.anomaly_history = []
        self.active_anomalies = {}
        
    async def detect_anomalies(self, time_series: List[TimeSeriesData],
                              method: DetectionMethod = DetectionMethod.ENSEMBLE) -> List[Anomaly]:
        """Main anomaly detection function"""
        
        all_anomalies = []
        
        if method == DetectionMethod.ENSEMBLE:
            # Use all detection methods
            statistical_anomalies = await self.statistical_detector.detect_anomalies(time_series)
            all_anomalies.extend(statistical_anomalies)
            
            if len(time_series) >= 50:
                ml_anomalies = await self.ml_detector.detect_anomalies(time_series)
                all_anomalies.extend(ml_anomalies)
            
            pattern_anomalies = await self.pattern_analyzer.detect_pattern_anomalies(time_series)
            all_anomalies.extend(pattern_anomalies)
            
            # Deduplicate and merge anomalies
            all_anomalies = await self._merge_anomalies(all_anomalies)
        
        elif method == DetectionMethod.STATISTICAL:
            all_anomalies = await self.statistical_detector.detect_anomalies(time_series)
        
        elif method == DetectionMethod.MACHINE_LEARNING:
            all_anomalies = await self.ml_detector.detect_anomalies(time_series)
        
        # Add recommendations
        for anomaly in all_anomalies:
            anomaly.recommended_actions = await self._generate_recommendations(anomaly)
        
        # Store in history
        self.anomaly_history.extend(all_anomalies)
        
        # Update active anomalies
        for anomaly in all_anomalies:
            self.active_anomalies[anomaly.anomaly_id] = anomaly
        
        return all_anomalies
    
    async def forecast_metrics(self, time_series: List[TimeSeriesData],
                              forecast_horizon: int = 24) -> Forecast:
        """Generate forecast for metrics"""
        return await self.forecasting_engine.generate_forecast(
            time_series, forecast_horizon, ForecastModel.ENSEMBLE
        )
    
    async def _merge_anomalies(self, anomalies: List[Anomaly]) -> List[Anomaly]:
        """Merge duplicate anomalies detected by different methods"""
        merged = {}
        
        for anomaly in anomalies:
            key = (anomaly.metric_id, anomaly.timestamp)
            
            if key in merged:
                # Merge with existing anomaly
                existing = merged[key]
                
                # Take the higher severity
                if anomaly.severity.value < existing.severity.value:
                    existing.severity = anomaly.severity
                
                # Average confidence scores
                existing.confidence = (existing.confidence + anomaly.confidence) / 2
                
                # Combine detection methods
                if anomaly.detection_method != existing.detection_method:
                    existing.context['additional_methods'] = existing.context.get('additional_methods', [])
                    existing.context['additional_methods'].append(anomaly.detection_method.value)
            else:
                merged[key] = anomaly
        
        return list(merged.values())
    
    async def _generate_recommendations(self, anomaly: Anomaly) -> List[str]:
        """Generate recommendations for anomaly"""
        recommendations = []
        
        if anomaly.severity in [AnomalySeverity.CRITICAL, AnomalySeverity.HIGH]:
            recommendations.append("Immediate investigation required")
            recommendations.append("Check system logs for errors")
            recommendations.append("Verify dependent services")
        
        if anomaly.anomaly_type == AnomalyType.TREND_ANOMALY:
            recommendations.append("Review recent changes")
            recommendations.append("Check for gradual degradation")
        
        elif anomaly.anomaly_type == AnomalyType.SEASONAL_ANOMALY:
            recommendations.append("Verify scheduled jobs")
            recommendations.append("Check for pattern changes")
        
        elif anomaly.anomaly_type == AnomalyType.CORRELATION_ANOMALY:
            recommendations.append("Check related metrics")
            recommendations.append("Investigate dependency issues")
        
        return recommendations

# Example usage
async def main():
    detection_system = AnomalyDetectionSystem()
    
    # Generate sample time series data
    time_series = []
    base_value = 100
    
    for i in range(200):
        timestamp = datetime.now() - timedelta(hours=200-i)
        
        # Normal pattern with some anomalies
        if i in [50, 100, 150]:  # Inject anomalies
            value = base_value + np.random.normal(0, 5) + 50  # Spike
        elif 80 <= i <= 90:  # Sustained anomaly
            value = base_value + 30
        else:
            # Normal with daily pattern
            hour = timestamp.hour
            daily_factor = 1 + 0.3 * np.sin(2 * np.pi * hour / 24)
            value = base_value * daily_factor + np.random.normal(0, 5)
        
        time_series.append(TimeSeriesData(
            metric_id="cpu_usage",
            metric_name="CPU Usage",
            service="api-server",
            timestamp=timestamp,
            value=max(0, value)
        ))
    
    # Detect anomalies
    anomalies = await detection_system.detect_anomalies(time_series)
    
    print(f"Detected {len(anomalies)} anomalies:")
    for anomaly in anomalies[:5]:  # Show first 5
        print(f"\n{anomaly.timestamp}: {anomaly.anomaly_type.value}")
        print(f"  Severity: {anomaly.severity.value}")
        print(f"  Value: {anomaly.value:.2f} (expected: {anomaly.expected_value:.2f})")
        print(f"  Confidence: {anomaly.confidence:.2%}")
        print(f"  Method: {anomaly.detection_method.value}")
    
    # Generate forecast
    forecast = await detection_system.forecast_metrics(time_series, forecast_horizon=24)
    
    if forecast:
        print(f"\nForecast for next 24 hours:")
        print(f"  Model: {forecast.model_type.value}")
        print(f"  Predicted values: {forecast.predicted_values[:5]}...")  # First 5
        print(f"  Anomaly predictions: {len(forecast.anomaly_predictions)} potential anomalies")

if __name__ == "__main__":
    asyncio.run(main())