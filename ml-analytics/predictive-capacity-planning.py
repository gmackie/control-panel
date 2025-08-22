#!/usr/bin/env python3
"""
Predictive Capacity Planning System
Uses machine learning to predict future resource needs and provide intelligent scaling recommendations
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import pickle
import os
import json
import requests
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import train_test_split, cross_val_score
import joblib
import warnings
warnings.filterwarnings('ignore')

@dataclass
class CapacityPrediction:
    """Data class for capacity predictions"""
    resource_type: str
    current_usage: float
    predicted_usage: float
    confidence_interval: Tuple[float, float]
    recommendation: str
    timeline: str
    risk_level: str

@dataclass
class ScalingRecommendation:
    """Data class for scaling recommendations"""
    service: str
    current_replicas: int
    recommended_replicas: int
    reasoning: str
    expected_savings: Optional[float]
    urgency: str

class PredictiveCapacityPlanner:
    """Advanced capacity planning with machine learning"""
    
    def __init__(self, prometheus_url: str = "http://prometheus:9090"):
        self.prometheus_url = prometheus_url
        self.models = {}
        self.scalers = {}
        self.model_path = "/models/capacity_planning"
        self.feature_importance = {}
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Load existing models if available
        self._load_models()
    
    def collect_training_data(self, days_back: int = 30) -> pd.DataFrame:
        """Collect historical data for model training"""
        end_time = datetime.now()
        start_time = end_time - timedelta(days=days_back)
        
        print(f"Collecting training data from {start_time} to {end_time}")
        
        # Define metrics to collect
        metrics_queries = {
            'cpu_usage': 'avg(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory_usage': 'avg(container_memory_usage_bytes{container="control-panel"}) / 1024 / 1024 / 1024',
            'request_rate': 'sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'response_time': 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))',
            'error_rate': 'sum(rate(http_requests_total{job="control-panel",status=~"5.."}[5m])) / sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'db_connections': 'pg_stat_database_numbackends{datname="control_panel"}',
            'disk_usage': 'avg(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))',
            'network_io': 'avg(rate(container_network_receive_bytes_total{name="control-panel"}[5m]) + rate(container_network_transmit_bytes_total{name="control-panel"}[5m]))'
        }
        
        # Collect data
        all_data = []
        current_time = start_time
        
        while current_time < end_time:
            timestamp = int(current_time.timestamp())
            row_data = {'timestamp': current_time}
            
            for metric_name, query in metrics_queries.items():
                try:
                    value = self._query_prometheus_at_time(query, timestamp)
                    row_data[metric_name] = value
                except Exception as e:
                    print(f"Warning: Could not fetch {metric_name}: {e}")
                    row_data[metric_name] = np.nan
            
            # Add temporal features
            row_data.update(self._extract_temporal_features(current_time))
            
            # Add external factors (simulated)
            row_data.update(self._simulate_external_factors(current_time))
            
            all_data.append(row_data)
            current_time += timedelta(hours=1)  # Hourly data points
        
        df = pd.DataFrame(all_data)
        
        # Clean and preprocess data
        df = self._preprocess_data(df)
        
        print(f"Collected {len(df)} data points with {len(df.columns)} features")
        return df
    
    def _query_prometheus_at_time(self, query: str, timestamp: int) -> float:
        """Query Prometheus for a specific timestamp"""
        try:
            response = requests.get(
                f"{self.prometheus_url}/api/v1/query",
                params={'query': query, 'time': timestamp},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'success' and data['data']['result']:
                    return float(data['data']['result'][0]['value'][1])
            
            # Return simulated data if Prometheus is not available
            return self._simulate_metric_value(query)
            
        except Exception:
            return self._simulate_metric_value(query)
    
    def _simulate_metric_value(self, query: str) -> float:
        """Simulate realistic metric values for development"""
        base_values = {
            'cpu_usage': np.random.normal(0.4, 0.1),
            'memory_usage': np.random.normal(1.5, 0.3),
            'request_rate': np.random.normal(50, 15),
            'response_time': np.random.lognormal(np.log(0.15), 0.3),
            'error_rate': np.random.exponential(0.005),
            'db_connections': np.random.poisson(25),
            'disk_usage': np.random.normal(0.6, 0.1),
            'network_io': np.random.normal(1000000, 300000)
        }
        
        # Determine metric type from query
        for metric_type, base_value in base_values.items():
            if metric_type.replace('_', '') in query.replace('_', '').lower():
                return max(0, base_value)
        
        return np.random.normal(1.0, 0.2)
    
    def _extract_temporal_features(self, timestamp: datetime) -> Dict:
        """Extract temporal features from timestamp"""
        return {
            'hour_of_day': timestamp.hour,
            'day_of_week': timestamp.weekday(),
            'day_of_month': timestamp.day,
            'month': timestamp.month,
            'is_weekend': timestamp.weekday() >= 5,
            'is_business_hours': 9 <= timestamp.hour <= 17,
            'hour_sin': np.sin(2 * np.pi * timestamp.hour / 24),
            'hour_cos': np.cos(2 * np.pi * timestamp.hour / 24),
            'day_sin': np.sin(2 * np.pi * timestamp.weekday() / 7),
            'day_cos': np.cos(2 * np.pi * timestamp.weekday() / 7)
        }
    
    def _simulate_external_factors(self, timestamp: datetime) -> Dict:
        """Simulate external factors that might affect resource usage"""
        # Simulate deployment events
        deployment_probability = 0.05  # 5% chance of deployment each hour
        is_deployment = np.random.random() < deployment_probability
        
        # Simulate marketing campaigns or events
        campaign_effect = np.sin(2 * np.pi * timestamp.day / 30) * 0.2  # Monthly cycle
        
        # Simulate seasonal trends
        seasonal_effect = np.sin(2 * np.pi * timestamp.timetuple().tm_yday / 365) * 0.1
        
        return {
            'deployment_event': is_deployment,
            'campaign_effect': campaign_effect,
            'seasonal_effect': seasonal_effect,
            'days_since_epoch': (timestamp - datetime(1970, 1, 1)).days
        }
    
    def _preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and preprocess the data"""
        # Handle missing values
        df = df.interpolate(method='linear')
        df = df.fillna(method='forward').fillna(method='backward')
        
        # Remove outliers using IQR method
        for column in df.select_dtypes(include=[np.number]).columns:
            if column != 'timestamp':
                Q1 = df[column].quantile(0.25)
                Q3 = df[column].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                df[column] = df[column].clip(lower_bound, upper_bound)
        
        # Add lag features for time series
        lag_columns = ['cpu_usage', 'memory_usage', 'request_rate', 'response_time']
        for col in lag_columns:
            if col in df.columns:
                df[f'{col}_lag_1h'] = df[col].shift(1)
                df[f'{col}_lag_24h'] = df[col].shift(24)
                df[f'{col}_lag_7d'] = df[col].shift(24 * 7)
        
        # Add rolling averages
        for col in lag_columns:
            if col in df.columns:
                df[f'{col}_rolling_6h'] = df[col].rolling(window=6, min_periods=1).mean()
                df[f'{col}_rolling_24h'] = df[col].rolling(window=24, min_periods=1).mean()
        
        # Drop rows with NaN values after feature engineering
        df = df.dropna()
        
        return df
    
    def train_models(self, df: pd.DataFrame) -> Dict[str, float]:
        """Train predictive models for different resources"""
        target_columns = ['cpu_usage', 'memory_usage', 'request_rate', 'response_time']
        feature_columns = [col for col in df.columns if col not in target_columns + ['timestamp']]
        
        model_performance = {}
        
        for target in target_columns:
            if target not in df.columns:
                continue
                
            print(f"Training model for {target}...")
            
            # Prepare features and target
            X = df[feature_columns].copy()
            y = df[target].copy()
            
            # Handle categorical variables
            for col in X.select_dtypes(include=['object']).columns:
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
            
            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )
            
            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            
            # Train model
            model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
            
            model.fit(X_train_scaled, y_train)
            
            # Evaluate model
            y_pred = model.predict(X_test_scaled)
            mae = mean_absolute_error(y_test, y_pred)
            rmse = np.sqrt(mean_squared_error(y_test, y_pred))
            
            # Cross-validation score
            cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='neg_mean_absolute_error')
            cv_mae = -cv_scores.mean()
            
            model_performance[target] = {
                'mae': mae,
                'rmse': rmse,
                'cv_mae': cv_mae,
                'feature_importance': dict(zip(feature_columns, model.feature_importances_))
            }
            
            # Save model and scaler
            self.models[target] = model
            self.scalers[target] = scaler
            self.feature_importance[target] = dict(zip(feature_columns, model.feature_importances_))
            
            print(f"Model for {target} - MAE: {mae:.4f}, RMSE: {rmse:.4f}, CV MAE: {cv_mae:.4f}")
        
        # Save models to disk
        self._save_models()
        
        return model_performance
    
    def predict_capacity_needs(self, forecast_hours: int = 168) -> List[CapacityPrediction]:
        """Predict future capacity needs"""
        predictions = []
        
        # Get current metrics as baseline
        current_metrics = self._get_current_metrics()
        
        for resource_type in self.models.keys():
            try:
                # Generate future timestamps
                future_timestamps = [
                    datetime.now() + timedelta(hours=h) for h in range(1, forecast_hours + 1)
                ]
                
                # Prepare features for prediction
                future_features = []
                for timestamp in future_timestamps:
                    features = self._extract_temporal_features(timestamp)
                    features.update(self._simulate_external_factors(timestamp))
                    
                    # Add lag features (using current values as approximation)
                    for col in ['cpu_usage', 'memory_usage', 'request_rate', 'response_time']:
                        if col in current_metrics:
                            features[f'{col}_lag_1h'] = current_metrics[col]
                            features[f'{col}_lag_24h'] = current_metrics[col]
                            features[f'{col}_lag_7d'] = current_metrics[col]
                            features[f'{col}_rolling_6h'] = current_metrics[col]
                            features[f'{col}_rolling_24h'] = current_metrics[col]
                    
                    future_features.append(features)
                
                # Convert to DataFrame and align with training features
                feature_df = pd.DataFrame(future_features)
                
                # Ensure all required features are present
                model_features = list(self.feature_importance[resource_type].keys())
                for feature in model_features:
                    if feature not in feature_df.columns:
                        feature_df[feature] = 0  # Default value for missing features
                
                feature_df = feature_df[model_features]
                
                # Scale features
                feature_scaled = self.scalers[resource_type].transform(feature_df)
                
                # Make predictions
                predictions_raw = self.models[resource_type].predict(feature_scaled)
                
                # Calculate confidence intervals (simplified)
                std_dev = np.std(predictions_raw)
                mean_pred = np.mean(predictions_raw)
                confidence_interval = (
                    mean_pred - 1.96 * std_dev,
                    mean_pred + 1.96 * std_dev
                )
                
                # Generate recommendation
                current_value = current_metrics.get(resource_type, 0)
                predicted_max = np.max(predictions_raw)
                
                recommendation, risk_level = self._generate_recommendation(
                    resource_type, current_value, predicted_max
                )
                
                prediction = CapacityPrediction(
                    resource_type=resource_type,
                    current_usage=current_value,
                    predicted_usage=predicted_max,
                    confidence_interval=confidence_interval,
                    recommendation=recommendation,
                    timeline=f"Next {forecast_hours} hours",
                    risk_level=risk_level
                )
                
                predictions.append(prediction)
                
            except Exception as e:
                print(f"Error predicting {resource_type}: {e}")
        
        return predictions
    
    def generate_scaling_recommendations(self) -> List[ScalingRecommendation]:
        """Generate intelligent scaling recommendations"""
        recommendations = []
        
        # Get capacity predictions
        predictions = self.predict_capacity_needs(forecast_hours=72)  # 3 days ahead
        
        for prediction in predictions:
            if prediction.risk_level in ['high', 'critical']:
                recommendation = self._create_scaling_recommendation(prediction)
                if recommendation:
                    recommendations.append(recommendation)
        
        return recommendations
    
    def _generate_recommendation(self, resource_type: str, current: float, predicted: float) -> Tuple[str, str]:
        """Generate human-readable recommendation and risk level"""
        
        if resource_type == 'cpu_usage':
            if predicted > 0.8:
                return "Scale up CPU resources immediately - high utilization predicted", "critical"
            elif predicted > 0.6:
                return "Consider scaling up CPU resources - elevated utilization predicted", "high"
            elif predicted > 0.4:
                return "Monitor CPU usage - moderate increase expected", "medium"
            else:
                return "CPU usage within normal range", "low"
                
        elif resource_type == 'memory_usage':
            if predicted > 3.0:  # GB
                return "Scale up memory resources - high usage predicted", "critical"
            elif predicted > 2.5:
                return "Consider memory optimization or scaling", "high"
            elif predicted > 2.0:
                return "Monitor memory usage trends", "medium"
            else:
                return "Memory usage within normal range", "low"
                
        elif resource_type == 'request_rate':
            if predicted > 100:
                return "Prepare for high traffic - scale application horizontally", "high"
            elif predicted > 75:
                return "Moderate traffic increase expected", "medium"
            else:
                return "Request rate within normal range", "low"
                
        elif resource_type == 'response_time':
            if predicted > 0.5:  # 500ms
                return "Performance degradation predicted - optimize or scale", "high"
            elif predicted > 0.3:
                return "Slight performance impact expected", "medium"
            else:
                return "Response time within acceptable range", "low"
        
        return "Monitor resource usage", "low"
    
    def _create_scaling_recommendation(self, prediction: CapacityPrediction) -> Optional[ScalingRecommendation]:
        """Create specific scaling recommendation"""
        
        if prediction.resource_type == 'cpu_usage' and prediction.predicted_usage > 0.7:
            return ScalingRecommendation(
                service="control-panel",
                current_replicas=3,
                recommended_replicas=5,
                reasoning=f"CPU usage predicted to reach {prediction.predicted_usage:.2f}",
                expected_savings=None,
                urgency="high" if prediction.predicted_usage > 0.8 else "medium"
            )
        
        elif prediction.resource_type == 'memory_usage' and prediction.predicted_usage > 2.5:
            return ScalingRecommendation(
                service="control-panel",
                current_replicas=3,
                recommended_replicas=4,
                reasoning=f"Memory usage predicted to reach {prediction.predicted_usage:.2f}GB",
                expected_savings=None,
                urgency="high" if prediction.predicted_usage > 3.0 else "medium"
            )
        
        return None
    
    def _get_current_metrics(self) -> Dict[str, float]:
        """Get current resource usage metrics"""
        metrics = {}
        
        queries = {
            'cpu_usage': 'avg(rate(container_cpu_usage_seconds_total{container="control-panel"}[5m]))',
            'memory_usage': 'avg(container_memory_usage_bytes{container="control-panel"}) / 1024 / 1024 / 1024',
            'request_rate': 'sum(rate(http_requests_total{job="control-panel"}[5m]))',
            'response_time': 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="control-panel"}[5m])) by (le))'
        }
        
        for metric_name, query in queries.items():
            try:
                value = self._query_prometheus_at_time(query, int(datetime.now().timestamp()))
                metrics[metric_name] = value
            except Exception:
                # Fallback to simulated values
                metrics[metric_name] = self._simulate_metric_value(query)
        
        return metrics
    
    def _save_models(self):
        """Save trained models to disk"""
        for target in self.models.keys():
            model_file = f"{self.model_path}/{target}_model.pkl"
            scaler_file = f"{self.model_path}/{target}_scaler.pkl"
            
            joblib.dump(self.models[target], model_file)
            joblib.dump(self.scalers[target], scaler_file)
        
        # Save feature importance
        importance_file = f"{self.model_path}/feature_importance.json"
        with open(importance_file, 'w') as f:
            json.dump(self.feature_importance, f, indent=2)
    
    def _load_models(self):
        """Load trained models from disk"""
        try:
            for target in ['cpu_usage', 'memory_usage', 'request_rate', 'response_time']:
                model_file = f"{self.model_path}/{target}_model.pkl"
                scaler_file = f"{self.model_path}/{target}_scaler.pkl"
                
                if os.path.exists(model_file) and os.path.exists(scaler_file):
                    self.models[target] = joblib.load(model_file)
                    self.scalers[target] = joblib.load(scaler_file)
            
            # Load feature importance
            importance_file = f"{self.model_path}/feature_importance.json"
            if os.path.exists(importance_file):
                with open(importance_file, 'r') as f:
                    self.feature_importance = json.load(f)
                    
            print(f"Loaded {len(self.models)} models from disk")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_model_performance(self) -> Dict:
        """Get model performance metrics"""
        if not self.models:
            return {"error": "No models trained yet"}
        
        performance = {}
        for target, importance in self.feature_importance.items():
            # Get top 5 most important features
            sorted_features = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:5]
            
            performance[target] = {
                "model_type": "Random Forest",
                "features_count": len(importance),
                "top_features": dict(sorted_features),
                "model_loaded": target in self.models
            }
        
        return performance


