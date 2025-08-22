"""
Trend Analysis and Forecasting Dashboard System
Advanced time series analysis, trend detection, and forecasting capabilities
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
import warnings
warnings.filterwarnings('ignore')
import aiohttp
import aioredis
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrendDirection(Enum):
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    VOLATILE = "volatile"
    SEASONAL = "seasonal"

class ForecastModel(Enum):
    LINEAR = "linear"
    POLYNOMIAL = "polynomial"
    RANDOM_FOREST = "random_forest"
    GRADIENT_BOOSTING = "gradient_boosting"
    EXPONENTIAL_SMOOTHING = "exponential_smoothing"
    ARIMA = "arima"
    ENSEMBLE = "ensemble"

class TrendStrength(Enum):
    VERY_WEAK = "very_weak"    # 0-0.2
    WEAK = "weak"              # 0.2-0.4
    MODERATE = "moderate"      # 0.4-0.6
    STRONG = "strong"          # 0.6-0.8
    VERY_STRONG = "very_strong" # 0.8-1.0

class SeasonalityType(Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

@dataclass
class TimeSeriesPoint:
    timestamp: datetime
    value: float
    metric_name: str
    labels: Dict[str, str]
    confidence: Optional[float] = None

@dataclass
class TrendAnalysis:
    metric_name: str
    time_range: Tuple[datetime, datetime]
    trend_direction: TrendDirection
    trend_strength: TrendStrength
    slope: float
    r_squared: float
    volatility: float
    change_points: List[datetime]
    seasonal_patterns: Dict[SeasonalityType, float]
    anomalies: List[TimeSeriesPoint]
    summary: str

@dataclass
class ForecastResult:
    forecast_id: str
    metric_name: str
    model_type: ForecastModel
    forecast_horizon: int
    predictions: List[TimeSeriesPoint]
    confidence_intervals: List[Tuple[float, float]]
    model_accuracy: Dict[str, float]
    feature_importance: Dict[str, float]
    created_at: datetime

@dataclass
class SeasonalDecomposition:
    metric_name: str
    trend_component: List[float]
    seasonal_component: List[float]
    residual_component: List[float]
    seasonal_strength: float
    trend_strength: float
    timestamps: List[datetime]

@dataclass
class ChangePoint:
    timestamp: datetime
    metric_name: str
    change_magnitude: float
    change_direction: str
    confidence: float
    context: Dict[str, Any]

class TimeSeriesAnalyzer:
    def __init__(self):
        self.scaler = StandardScaler()
        
    def analyze_trend(self, data: List[TimeSeriesPoint]) -> TrendAnalysis:
        """Analyze trend in time series data"""
        if len(data) < 10:
            raise ValueError("Need at least 10 data points for trend analysis")
        
        # Sort by timestamp
        sorted_data = sorted(data, key=lambda x: x.timestamp)
        
        # Extract values and timestamps
        timestamps = [d.timestamp for d in sorted_data]
        values = [d.value for d in sorted_data]
        
        # Convert timestamps to numeric values (days since first timestamp)
        first_timestamp = timestamps[0]
        numeric_timestamps = [(t - first_timestamp).total_seconds() / 86400 for t in timestamps]
        
        # Linear regression for trend
        X = np.array(numeric_timestamps).reshape(-1, 1)
        y = np.array(values)
        
        model = LinearRegression()
        model.fit(X, y)
        
        slope = model.coef_[0]
        r_squared = model.score(X, y)
        
        # Determine trend direction
        if abs(slope) < 0.001:
            direction = TrendDirection.STABLE
        elif slope > 0:
            direction = TrendDirection.INCREASING
        else:
            direction = TrendDirection.DECREASING
        
        # Calculate volatility (coefficient of variation)
        volatility = np.std(values) / np.mean(values) if np.mean(values) != 0 else 0
        
        if volatility > 0.3:  # High volatility
            direction = TrendDirection.VOLATILE
        
        # Determine trend strength based on R-squared
        if r_squared >= 0.8:
            strength = TrendStrength.VERY_STRONG
        elif r_squared >= 0.6:
            strength = TrendStrength.STRONG
        elif r_squared >= 0.4:
            strength = TrendStrength.MODERATE
        elif r_squared >= 0.2:
            strength = TrendStrength.WEAK
        else:
            strength = TrendStrength.VERY_WEAK
        
        # Detect change points
        change_points = self._detect_change_points(sorted_data)
        
        # Analyze seasonal patterns
        seasonal_patterns = self._analyze_seasonality(sorted_data)
        
        # Detect anomalies
        anomalies = self._detect_anomalies(sorted_data)
        
        # Generate summary
        summary = self._generate_trend_summary(direction, strength, slope, volatility, seasonal_patterns)
        
        return TrendAnalysis(
            metric_name=data[0].metric_name,
            time_range=(timestamps[0], timestamps[-1]),
            trend_direction=direction,
            trend_strength=strength,
            slope=slope,
            r_squared=r_squared,
            volatility=volatility,
            change_points=[cp.timestamp for cp in change_points],
            seasonal_patterns=seasonal_patterns,
            anomalies=anomalies,
            summary=summary
        )
    
    def _detect_change_points(self, data: List[TimeSeriesPoint], window_size: int = 10) -> List[ChangePoint]:
        """Detect significant change points in the time series"""
        if len(data) < window_size * 2:
            return []
        
        change_points = []
        values = [d.value for d in data]
        
        for i in range(window_size, len(data) - window_size):
            # Compare means of windows before and after point i
            before_window = values[i-window_size:i]
            after_window = values[i:i+window_size]
            
            mean_before = np.mean(before_window)
            mean_after = np.mean(after_window)
            
            # Calculate change magnitude and significance
            change_magnitude = abs(mean_after - mean_before)
            relative_change = change_magnitude / mean_before if mean_before != 0 else 0
            
            # Consider it a change point if relative change > 20%
            if relative_change > 0.2:
                direction = "increase" if mean_after > mean_before else "decrease"
                confidence = min(1.0, relative_change / 0.5)  # Normalize confidence
                
                change_point = ChangePoint(
                    timestamp=data[i].timestamp,
                    metric_name=data[i].metric_name,
                    change_magnitude=change_magnitude,
                    change_direction=direction,
                    confidence=confidence,
                    context={
                        "mean_before": mean_before,
                        "mean_after": mean_after,
                        "relative_change": relative_change
                    }
                )
                
                change_points.append(change_point)
        
        return change_points
    
    def _analyze_seasonality(self, data: List[TimeSeriesPoint]) -> Dict[SeasonalityType, float]:
        """Analyze seasonal patterns in the data"""
        if len(data) < 50:  # Need enough data for seasonality analysis
            return {SeasonalityType.NONE: 1.0}
        
        df_data = []
        for point in data:
            df_data.append({
                'timestamp': point.timestamp,
                'value': point.value,
                'hour': point.timestamp.hour,
                'day_of_week': point.timestamp.weekday(),
                'day_of_month': point.timestamp.day,
                'month': point.timestamp.month
            })
        
        df = pd.DataFrame(df_data)
        seasonal_strength = {}
        
        # Daily seasonality (by hour)
        if len(df['hour'].unique()) > 12:  # Need variety in hours
            hourly_var = df.groupby('hour')['value'].var().mean()
            total_var = df['value'].var()
            daily_strength = min(1.0, hourly_var / total_var if total_var > 0 else 0)
            seasonal_strength[SeasonalityType.DAILY] = daily_strength
        
        # Weekly seasonality (by day of week)
        if (df['timestamp'].max() - df['timestamp'].min()).days >= 14:
            weekly_var = df.groupby('day_of_week')['value'].var().mean()
            total_var = df['value'].var()
            weekly_strength = min(1.0, weekly_var / total_var if total_var > 0 else 0)
            seasonal_strength[SeasonalityType.WEEKLY] = weekly_strength
        
        # Monthly seasonality
        if (df['timestamp'].max() - df['timestamp'].min()).days >= 60:
            monthly_var = df.groupby('month')['value'].var().mean()
            total_var = df['value'].var()
            monthly_strength = min(1.0, monthly_var / total_var if total_var > 0 else 0)
            seasonal_strength[SeasonalityType.MONTHLY] = monthly_strength
        
        # If no strong seasonality found, return None
        if not seasonal_strength or max(seasonal_strength.values()) < 0.1:
            seasonal_strength = {SeasonalityType.NONE: 1.0}
        
        return seasonal_strength
    
    def _detect_anomalies(self, data: List[TimeSeriesPoint], threshold: float = 2.5) -> List[TimeSeriesPoint]:
        """Detect anomalies using statistical methods"""
        values = [d.value for d in data]
        
        if len(values) < 10:
            return []
        
        # Use IQR method for anomaly detection
        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        
        anomalies = []
        for point in data:
            if point.value < lower_bound or point.value > upper_bound:
                anomalies.append(point)
        
        return anomalies
    
    def _generate_trend_summary(self, direction: TrendDirection, strength: TrendStrength,
                               slope: float, volatility: float, 
                               seasonal_patterns: Dict[SeasonalityType, float]) -> str:
        """Generate human-readable trend summary"""
        direction_text = {
            TrendDirection.INCREASING: "increasing",
            TrendDirection.DECREASING: "decreasing", 
            TrendDirection.STABLE: "stable",
            TrendDirection.VOLATILE: "highly volatile",
            TrendDirection.SEASONAL: "seasonal"
        }
        
        strength_text = {
            TrendStrength.VERY_STRONG: "very strong",
            TrendStrength.STRONG: "strong",
            TrendStrength.MODERATE: "moderate",
            TrendStrength.WEAK: "weak",
            TrendStrength.VERY_WEAK: "very weak"
        }
        
        summary = f"The metric shows a {strength_text[strength]} {direction_text[direction]} trend"
        
        if slope != 0:
            summary += f" with a slope of {slope:.4f}"
        
        if volatility > 0.2:
            summary += f" and high volatility ({volatility:.2f})"
        
        # Add seasonality information
        strongest_season = max(seasonal_patterns, key=seasonal_patterns.get)
        if strongest_season != SeasonalityType.NONE and seasonal_patterns[strongest_season] > 0.3:
            summary += f" with {strongest_season.value} seasonal patterns"
        
        return summary + "."

class ForecastingEngine:
    def __init__(self):
        self.models = {
            ForecastModel.LINEAR: LinearRegression(),
            ForecastModel.RANDOM_FOREST: RandomForestRegressor(n_estimators=100, random_state=42),
            ForecastModel.GRADIENT_BOOSTING: GradientBoostingRegressor(random_state=42),
        }
        self.scaler = StandardScaler()
        
    async def generate_forecast(self, data: List[TimeSeriesPoint], 
                              horizon: int = 24,
                              model_type: ForecastModel = ForecastModel.ENSEMBLE) -> ForecastResult:
        """Generate forecast for time series data"""
        if len(data) < 20:
            raise ValueError("Need at least 20 data points for forecasting")
        
        # Sort data by timestamp
        sorted_data = sorted(data, key=lambda x: x.timestamp)
        
        # Prepare features and target
        X, y, feature_names = self._prepare_features(sorted_data)
        
        # Train model(s)
        if model_type == ForecastModel.ENSEMBLE:
            predictions, confidence_intervals, accuracy, importance = await self._ensemble_forecast(
                X, y, horizon, feature_names
            )
        else:
            predictions, confidence_intervals, accuracy, importance = await self._single_model_forecast(
                X, y, horizon, model_type, feature_names
            )
        
        # Convert predictions to TimeSeriesPoint objects
        last_timestamp = sorted_data[-1].timestamp
        forecast_points = []
        
        for i, pred in enumerate(predictions):
            forecast_timestamp = last_timestamp + timedelta(hours=i+1)
            forecast_points.append(TimeSeriesPoint(
                timestamp=forecast_timestamp,
                value=pred,
                metric_name=data[0].metric_name,
                labels={"type": "forecast"},
                confidence=confidence_intervals[i][1] - confidence_intervals[i][0]  # Use interval width as confidence
            ))
        
        forecast_id = f"forecast_{data[0].metric_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        return ForecastResult(
            forecast_id=forecast_id,
            metric_name=data[0].metric_name,
            model_type=model_type,
            forecast_horizon=horizon,
            predictions=forecast_points,
            confidence_intervals=confidence_intervals,
            model_accuracy=accuracy,
            feature_importance=importance,
            created_at=datetime.now()
        )
    
    def _prepare_features(self, data: List[TimeSeriesPoint]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare features for machine learning models"""
        feature_data = []
        target_data = []
        
        for i in range(len(data)):
            point = data[i]
            
            # Time-based features
            features = {
                'hour': point.timestamp.hour,
                'day_of_week': point.timestamp.weekday(),
                'day_of_month': point.timestamp.day,
                'month': point.timestamp.month,
                'is_weekend': 1 if point.timestamp.weekday() >= 5 else 0,
            }
            
            # Lag features (previous values)
            for lag in [1, 2, 3, 6, 12, 24]:
                if i >= lag:
                    features[f'lag_{lag}'] = data[i-lag].value
                else:
                    features[f'lag_{lag}'] = data[0].value  # Use first value for missing lags
            
            # Rolling statistics
            window_sizes = [3, 6, 12]
            for window in window_sizes:
                start_idx = max(0, i - window + 1)
                window_values = [data[j].value for j in range(start_idx, i + 1)]
                
                features[f'rolling_mean_{window}'] = np.mean(window_values)
                features[f'rolling_std_{window}'] = np.std(window_values) if len(window_values) > 1 else 0
                features[f'rolling_min_{window}'] = np.min(window_values)
                features[f'rolling_max_{window}'] = np.max(window_values)
            
            # Trend features
            if i >= 5:
                recent_values = [data[j].value for j in range(max(0, i-4), i+1)]
                features['recent_trend'] = np.polyfit(range(len(recent_values)), recent_values, 1)[0]
            else:
                features['recent_trend'] = 0
            
            feature_data.append(list(features.values()))
            target_data.append(point.value)
        
        feature_names = list(features.keys())
        
        return np.array(feature_data), np.array(target_data), feature_names
    
    async def _ensemble_forecast(self, X: np.ndarray, y: np.ndarray, 
                               horizon: int, feature_names: List[str]) -> Tuple[List[float], List[Tuple[float, float]], Dict[str, float], Dict[str, float]]:
        """Generate ensemble forecast using multiple models"""
        # Train multiple models
        models = [
            ('linear', LinearRegression()),
            ('rf', RandomForestRegressor(n_estimators=50, random_state=42)),
            ('gb', GradientBoostingRegressor(n_estimators=50, random_state=42))
        ]
        
        trained_models = []
        model_weights = []
        
        # Split data for validation
        split_point = int(len(X) * 0.8)
        X_train, X_val = X[:split_point], X[split_point:]
        y_train, y_val = y[:split_point], y[split_point:]
        
        if len(X_val) == 0:  # Not enough data for validation
            X_train, X_val = X, X[-5:]  # Use last 5 points for validation
            y_train, y_val = y, y[-5:]
        
        for name, model in models:
            try:
                model.fit(X_train, y_train)
                val_predictions = model.predict(X_val)
                mse = mean_squared_error(y_val, val_predictions)
                weight = 1.0 / (1.0 + mse)  # Inverse MSE weighting
                
                trained_models.append(model)
                model_weights.append(weight)
            except Exception as e:
                logger.warning(f"Failed to train {name} model: {e}")
        
        # Normalize weights
        total_weight = sum(model_weights)
        if total_weight > 0:
            model_weights = [w / total_weight for w in model_weights]
        else:
            model_weights = [1.0 / len(trained_models)] * len(trained_models)
        
        # Generate predictions
        predictions = []
        confidence_intervals = []
        
        # Use the last known features as base for forecasting
        last_features = X[-1].copy()
        
        for step in range(horizon):
            step_predictions = []
            
            for model in trained_models:
                pred = model.predict(last_features.reshape(1, -1))[0]
                step_predictions.append(pred)
            
            # Weighted average prediction
            weighted_pred = sum(pred * weight for pred, weight in zip(step_predictions, model_weights))
            predictions.append(weighted_pred)
            
            # Calculate confidence interval based on prediction variance
            pred_std = np.std(step_predictions)
            confidence_intervals.append((weighted_pred - 1.96 * pred_std, weighted_pred + 1.96 * pred_std))
            
            # Update features for next step (simplified)
            # In practice, would update lag features and rolling statistics
            last_features = self._update_features_for_next_step(last_features, weighted_pred, step)
        
        # Calculate overall accuracy
        all_predictions = []
        for model in trained_models:
            all_predictions.extend(model.predict(X_val))
        
        accuracy = {
            'mse': mean_squared_error(np.tile(y_val, len(trained_models)), all_predictions),
            'mae': mean_absolute_error(np.tile(y_val, len(trained_models)), all_predictions),
            'ensemble_models': len(trained_models)
        }
        
        # Calculate feature importance (from Random Forest if available)
        feature_importance = {}
        rf_model = next((m for m, name in zip(trained_models, [n for n, _ in models]) if name == 'rf'), None)
        if rf_model and hasattr(rf_model, 'feature_importances_'):
            for name, importance in zip(feature_names, rf_model.feature_importances_):
                feature_importance[name] = float(importance)
        
        return predictions, confidence_intervals, accuracy, feature_importance
    
    async def _single_model_forecast(self, X: np.ndarray, y: np.ndarray, horizon: int,
                                   model_type: ForecastModel, feature_names: List[str]) -> Tuple[List[float], List[Tuple[float, float]], Dict[str, float], Dict[str, float]]:
        """Generate forecast using a single model"""
        model = self.models.get(model_type)
        if not model:
            raise ValueError(f"Unsupported model type: {model_type}")
        
        # Train model
        model.fit(X, y)
        
        # Generate predictions
        predictions = []
        confidence_intervals = []
        last_features = X[-1].copy()
        
        for step in range(horizon):
            pred = model.predict(last_features.reshape(1, -1))[0]
            predictions.append(pred)
            
            # Simple confidence interval (±10% of prediction)
            confidence_intervals.append((pred * 0.9, pred * 1.1))
            
            # Update features for next step
            last_features = self._update_features_for_next_step(last_features, pred, step)
        
        # Calculate accuracy on training data (simplified)
        train_predictions = model.predict(X)
        accuracy = {
            'mse': float(mean_squared_error(y, train_predictions)),
            'mae': float(mean_absolute_error(y, train_predictions)),
            'r2_score': float(model.score(X, y)) if hasattr(model, 'score') else 0.0
        }
        
        # Feature importance
        feature_importance = {}
        if hasattr(model, 'feature_importances_'):
            for name, importance in zip(feature_names, model.feature_importances_):
                feature_importance[name] = float(importance)
        
        return predictions, confidence_intervals, accuracy, feature_importance
    
    def _update_features_for_next_step(self, features: np.ndarray, new_value: float, step: int) -> np.ndarray:
        """Update feature vector for next forecasting step"""
        updated_features = features.copy()
        
        # This is a simplified update - in practice, would properly update:
        # - Lag features with new predicted value
        # - Rolling statistics
        # - Time-based features
        
        # For now, just update the first lag feature if it exists
        if len(updated_features) > 5:  # Assuming lag_1 is around index 5
            updated_features[5] = new_value
        
        return updated_features

