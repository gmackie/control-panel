import asyncio
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import PolynomialFeatures
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.holtwinters import ExponentialSmoothing
import warnings
warnings.filterwarnings('ignore')

class ResourceType(Enum):
    CPU = "cpu"
    MEMORY = "memory"
    STORAGE = "storage"
    NETWORK = "network"
    COMPUTE_UNITS = "compute_units"
    DATABASE_CONNECTIONS = "database_connections"
    QUEUE_SIZE = "queue_size"
    CACHE_SIZE = "cache_size"

class PlanningHorizon(Enum):
    SHORT_TERM = "short_term"  # 1-7 days
    MEDIUM_TERM = "medium_term"  # 1-4 weeks
    LONG_TERM = "long_term"  # 1-6 months

class ScalingStrategy(Enum):
    VERTICAL = "vertical"  # Scale up/down
    HORIZONTAL = "horizontal"  # Scale out/in
    HYBRID = "hybrid"  # Combination
    ELASTIC = "elastic"  # Auto-scaling

class CostOptimization(Enum):
    AGGRESSIVE = "aggressive"  # Minimize cost, accept some risk
    BALANCED = "balanced"  # Balance cost and performance
    CONSERVATIVE = "conservative"  # Prioritize performance
    CUSTOM = "custom"  # Custom thresholds

@dataclass
class ResourceMetrics:
    timestamp: datetime
    resource_type: ResourceType
    current_usage: float
    peak_usage: float
    average_usage: float
    percentile_95: float
    percentile_99: float
    total_capacity: float
    available_capacity: float
    utilization_rate: float
    growth_rate: float
    cost_per_unit: float
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class WorkloadPattern:
    pattern_id: str
    name: str
    resource_type: ResourceType
    daily_pattern: List[float]  # 24-hour pattern
    weekly_pattern: List[float]  # 7-day pattern
    monthly_pattern: List[float]  # 30-day pattern
    seasonal_factors: Dict[str, float]  # Season -> multiplier
    special_events: List[Dict[str, Any]]  # Event dates and impact
    confidence_score: float
    last_updated: datetime

@dataclass
class CapacityForecast:
    forecast_id: str
    resource_type: ResourceType
    horizon: PlanningHorizon
    start_date: datetime
    end_date: datetime
    predicted_usage: List[float]
    confidence_intervals: List[Tuple[float, float]]  # (lower, upper)
    peak_prediction: float
    average_prediction: float
    required_capacity: float
    recommended_buffer: float
    probability_of_exhaustion: float
    cost_projection: float
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ScalingRecommendation:
    recommendation_id: str
    resource_type: ResourceType
    strategy: ScalingStrategy
    action: str  # scale_up, scale_down, scale_out, scale_in
    target_capacity: float
    current_capacity: float
    change_percentage: float
    estimated_cost: float
    estimated_savings: float
    implementation_time: timedelta
    risk_score: float
    justification: List[str]
    prerequisites: List[str]
    impact_analysis: Dict[str, Any]

@dataclass
class ResourceOptimization:
    optimization_id: str
    resource_type: ResourceType
    current_allocation: float
    optimized_allocation: float
    efficiency_gain: float
    cost_reduction: float
    performance_impact: float
    implementation_steps: List[str]
    rollback_plan: str
    validation_metrics: List[str]

