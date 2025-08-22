import asyncio
import hashlib
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer
import aiohttp
import ipaddress

class ThreatLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ThreatType(Enum):
    MALWARE = "malware"
    PHISHING = "phishing"
    DDoS = "ddos"
    BRUTE_FORCE = "brute_force"
    DATA_EXFILTRATION = "data_exfiltration"
    INSIDER_THREAT = "insider_threat"
    APT = "apt"
    RANSOMWARE = "ransomware"
    BOTNET = "botnet"
    SQL_INJECTION = "sql_injection"
    XSS = "xss"
    PRIVILEGE_ESCALATION = "privilege_escalation"

@dataclass
class ThreatIndicator:
    id: str
    type: ThreatType
    value: str
    confidence: float
    severity: ThreatLevel
    first_seen: datetime
    last_seen: datetime
    source: str
    description: str
    tags: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SecurityEvent:
    id: str
    timestamp: datetime
    source_ip: str
    destination_ip: str
    user_id: Optional[str]
    event_type: str
    severity: ThreatLevel
    description: str
    raw_data: Dict[str, Any]
    indicators: List[ThreatIndicator] = field(default_factory=list)
    risk_score: float = 0.0
    
@dataclass
class ThreatDetectionResult:
    threat_detected: bool
    threat_type: ThreatType
    confidence: float
    severity: ThreatLevel
    indicators: List[ThreatIndicator]
    recommended_actions: List[str]
    context: Dict[str, Any]

class BehavioralAnalyzer:
    def __init__(self):
        self.user_baselines = {}
        self.network_baselines = {}
        self.isolation_forest = IsolationForest(contamination=0.1, random_state=42)
        self.is_trained = False
        
    async def build_baseline(self, user_id: str, activities: List[Dict]):
        features = self._extract_behavioral_features(activities)
        if len(features) >= 10:
            baseline = {
                'login_times': np.array([f['hour'] for f in features]),
                'access_patterns': [f['resources'] for f in features],
                'data_volumes': np.array([f['data_volume'] for f in features]),
                'session_durations': np.array([f['session_duration'] for f in features]),
                'locations': [f['location'] for f in features]
            }
            self.user_baselines[user_id] = baseline
            
    def _extract_behavioral_features(self, activities: List[Dict]) -> List[Dict]:
        features = []
        for activity in activities:
            timestamp = datetime.fromisoformat(activity.get('timestamp', ''))
            features.append({
                'hour': timestamp.hour,
                'day_of_week': timestamp.weekday(),
                'resources': len(activity.get('resources_accessed', [])),
                'data_volume': activity.get('data_transferred', 0),
                'session_duration': activity.get('session_duration', 0),
                'location': activity.get('source_location', 'unknown'),
                'failed_attempts': activity.get('failed_attempts', 0)
            })
        return features
        
    async def detect_anomaly(self, user_id: str, current_activity: Dict) -> Tuple[bool, float]:
        if user_id not in self.user_baselines:
            return False, 0.0
            
        baseline = self.user_baselines[user_id]
        current_features = self._extract_behavioral_features([current_activity])[0]
        
        anomaly_score = 0.0
        anomaly_count = 0
        
        # Time-based anomaly
        hour_deviation = min(abs(current_features['hour'] - baseline['login_times'].mean()),
                           24 - abs(current_features['hour'] - baseline['login_times'].mean()))
        if hour_deviation > 2 * baseline['login_times'].std():
            anomaly_score += 0.3
            anomaly_count += 1
            
        # Data volume anomaly
        if len(baseline['data_volumes']) > 0:
            volume_z_score = abs((current_features['data_volume'] - baseline['data_volumes'].mean()) / 
                               (baseline['data_volumes'].std() + 1e-6))
            if volume_z_score > 3:
                anomaly_score += 0.4
                anomaly_count += 1
                
        # Location anomaly
        if current_features['location'] not in baseline['locations']:
            anomaly_score += 0.3
            anomaly_count += 1
            
        is_anomalous = anomaly_score > 0.5 or anomaly_count >= 2
        return is_anomalous, min(anomaly_score, 1.0)