def main():
    """Main execution function for testing"""
    print("🤖 Starting Predictive Capacity Planning System...")
    
    # Initialize the planner
    planner = PredictiveCapacityPlanner()
    
    # Collect training data
    print("📊 Collecting training data...")
    training_data = planner.collect_training_data(days_back=14)  # 2 weeks of data
    
    if len(training_data) > 100:  # Minimum data points
        # Train models
        print("🔬 Training predictive models...")
        performance = planner.train_models(training_data)
        
        print("\n📈 Model Performance:")
        for target, metrics in performance.items():
            print(f"  {target}: MAE={metrics['mae']:.4f}, RMSE={metrics['rmse']:.4f}")
        
        # Generate predictions
        print("\n🔮 Generating capacity predictions...")
        predictions = planner.predict_capacity_needs(forecast_hours=72)
        
        print("\n📋 Capacity Predictions:")
        for pred in predictions:
            print(f"  {pred.resource_type}:")
            print(f"    Current: {pred.current_usage:.4f}")
            print(f"    Predicted: {pred.predicted_usage:.4f}")
            print(f"    Risk: {pred.risk_level}")
            print(f"    Recommendation: {pred.recommendation}")
            print()
        
        # Generate scaling recommendations
        print("⚖️ Generating scaling recommendations...")
        recommendations = planner.generate_scaling_recommendations()
        
        if recommendations:
            print("\n🎯 Scaling Recommendations:")
            for rec in recommendations:
                print(f"  {rec.service}: {rec.current_replicas} → {rec.recommended_replicas} replicas")
                print(f"    Reason: {rec.reasoning}")
                print(f"    Urgency: {rec.urgency}")
                print()
        else:
            print("✅ No scaling recommendations needed at this time")
        
    else:
        print(f"❌ Insufficient training data: {len(training_data)} points (minimum 100 required)")
    
    print("✅ Predictive Capacity Planning completed!")


if __name__ == "__main__":
    main()