class TimeSeriesForecaster:
    def __init__(self):
        self.models = {}
        self.historical_data = {}
        self.forecast_cache = {}
        
    def add_historical_data(self, resource_type: ResourceType, data: pd.Series):
        """Add historical data for a resource type"""
        self.historical_data[resource_type] = data
    
    async def forecast_arima(self, data: pd.Series, periods: int) -> Tuple[np.ndarray, np.ndarray]:
        """ARIMA forecasting"""
        try:
            # Fit ARIMA model
            model = ARIMA(data, order=(2, 1, 2))
            fitted_model = model.fit()
            
            # Generate forecast
            forecast = fitted_model.forecast(steps=periods)
            
            # Calculate confidence intervals
            forecast_df = fitted_model.get_forecast(steps=periods)
            confidence_intervals = forecast_df.conf_int()
            
            return forecast.values, confidence_intervals.values
        except Exception as e:
            logging.error(f"ARIMA forecast failed: {e}")
            return self._fallback_forecast(data, periods)
    
    async def forecast_exponential_smoothing(self, data: pd.Series, periods: int) -> Tuple[np.ndarray, np.ndarray]:
        """Exponential smoothing forecast"""
        try:
            # Fit exponential smoothing model
            model = ExponentialSmoothing(
                data,
                seasonal_periods=24,  # Daily seasonality
                trend='add',
                seasonal='add'
            )
            fitted_model = model.fit()
            
            # Generate forecast
            forecast = fitted_model.forecast(steps=periods)
            
            # Simple confidence intervals (±20% for now)
            lower_bound = forecast * 0.8
            upper_bound = forecast * 1.2
            confidence_intervals = np.column_stack((lower_bound, upper_bound))
            
            return forecast.values, confidence_intervals
        except Exception as e:
            logging.error(f"Exponential smoothing failed: {e}")
            return self._fallback_forecast(data, periods)
    
    async def forecast_ml(self, data: pd.Series, periods: int) -> Tuple[np.ndarray, np.ndarray]:
        """Machine learning based forecast using Random Forest"""
        try:
            # Prepare features
            X, y = self._prepare_ml_features(data.values)
            
            # Train model
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X, y)
            
            # Generate forecast
            forecast = []
            last_values = data.values[-10:].tolist()
            
            for _ in range(periods):
                features = self._create_features(last_values)
                pred = model.predict([features])[0]
                forecast.append(pred)
                last_values.append(pred)
                last_values.pop(0)
            
            forecast = np.array(forecast)
            
            # Confidence intervals based on model uncertainty
            std_dev = np.std(data.values) * 0.2
            lower_bound = forecast - 1.96 * std_dev
            upper_bound = forecast + 1.96 * std_dev
            confidence_intervals = np.column_stack((lower_bound, upper_bound))
            
            return forecast, confidence_intervals
        except Exception as e:
            logging.error(f"ML forecast failed: {e}")
            return self._fallback_forecast(data, periods)
    
    def _prepare_ml_features(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare features for ML model"""
        window_size = 10
        X, y = [], []
        
        for i in range(window_size, len(data)):
            features = self._create_features(data[i-window_size:i])
            X.append(features)
            y.append(data[i])
        
        return np.array(X), np.array(y)
    
    def _create_features(self, window: List[float]) -> List[float]:
        """Create features from time window"""
        return [
            np.mean(window),
            np.std(window),
            np.max(window),
            np.min(window),
            window[-1],  # Last value
            window[-1] - window[0],  # Trend
            np.percentile(window, 75),
            np.percentile(window, 25),
            len([x for x in window if x > np.mean(window)]),  # Values above mean
            np.median(window)
        ]
    
    def _fallback_forecast(self, data: pd.Series, periods: int) -> Tuple[np.ndarray, np.ndarray]:
        """Simple linear forecast as fallback"""
        # Linear regression on recent trend
        X = np.arange(len(data)).reshape(-1, 1)
        y = data.values
        
        model = LinearRegression()
        model.fit(X, y)
        
        future_X = np.arange(len(data), len(data) + periods).reshape(-1, 1)
        forecast = model.predict(future_X)
        
        # Simple confidence intervals
        std_dev = np.std(y)
        lower_bound = forecast - 1.96 * std_dev
        upper_bound = forecast + 1.96 * std_dev
        confidence_intervals = np.column_stack((lower_bound, upper_bound))
        
        return forecast, confidence_intervals
    
    async def ensemble_forecast(self, data: pd.Series, periods: int) -> Tuple[np.ndarray, np.ndarray]:
        """Ensemble forecast combining multiple methods"""
        forecasts = []
        intervals = []
        
        # Run multiple forecasting methods
        arima_forecast, arima_intervals = await self.forecast_arima(data, periods)
        forecasts.append(arima_forecast)
        intervals.append(arima_intervals)
        
        exp_forecast, exp_intervals = await self.forecast_exponential_smoothing(data, periods)
        forecasts.append(exp_forecast)
        intervals.append(exp_intervals)
        
        ml_forecast, ml_intervals = await self.forecast_ml(data, periods)
        forecasts.append(ml_forecast)
        intervals.append(ml_intervals)
        
        # Weighted average ensemble
        weights = [0.3, 0.3, 0.4]  # ARIMA, Exp Smoothing, ML
        ensemble_forecast = np.average(forecasts, axis=0, weights=weights)
        
        # Combine confidence intervals
        lower_bounds = [ci[:, 0] for ci in intervals]
        upper_bounds = [ci[:, 1] for ci in intervals]
        
        ensemble_lower = np.average(lower_bounds, axis=0, weights=weights)
        ensemble_upper = np.average(upper_bounds, axis=0, weights=weights)
        ensemble_intervals = np.column_stack((ensemble_lower, ensemble_upper))
        
        return ensemble_forecast, ensemble_intervals

class WorkloadAnalyzer:
    def __init__(self):
        self.patterns = {}
        self.anomaly_threshold = 2.5  # Standard deviations
        
    async def detect_patterns(self, resource_type: ResourceType, 
                            data: pd.Series) -> WorkloadPattern:
        """Detect workload patterns from historical data"""
        # Extract daily pattern (hourly averages)
        hourly_data = data.resample('H').mean()
        daily_pattern = self._extract_daily_pattern(hourly_data)
        
        # Extract weekly pattern (daily averages)
        daily_data = data.resample('D').mean()
        weekly_pattern = self._extract_weekly_pattern(daily_data)
        
        # Extract monthly pattern
        monthly_pattern = self._extract_monthly_pattern(daily_data)
        
        # Detect seasonal factors
        seasonal_factors = self._detect_seasonal_factors(daily_data)
        
        # Identify special events
        special_events = await self._identify_special_events(data)
        
        # Calculate confidence score
        confidence_score = self._calculate_pattern_confidence(data, daily_pattern)
        
        pattern = WorkloadPattern(
            pattern_id=str(uuid.uuid4()),
            name=f"{resource_type.value}_pattern",
            resource_type=resource_type,
            daily_pattern=daily_pattern,
            weekly_pattern=weekly_pattern,
            monthly_pattern=monthly_pattern,
            seasonal_factors=seasonal_factors,
            special_events=special_events,
            confidence_score=confidence_score,
            last_updated=datetime.now()
        )
        
        self.patterns[resource_type] = pattern
        return pattern
    
    def _extract_daily_pattern(self, hourly_data: pd.Series) -> List[float]:
        """Extract 24-hour pattern"""
        pattern = []
        for hour in range(24):
            hour_values = hourly_data[hourly_data.index.hour == hour]
            if len(hour_values) > 0:
                pattern.append(float(hour_values.mean()))
            else:
                pattern.append(0.0)
        return pattern
    
    def _extract_weekly_pattern(self, daily_data: pd.Series) -> List[float]:
        """Extract 7-day weekly pattern"""
        pattern = []
        for day in range(7):
            day_values = daily_data[daily_data.index.dayofweek == day]
            if len(day_values) > 0:
                pattern.append(float(day_values.mean()))
            else:
                pattern.append(0.0)
        return pattern
    
    def _extract_monthly_pattern(self, daily_data: pd.Series) -> List[float]:
        """Extract 30-day monthly pattern"""
        pattern = []
        for day in range(1, 31):
            day_values = daily_data[daily_data.index.day == day]
            if len(day_values) > 0:
                pattern.append(float(day_values.mean()))
            else:
                pattern.append(0.0)
        return pattern
    
    def _detect_seasonal_factors(self, daily_data: pd.Series) -> Dict[str, float]:
        """Detect seasonal variations"""
        seasonal_factors = {}
        
        # Group by season (simplified)
        for month in range(1, 13):
            month_data = daily_data[daily_data.index.month == month]
            if len(month_data) > 0:
                overall_mean = daily_data.mean()
                month_mean = month_data.mean()
                factor = month_mean / overall_mean if overall_mean > 0 else 1.0
                
                # Map to season
                if month in [12, 1, 2]:
                    season = "winter"
                elif month in [3, 4, 5]:
                    season = "spring"
                elif month in [6, 7, 8]:
                    season = "summer"
                else:
                    season = "fall"
                
                if season not in seasonal_factors:
                    seasonal_factors[season] = []
                seasonal_factors[season].append(factor)
        
        # Average factors per season
        for season in seasonal_factors:
            seasonal_factors[season] = float(np.mean(seasonal_factors[season]))
        
        return seasonal_factors
    
    async def _identify_special_events(self, data: pd.Series) -> List[Dict[str, Any]]:
        """Identify special events that cause spikes"""
        special_events = []
        
        # Detect anomalies
        mean = data.mean()
        std = data.std()
        
        for timestamp, value in data.items():
            z_score = abs((value - mean) / std)
            if z_score > self.anomaly_threshold:
                special_events.append({
                    'date': timestamp.isoformat(),
                    'impact_multiplier': value / mean,
                    'z_score': z_score,
                    'type': 'spike' if value > mean else 'dip'
                })
        
        # Limit to top 10 events
        special_events.sort(key=lambda x: x['z_score'], reverse=True)
        return special_events[:10]
    
    def _calculate_pattern_confidence(self, data: pd.Series, pattern: List[float]) -> float:
        """Calculate confidence score for detected pattern"""
        if len(data) < 100:
            return 0.5  # Low confidence for small datasets
        
        # Calculate how well the pattern fits the data
        # Simplified calculation
        confidence = min(0.95, 0.5 + len(data) / 1000)
        return confidence
    
    async def predict_workload(self, resource_type: ResourceType, 
                              future_date: datetime) -> float:
        """Predict workload for a specific future date/time"""
        if resource_type not in self.patterns:
            return 0.0
        
        pattern = self.patterns[resource_type]
        
        # Get base prediction from patterns
        hour_of_day = future_date.hour
        day_of_week = future_date.weekday()
        day_of_month = future_date.day
        
        hourly_factor = pattern.daily_pattern[hour_of_day] if hour_of_day < len(pattern.daily_pattern) else 1.0
        daily_factor = pattern.weekly_pattern[day_of_week] if day_of_week < len(pattern.weekly_pattern) else 1.0
        monthly_factor = pattern.monthly_pattern[day_of_month - 1] if day_of_month <= len(pattern.monthly_pattern) else 1.0
        
        # Apply seasonal factor
        month = future_date.month
        if month in [12, 1, 2]:
            season = "winter"
        elif month in [3, 4, 5]:
            season = "spring"
        elif month in [6, 7, 8]:
            season = "summer"
        else:
            season = "fall"
        
        seasonal_factor = pattern.seasonal_factors.get(season, 1.0)
        
        # Combine factors
        predicted_workload = hourly_factor * daily_factor * monthly_factor * seasonal_factor
        
        # Check for special events
        for event in pattern.special_events:
            event_date = datetime.fromisoformat(event['date'])
            if abs((future_date - event_date).days) < 1:
                predicted_workload *= event.get('impact_multiplier', 1.0)
        
        return predicted_workload

class CapacityPlanner:
    def __init__(self):
        self.forecaster = TimeSeriesForecaster()
        self.workload_analyzer = WorkloadAnalyzer()
        self.resource_metrics = {}
        self.forecasts = {}
        self.recommendations = []
        
    async def analyze_resource(self, metrics: List[ResourceMetrics]) -> Dict[str, Any]:
        """Analyze resource usage and trends"""
        if not metrics:
            return {}
        
        resource_type = metrics[0].resource_type
        
        # Convert to time series
        timestamps = [m.timestamp for m in metrics]
        usage_values = [m.current_usage for m in metrics]
        
        data = pd.Series(usage_values, index=pd.DatetimeIndex(timestamps))
        
        # Store historical data
        self.forecaster.add_historical_data(resource_type, data)
        
        # Detect patterns
        pattern = await self.workload_analyzer.detect_patterns(resource_type, data)
        
        # Calculate statistics
        stats = {
            'resource_type': resource_type.value,
            'current_usage': metrics[-1].current_usage,
            'peak_usage': max(m.peak_usage for m in metrics),
            'average_usage': np.mean([m.average_usage for m in metrics]),
            'utilization_rate': metrics[-1].utilization_rate,
            'growth_rate': self._calculate_growth_rate(usage_values),
            'volatility': np.std(usage_values),
            'pattern_detected': pattern.confidence_score > 0.7,
            'pattern_confidence': pattern.confidence_score
        }
        
        return stats
    
    async def generate_forecast(self, resource_type: ResourceType, 
                              horizon: PlanningHorizon) -> CapacityForecast:
        """Generate capacity forecast for a resource"""
        # Determine forecast periods
        periods_map = {
            PlanningHorizon.SHORT_TERM: 7 * 24,  # 7 days in hours
            PlanningHorizon.MEDIUM_TERM: 4 * 7 * 24,  # 4 weeks in hours
            PlanningHorizon.LONG_TERM: 6 * 30 * 24  # 6 months in hours
        }
        
        periods = periods_map[horizon]
        
        # Get historical data
        if resource_type not in self.forecaster.historical_data:
            logging.error(f"No historical data for {resource_type}")
            return None
        
        data = self.forecaster.historical_data[resource_type]
        
        # Generate ensemble forecast
        forecast_values, confidence_intervals = await self.forecaster.ensemble_forecast(data, periods)
        
        # Calculate required capacity
        peak_prediction = float(np.max(forecast_values))
        average_prediction = float(np.mean(forecast_values))
        
        # Calculate buffer based on volatility and confidence
        volatility = np.std(data.values)
        buffer_percentage = min(50, 10 + volatility * 2)  # 10-50% buffer
        recommended_buffer = peak_prediction * (buffer_percentage / 100)
        
        required_capacity = peak_prediction + recommended_buffer
        
        # Calculate probability of exhaustion
        current_capacity = data.values[-1] * 1.2  # Assume 20% headroom
        prob_exhaustion = self._calculate_exhaustion_probability(
            forecast_values, confidence_intervals, current_capacity
        )
        
        # Cost projection
        cost_per_unit = 0.10  # Example cost
        cost_projection = required_capacity * cost_per_unit * (periods / 24)  # Daily cost
        
        forecast = CapacityForecast(
            forecast_id=str(uuid.uuid4()),
            resource_type=resource_type,
            horizon=horizon,
            start_date=datetime.now(),
            end_date=datetime.now() + timedelta(hours=periods),
            predicted_usage=forecast_values.tolist(),
            confidence_intervals=[tuple(ci) for ci in confidence_intervals],
            peak_prediction=peak_prediction,
            average_prediction=average_prediction,
            required_capacity=required_capacity,
            recommended_buffer=recommended_buffer,
            probability_of_exhaustion=prob_exhaustion,
            cost_projection=cost_projection
        )
        
        self.forecasts[resource_type] = forecast
        return forecast
    
    async def generate_scaling_recommendation(self, resource_type: ResourceType,
                                             forecast: CapacityForecast,
                                             cost_optimization: CostOptimization) -> ScalingRecommendation:
        """Generate scaling recommendations based on forecast"""
        current_capacity = self._get_current_capacity(resource_type)
        required_capacity = forecast.required_capacity
        
        # Determine scaling strategy
        if required_capacity > current_capacity * 1.5:
            strategy = ScalingStrategy.HORIZONTAL
            action = "scale_out"
        elif required_capacity > current_capacity:
            strategy = ScalingStrategy.VERTICAL
            action = "scale_up"
        elif required_capacity < current_capacity * 0.7:
            strategy = ScalingStrategy.VERTICAL
            action = "scale_down"
        else:
            strategy = ScalingStrategy.ELASTIC
            action = "maintain"
        
        change_percentage = ((required_capacity - current_capacity) / current_capacity) * 100
        
        # Cost analysis
        current_cost = current_capacity * 0.10 * 24  # Daily cost
        target_cost = required_capacity * 0.10 * 24
        estimated_savings = max(0, current_cost - target_cost)
        estimated_cost = max(0, target_cost - current_cost)
        
        # Risk assessment
        risk_score = self._calculate_risk_score(
            forecast.probability_of_exhaustion,
            change_percentage,
            cost_optimization
        )
        
        # Generate justification
        justification = []
        if forecast.probability_of_exhaustion > 0.3:
            justification.append(f"High probability of capacity exhaustion: {forecast.probability_of_exhaustion:.1%}")
        if abs(change_percentage) > 20:
            justification.append(f"Significant capacity change needed: {change_percentage:.1f}%")
        if forecast.peak_prediction > current_capacity:
            justification.append(f"Peak demand exceeds current capacity by {(forecast.peak_prediction - current_capacity):.1f} units")
        
        # Prerequisites
        prerequisites = []
        if strategy == ScalingStrategy.HORIZONTAL:
            prerequisites.append("Ensure load balancer configuration is updated")
            prerequisites.append("Verify application supports horizontal scaling")
        elif strategy == ScalingStrategy.VERTICAL:
            prerequisites.append("Schedule maintenance window for vertical scaling")
            prerequisites.append("Backup current configuration")
        
        # Impact analysis
        impact_analysis = {
            'downtime_required': strategy == ScalingStrategy.VERTICAL,
            'estimated_downtime': timedelta(minutes=30) if strategy == ScalingStrategy.VERTICAL else timedelta(0),
            'affected_services': self._get_affected_services(resource_type),
            'performance_impact': 'positive' if action in ['scale_up', 'scale_out'] else 'neutral',
            'cost_impact': 'increase' if estimated_cost > 0 else 'decrease'
        }
        
        recommendation = ScalingRecommendation(
            recommendation_id=str(uuid.uuid4()),
            resource_type=resource_type,
            strategy=strategy,
            action=action,
            target_capacity=required_capacity,
            current_capacity=current_capacity,
            change_percentage=change_percentage,
            estimated_cost=estimated_cost,
            estimated_savings=estimated_savings,
            implementation_time=timedelta(hours=1) if strategy == ScalingStrategy.HORIZONTAL else timedelta(hours=2),
            risk_score=risk_score,
            justification=justification,
            prerequisites=prerequisites,
            impact_analysis=impact_analysis
        )
        
        self.recommendations.append(recommendation)
        return recommendation
    
    async def optimize_resources(self, resource_type: ResourceType,
                                constraints: Dict[str, Any]) -> ResourceOptimization:
        """Optimize resource allocation based on constraints"""
        current_allocation = self._get_current_capacity(resource_type)
        
        # Get forecast
        forecast = self.forecasts.get(resource_type)
        if not forecast:
            forecast = await self.generate_forecast(resource_type, PlanningHorizon.SHORT_TERM)
        
        # Optimization based on constraints
        max_budget = constraints.get('max_budget', float('inf'))
        min_performance = constraints.get('min_performance', 0.8)
        max_utilization = constraints.get('max_utilization', 0.85)
        
        # Calculate optimized allocation
        optimized_allocation = forecast.average_prediction * (1 / max_utilization)
        
        # Apply budget constraint
        max_allocation_budget = max_budget / (0.10 * 24)  # Daily budget to capacity
        optimized_allocation = min(optimized_allocation, max_allocation_budget)
        
        # Ensure minimum performance
        min_allocation = forecast.average_prediction * min_performance
        optimized_allocation = max(optimized_allocation, min_allocation)
        
        # Calculate gains
        efficiency_gain = (1 - (optimized_allocation / current_allocation)) * 100 if current_allocation > 0 else 0
        cost_reduction = (current_allocation - optimized_allocation) * 0.10 * 24 * 30  # Monthly savings
        
        # Performance impact
        if optimized_allocation < forecast.peak_prediction:
            performance_impact = -((forecast.peak_prediction - optimized_allocation) / forecast.peak_prediction) * 100
        else:
            performance_impact = 0
        
        # Implementation steps
        implementation_steps = [
            "Analyze current workload distribution",
            f"Identify resources to {'reduce' if efficiency_gain > 0 else 'increase'}",
            "Update auto-scaling policies",
            "Implement gradual transition over 24 hours",
            "Monitor performance metrics",
            "Validate optimization results"
        ]
        
        # Validation metrics
        validation_metrics = [
            f"Utilization rate < {max_utilization * 100}%",
            f"Response time within SLA",
            f"No increase in error rate",
            f"Cost reduction >= ${cost_reduction:.2f}/month"
        ]
        
        optimization = ResourceOptimization(
            optimization_id=str(uuid.uuid4()),
            resource_type=resource_type,
            current_allocation=current_allocation,
            optimized_allocation=optimized_allocation,
            efficiency_gain=efficiency_gain,
            cost_reduction=cost_reduction,
            performance_impact=performance_impact,
            implementation_steps=implementation_steps,
            rollback_plan="Revert to previous allocation if performance degrades",
            validation_metrics=validation_metrics
        )
        
        return optimization
    
    def _calculate_growth_rate(self, values: List[float]) -> float:
        """Calculate growth rate from time series"""
        if len(values) < 2:
            return 0.0
        
        # Simple linear regression for trend
        X = np.arange(len(values)).reshape(-1, 1)
        y = np.array(values)
        
        model = LinearRegression()
        model.fit(X, y)
        
        # Growth rate as percentage
        start_pred = model.predict([[0]])[0]
        end_pred = model.predict([[len(values) - 1]])[0]
        
        if start_pred > 0:
            growth_rate = ((end_pred - start_pred) / start_pred) * 100
        else:
            growth_rate = 0.0
        
        return growth_rate
    
    def _calculate_exhaustion_probability(self, forecast: np.ndarray,
                                         confidence_intervals: np.ndarray,
                                         capacity: float) -> float:
        """Calculate probability of capacity exhaustion"""
        # Count how many forecast points exceed capacity
        upper_bounds = confidence_intervals[:, 1]
        exhaustion_points = sum(1 for ub in upper_bounds if ub > capacity)
        probability = exhaustion_points / len(upper_bounds)
        return probability
    
    def _get_current_capacity(self, resource_type: ResourceType) -> float:
        """Get current capacity for resource type"""
        # Simplified - would connect to actual infrastructure
        default_capacities = {
            ResourceType.CPU: 100.0,
            ResourceType.MEMORY: 256.0,
            ResourceType.STORAGE: 1000.0,
            ResourceType.NETWORK: 1000.0,
            ResourceType.COMPUTE_UNITS: 50.0,
            ResourceType.DATABASE_CONNECTIONS: 100.0,
            ResourceType.QUEUE_SIZE: 1000.0,
            ResourceType.CACHE_SIZE: 64.0
        }
        return default_capacities.get(resource_type, 100.0)
    
    def _calculate_risk_score(self, exhaustion_prob: float,
                             change_percentage: float,
                             cost_optimization: CostOptimization) -> float:
        """Calculate risk score for scaling recommendation"""
        base_risk = exhaustion_prob * 50  # 0-50 points from exhaustion probability
        
        # Add risk from change magnitude
        change_risk = min(abs(change_percentage) / 2, 30)  # 0-30 points
        
        # Adjust based on cost optimization strategy
        strategy_multiplier = {
            CostOptimization.AGGRESSIVE: 1.5,
            CostOptimization.BALANCED: 1.0,
            CostOptimization.CONSERVATIVE: 0.7,
            CostOptimization.CUSTOM: 1.0
        }
        
        multiplier = strategy_multiplier.get(cost_optimization, 1.0)
        
        risk_score = (base_risk + change_risk) * multiplier
        return min(100, risk_score)  # Cap at 100
    
    def _get_affected_services(self, resource_type: ResourceType) -> List[str]:
        """Get services affected by resource type"""
        service_map = {
            ResourceType.CPU: ['compute', 'api', 'workers'],
            ResourceType.MEMORY: ['cache', 'database', 'api'],
            ResourceType.STORAGE: ['database', 'logs', 'backups'],
            ResourceType.NETWORK: ['loadbalancer', 'api', 'cdn'],
            ResourceType.DATABASE_CONNECTIONS: ['database', 'api', 'analytics'],
            ResourceType.QUEUE_SIZE: ['workers', 'messaging', 'events'],
            ResourceType.CACHE_SIZE: ['cache', 'api', 'web']
        }
        return service_map.get(resource_type, [])
    
    async def generate_capacity_report(self) -> Dict[str, Any]:
        """Generate comprehensive capacity planning report"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'forecasts': {},
            'recommendations': [],
            'optimizations': [],
            'risk_assessment': {},
            'cost_analysis': {}
        }
        
        # Add forecasts
        for resource_type, forecast in self.forecasts.items():
            report['forecasts'][resource_type.value] = {
                'horizon': forecast.horizon.value,
                'peak_prediction': forecast.peak_prediction,
                'average_prediction': forecast.average_prediction,
                'required_capacity': forecast.required_capacity,
                'probability_of_exhaustion': forecast.probability_of_exhaustion,
                'cost_projection': forecast.cost_projection
            }
        
        # Add recommendations
        for rec in self.recommendations:
            report['recommendations'].append({
                'resource': rec.resource_type.value,
                'action': rec.action,
                'change_percentage': rec.change_percentage,
                'risk_score': rec.risk_score,
                'estimated_cost': rec.estimated_cost,
                'estimated_savings': rec.estimated_savings
            })
        
        # Risk assessment
        high_risk_resources = [
            rec.resource_type.value for rec in self.recommendations
            if rec.risk_score > 70
        ]
        report['risk_assessment'] = {
            'high_risk_resources': high_risk_resources,
            'total_risk_score': np.mean([rec.risk_score for rec in self.recommendations]) if self.recommendations else 0
        }
        
        # Cost analysis
        total_current_cost = sum(
            self._get_current_capacity(rt) * 0.10 * 24 * 30
            for rt in ResourceType
        )
        total_projected_cost = sum(
            forecast.cost_projection for forecast in self.forecasts.values()
        )
        
        report['cost_analysis'] = {
            'current_monthly_cost': total_current_cost,
            'projected_monthly_cost': total_projected_cost,
            'potential_savings': max(0, total_current_cost - total_projected_cost),
            'potential_increase': max(0, total_projected_cost - total_current_cost)
        }
        
        return report

