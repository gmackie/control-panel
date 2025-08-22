#!/usr/bin/env python3
"""
Intelligent Log Analysis and Insights System
Uses NLP and ML to automatically analyze logs, extract patterns, and generate actionable insights
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json
import os
import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from collections import Counter, defaultdict
import joblib
import warnings
warnings.filterwarnings('ignore')

@dataclass
class LogEntry:
    """Data class for log entries"""
    timestamp: datetime
    level: str  # DEBUG, INFO, WARN, ERROR, FATAL
    message: str
    source: str  # service/component name
    metadata: Dict[str, Any]
    raw_log: str
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data

@dataclass
class LogPattern:
    """Data class for detected log patterns"""
    pattern_id: str
    pattern_type: str  # error_spike, anomaly, trend, correlation
    frequency: int
    confidence: float
    description: str
    affected_services: List[str]
    severity: str
    time_window: str
    sample_logs: List[str]
    business_impact: str
    recommended_action: str

@dataclass
class LogInsight:
    """Data class for generated insights"""
    insight_id: str
    category: str  # performance, error, security, business
    title: str
    description: str
    evidence: List[Dict]
    confidence: float
    priority: str  # low, medium, high, critical
    affected_components: List[str]
    time_range: Tuple[datetime, datetime]
    recommendations: List[str]
    related_patterns: List[str]

class IntelligentLogAnalyzer:
    """Advanced log analysis system with NLP and ML capabilities"""
    
    def __init__(self, log_sources: List[str] = None):
        self.log_sources = log_sources or [
            "/var/log/control-panel/app.log",
            "/var/log/control-panel/error.log",
            "/var/log/control-panel/access.log",
            "/var/log/nginx/access.log",
            "/var/log/nginx/error.log",
            "/var/log/postgresql/postgresql.log"
        ]
        
        self.model_path = "/models/log_analysis"
        self.models = {}
        self.vectorizers = {}
        self.log_history = []
        self.patterns = []
        self.insights = []
        
        # Analysis parameters
        self.max_log_retention = timedelta(days=7)
        self.pattern_detection_window = timedelta(hours=24)
        self.min_pattern_frequency = 5
        
        # Create model directory
        os.makedirs(self.model_path, exist_ok=True)
        
        # Initialize NLP components
        self._initialize_nlp_components()
        
        # Load existing models
        self._load_models()
    
    def collect_logs(self, hours_back: int = 1) -> List[LogEntry]:
        """Collect logs from various sources"""
        cutoff_time = datetime.now() - timedelta(hours=hours_back)
        collected_logs = []
        
        # Simulate log collection (in real implementation, read from actual log files)
        simulated_logs = self._simulate_log_data(hours_back)
        
        for log_data in simulated_logs:
            log_entry = self._parse_log_entry(log_data)
            if log_entry and log_entry.timestamp >= cutoff_time:
                collected_logs.append(log_entry)
        
        # Add to history
        self.log_history.extend(collected_logs)
        
        # Cleanup old logs
        retention_cutoff = datetime.now() - self.max_log_retention
        self.log_history = [
            log for log in self.log_history 
            if log.timestamp > retention_cutoff
        ]
        
        return collected_logs
    
    def analyze_logs(self, logs: List[LogEntry] = None) -> Dict[str, Any]:
        """Perform comprehensive log analysis"""
        if logs is None:
            logs = self.log_history
        
        if not logs:
            return {"message": "No logs to analyze"}
        
        analysis_results = {
            "log_volume_analysis": self._analyze_log_volume(logs),
            "error_analysis": self._analyze_errors(logs),
            "performance_analysis": self._analyze_performance(logs),
            "security_analysis": self._analyze_security(logs),
            "patterns": self.detect_log_patterns(logs),
            "insights": self.generate_insights(logs),
            "anomalies": self.detect_log_anomalies(logs),
            "correlations": self._analyze_correlations(logs)
        }
        
        return analysis_results
    
    def detect_log_patterns(self, logs: List[LogEntry]) -> List[LogPattern]:
        """Detect patterns in log data using ML and statistical methods"""
        patterns = []
        
        if len(logs) < self.min_pattern_frequency:
            return patterns
        
        # Create feature matrix for pattern detection
        features_df = self._extract_log_features(logs)
        
        # Detect error patterns
        patterns.extend(self._detect_error_patterns(logs))
        
        # Detect temporal patterns
        patterns.extend(self._detect_temporal_patterns(logs))
        
        # Detect text clustering patterns
        patterns.extend(self._detect_text_patterns(logs))
        
        # Detect frequency anomalies
        patterns.extend(self._detect_frequency_patterns(logs))
        
        # Store detected patterns
        self.patterns.extend(patterns)
        
        return patterns
    
    def generate_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate actionable insights from log analysis"""
        insights = []
        
        # Performance insights
        insights.extend(self._generate_performance_insights(logs))
        
        # Error insights
        insights.extend(self._generate_error_insights(logs))
        
        # Security insights
        insights.extend(self._generate_security_insights(logs))
        
        # Business insights
        insights.extend(self._generate_business_insights(logs))
        
        # Capacity insights
        insights.extend(self._generate_capacity_insights(logs))
        
        # Store insights
        self.insights.extend(insights)
        
        return insights
    
    def detect_log_anomalies(self, logs: List[LogEntry]) -> List[Dict]:
        """Detect anomalies in log patterns and content"""
        anomalies = []
        
        if len(logs) < 10:
            return anomalies
        
        # Prepare data for anomaly detection
        features_df = self._extract_log_features(logs)
        numeric_features = features_df.select_dtypes(include=[np.number])
        
        if len(numeric_features.columns) > 0:
            # Use Isolation Forest for anomaly detection
            iso_forest = IsolationForest(contamination=0.1, random_state=42)
            anomaly_predictions = iso_forest.fit_predict(numeric_features.values)
            
            # Identify anomalous logs
            for i, prediction in enumerate(anomaly_predictions):
                if prediction == -1:  # Anomaly
                    log_entry = logs[i]
                    anomalies.append({
                        "timestamp": log_entry.timestamp.isoformat(),
                        "type": "statistical_anomaly",
                        "message": log_entry.message,
                        "source": log_entry.source,
                        "level": log_entry.level,
                        "description": "Statistical anomaly detected in log patterns",
                        "confidence": 0.8
                    })
        
        # Text-based anomaly detection
        text_anomalies = self._detect_text_anomalies(logs)
        anomalies.extend(text_anomalies)
        
        return anomalies
    
    def _parse_log_entry(self, log_data: Dict) -> Optional[LogEntry]:
        """Parse raw log data into LogEntry object"""
        try:
            # Extract timestamp
            timestamp_str = log_data.get('timestamp', datetime.now().isoformat())
            if isinstance(timestamp_str, str):
                # Try different timestamp formats
                for fmt in ['%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S']:
                    try:
                        timestamp = datetime.strptime(timestamp_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    timestamp = datetime.now()
            else:
                timestamp = timestamp_str
            
            # Extract log level
            level = log_data.get('level', 'INFO').upper()
            if level not in ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']:
                level = 'INFO'
            
            # Extract message and source
            message = log_data.get('message', '')
            source = log_data.get('source', 'unknown')
            raw_log = log_data.get('raw', f"{timestamp} [{level}] {source}: {message}")
            
            # Extract metadata
            metadata = {k: v for k, v in log_data.items() 
                       if k not in ['timestamp', 'level', 'message', 'source', 'raw']}
            
            return LogEntry(
                timestamp=timestamp,
                level=level,
                message=message,
                source=source,
                metadata=metadata,
                raw_log=raw_log
            )
            
        except Exception as e:
            print(f"Error parsing log entry: {e}")
            return None
    
    def _extract_log_features(self, logs: List[LogEntry]) -> pd.DataFrame:
        """Extract features from logs for ML analysis"""
        features = []
        
        for log in logs:
            feature_dict = {
                'timestamp': log.timestamp.timestamp(),
                'hour': log.timestamp.hour,
                'day_of_week': log.timestamp.weekday(),
                'is_weekend': log.timestamp.weekday() >= 5,
                'message_length': len(log.message),
                'source': log.source,
                'level': log.level,
                'level_numeric': self._level_to_numeric(log.level),
                'has_error_keywords': self._has_error_keywords(log.message),
                'has_performance_keywords': self._has_performance_keywords(log.message),
                'has_security_keywords': self._has_security_keywords(log.message),
                'word_count': len(log.message.split()),
                'contains_numbers': bool(re.search(r'\d+', log.message)),
                'contains_ip': bool(re.search(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', log.message)),
                'contains_url': bool(re.search(r'http[s]?://|www\.', log.message)),
                'contains_exception': bool(re.search(r'exception|error|traceback', log.message.lower())),
            }
            
            # Add metadata features
            for key, value in log.metadata.items():
                if isinstance(value, (int, float)):
                    feature_dict[f'meta_{key}'] = value
                elif isinstance(value, str):
                    feature_dict[f'meta_{key}_length'] = len(value)
            
            features.append(feature_dict)
        
        return pd.DataFrame(features)
    
    def _detect_error_patterns(self, logs: List[LogEntry]) -> List[LogPattern]:
        """Detect error patterns and spikes"""
        patterns = []
        
        # Filter error logs
        error_logs = [log for log in logs if log.level in ['ERROR', 'FATAL']]
        
        if len(error_logs) < 3:
            return patterns
        
        # Group errors by hour
        hourly_errors = defaultdict(list)
        for log in error_logs:
            hour_key = log.timestamp.replace(minute=0, second=0, microsecond=0)
            hourly_errors[hour_key].append(log)
        
        # Detect error spikes
        error_counts = [len(errors) for errors in hourly_errors.values()]
        if error_counts:
            avg_errors = np.mean(error_counts)
            std_errors = np.std(error_counts)
            
            for hour, errors in hourly_errors.items():
                if len(errors) > avg_errors + 2 * std_errors and len(errors) >= 5:
                    # Error spike detected
                    affected_services = list(set(log.source for log in errors))
                    sample_messages = [log.message for log in errors[:3]]
                    
                    patterns.append(LogPattern(
                        pattern_id=f"error_spike_{hour.timestamp()}",
                        pattern_type="error_spike",
                        frequency=len(errors),
                        confidence=0.9,
                        description=f"Error spike detected at {hour.strftime('%Y-%m-%d %H:%M')} with {len(errors)} errors",
                        affected_services=affected_services,
                        severity="high",
                        time_window=f"{hour.strftime('%H:%M')}-{(hour + timedelta(hours=1)).strftime('%H:%M')}",
                        sample_logs=sample_messages,
                        business_impact="Potential service degradation or outage",
                        recommended_action="Investigate root cause and implement fixes"
                    ))
        
        # Detect recurring error patterns
        error_messages = [log.message for log in error_logs]
        message_counts = Counter(error_messages)
        
        for message, count in message_counts.items():
            if count >= 5:  # Recurring error
                patterns.append(LogPattern(
                    pattern_id=f"recurring_error_{hash(message)}",
                    pattern_type="recurring_error",
                    frequency=count,
                    confidence=0.8,
                    description=f"Recurring error pattern: {message[:100]}...",
                    affected_services=list(set(log.source for log in error_logs if log.message == message)),
                    severity="medium",
                    time_window="various",
                    sample_logs=[message],
                    business_impact="System reliability concern",
                    recommended_action="Fix underlying issue causing recurring errors"
                ))
        
        return patterns
    
    def _detect_temporal_patterns(self, logs: List[LogEntry]) -> List[LogPattern]:
        """Detect temporal patterns in logs"""
        patterns = []
        
        # Analyze hourly distribution
        hourly_counts = defaultdict(int)
        for log in logs:
            hourly_counts[log.timestamp.hour] += 1
        
        # Find peak hours
        if hourly_counts:
            avg_count = np.mean(list(hourly_counts.values()))
            std_count = np.std(list(hourly_counts.values()))
            
            peak_hours = []
            for hour, count in hourly_counts.items():
                if count > avg_count + std_count:
                    peak_hours.append(hour)
            
            if peak_hours:
                patterns.append(LogPattern(
                    pattern_id="temporal_peak_hours",
                    pattern_type="temporal_pattern",
                    frequency=sum(hourly_counts[hour] for hour in peak_hours),
                    confidence=0.7,
                    description=f"Peak log activity during hours: {sorted(peak_hours)}",
                    affected_services=list(set(log.source for log in logs)),
                    severity="low",
                    time_window=f"Hours {min(peak_hours)}-{max(peak_hours)}",
                    sample_logs=[],
                    business_impact="Normal traffic pattern or potential performance bottleneck",
                    recommended_action="Monitor for capacity planning"
                ))
        
        return patterns
    
    def _detect_text_patterns(self, logs: List[LogEntry]) -> List[LogPattern]:
        """Detect patterns in log text using NLP"""
        patterns = []
        
        if len(logs) < 10:
            return patterns
        
        # Extract text messages
        messages = [log.message for log in logs]
        
        try:
            # Use TF-IDF for text clustering
            vectorizer = TfidfVectorizer(max_features=1000, stop_words='english', max_df=0.9, min_df=2)
            text_vectors = vectorizer.fit_transform(messages)
            
            # Apply clustering
            n_clusters = min(5, len(logs) // 10)
            if n_clusters >= 2:
                kmeans = KMeans(n_clusters=n_clusters, random_state=42)
                cluster_labels = kmeans.fit_predict(text_vectors)
                
                # Analyze clusters
                for cluster_id in set(cluster_labels):
                    cluster_messages = [messages[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
                    cluster_logs = [logs[i] for i, label in enumerate(cluster_labels) if label == cluster_id]
                    
                    if len(cluster_messages) >= 3:
                        # Get representative terms for this cluster
                        cluster_vectorizer = TfidfVectorizer(max_features=10, stop_words='english')
                        cluster_vectors = cluster_vectorizer.fit_transform(cluster_messages)
                        feature_names = cluster_vectorizer.get_feature_names_out()
                        
                        # Get top terms
                        mean_scores = np.mean(cluster_vectors.toarray(), axis=0)
                        top_terms = [feature_names[i] for i in np.argsort(mean_scores)[-5:]]
                        
                        patterns.append(LogPattern(
                            pattern_id=f"text_cluster_{cluster_id}",
                            pattern_type="text_pattern",
                            frequency=len(cluster_messages),
                            confidence=0.6,
                            description=f"Text pattern cluster with terms: {', '.join(top_terms)}",
                            affected_services=list(set(log.source for log in cluster_logs)),
                            severity="low",
                            time_window="various",
                            sample_logs=cluster_messages[:3],
                            business_impact="Potential recurring issue or workflow pattern",
                            recommended_action="Analyze pattern for optimization opportunities"
                        ))
            
        except Exception as e:
            print(f"Error in text pattern detection: {e}")
        
        return patterns
    
    def _detect_frequency_patterns(self, logs: List[LogEntry]) -> List[LogPattern]:
        """Detect unusual frequency patterns"""
        patterns = []
        
        # Group logs by 10-minute intervals
        interval_logs = defaultdict(list)
        for log in logs:
            interval_key = log.timestamp.replace(minute=(log.timestamp.minute // 10) * 10, second=0, microsecond=0)
            interval_logs[interval_key].append(log)
        
        # Analyze frequency distribution
        frequencies = [len(logs_in_interval) for logs_in_interval in interval_logs.values()]
        
        if frequencies:
            mean_freq = np.mean(frequencies)
            std_freq = np.std(frequencies)
            
            # Detect unusual frequency intervals
            for interval, logs_in_interval in interval_logs.items():
                freq = len(logs_in_interval)
                
                if freq > mean_freq + 2 * std_freq and freq >= 10:
                    # High frequency detected
                    patterns.append(LogPattern(
                        pattern_id=f"high_frequency_{interval.timestamp()}",
                        pattern_type="frequency_anomaly",
                        frequency=freq,
                        confidence=0.8,
                        description=f"High log frequency ({freq} logs) in 10-minute window starting {interval.strftime('%H:%M')}",
                        affected_services=list(set(log.source for log in logs_in_interval)),
                        severity="medium",
                        time_window=f"{interval.strftime('%H:%M')}-{(interval + timedelta(minutes=10)).strftime('%H:%M')}",
                        sample_logs=[log.message for log in logs_in_interval[:3]],
                        business_impact="Potential system stress or unusual activity",
                        recommended_action="Investigate cause of increased activity"
                    ))
        
        return patterns
    
    def _detect_text_anomalies(self, logs: List[LogEntry]) -> List[Dict]:
        """Detect anomalies in log text content"""
        anomalies = []
        
        # Look for unusual patterns in text
        for log in logs:
            anomaly_score = 0
            reasons = []
            
            # Check for very long messages
            if len(log.message) > 1000:
                anomaly_score += 0.3
                reasons.append("unusually long message")
            
            # Check for excessive special characters
            special_char_ratio = len(re.findall(r'[^a-zA-Z0-9\s]', log.message)) / max(len(log.message), 1)
            if special_char_ratio > 0.3:
                anomaly_score += 0.4
                reasons.append("high special character density")
            
            # Check for potential injection patterns
            injection_patterns = [
                r'<script|javascript:|onload=',
                r'union\s+select|drop\s+table',
                r'\.\./|\.\.\\'
            ]
            
            for pattern in injection_patterns:
                if re.search(pattern, log.message, re.IGNORECASE):
                    anomaly_score += 0.6
                    reasons.append("potential injection pattern")
                    break
            
            # Check for encoded content
            if re.search(r'%[0-9a-fA-F]{2}|&#x?[0-9a-fA-F]+;', log.message):
                anomaly_score += 0.2
                reasons.append("encoded content detected")
            
            if anomaly_score > 0.5:
                anomalies.append({
                    "timestamp": log.timestamp.isoformat(),
                    "type": "text_anomaly",
                    "message": log.message,
                    "source": log.source,
                    "level": log.level,
                    "description": f"Text anomaly: {', '.join(reasons)}",
                    "confidence": min(anomaly_score, 1.0)
                })
        
        return anomalies
    
    def _analyze_log_volume(self, logs: List[LogEntry]) -> Dict:
        """Analyze log volume patterns"""
        if not logs:
            return {"total_logs": 0}
        
        # Calculate volume statistics
        total_logs = len(logs)
        time_span = (max(log.timestamp for log in logs) - min(log.timestamp for log in logs)).total_seconds() / 3600
        avg_logs_per_hour = total_logs / max(time_span, 1)
        
        # Analyze by log level
        level_counts = Counter(log.level for log in logs)
        
        # Analyze by source
        source_counts = Counter(log.source for log in logs)
        
        return {
            "total_logs": total_logs,
            "time_span_hours": round(time_span, 2),
            "avg_logs_per_hour": round(avg_logs_per_hour, 2),
            "level_distribution": dict(level_counts),
            "top_sources": dict(source_counts.most_common(5))
        }
    
    def _analyze_errors(self, logs: List[LogEntry]) -> Dict:
        """Analyze error patterns in logs"""
        error_logs = [log for log in logs if log.level in ['ERROR', 'FATAL']]
        
        if not error_logs:
            return {"error_count": 0, "error_rate": 0}
        
        # Calculate error rate
        total_logs = len(logs)
        error_rate = len(error_logs) / total_logs
        
        # Find most common errors
        error_messages = [log.message for log in error_logs]
        common_errors = Counter(error_messages).most_common(5)
        
        # Analyze error sources
        error_sources = Counter(log.source for log in error_logs)
        
        return {
            "error_count": len(error_logs),
            "error_rate": round(error_rate, 4),
            "most_common_errors": [{"message": msg[:100], "count": count} for msg, count in common_errors],
            "error_sources": dict(error_sources)
        }
    
    def _analyze_performance(self, logs: List[LogEntry]) -> Dict:
        """Analyze performance-related log entries"""
        perf_keywords = ['slow', 'timeout', 'performance', 'latency', 'response time', 'query time']
        perf_logs = [log for log in logs if any(keyword in log.message.lower() for keyword in perf_keywords)]
        
        performance_issues = []
        for log in perf_logs:
            # Extract numeric values that might represent performance metrics
            numbers = re.findall(r'\d+\.?\d*', log.message)
            performance_issues.append({
                "timestamp": log.timestamp.isoformat(),
                "source": log.source,
                "message": log.message[:200],
                "extracted_values": numbers
            })
        
        return {
            "performance_related_logs": len(perf_logs),
            "issues": performance_issues[:10]  # Top 10 performance issues
        }
    
    def _analyze_security(self, logs: List[LogEntry]) -> Dict:
        """Analyze security-related log entries"""
        security_keywords = ['login', 'authentication', 'unauthorized', 'forbidden', 'attack', 'security', 'breach']
        security_logs = [log for log in logs if any(keyword in log.message.lower() for keyword in security_keywords)]
        
        # Look for failed login attempts
        failed_logins = [log for log in security_logs if 'fail' in log.message.lower() and 'login' in log.message.lower()]
        
        # Look for potential attacks
        attack_patterns = [
            'sql injection',
            'xss',
            'brute force',
            'ddos',
            'suspicious'
        ]
        
        potential_attacks = []
        for log in security_logs:
            for pattern in attack_patterns:
                if pattern in log.message.lower():
                    potential_attacks.append({
                        "timestamp": log.timestamp.isoformat(),
                        "source": log.source,
                        "pattern": pattern,
                        "message": log.message[:200]
                    })
        
        return {
            "security_related_logs": len(security_logs),
            "failed_login_attempts": len(failed_logins),
            "potential_attacks": potential_attacks
        }
    
    def _analyze_correlations(self, logs: List[LogEntry]) -> Dict:
        """Analyze correlations between different log events"""
        correlations = []
        
        # Group logs by time windows (5-minute intervals)
        time_windows = defaultdict(list)
        for log in logs:
            window_key = log.timestamp.replace(minute=(log.timestamp.minute // 5) * 5, second=0, microsecond=0)
            time_windows[window_key].append(log)
        
        # Look for correlations between error types and sources
        for window, window_logs in time_windows.items():
            if len(window_logs) > 3:
                sources = [log.source for log in window_logs]
                levels = [log.level for log in window_logs]
                
                # Check if multiple services have errors in the same window
                error_sources = [log.source for log in window_logs if log.level in ['ERROR', 'FATAL']]
                if len(set(error_sources)) > 1:
                    correlations.append({
                        "window": window.isoformat(),
                        "type": "cross_service_errors",
                        "description": f"Multiple services had errors: {list(set(error_sources))}",
                        "confidence": 0.7
                    })
        
        return {
            "correlations_found": len(correlations),
            "correlations": correlations[:5]  # Top 5 correlations
        }
    
    def _generate_performance_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate performance-related insights"""
        insights = []
        
        # Look for slow queries or operations
        slow_operations = []
        for log in logs:
            # Extract timing information from logs
            time_matches = re.findall(r'(\d+\.?\d*)\s*(ms|seconds?|sec)', log.message.lower())
            for time_val, unit in time_matches:
                time_ms = float(time_val)
                if unit in ['seconds', 'sec']:
                    time_ms *= 1000
                
                if time_ms > 5000:  # Operations taking more than 5 seconds
                    slow_operations.append({
                        "timestamp": log.timestamp,
                        "source": log.source,
                        "duration_ms": time_ms,
                        "message": log.message
                    })
        
        if slow_operations:
            insights.append(LogInsight(
                insight_id=f"slow_operations_{datetime.now().timestamp()}",
                category="performance",
                title="Slow Operations Detected",
                description=f"Found {len(slow_operations)} operations taking longer than 5 seconds",
                evidence=[{"type": "slow_operation", "data": op} for op in slow_operations[:5]],
                confidence=0.8,
                priority="high" if len(slow_operations) > 10 else "medium",
                affected_components=list(set(op["source"] for op in slow_operations)),
                time_range=(min(op["timestamp"] for op in slow_operations), 
                           max(op["timestamp"] for op in slow_operations)),
                recommendations=[
                    "Investigate database query performance",
                    "Check for resource constraints",
                    "Consider implementing caching",
                    "Review application logic for optimization opportunities"
                ],
                related_patterns=[]
            ))
        
        return insights
    
    def _generate_error_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate error-related insights"""
        insights = []
        
        error_logs = [log for log in logs if log.level in ['ERROR', 'FATAL']]
        
        if error_logs:
            # Analyze error trends
            error_trend = "increasing" if len(error_logs) > 10 else "stable"
            
            # Find most problematic service
            error_sources = Counter(log.source for log in error_logs)
            most_problematic = error_sources.most_common(1)[0] if error_sources else None
            
            insights.append(LogInsight(
                insight_id=f"error_analysis_{datetime.now().timestamp()}",
                category="error",
                title="Error Analysis Summary",
                description=f"Detected {len(error_logs)} errors with {error_trend} trend",
                evidence=[
                    {"type": "error_count", "data": len(error_logs)},
                    {"type": "error_sources", "data": dict(error_sources.most_common(3))}
                ],
                confidence=0.9,
                priority="high" if len(error_logs) > 20 else "medium",
                affected_components=list(error_sources.keys()),
                time_range=(min(log.timestamp for log in error_logs),
                           max(log.timestamp for log in error_logs)),
                recommendations=[
                    f"Focus on {most_problematic[0]} service which has {most_problematic[1]} errors" if most_problematic else "Review error patterns",
                    "Implement better error handling",
                    "Set up monitoring for error thresholds",
                    "Review recent deployments for correlation"
                ],
                related_patterns=[]
            ))
        
        return insights
    
    def _generate_security_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate security-related insights"""
        insights = []
        
        # Look for authentication failures
        auth_failures = [log for log in logs if 'authentication' in log.message.lower() and 'fail' in log.message.lower()]
        
        if len(auth_failures) > 5:
            insights.append(LogInsight(
                insight_id=f"auth_failures_{datetime.now().timestamp()}",
                category="security",
                title="Multiple Authentication Failures",
                description=f"Detected {len(auth_failures)} authentication failures",
                evidence=[{"type": "auth_failure", "data": {"count": len(auth_failures)}}],
                confidence=0.8,
                priority="high",
                affected_components=list(set(log.source for log in auth_failures)),
                time_range=(min(log.timestamp for log in auth_failures),
                           max(log.timestamp for log in auth_failures)),
                recommendations=[
                    "Review user access patterns",
                    "Check for brute force attacks",
                    "Implement account lockout policies",
                    "Monitor for suspicious IP addresses"
                ],
                related_patterns=[]
            ))
        
        return insights
    
    def _generate_business_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate business-related insights"""
        insights = []
        
        # Look for user activity patterns
        user_activity_logs = [log for log in logs if any(keyword in log.message.lower() 
                                                       for keyword in ['user', 'session', 'login', 'request'])]
        
        if user_activity_logs:
            # Analyze peak activity times
            hourly_activity = defaultdict(int)
            for log in user_activity_logs:
                hourly_activity[log.timestamp.hour] += 1
            
            if hourly_activity:
                peak_hour = max(hourly_activity.keys(), key=lambda x: hourly_activity[x])
                
                insights.append(LogInsight(
                    insight_id=f"user_activity_{datetime.now().timestamp()}",
                    category="business",
                    title="User Activity Pattern Analysis",
                    description=f"Peak user activity at hour {peak_hour} with {hourly_activity[peak_hour]} events",
                    evidence=[{"type": "activity_pattern", "data": dict(hourly_activity)}],
                    confidence=0.7,
                    priority="low",
                    affected_components=list(set(log.source for log in user_activity_logs)),
                    time_range=(min(log.timestamp for log in user_activity_logs),
                               max(log.timestamp for log in user_activity_logs)),
                    recommendations=[
                        "Plan capacity for peak hours",
                        "Consider scaling strategies",
                        "Optimize user experience during peak times"
                    ],
                    related_patterns=[]
                ))
        
        return insights
    
    def _generate_capacity_insights(self, logs: List[LogEntry]) -> List[LogInsight]:
        """Generate capacity-related insights"""
        insights = []
        
        # Look for capacity-related warnings
        capacity_keywords = ['memory', 'disk', 'cpu', 'connection', 'limit', 'capacity', 'queue']
        capacity_logs = [log for log in logs if any(keyword in log.message.lower() for keyword in capacity_keywords)]
        
        if len(capacity_logs) > 10:
            insights.append(LogInsight(
                insight_id=f"capacity_concerns_{datetime.now().timestamp()}",
                category="capacity",
                title="Capacity-Related Log Activity",
                description=f"Found {len(capacity_logs)} logs mentioning capacity-related terms",
                evidence=[{"type": "capacity_mentions", "data": {"count": len(capacity_logs)}}],
                confidence=0.6,
                priority="medium",
                affected_components=list(set(log.source for log in capacity_logs)),
                time_range=(min(log.timestamp for log in capacity_logs),
                           max(log.timestamp for log in capacity_logs)),
                recommendations=[
                    "Monitor resource utilization",
                    "Plan for capacity expansion",
                    "Review resource allocation",
                    "Implement auto-scaling if applicable"
                ],
                related_patterns=[]
            ))
        
        return insights
    
    def _simulate_log_data(self, hours_back: int) -> List[Dict]:
        """Simulate realistic log data for testing"""
        simulated_logs = []
        
        # Define log templates
        log_templates = [
            {"level": "INFO", "source": "control-panel", "message": "User login successful for user {user_id}"},
            {"level": "INFO", "source": "control-panel", "message": "Request processed successfully: GET /api/metrics"},
            {"level": "INFO", "source": "control-panel", "message": "Database connection established"},
            {"level": "WARN", "source": "control-panel", "message": "Slow query detected: {query_time}ms"},
            {"level": "ERROR", "source": "control-panel", "message": "Failed to connect to database: connection timeout"},
            {"level": "ERROR", "source": "nginx", "message": "502 Bad Gateway: upstream server not responding"},
            {"level": "INFO", "source": "nginx", "message": "Request: GET /health - 200 OK - {response_time}ms"},
            {"level": "ERROR", "source": "postgresql", "message": "ERROR: deadlock detected"},
            {"level": "WARN", "source": "postgresql", "message": "WARNING: could not resolve hostname"},
            {"level": "INFO", "source": "auth-service", "message": "Token validation successful"},
            {"level": "ERROR", "source": "auth-service", "message": "Authentication failed: invalid credentials"},
            {"level": "FATAL", "source": "control-panel", "message": "Out of memory error - application crashed"},
        ]
        
        # Generate logs for the specified time period
        start_time = datetime.now() - timedelta(hours=hours_back)
        
        # Generate more logs during business hours
        for i in range(hours_back * 60):  # One log per minute on average
            timestamp = start_time + timedelta(minutes=i)
            
            # Increase log frequency during business hours
            if 9 <= timestamp.hour <= 17:
                log_count = np.random.poisson(2)  # 2 logs per minute on average
            else:
                log_count = np.random.poisson(0.5)  # 0.5 logs per minute on average
            
            for _ in range(log_count):
                template = np.random.choice(log_templates)
                
                # Add some randomness and inject variables
                message = template["message"]
                if "{user_id}" in message:
                    message = message.replace("{user_id}", f"user_{np.random.randint(1, 1000)}")
                if "{query_time}" in message:
                    query_time = np.random.lognormal(3, 1) * 100  # Log-normal distribution for query times
                    message = message.replace("{query_time}", f"{query_time:.0f}")
                if "{response_time}" in message:
                    response_time = np.random.lognormal(2, 0.5) * 10
                    message = message.replace("{response_time}", f"{response_time:.0f}")
                
                # Occasionally inject anomalies
                if np.random.random() < 0.02:  # 2% chance of anomaly
                    message = "ANOMALY: " + message + " with unusual parameters"
                
                simulated_logs.append({
                    "timestamp": timestamp + timedelta(seconds=np.random.randint(0, 60)),
                    "level": template["level"],
                    "source": template["source"],
                    "message": message,
                    "raw": f"{timestamp.isoformat()} [{template['level']}] {template['source']}: {message}"
                })
        
        return simulated_logs
    
    def _initialize_nlp_components(self):
        """Initialize NLP components for text analysis"""
        self.vectorizers['tfidf'] = TfidfVectorizer(max_features=1000, stop_words='english')
        self.vectorizers['count'] = CountVectorizer(max_features=500, stop_words='english')
    
    def _level_to_numeric(self, level: str) -> int:
        """Convert log level to numeric value"""
        level_map = {'DEBUG': 1, 'INFO': 2, 'WARN': 3, 'ERROR': 4, 'FATAL': 5}
        return level_map.get(level, 2)
    
    def _has_error_keywords(self, message: str) -> bool:
        """Check if message contains error keywords"""
        error_keywords = ['error', 'exception', 'fail', 'crash', 'timeout', 'unable']
        return any(keyword in message.lower() for keyword in error_keywords)
    
    def _has_performance_keywords(self, message: str) -> bool:
        """Check if message contains performance keywords"""
        perf_keywords = ['slow', 'latency', 'performance', 'timeout', 'delay', 'response time']
        return any(keyword in message.lower() for keyword in perf_keywords)
    
    def _has_security_keywords(self, message: str) -> bool:
        """Check if message contains security keywords"""
        security_keywords = ['auth', 'login', 'security', 'unauthorized', 'forbidden', 'attack']
        return any(keyword in message.lower() for keyword in security_keywords)
    
    def _save_models(self):
        """Save trained models and patterns"""
        models_file = f"{self.model_path}/log_analysis_models.pkl"
        patterns_file = f"{self.model_path}/log_patterns.json"
        
        with open(models_file, 'wb') as f:
            joblib.dump({
                'models': self.models,
                'vectorizers': self.vectorizers
            }, f)
        
        # Save patterns as JSON
        patterns_data = [
            {
                'pattern_id': p.pattern_id,
                'pattern_type': p.pattern_type,
                'description': p.description,
                'frequency': p.frequency,
                'confidence': p.confidence
            } for p in self.patterns
        ]
        
        with open(patterns_file, 'w') as f:
            json.dump(patterns_data, f, indent=2)
    
    def _load_models(self):
        """Load saved models and patterns"""
        try:
            models_file = f"{self.model_path}/log_analysis_models.pkl"
            if os.path.exists(models_file):
                data = joblib.load(models_file)
                self.models = data.get('models', {})
                self.vectorizers.update(data.get('vectorizers', {}))
            
            print("Loaded log analysis models")
            
        except Exception as e:
            print(f"Could not load existing models: {e}")
    
    def get_log_summary(self) -> Dict:
        """Get comprehensive log analysis summary"""
        recent_logs = [log for log in self.log_history if log.timestamp > datetime.now() - timedelta(hours=1)]
        
        return {
            "log_retention_hours": int(self.max_log_retention.total_seconds() / 3600),
            "total_logs_in_history": len(self.log_history),
            "recent_logs_1h": len(recent_logs),
            "patterns_detected": len(self.patterns),
            "insights_generated": len(self.insights),
            "log_sources": list(set(log.source for log in self.log_history)),
            "recent_analysis": self.analyze_logs(recent_logs) if recent_logs else "No recent logs"
        }


def main():
    """Main execution function for testing"""
    print("🤖 Starting Intelligent Log Analysis System...")
    
    # Initialize the analyzer
    analyzer = IntelligentLogAnalyzer()
    
    # Collect recent logs
    print("📊 Collecting logs...")
    recent_logs = analyzer.collect_logs(hours_back=2)
    print(f"Collected {len(recent_logs)} log entries")
    
    # Perform comprehensive analysis
    print("\n🔍 Analyzing logs...")
    analysis_results = analyzer.analyze_logs(recent_logs)
    
    # Display volume analysis
    print(f"\n📈 Log Volume Analysis:")
    volume_analysis = analysis_results.get('log_volume_analysis', {})
    for key, value in volume_analysis.items():
        print(f"   {key}: {value}")
    
    # Display error analysis
    print(f"\n🚨 Error Analysis:")
    error_analysis = analysis_results.get('error_analysis', {})
    for key, value in error_analysis.items():
        if key == 'most_common_errors':
            print(f"   {key}:")
            for error in value[:3]:
                print(f"     - {error['message'][:80]}... (count: {error['count']})")
        else:
            print(f"   {key}: {value}")
    
    # Display detected patterns
    patterns = analysis_results.get('patterns', [])
    print(f"\n🔍 Detected Patterns ({len(patterns)}):")
    for pattern in patterns[:3]:
        print(f"   - {pattern.pattern_type}: {pattern.description}")
        print(f"     Severity: {pattern.severity}, Frequency: {pattern.frequency}")
        print(f"     Recommendation: {pattern.recommended_action}")
    
    # Display insights
    insights = analysis_results.get('insights', [])
    print(f"\n💡 Generated Insights ({len(insights)}):")
    for insight in insights[:3]:
        print(f"   - {insight.category.upper()}: {insight.title}")
        print(f"     {insight.description}")
        print(f"     Priority: {insight.priority}, Confidence: {insight.confidence:.2f}")
        if insight.recommendations:
            print(f"     Recommendations: {insight.recommendations[0]}")
    
    # Display anomalies
    anomalies = analysis_results.get('anomalies', [])
    print(f"\n⚠️ Log Anomalies ({len(anomalies)}):")
    for anomaly in anomalies[:3]:
        print(f"   - {anomaly['type']}: {anomaly['description']}")
        print(f"     Source: {anomaly['source']}, Confidence: {anomaly['confidence']:.2f}")
    
    # Display security analysis
    security_analysis = analysis_results.get('security_analysis', {})
    print(f"\n🔒 Security Analysis:")
    for key, value in security_analysis.items():
        if key == 'potential_attacks':
            if value:
                print(f"   {key}: {len(value)} potential attacks detected")
        else:
            print(f"   {key}: {value}")
    
    # Display performance analysis
    performance_analysis = analysis_results.get('performance_analysis', {})
    print(f"\n⚡ Performance Analysis:")
    print(f"   performance_related_logs: {performance_analysis.get('performance_related_logs', 0)}")
    
    # Show overall summary
    print(f"\n📋 Log Analysis Summary:")
    summary = analyzer.get_log_summary()
    for key, value in summary.items():
        if key != 'recent_analysis':
            print(f"   {key}: {value}")
    
    print("\n✅ Intelligent Log Analysis completed!")


if __name__ == "__main__":
    main()