class TrendForecastingSystem:
    def __init__(self):
        self.analyzer = TimeSeriesAnalyzer()
        self.forecasting_engine = ForecastingEngine()
        self.redis_client = None
        self.time_series_data: Dict[str, List[TimeSeriesPoint]] = {}
        self.trend_analyses: Dict[str, TrendAnalysis] = {}
        self.forecasts: Dict[str, ForecastResult] = {}
        
    async def initialize(self):
        """Initialize the trend and forecasting system"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        # Generate sample time series data
        await self._generate_sample_data()
        
        logger.info("Trend analysis and forecasting system initialized")
    
    async def _generate_sample_data(self):
        """Generate sample time series data for demonstration"""
        metrics = ["cpu_usage", "memory_usage", "disk_io", "network_throughput", "response_time"]
        
        for metric in metrics:
            data_points = []
            base_time = datetime.now() - timedelta(days=7)
            
            # Generate realistic time series with trend and seasonality
            for i in range(168):  # 7 days * 24 hours
                timestamp = base_time + timedelta(hours=i)
                
                # Base value with trend
                base_value = 50 + 0.1 * i  # Slight upward trend
                
                # Add daily seasonality
                hour_factor = 1 + 0.3 * np.sin(2 * np.pi * (i % 24) / 24)
                
                # Add weekly seasonality
                day_factor = 1 + 0.1 * np.sin(2 * np.pi * (i % (24 * 7)) / (24 * 7))
                
                # Add noise
                noise = np.random.normal(0, 5)
                
                # Special patterns for different metrics
                if metric == "cpu_usage":
                    value = max(0, min(100, base_value * hour_factor * day_factor + noise))
                elif metric == "response_time":
                    value = max(10, base_value * hour_factor + noise)
                elif metric == "network_throughput":
                    value = max(0, base_value * 2 * hour_factor + noise)
                else:
                    value = max(0, base_value * hour_factor + noise)
                
                data_points.append(TimeSeriesPoint(
                    timestamp=timestamp,
                    value=value,
                    metric_name=metric,
                    labels={"environment": "production", "service": "web-app"}
                ))
            
            self.time_series_data[metric] = data_points
    
    async def analyze_trends(self, metric_name: str = None) -> Dict[str, Any]:
        """Analyze trends for specified metric or all metrics"""
        results = {}
        
        metrics_to_analyze = [metric_name] if metric_name else list(self.time_series_data.keys())
        
        for metric in metrics_to_analyze:
            if metric not in self.time_series_data:
                continue
            
            try:
                analysis = self.analyzer.analyze_trend(self.time_series_data[metric])
                self.trend_analyses[metric] = analysis
                results[metric] = asdict(analysis)
                
                logger.info(f"Completed trend analysis for {metric}")
                
            except Exception as e:
                logger.error(f"Error analyzing trends for {metric}: {e}")
                results[metric] = {"error": str(e)}
        
        # Cache results
        await self._cache_trend_results(results)
        
        return {
            "analyses": results,
            "summary": self._generate_trend_summary(results),
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_trend_summary(self, analyses: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of trend analyses"""
        if not analyses:
            return {}
        
        trend_counts = {}
        strength_counts = {}
        seasonal_metrics = []
        volatile_metrics = []
        
        for metric, analysis in analyses.items():
            if "error" in analysis:
                continue
            
            # Count trend directions
            direction = analysis.get("trend_direction")
            if direction:
                trend_counts[direction] = trend_counts.get(direction, 0) + 1
            
            # Count trend strengths
            strength = analysis.get("trend_strength")
            if strength:
                strength_counts[strength] = strength_counts.get(strength, 0) + 1
            
            # Identify seasonal and volatile metrics
            if analysis.get("volatility", 0) > 0.3:
                volatile_metrics.append(metric)
            
            seasonal_patterns = analysis.get("seasonal_patterns", {})
            if any(strength > 0.3 for pattern, strength in seasonal_patterns.items() if pattern != "none"):
                seasonal_metrics.append(metric)
        
        return {
            "total_metrics": len(analyses),
            "trend_distribution": trend_counts,
            "strength_distribution": strength_counts,
            "seasonal_metrics": seasonal_metrics,
            "volatile_metrics": volatile_metrics,
            "metrics_with_strong_trends": len([a for a in analyses.values() if a.get("trend_strength") in ["strong", "very_strong"]])
        }
    
    async def generate_forecasts(self, metric_name: str = None, 
                               horizon: int = 24,
                               model_type: ForecastModel = ForecastModel.ENSEMBLE) -> Dict[str, Any]:
        """Generate forecasts for specified metric or all metrics"""
        results = {}
        
        metrics_to_forecast = [metric_name] if metric_name else list(self.time_series_data.keys())
        
        for metric in metrics_to_forecast:
            if metric not in self.time_series_data:
                continue
            
            try:
                forecast = await self.forecasting_engine.generate_forecast(
                    self.time_series_data[metric],
                    horizon=horizon,
                    model_type=model_type
                )
                
                self.forecasts[forecast.forecast_id] = forecast
                results[metric] = asdict(forecast)
                
                logger.info(f"Generated forecast for {metric} with horizon {horizon}")
                
            except Exception as e:
                logger.error(f"Error generating forecast for {metric}: {e}")
                results[metric] = {"error": str(e)}
        
        # Cache results
        await self._cache_forecast_results(results)
        
        return {
            "forecasts": results,
            "summary": self._generate_forecast_summary(results),
            "timestamp": datetime.now().isoformat()
        }
    
    def _generate_forecast_summary(self, forecasts: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of forecast results"""
        if not forecasts:
            return {}
        
        total_forecasts = len(forecasts)
        successful_forecasts = len([f for f in forecasts.values() if "error" not in f])
        
        # Analyze forecast accuracy
        accuracy_scores = []
        for forecast in forecasts.values():
            if "error" not in forecast and "model_accuracy" in forecast:
                accuracy = forecast["model_accuracy"]
                if "r2_score" in accuracy:
                    accuracy_scores.append(accuracy["r2_score"])
        
        avg_accuracy = np.mean(accuracy_scores) if accuracy_scores else 0
        
        return {
            "total_forecasts": total_forecasts,
            "successful_forecasts": successful_forecasts,
            "success_rate": successful_forecasts / total_forecasts if total_forecasts > 0 else 0,
            "average_accuracy": avg_accuracy,
            "forecast_horizon_hours": max([f.get("forecast_horizon", 0) for f in forecasts.values() if "error" not in f], default=0)
        }
    
    async def _cache_trend_results(self, results: Dict[str, Any]):
        """Cache trend analysis results"""
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    "trend_analysis_results",
                    3600,  # 1 hour TTL
                    json.dumps(results, default=str)
                )
            except Exception as e:
                logger.error(f"Error caching trend results: {e}")
    
    async def _cache_forecast_results(self, results: Dict[str, Any]):
        """Cache forecast results"""
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    "forecast_results",
                    7200,  # 2 hour TTL
                    json.dumps(results, default=str)
                )
            except Exception as e:
                logger.error(f"Error caching forecast results: {e}")
    
    async def get_trend_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive data for trend dashboard"""
        # Get recent trend analyses
        trend_data = {}
        for metric, analysis in self.trend_analyses.items():
            trend_data[metric] = {
                "current_trend": analysis.trend_direction.value,
                "trend_strength": analysis.trend_strength.value,
                "slope": analysis.slope,
                "volatility": analysis.volatility,
                "r_squared": analysis.r_squared,
                "anomalies_count": len(analysis.anomalies),
                "change_points_count": len(analysis.change_points),
                "seasonal_patterns": {k.value: v for k, v in analysis.seasonal_patterns.items()}
            }
        
        # Get recent forecasts
        forecast_data = {}
        for forecast_id, forecast in list(self.forecasts.items())[-10:]:  # Last 10 forecasts
            forecast_data[forecast.metric_name] = {
                "forecast_id": forecast_id,
                "model_type": forecast.model_type.value,
                "horizon": forecast.forecast_horizon,
                "accuracy": forecast.model_accuracy,
                "next_24h_predictions": [
                    {"timestamp": p.timestamp.isoformat(), "value": p.value}
                    for p in forecast.predictions[:24]  # Next 24 hours
                ]
            }
        
        # Generate insights
        insights = await self._generate_insights()
        
        return {
            "trends": trend_data,
            "forecasts": forecast_data,
            "insights": insights,
            "last_updated": datetime.now().isoformat()
        }
    
    async def _generate_insights(self) -> List[Dict[str, Any]]:
        """Generate actionable insights from trend and forecast data"""
        insights = []
        
        # Analyze trends for insights
        for metric, analysis in self.trend_analyses.items():
            # High volatility insight
            if analysis.volatility > 0.4:
                insights.append({
                    "type": "volatility_warning",
                    "metric": metric,
                    "severity": "medium",
                    "message": f"{metric} shows high volatility ({analysis.volatility:.2f}). Consider investigating underlying causes.",
                    "recommendation": "Review system stability and consider implementing smoothing mechanisms."
                })
            
            # Strong negative trend insight
            if analysis.trend_direction == TrendDirection.DECREASING and analysis.trend_strength in [TrendStrength.STRONG, TrendStrength.VERY_STRONG]:
                insights.append({
                    "type": "declining_trend",
                    "metric": metric,
                    "severity": "high",
                    "message": f"{metric} shows a strong declining trend.",
                    "recommendation": "Investigate root causes and implement corrective measures."
                })
            
            # Anomalies insight
            if len(analysis.anomalies) > 5:
                insights.append({
                    "type": "anomaly_detection",
                    "metric": metric,
                    "severity": "medium",
                    "message": f"{metric} has {len(analysis.anomalies)} anomalies detected.",
                    "recommendation": "Review anomalous periods for potential issues or unusual events."
                })
        
        # Analyze forecasts for insights
        for forecast in self.forecasts.values():
            # Low accuracy forecast
            accuracy = forecast.model_accuracy.get("r2_score", 0)
            if accuracy < 0.5:
                insights.append({
                    "type": "forecast_accuracy",
                    "metric": forecast.metric_name,
                    "severity": "low",
                    "message": f"Forecast accuracy for {forecast.metric_name} is low ({accuracy:.2f}). Predictions may be unreliable.",
                    "recommendation": "Consider collecting more training data or using different forecasting models."
                })
        
        return sorted(insights, key=lambda x: {"high": 3, "medium": 2, "low": 1}[x["severity"]], reverse=True)

# FastAPI application
app = FastAPI(title="Trend Analysis and Forecasting System", version="1.0.0")
trend_system = TrendForecastingSystem()

@app.on_event("startup")
async def startup():
    await trend_system.initialize()

class TrendAnalysisRequest(BaseModel):
    metric_name: Optional[str] = None

class ForecastRequest(BaseModel):
    metric_name: Optional[str] = None
    horizon: int = 24
    model_type: str = "ensemble"

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "trend-forecasting"}