# Example usage
async def main():
    planner = CapacityPlanner()
    
    # Generate sample metrics
    metrics = []
    base_usage = 50.0
    
    for i in range(168):  # One week of hourly data
        timestamp = datetime.now() - timedelta(hours=168-i)
        
        # Simulate daily pattern
        hour_of_day = timestamp.hour
        daily_factor = 1.5 if 9 <= hour_of_day <= 17 else 0.7  # Business hours
        
        # Add some randomness
        noise = np.random.normal(0, 5)
        
        usage = base_usage * daily_factor + noise + (i * 0.1)  # Slight growth
        
        metric = ResourceMetrics(
            timestamp=timestamp,
            resource_type=ResourceType.CPU,
            current_usage=usage,
            peak_usage=usage * 1.2,
            average_usage=usage,
            percentile_95=usage * 1.1,
            percentile_99=usage * 1.15,
            total_capacity=100.0,
            available_capacity=100.0 - usage,
            utilization_rate=usage / 100.0,
            growth_rate=0.1,
            cost_per_unit=0.10
        )
        metrics.append(metric)
    
    # Analyze resource
    analysis = await planner.analyze_resource(metrics)
    print(f"Resource Analysis: {json.dumps(analysis, indent=2)}")
    
    # Generate forecast
    forecast = await planner.generate_forecast(ResourceType.CPU, PlanningHorizon.SHORT_TERM)
    print(f"\nForecast Summary:")
    print(f"  Peak: {forecast.peak_prediction:.2f}")
    print(f"  Average: {forecast.average_prediction:.2f}")
    print(f"  Required Capacity: {forecast.required_capacity:.2f}")
    print(f"  Exhaustion Probability: {forecast.probability_of_exhaustion:.2%}")
    
    # Generate scaling recommendation
    recommendation = await planner.generate_scaling_recommendation(
        ResourceType.CPU,
        forecast,
        CostOptimization.BALANCED
    )
    print(f"\nScaling Recommendation:")
    print(f"  Action: {recommendation.action}")
    print(f"  Target Capacity: {recommendation.target_capacity:.2f}")
    print(f"  Risk Score: {recommendation.risk_score:.1f}")
    
    # Optimize resources
    optimization = await planner.optimize_resources(
        ResourceType.CPU,
        {'max_budget': 1000, 'max_utilization': 0.80}
    )
    print(f"\nResource Optimization:")
    print(f"  Optimized Allocation: {optimization.optimized_allocation:.2f}")
    print(f"  Efficiency Gain: {optimization.efficiency_gain:.1f}%")
    print(f"  Cost Reduction: ${optimization.cost_reduction:.2f}/month")
    
    # Generate report
    report = await planner.generate_capacity_report()
    print(f"\nCapacity Planning Report: {json.dumps(report, indent=2, default=str)}")

if __name__ == "__main__":
    asyncio.run(main())