class ThreatIntelligenceEngine:
    def __init__(self):
        self.threat_feeds = {
            'malware_hashes': set(),
            'malicious_ips': set(),
            'malicious_domains': set(),
            'phishing_urls': set(),
            'botnet_c2': set()
        }
        self.ioc_cache = {}
        self.last_update = datetime.now() - timedelta(hours=24)
        
    async def update_threat_feeds(self):
        try:
            await self._fetch_malware_hashes()
            await self._fetch_malicious_ips()
            await self._fetch_malicious_domains()
            await self._fetch_phishing_urls()
            self.last_update = datetime.now()
        except Exception as e:
            logging.error(f"Failed to update threat feeds: {e}")
            
    async def _fetch_malware_hashes(self):
        # Simulate threat feed integration
        sample_hashes = [
            "d41d8cd98f00b204e9800998ecf8427e",
            "5d41402abc4b2a76b9719d911017c592",
            "098f6bcd4621d373cade4e832627b4f6"
        ]
        self.threat_feeds['malware_hashes'].update(sample_hashes)
        
    async def _fetch_malicious_ips(self):
        sample_ips = [
            "192.168.1.100",
            "10.0.0.50",
            "172.16.0.25"
        ]
        self.threat_feeds['malicious_ips'].update(sample_ips)
        
    async def _fetch_malicious_domains(self):
        sample_domains = [
            "malicious-example.com",
            "phishing-site.net",
            "trojan-download.org"
        ]
        self.threat_feeds['malicious_domains'].update(sample_domains)
        
    async def _fetch_phishing_urls(self):
        sample_urls = [
            "http://fake-bank-login.com/secure",
            "https://phishing-paypal.net/signin",
            "http://microsoft-support-scam.org"
        ]
        self.threat_feeds['phishing_urls'].update(sample_urls)
        
    async def check_ioc(self, indicator: str, indicator_type: str) -> Optional[ThreatIndicator]:
        if indicator_type == 'hash' and indicator in self.threat_feeds['malware_hashes']:
            return ThreatIndicator(
                id=f"hash_{indicator[:8]}",
                type=ThreatType.MALWARE,
                value=indicator,
                confidence=0.9,
                severity=ThreatLevel.HIGH,
                first_seen=datetime.now(),
                last_seen=datetime.now(),
                source="threat_intelligence",
                description="Known malware hash detected"
            )
            
        if indicator_type == 'ip' and indicator in self.threat_feeds['malicious_ips']:
            return ThreatIndicator(
                id=f"ip_{indicator.replace('.', '_')}",
                type=ThreatType.BOTNET,
                value=indicator,
                confidence=0.8,
                severity=ThreatLevel.HIGH,
                first_seen=datetime.now(),
                last_seen=datetime.now(),
                source="threat_intelligence",
                description="Known malicious IP address"
            )
            
        if indicator_type == 'domain' and indicator in self.threat_feeds['malicious_domains']:
            return ThreatIndicator(
                id=f"domain_{hash(indicator)}",
                type=ThreatType.PHISHING,
                value=indicator,
                confidence=0.85,
                severity=ThreatLevel.HIGH,
                first_seen=datetime.now(),
                last_seen=datetime.now(),
                source="threat_intelligence",
                description="Known malicious domain"
            )
            
        return None