@app.post("/analyze/trends")
async def analyze_trends(request: TrendAnalysisRequest, background_tasks: BackgroundTasks):
    """Analyze trends for metrics"""
    try:
        background_tasks.add_task(trend_system.analyze_trends, request.metric_name)
        return {
            "status": "analysis_started",
            "metric": request.metric_name or "all_metrics",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/trends")
async def get_trend_analyses(metric_name: Optional[str] = Query(None)):
    """Get trend analysis results"""
    try:
        if metric_name:
            if metric_name not in trend_system.trend_analyses:
                raise HTTPException(status_code=404, detail="Trend analysis not found")
            return {metric_name: asdict(trend_system.trend_analyses[metric_name])}
        else:
            return {
                metric: asdict(analysis) 
                for metric, analysis in trend_system.trend_analyses.items()
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast")
async def generate_forecast(request: ForecastRequest, background_tasks: BackgroundTasks):
    """Generate forecasts for metrics"""
    try:
        model_type = ForecastModel(request.model_type)
        
        background_tasks.add_task(
            trend_system.generate_forecasts,
            request.metric_name,
            request.horizon,
            model_type
        )
        
        return {
            "status": "forecast_started",
            "metric": request.metric_name or "all_metrics",
            "horizon": request.horizon,
            "model_type": request.model_type,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/forecasts")
async def get_forecasts(metric_name: Optional[str] = Query(None)):
    """Get forecast results"""
    try:
        forecasts = {}
        for forecast_id, forecast in trend_system.forecasts.items():
            if not metric_name or forecast.metric_name == metric_name:
                forecasts[forecast_id] = asdict(forecast)
        
        return {"forecasts": forecasts, "count": len(forecasts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard")
async def get_dashboard_data():
    """Get comprehensive dashboard data"""
    try:
        dashboard_data = await trend_system.get_trend_dashboard_data()
        return dashboard_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/insights")
async def get_insights():
    """Get actionable insights from trend and forecast analysis"""
    try:
        insights = await trend_system._generate_insights()
        return {
            "insights": insights,
            "count": len(insights),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_available_metrics():
    """Get list of available metrics for analysis"""
    try:
        metrics = list(trend_system.time_series_data.keys())
        metrics_info = {}
        
        for metric in metrics:
            data = trend_system.time_series_data[metric]
            metrics_info[metric] = {
                "data_points": len(data),
                "time_range": {
                    "start": data[0].timestamp.isoformat() if data else None,
                    "end": data[-1].timestamp.isoformat() if data else None
                },
                "has_trend_analysis": metric in trend_system.trend_analyses,
                "forecast_count": len([f for f in trend_system.forecasts.values() if f.metric_name == metric])
            }
        
        return {
            "metrics": metrics_info,
            "total_metrics": len(metrics)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)