class MLThreatClassifier:
    def __init__(self):
        self.classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.scaler = StandardScaler()
        self.vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
        self.is_trained = False
        
    async def train(self, training_data: List[Dict]):
        features = []
        labels = []
        
        for sample in training_data:
            feature_vector = self._extract_ml_features(sample)
            features.append(feature_vector)
            labels.append(sample['threat_type'])
            
        if len(features) > 0:
            X = self.scaler.fit_transform(features)
            self.classifier.fit(X, labels)
            self.is_trained = True
            
    def _extract_ml_features(self, event_data: Dict) -> List[float]:
        features = [
            event_data.get('connection_count', 0),
            event_data.get('data_volume', 0),
            event_data.get('failed_login_attempts', 0),
            event_data.get('session_duration', 0),
            event_data.get('privilege_escalations', 0),
            event_data.get('file_access_count', 0),
            event_data.get('network_requests', 0),
            1.0 if event_data.get('off_hours_access', False) else 0.0,
            1.0 if event_data.get('unusual_location', False) else 0.0,
            event_data.get('risk_score', 0.0)
        ]
        return features
        
    async def classify_threat(self, event_data: Dict) -> Tuple[ThreatType, float]:
        if not self.is_trained:
            return ThreatType.MALWARE, 0.5
            
        features = self._extract_ml_features(event_data)
        X = self.scaler.transform([features])
        
        prediction = self.classifier.predict(X)[0]
        confidence = max(self.classifier.predict_proba(X)[0])
        
        try:
            threat_type = ThreatType(prediction)
        except ValueError:
            threat_type = ThreatType.MALWARE
            
        return threat_type, confidence

class AdvancedThreatDetectionSystem:
    def __init__(self):
        self.behavioral_analyzer = BehavioralAnalyzer()
        self.threat_intelligence = ThreatIntelligenceEngine()
        self.ml_classifier = MLThreatClassifier()
        self.active_threats = {}
        self.detection_rules = self._initialize_detection_rules()
        self.correlation_window = timedelta(minutes=5)
        self.event_buffer = []
        
    def _initialize_detection_rules(self) -> Dict[str, Dict]:
        return {
            'brute_force': {
                'threshold': 5,
                'window': 300,  # 5 minutes
                'severity': ThreatLevel.MEDIUM
            },
            'data_exfiltration': {
                'data_threshold': 100 * 1024 * 1024,  # 100MB
                'time_threshold': 3600,  # 1 hour
                'severity': ThreatLevel.HIGH
            },
            'privilege_escalation': {
                'admin_access_threshold': 3,
                'window': 900,  # 15 minutes
                'severity': ThreatLevel.HIGH
            },
            'suspicious_network': {
                'connection_threshold': 100,
                'unique_destinations': 50,
                'window': 600,  # 10 minutes
                'severity': ThreatLevel.MEDIUM
            }
        }
        
    async def initialize(self):
        await self.threat_intelligence.update_threat_feeds()
        # Load and train ML models with historical data
        training_data = await self._load_training_data()
        if training_data:
            await self.ml_classifier.train(training_data)
            
    async def _load_training_data(self) -> List[Dict]:
        # Simulate loading training data
        return [
            {
                'connection_count': 50, 'data_volume': 1000000, 'failed_login_attempts': 0,
                'session_duration': 3600, 'privilege_escalations': 0, 'file_access_count': 10,
                'network_requests': 25, 'off_hours_access': False, 'unusual_location': False,
                'risk_score': 0.2, 'threat_type': 'normal'
            },
            {
                'connection_count': 200, 'data_volume': 500000000, 'failed_login_attempts': 0,
                'session_duration': 7200, 'privilege_escalations': 0, 'file_access_count': 1000,
                'network_requests': 500, 'off_hours_access': True, 'unusual_location': True,
                'risk_score': 0.9, 'threat_type': 'data_exfiltration'
            }
        ]
        
    async def analyze_event(self, event: SecurityEvent) -> ThreatDetectionResult:
        indicators = []
        threat_detected = False
        max_confidence = 0.0
        primary_threat_type = ThreatType.MALWARE
        severity = ThreatLevel.LOW
        recommended_actions = []
        
        # 1. Threat Intelligence Check
        ti_indicators = await self._check_threat_intelligence(event)
        indicators.extend(ti_indicators)
        
        # 2. Behavioral Analysis
        if event.user_id:
            behavioral_result = await self._analyze_behavior(event)
            if behavioral_result:
                indicators.append(behavioral_result)
                
        # 3. Rule-based Detection
        rule_results = await self._apply_detection_rules(event)
        indicators.extend(rule_results)
        
        # 4. ML Classification
        ml_threat_type, ml_confidence = await self._classify_with_ml(event)
        if ml_confidence > 0.7:
            ml_indicator = ThreatIndicator(
                id=f"ml_{event.id}",
                type=ml_threat_type,
                value=event.source_ip,
                confidence=ml_confidence,
                severity=self._calculate_severity(ml_confidence),
                first_seen=event.timestamp,
                last_seen=event.timestamp,
                source="ml_classifier",
                description=f"ML-detected {ml_threat_type.value} activity"
            )
            indicators.append(ml_indicator)
            
        # 5. Correlation Analysis
        correlated_indicators = await self._correlate_events(event, indicators)
        indicators.extend(correlated_indicators)
        
        # Determine overall result
        if indicators:
            threat_detected = True
            max_confidence = max(ind.confidence for ind in indicators)
            severity_scores = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
            max_severity = max(severity_scores[ind.severity.value] for ind in indicators)
            severity = ThreatLevel(['low', 'medium', 'high', 'critical'][max_severity-1])
            
            # Determine primary threat type
            threat_counts = {}
            for ind in indicators:
                threat_counts[ind.type] = threat_counts.get(ind.type, 0) + ind.confidence
            primary_threat_type = max(threat_counts.keys(), key=lambda x: threat_counts[x])
            
            recommended_actions = self._generate_recommendations(primary_threat_type, severity)
            
        return ThreatDetectionResult(
            threat_detected=threat_detected,
            threat_type=primary_threat_type,
            confidence=max_confidence,
            severity=severity,
            indicators=indicators,
            recommended_actions=recommended_actions,
            context={
                'event_id': event.id,
                'analysis_timestamp': datetime.now().isoformat(),
                'indicators_count': len(indicators)
            }
        )
        
    async def _check_threat_intelligence(self, event: SecurityEvent) -> List[ThreatIndicator]:
        indicators = []
        
        # Check source IP
        ip_indicator = await self.threat_intelligence.check_ioc(event.source_ip, 'ip')
        if ip_indicator:
            indicators.append(ip_indicator)
            
        # Check destination IP
        dest_indicator = await self.threat_intelligence.check_ioc(event.destination_ip, 'ip')
        if dest_indicator:
            indicators.append(dest_indicator)
            
        # Check file hashes if present
        file_hashes = event.raw_data.get('file_hashes', [])
        for hash_value in file_hashes:
            hash_indicator = await self.threat_intelligence.check_ioc(hash_value, 'hash')
            if hash_indicator:
                indicators.append(hash_indicator)
                
        return indicators
        
    async def _analyze_behavior(self, event: SecurityEvent) -> Optional[ThreatIndicator]:
        if not event.user_id:
            return None
            
        activity = {
            'timestamp': event.timestamp.isoformat(),
            'resources_accessed': event.raw_data.get('resources', []),
            'data_transferred': event.raw_data.get('data_volume', 0),
            'session_duration': event.raw_data.get('session_duration', 0),
            'source_location': event.raw_data.get('location', 'unknown')
        }
        
        is_anomalous, anomaly_score = await self.behavioral_analyzer.detect_anomaly(
            event.user_id, activity
        )
        
        if is_anomalous and anomaly_score > 0.6:
            return ThreatIndicator(
                id=f"behavioral_{event.user_id}_{event.id}",
                type=ThreatType.INSIDER_THREAT,
                value=event.user_id,
                confidence=anomaly_score,
                severity=self._calculate_severity(anomaly_score),
                first_seen=event.timestamp,
                last_seen=event.timestamp,
                source="behavioral_analysis",
                description="Anomalous user behavior detected"
            )
            
        return None
        
    async def _apply_detection_rules(self, event: SecurityEvent) -> List[ThreatIndicator]:
        indicators = []
        
        # Brute force detection
        if event.event_type == 'failed_login':
            recent_failures = self._count_recent_events(
                event.source_ip, 'failed_login', self.detection_rules['brute_force']['window']
            )
            if recent_failures >= self.detection_rules['brute_force']['threshold']:
                indicators.append(ThreatIndicator(
                    id=f"brute_force_{event.source_ip}",
                    type=ThreatType.BRUTE_FORCE,
                    value=event.source_ip,
                    confidence=0.8,
                    severity=self.detection_rules['brute_force']['severity'],
                    first_seen=event.timestamp,
                    last_seen=event.timestamp,
                    source="rule_engine",
                    description=f"Brute force attack detected: {recent_failures} failed attempts"
                ))
                
        # Data exfiltration detection
        if event.raw_data.get('data_volume', 0) > self.detection_rules['data_exfiltration']['data_threshold']:
            indicators.append(ThreatIndicator(
                id=f"data_exfil_{event.id}",
                type=ThreatType.DATA_EXFILTRATION,
                value=event.source_ip,
                confidence=0.7,
                severity=self.detection_rules['data_exfiltration']['severity'],
                first_seen=event.timestamp,
                last_seen=event.timestamp,
                source="rule_engine",
                description="Large data transfer detected"
            ))
            
        return indicators
        
    def _count_recent_events(self, source_ip: str, event_type: str, window_seconds: int) -> int:
        cutoff_time = datetime.now() - timedelta(seconds=window_seconds)
        count = 0
        for buffered_event in self.event_buffer:
            if (buffered_event.source_ip == source_ip and 
                buffered_event.event_type == event_type and
                buffered_event.timestamp > cutoff_time):
                count += 1
        return count
        
    async def _classify_with_ml(self, event: SecurityEvent) -> Tuple[ThreatType, float]:
        event_features = {
            'connection_count': event.raw_data.get('connection_count', 1),
            'data_volume': event.raw_data.get('data_volume', 0),
            'failed_login_attempts': event.raw_data.get('failed_attempts', 0),
            'session_duration': event.raw_data.get('session_duration', 0),
            'privilege_escalations': event.raw_data.get('privilege_escalations', 0),
            'file_access_count': event.raw_data.get('file_accesses', 0),
            'network_requests': event.raw_data.get('network_requests', 1),
            'off_hours_access': event.timestamp.hour < 6 or event.timestamp.hour > 22,
            'unusual_location': event.raw_data.get('unusual_location', False),
            'risk_score': event.risk_score
        }
        
        return await self.ml_classifier.classify_threat(event_features)
        
    async def _correlate_events(self, event: SecurityEvent, existing_indicators: List[ThreatIndicator]) -> List[ThreatIndicator]:
        correlated_indicators = []
        
        # Time-based correlation
        recent_events = [e for e in self.event_buffer 
                        if abs((e.timestamp - event.timestamp).total_seconds()) <= self.correlation_window.total_seconds()]
        
        # IP-based correlation
        same_ip_events = [e for e in recent_events if e.source_ip == event.source_ip]
        if len(same_ip_events) > 5:
            correlated_indicators.append(ThreatIndicator(
                id=f"correlation_ip_{event.source_ip}",
                type=ThreatType.BOTNET,
                value=event.source_ip,
                confidence=0.6,
                severity=ThreatLevel.MEDIUM,
                first_seen=min(e.timestamp for e in same_ip_events),
                last_seen=max(e.timestamp for e in same_ip_events),
                source="correlation_engine",
                description=f"Multiple events from same IP: {len(same_ip_events)} events"
            ))
            
        # User-based correlation
        if event.user_id:
            same_user_events = [e for e in recent_events if e.user_id == event.user_id]
            if len(same_user_events) > 3:
                severity_count = sum(1 for e in same_user_events if e.severity in [ThreatLevel.HIGH, ThreatLevel.CRITICAL])
                if severity_count > 1:
                    correlated_indicators.append(ThreatIndicator(
                        id=f"correlation_user_{event.user_id}",
                        type=ThreatType.INSIDER_THREAT,
                        value=event.user_id,
                        confidence=0.7,
                        severity=ThreatLevel.HIGH,
                        first_seen=min(e.timestamp for e in same_user_events),
                        last_seen=max(e.timestamp for e in same_user_events),
                        source="correlation_engine",
                        description=f"Multiple high-severity events from user: {severity_count} events"
                    ))
                    
        return correlated_indicators
        
    def _calculate_severity(self, confidence: float) -> ThreatLevel:
        if confidence >= 0.9:
            return ThreatLevel.CRITICAL
        elif confidence >= 0.7:
            return ThreatLevel.HIGH
        elif confidence >= 0.5:
            return ThreatLevel.MEDIUM
        else:
            return ThreatLevel.LOW
            
    def _generate_recommendations(self, threat_type: ThreatType, severity: ThreatLevel) -> List[str]:
        base_actions = {
            ThreatType.MALWARE: [
                "Isolate affected systems",
                "Run full antivirus scan",
                "Update security signatures"
            ],
            ThreatType.BRUTE_FORCE: [
                "Block source IP",
                "Enforce account lockout policies",
                "Enable multi-factor authentication"
            ],
            ThreatType.DATA_EXFILTRATION: [
                "Block data transfer",
                "Investigate user activity",
                "Review data access logs"
            ],
            ThreatType.INSIDER_THREAT: [
                "Review user permissions",
                "Monitor user activity",
                "Conduct security interview"
            ],
            ThreatType.PHISHING: [
                "Block malicious URLs",
                "Warn affected users",
                "Update email filters"
            ]
        }
        
        actions = base_actions.get(threat_type, ["Investigate further"])
        
        if severity in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
            actions.extend([
                "Notify security team immediately",
                "Consider system shutdown",
                "Preserve evidence for forensics"
            ])
            
        return actions
        
    async def add_event_to_buffer(self, event: SecurityEvent):
        self.event_buffer.append(event)
        # Keep buffer size manageable
        if len(self.event_buffer) > 10000:
            self.event_buffer = self.event_buffer[-5000:]
            
    async def get_threat_summary(self) -> Dict[str, Any]:
        now = datetime.now()
        last_24h = now - timedelta(hours=24)
        
        recent_events = [e for e in self.event_buffer if e.timestamp > last_24h]
        
        threat_counts = {}
        severity_counts = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
        
        for event in recent_events:
            if hasattr(event, 'threat_type'):
                threat_counts[event.threat_type] = threat_counts.get(event.threat_type, 0) + 1
            severity_counts[event.severity.value] += 1
            
        return {
            'total_events_24h': len(recent_events),
            'threat_types': threat_counts,
            'severity_distribution': severity_counts,
            'active_threats': len(self.active_threats),
            'last_update': now.isoformat(),
            'system_status': 'operational'
        }

# Example usage and testing
async def main():
    detection_system = AdvancedThreatDetectionSystem()
    await detection_system.initialize()
    
    # Example security event
    test_event = SecurityEvent(
        id="evt_001",
        timestamp=datetime.now(),
        source_ip="192.168.1.100",
        destination_ip="10.0.0.1",
        user_id="user123",
        event_type="data_transfer",
        severity=ThreatLevel.MEDIUM,
        description="Large file download",
        raw_data={
            'data_volume': 150 * 1024 * 1024,  # 150MB
            'session_duration': 3600,
            'file_accesses': 50,
            'network_requests': 25,
            'unusual_location': True
        }
    )
    
    # Analyze the event
    result = await detection_system.analyze_event(test_event)
    
    print(f"Threat Detected: {result.threat_detected}")
    print(f"Threat Type: {result.threat_type}")
    print(f"Confidence: {result.confidence:.2f}")
    print(f"Severity: {result.severity}")
    print(f"Indicators: {len(result.indicators)}")
    print(f"Recommended Actions: {result.recommended_actions}")
    
    # Get system summary
    summary = await detection_system.get_threat_summary()
    print(f"\nSystem Summary: {summary}")

if __name__ == "__main__":
    asyncio.run(main())