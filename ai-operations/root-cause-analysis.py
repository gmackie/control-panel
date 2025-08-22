import asyncio
import json
import networkx as nx
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import logging
import uuid
from collections import defaultdict, deque
import re
from difflib import SequenceMatcher
import heapq

class IncidentType(Enum):
    OUTAGE = "outage"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    ERROR_SPIKE = "error_spike"
    CAPACITY_ISSUE = "capacity_issue"
    SECURITY_INCIDENT = "security_incident"
    DATA_CORRUPTION = "data_corruption"
    CONFIGURATION_ERROR = "configuration_error"
    DEPENDENCY_FAILURE = "dependency_failure"

class CauseType(Enum):
    CODE_CHANGE = "code_change"
    CONFIGURATION_CHANGE = "configuration_change"
    INFRASTRUCTURE_FAILURE = "infrastructure_failure"
    EXTERNAL_DEPENDENCY = "external_dependency"
    RESOURCE_EXHAUSTION = "resource_exhaustion"
    NETWORK_ISSUE = "network_issue"
    SECURITY_BREACH = "security_breach"
    DATA_ISSUE = "data_issue"
    HUMAN_ERROR = "human_error"
    ENVIRONMENTAL = "environmental"

class ConfidenceLevel(Enum):
    HIGH = "high"  # > 85%
    MEDIUM = "medium"  # 50-85%
    LOW = "low"  # < 50%

class EvidenceType(Enum):
    METRIC_ANOMALY = "metric_anomaly"
    LOG_PATTERN = "log_pattern"
    EVENT_CORRELATION = "event_correlation"
    DEPLOYMENT_TIMELINE = "deployment_timeline"
    DEPENDENCY_GRAPH = "dependency_graph"
    ERROR_SIGNATURE = "error_signature"
    PERFORMANCE_PROFILE = "performance_profile"
    CONFIGURATION_DIFF = "configuration_diff"

@dataclass
class Evidence:
    evidence_id: str
    evidence_type: EvidenceType
    description: str
    relevance_score: float  # 0-1
    confidence: float  # 0-1
    timestamp: datetime
    source: str
    details: Dict[str, Any]
    related_components: List[str] = field(default_factory=list)
    supporting_data: Optional[Dict[str, Any]] = None

@dataclass
class RootCause:
    cause_id: str
    cause_type: CauseType
    description: str
    confidence: ConfidenceLevel
    probability: float  # 0-1
    impact_score: float  # 0-1
    time_to_detection: timedelta
    affected_components: List[str]
    evidence: List[Evidence]
    recommended_actions: List[str]
    prevention_measures: List[str]
    similar_incidents: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Incident:
    incident_id: str
    incident_type: IncidentType
    title: str
    description: str
    start_time: datetime
    detection_time: datetime
    end_time: Optional[datetime]
    severity: str
    affected_services: List[str]
    symptoms: List[str]
    initial_indicators: Dict[str, Any]
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class ServiceDependency:
    from_service: str
    to_service: str
    dependency_type: str  # sync, async, data, config
    criticality: float  # 0-1
    typical_latency: float
    failure_modes: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class MetricAnomaly:
    metric_name: str
    service: str
    timestamp: datetime
    value: float
    expected_value: float
    deviation: float
    severity: str
    anomaly_type: str  # spike, drop, trend_change, pattern_break
    context: Dict[str, Any] = field(default_factory=dict)

@dataclass
class LogEvent:
    timestamp: datetime
    service: str
    level: str
    message: str
    structured_data: Dict[str, Any]
    error_signature: Optional[str] = None
    stack_trace: Optional[str] = None
    correlation_id: Optional[str] = None

@dataclass
class DeploymentEvent:
    deployment_id: str
    service: str
    timestamp: datetime
    version_from: str
    version_to: str
    deployment_type: str  # rolling, blue_green, canary
    status: str  # success, failed, rolled_back
    changes: List[Dict[str, Any]]
    rollback_time: Optional[datetime] = None

class DependencyAnalyzer:
    def __init__(self):
        self.dependency_graph = nx.DiGraph()
        self.service_dependencies = {}
        self.failure_propagation_cache = {}
        
    def add_dependency(self, dependency: ServiceDependency):
        """Add service dependency to graph"""
        self.dependency_graph.add_edge(
            dependency.from_service,
            dependency.to_service,
            weight=dependency.criticality,
            latency=dependency.typical_latency,
            dependency_type=dependency.dependency_type,
            failure_modes=dependency.failure_modes
        )
        
        key = (dependency.from_service, dependency.to_service)
        self.service_dependencies[key] = dependency
    
    async def analyze_failure_propagation(self, failed_service: str) -> Dict[str, Any]:
        """Analyze how failure might propagate through dependencies"""
        if failed_service not in self.dependency_graph:
            return {}
        
        # Find all services that depend on the failed service
        dependent_services = list(self.dependency_graph.predecessors(failed_service))
        
        # Find services that the failed service depends on
        upstream_services = list(self.dependency_graph.successors(failed_service))
        
        # Calculate impact scores
        impact_analysis = {
            'failed_service': failed_service,
            'directly_impacted': [],
            'potentially_impacted': [],
            'upstream_dependencies': [],
            'cascade_probability': 0.0
        }
        
        # Analyze direct impact
        for service in dependent_services:
            edge_data = self.dependency_graph.get_edge_data(service, failed_service)
            criticality = edge_data.get('weight', 0.5)
            
            impact_analysis['directly_impacted'].append({
                'service': service,
                'criticality': criticality,
                'dependency_type': edge_data.get('dependency_type', 'unknown'),
                'typical_latency': edge_data.get('latency', 0)
            })
        
        # Analyze potential cascade
        cascade_services = set()
        for service in dependent_services:
            cascade_services.update(self.dependency_graph.predecessors(service))
        
        for service in cascade_services:
            if service != failed_service:
                impact_analysis['potentially_impacted'].append(service)
        
        # Analyze upstream dependencies
        for service in upstream_services:
            edge_data = self.dependency_graph.get_edge_data(failed_service, service)
            impact_analysis['upstream_dependencies'].append({
                'service': service,
                'dependency_type': edge_data.get('dependency_type', 'unknown'),
                'failure_modes': edge_data.get('failure_modes', [])
            })
        
        # Calculate cascade probability
        if dependent_services:
            avg_criticality = np.mean([
                self.dependency_graph.get_edge_data(s, failed_service).get('weight', 0.5)
                for s in dependent_services
            ])
            impact_analysis['cascade_probability'] = min(avg_criticality * len(dependent_services) * 0.3, 1.0)
        
        return impact_analysis
    
    def find_critical_path(self, from_service: str, to_service: str) -> List[str]:
        """Find critical path between services"""
        try:
            path = nx.shortest_path(self.dependency_graph, from_service, to_service, weight='weight')
            return path
        except nx.NetworkXNoPath:
            return []
    
    def get_service_centrality(self, service: str) -> float:
        """Calculate service centrality (importance in dependency graph)"""
        if service not in self.dependency_graph:
            return 0.0
        
        # Combine in-degree and out-degree centrality
        in_centrality = self.dependency_graph.in_degree(service, weight='weight')
        out_centrality = self.dependency_graph.out_degree(service, weight='weight')
        
        # Normalize by total number of services
        total_services = len(self.dependency_graph.nodes())
        if total_services <= 1:
            return 0.0
        
        centrality = (in_centrality + out_centrality) / (2 * (total_services - 1))
        return min(centrality, 1.0)

class TimelineAnalyzer:
    def __init__(self):
        self.events = []
        self.correlation_window = timedelta(minutes=30)
        
    def add_events(self, events: List[Dict[str, Any]]):
        """Add events to timeline"""
        self.events.extend(events)
        self.events.sort(key=lambda x: x.get('timestamp', datetime.min))
    
    async def analyze_timeline(self, incident_start: datetime, 
                              incident_end: Optional[datetime] = None) -> Dict[str, Any]:
        """Analyze timeline for patterns and correlations"""
        if not incident_end:
            incident_end = datetime.now()
        
        # Find events in the incident window
        incident_events = [
            event for event in self.events
            if incident_start <= event.get('timestamp', datetime.min) <= incident_end
        ]
        
        # Find events before incident (potential causes)
        lookback_start = incident_start - timedelta(hours=2)
        pre_incident_events = [
            event for event in self.events
            if lookback_start <= event.get('timestamp', datetime.min) < incident_start
        ]
        
        analysis = {
            'incident_events': incident_events,
            'pre_incident_events': pre_incident_events,
            'timeline_patterns': await self._detect_timeline_patterns(incident_events),
            'causal_sequences': await self._find_causal_sequences(pre_incident_events, incident_events),
            'concurrent_events': await self._find_concurrent_events(incident_events),
            'unusual_sequences': await self._detect_unusual_sequences(pre_incident_events + incident_events)
        }
        
        return analysis
    
    async def _detect_timeline_patterns(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect patterns in event timeline"""
        patterns = []
        
        # Group events by type
        event_types = defaultdict(list)
        for event in events:
            event_types[event.get('type', 'unknown')].append(event)
        
        # Look for repeating patterns
        for event_type, type_events in event_types.items():
            if len(type_events) >= 3:
                timestamps = [e.get('timestamp', datetime.min) for e in type_events]
                intervals = [
                    (timestamps[i+1] - timestamps[i]).total_seconds()
                    for i in range(len(timestamps)-1)
                ]
                
                if len(set(intervals)) == 1:  # Regular intervals
                    patterns.append({
                        'type': 'regular_pattern',
                        'event_type': event_type,
                        'interval_seconds': intervals[0],
                        'count': len(type_events)
                    })
        
        return patterns
    
    async def _find_causal_sequences(self, pre_events: List[Dict[str, Any]], 
                                    incident_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find potential causal sequences"""
        sequences = []
        
        # Look for deployment -> error patterns
        deployments = [e for e in pre_events if e.get('type') == 'deployment']
        errors = incident_events[:3]  # First few incident events
        
        for deployment in deployments:
            for error in errors:
                time_diff = error.get('timestamp', datetime.max) - deployment.get('timestamp', datetime.min)
                if timedelta(0) <= time_diff <= timedelta(hours=1):
                    sequences.append({
                        'type': 'deployment_error_sequence',
                        'deployment': deployment,
                        'error': error,
                        'time_gap': time_diff.total_seconds(),
                        'confidence': 0.8 if time_diff <= timedelta(minutes=15) else 0.5
                    })
        
        return sequences
    
    async def _find_concurrent_events(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find events that occurred concurrently"""
        concurrent = []
        
        for i, event1 in enumerate(events):
            for event2 in events[i+1:]:
                time_diff = abs(
                    (event1.get('timestamp', datetime.min) - 
                     event2.get('timestamp', datetime.min)).total_seconds()
                )
                
                if time_diff <= 60:  # Within 1 minute
                    concurrent.append({
                        'event1': event1,
                        'event2': event2,
                        'time_diff_seconds': time_diff
                    })
        
        return concurrent
    
    async def _detect_unusual_sequences(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Detect unusual event sequences"""
        unusual = []
        
        # Simple heuristic: look for error events followed by more errors
        error_events = [e for e in events if 'error' in e.get('type', '').lower()]
        
        if len(error_events) >= 3:
            # Check if errors are cascading (increasing frequency)
            timestamps = [e.get('timestamp', datetime.min) for e in error_events[:5]]
            intervals = [
                (timestamps[i+1] - timestamps[i]).total_seconds()
                for i in range(len(timestamps)-1)
            ]
            
            if len(intervals) >= 2:
                # Check if intervals are decreasing (accelerating errors)
                if all(intervals[i] > intervals[i+1] for i in range(len(intervals)-1)):
                    unusual.append({
                        'type': 'accelerating_errors',
                        'error_count': len(error_events),
                        'acceleration_factor': intervals[0] / intervals[-1] if intervals[-1] > 0 else 1
                    })
        
        return unusual

class LogAnalyzer:
    def __init__(self):
        self.error_patterns = {}
        self.known_signatures = {}
        
    async def analyze_logs(self, logs: List[LogEvent], 
                          incident_window: Tuple[datetime, datetime]) -> Dict[str, Any]:
        """Analyze logs for root cause indicators"""
        start_time, end_time = incident_window
        
        # Filter logs to incident window
        incident_logs = [
            log for log in logs
            if start_time <= log.timestamp <= end_time
        ]
        
        analysis = {
            'error_patterns': await self._extract_error_patterns(incident_logs),
            'anomalous_messages': await self._find_anomalous_messages(incident_logs),
            'stack_trace_analysis': await self._analyze_stack_traces(incident_logs),
            'correlation_analysis': await self._analyze_correlations(incident_logs),
            'log_volume_analysis': await self._analyze_log_volume(incident_logs),
            'service_error_distribution': await self._analyze_service_errors(incident_logs)
        }
        
        return analysis
    
    async def _extract_error_patterns(self, logs: List[LogEvent]) -> List[Dict[str, Any]]:
        """Extract common error patterns from logs"""
        error_logs = [log for log in logs if log.level in ['ERROR', 'CRITICAL', 'FATAL']]
        
        # Group by error signature
        signature_groups = defaultdict(list)
        for log in error_logs:
            signature = self._generate_error_signature(log.message)
            signature_groups[signature].append(log)
        
        patterns = []
        for signature, group_logs in signature_groups.items():
            if len(group_logs) >= 3:  # Pattern needs at least 3 occurrences
                patterns.append({
                    'signature': signature,
                    'count': len(group_logs),
                    'first_occurrence': min(log.timestamp for log in group_logs),
                    'last_occurrence': max(log.timestamp for log in group_logs),
                    'affected_services': list(set(log.service for log in group_logs)),
                    'sample_message': group_logs[0].message
                })
        
        # Sort by count (most common first)
        patterns.sort(key=lambda x: x['count'], reverse=True)
        return patterns
    
    async def _find_anomalous_messages(self, logs: List[LogEvent]) -> List[Dict[str, Any]]:
        """Find anomalous log messages that might indicate root cause"""
        anomalous = []
        
        # Look for first occurrence of error messages
        seen_messages = set()
        for log in sorted(logs, key=lambda x: x.timestamp):
            message_signature = self._generate_error_signature(log.message)
            
            if (log.level in ['ERROR', 'CRITICAL', 'FATAL'] and 
                message_signature not in seen_messages):
                
                anomalous.append({
                    'timestamp': log.timestamp,
                    'service': log.service,
                    'level': log.level,
                    'message': log.message,
                    'is_first_occurrence': True,
                    'anomaly_score': self._calculate_message_anomaly_score(log)
                })
                seen_messages.add(message_signature)
        
        # Sort by anomaly score
        anomalous.sort(key=lambda x: x['anomaly_score'], reverse=True)
        return anomalous[:10]  # Top 10 anomalous messages
    
    async def _analyze_stack_traces(self, logs: List[LogEvent]) -> Dict[str, Any]:
        """Analyze stack traces for common failure points"""
        stack_trace_logs = [log for log in logs if log.stack_trace]
        
        if not stack_trace_logs:
            return {}
        
        # Extract common stack trace patterns
        trace_patterns = defaultdict(int)
        for log in stack_trace_logs:
            # Extract key lines from stack trace (simplified)
            lines = log.stack_trace.split('\n')
            key_lines = [line.strip() for line in lines if 'at ' in line or 'in ' in line][:3]
            pattern = ' -> '.join(key_lines)
            trace_patterns[pattern] += 1
        
        # Find most common patterns
        common_patterns = sorted(trace_patterns.items(), key=lambda x: x[1], reverse=True)[:5]
        
        return {
            'total_stack_traces': len(stack_trace_logs),
            'common_patterns': [
                {'pattern': pattern, 'count': count}
                for pattern, count in common_patterns
            ],
            'unique_patterns': len(trace_patterns)
        }
    
    async def _analyze_correlations(self, logs: List[LogEvent]) -> List[Dict[str, Any]]:
        """Analyze correlations between log events"""
        correlations = []
        
        # Group logs by correlation ID
        correlation_groups = defaultdict(list)
        for log in logs:
            if log.correlation_id:
                correlation_groups[log.correlation_id].append(log)
        
        # Analyze each correlation group
        for corr_id, group_logs in correlation_groups.items():
            if len(group_logs) >= 2:
                error_logs = [log for log in group_logs if log.level in ['ERROR', 'CRITICAL']]
                if error_logs:
                    correlations.append({
                        'correlation_id': corr_id,
                        'total_logs': len(group_logs),
                        'error_logs': len(error_logs),
                        'services_involved': list(set(log.service for log in group_logs)),
                        'time_span': (
                            max(log.timestamp for log in group_logs) - 
                            min(log.timestamp for log in group_logs)
                        ).total_seconds(),
                        'first_error': min(log.timestamp for log in error_logs)
                    })
        
        # Sort by number of errors
        correlations.sort(key=lambda x: x['error_logs'], reverse=True)
        return correlations
    
    async def _analyze_log_volume(self, logs: List[LogEvent]) -> Dict[str, Any]:
        """Analyze log volume patterns"""
        if not logs:
            return {}
        
        # Group by service and level
        service_volumes = defaultdict(lambda: defaultdict(int))
        for log in logs:
            service_volumes[log.service][log.level] += 1
        
        # Find services with unusual error volumes
        high_error_services = []
        for service, levels in service_volumes.items():
            error_count = levels.get('ERROR', 0) + levels.get('CRITICAL', 0)
            total_count = sum(levels.values())
            
            if total_count > 0:
                error_ratio = error_count / total_count
                if error_ratio > 0.1:  # More than 10% errors
                    high_error_services.append({
                        'service': service,
                        'total_logs': total_count,
                        'error_logs': error_count,
                        'error_ratio': error_ratio
                    })
        
        return {
            'total_logs': len(logs),
            'services_analyzed': len(service_volumes),
            'high_error_services': sorted(high_error_services, key=lambda x: x['error_ratio'], reverse=True)
        }
    
    async def _analyze_service_errors(self, logs: List[LogEvent]) -> Dict[str, Any]:
        """Analyze error distribution across services"""
        service_errors = defaultdict(list)
        
        for log in logs:
            if log.level in ['ERROR', 'CRITICAL', 'FATAL']:
                service_errors[log.service].append(log)
        
        service_analysis = {}
        for service, errors in service_errors.items():
            if errors:
                service_analysis[service] = {
                    'error_count': len(errors),
                    'first_error': min(log.timestamp for log in errors),
                    'last_error': max(log.timestamp for log in errors),
                    'unique_errors': len(set(self._generate_error_signature(log.message) for log in errors)),
                    'error_rate_per_minute': len(errors) / max(1, (
                        max(log.timestamp for log in errors) - 
                        min(log.timestamp for log in errors)
                    ).total_seconds() / 60)
                }
        
        return service_analysis
    
    def _generate_error_signature(self, message: str) -> str:
        """Generate a signature for error message grouping"""
        # Remove variable parts (numbers, timestamps, IDs)
        signature = re.sub(r'\d+', 'X', message)
        signature = re.sub(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', 'UUID', signature)
        signature = re.sub(r'\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}', 'TIMESTAMP', signature)
        signature = re.sub(r'\s+', ' ', signature).strip()
        return signature[:200]  # Limit length
    
    def _calculate_message_anomaly_score(self, log: LogEvent) -> float:
        """Calculate anomaly score for a log message"""
        score = 0.0
        
        # Higher score for more severe levels
        level_scores = {'CRITICAL': 1.0, 'FATAL': 1.0, 'ERROR': 0.8, 'WARN': 0.4, 'INFO': 0.1}
        score += level_scores.get(log.level, 0.1)
        
        # Higher score for stack traces
        if log.stack_trace:
            score += 0.5
        
        # Higher score for certain keywords
        critical_keywords = ['timeout', 'connection', 'failed', 'exception', 'null', 'memory', 'disk']
        message_lower = log.message.lower()
        for keyword in critical_keywords:
            if keyword in message_lower:
                score += 0.2
        
        return min(score, 1.0)

class RootCauseAnalysisEngine:
    def __init__(self):
        self.dependency_analyzer = DependencyAnalyzer()
        self.timeline_analyzer = TimelineAnalyzer()
        self.log_analyzer = LogAnalyzer()
        self.known_patterns = {}
        self.historical_incidents = []
        
    async def analyze_incident(self, incident: Incident,
                              metrics: List[MetricAnomaly],
                              logs: List[LogEvent],
                              deployments: List[DeploymentEvent]) -> List[RootCause]:
        """Perform comprehensive root cause analysis"""
        
        # Collect all evidence
        evidence_collection = await self._collect_evidence(incident, metrics, logs, deployments)
        
        # Analyze dependencies
        dependency_analysis = await self._analyze_dependencies(incident)
        
        # Analyze timeline
        timeline_analysis = await self.timeline_analyzer.analyze_timeline(
            incident.start_time, incident.end_time
        )
        
        # Analyze logs
        log_analysis = await self.log_analyzer.analyze_logs(
            logs, (incident.start_time, incident.end_time or datetime.now())
        )
        
        # Generate hypotheses
        hypotheses = await self._generate_hypotheses(
            incident, evidence_collection, dependency_analysis, 
            timeline_analysis, log_analysis
        )
        
        # Score and rank hypotheses
        ranked_causes = await self._rank_hypotheses(hypotheses, evidence_collection)
        
        # Enrich with recommendations
        enriched_causes = await self._enrich_with_recommendations(ranked_causes)
        
        return enriched_causes
    
    async def _collect_evidence(self, incident: Incident,
                               metrics: List[MetricAnomaly],
                               logs: List[LogEvent],
                               deployments: List[DeploymentEvent]) -> List[Evidence]:
        """Collect all available evidence"""
        evidence = []
        
        # Evidence from metric anomalies
        for anomaly in metrics:
            if (incident.start_time - timedelta(minutes=30) <= 
                anomaly.timestamp <= 
                (incident.end_time or datetime.now()) + timedelta(minutes=30)):
                
                evidence.append(Evidence(
                    evidence_id=str(uuid.uuid4()),
                    evidence_type=EvidenceType.METRIC_ANOMALY,
                    description=f"Anomaly in {anomaly.metric_name}: {anomaly.value} (expected {anomaly.expected_value})",
                    relevance_score=self._calculate_metric_relevance(anomaly, incident),
                    confidence=0.8,
                    timestamp=anomaly.timestamp,
                    source=anomaly.service,
                    details={
                        'metric_name': anomaly.metric_name,
                        'value': anomaly.value,
                        'expected_value': anomaly.expected_value,
                        'deviation': anomaly.deviation,
                        'anomaly_type': anomaly.anomaly_type
                    },
                    related_components=[anomaly.service]
                ))
        
        # Evidence from deployments
        for deployment in deployments:
            time_diff = abs((deployment.timestamp - incident.start_time).total_seconds())
            if time_diff <= 3600:  # Within 1 hour
                relevance = max(0.1, 1.0 - (time_diff / 3600))
                
                evidence.append(Evidence(
                    evidence_id=str(uuid.uuid4()),
                    evidence_type=EvidenceType.DEPLOYMENT_TIMELINE,
                    description=f"Deployment of {deployment.service} from {deployment.version_from} to {deployment.version_to}",
                    relevance_score=relevance,
                    confidence=0.9,
                    timestamp=deployment.timestamp,
                    source=deployment.service,
                    details={
                        'deployment_id': deployment.deployment_id,
                        'version_from': deployment.version_from,
                        'version_to': deployment.version_to,
                        'deployment_type': deployment.deployment_type,
                        'status': deployment.status,
                        'changes': deployment.changes
                    },
                    related_components=[deployment.service]
                ))
        
        # Evidence from logs
        error_logs = [log for log in logs if log.level in ['ERROR', 'CRITICAL', 'FATAL']]
        if error_logs:
            # Group by service
            service_errors = defaultdict(list)
            for log in error_logs:
                service_errors[log.service].append(log)
            
            for service, service_logs in service_errors.items():
                if len(service_logs) >= 3:  # Significant error volume
                    evidence.append(Evidence(
                        evidence_id=str(uuid.uuid4()),
                        evidence_type=EvidenceType.LOG_PATTERN,
                        description=f"High error volume in {service}: {len(service_logs)} errors",
                        relevance_score=min(1.0, len(service_logs) / 10),
                        confidence=0.7,
                        timestamp=service_logs[0].timestamp,
                        source=service,
                        details={
                            'error_count': len(service_logs),
                            'sample_errors': [log.message for log in service_logs[:3]]
                        },
                        related_components=[service]
                    ))
        
        return evidence
    
    async def _analyze_dependencies(self, incident: Incident) -> Dict[str, Any]:
        """Analyze service dependencies for failure propagation"""
        dependency_analysis = {}
        
        for service in incident.affected_services:
            analysis = await self.dependency_analyzer.analyze_failure_propagation(service)
            if analysis:
                dependency_analysis[service] = analysis
        
        return dependency_analysis
    
    async def _generate_hypotheses(self, incident: Incident,
                                  evidence: List[Evidence],
                                  dependency_analysis: Dict[str, Any],
                                  timeline_analysis: Dict[str, Any],
                                  log_analysis: Dict[str, Any]) -> List[RootCause]:
        """Generate root cause hypotheses"""
        hypotheses = []
        
        # Hypothesis 1: Deployment-related issue
        deployment_evidence = [e for e in evidence if e.evidence_type == EvidenceType.DEPLOYMENT_TIMELINE]
        if deployment_evidence:
            for dep_evidence in deployment_evidence:
                if dep_evidence.relevance_score > 0.5:
                    hypotheses.append(RootCause(
                        cause_id=str(uuid.uuid4()),
                        cause_type=CauseType.CODE_CHANGE,
                        description=f"Issue introduced by deployment: {dep_evidence.description}",
                        confidence=ConfidenceLevel.HIGH if dep_evidence.relevance_score > 0.8 else ConfidenceLevel.MEDIUM,
                        probability=dep_evidence.relevance_score,
                        impact_score=self._calculate_impact_score(incident),
                        time_to_detection=incident.detection_time - incident.start_time,
                        affected_components=dep_evidence.related_components,
                        evidence=[dep_evidence],
                        recommended_actions=[
                            "Review deployment changes",
                            "Consider rollback if issue persists",
                            "Analyze deployment logs for errors"
                        ],
                        prevention_measures=[
                            "Implement better pre-deployment testing",
                            "Use canary deployments",
                            "Add deployment health checks"
                        ]
                    ))
        
        # Hypothesis 2: Resource exhaustion
        resource_anomalies = [
            e for e in evidence 
            if (e.evidence_type == EvidenceType.METRIC_ANOMALY and 
                any(keyword in e.description.lower() for keyword in ['cpu', 'memory', 'disk', 'connection']))
        ]
        if resource_anomalies:
            hypotheses.append(RootCause(
                cause_id=str(uuid.uuid4()),
                cause_type=CauseType.RESOURCE_EXHAUSTION,
                description="Resource exhaustion detected in system metrics",
                confidence=ConfidenceLevel.MEDIUM,
                probability=len(resource_anomalies) / max(1, len(evidence)),
                impact_score=self._calculate_impact_score(incident),
                time_to_detection=incident.detection_time - incident.start_time,
                affected_components=list(set().union(*[e.related_components for e in resource_anomalies])),
                evidence=resource_anomalies,
                recommended_actions=[
                    "Scale up affected resources",
                    "Identify resource-intensive processes",
                    "Implement resource monitoring alerts"
                ],
                prevention_measures=[
                    "Set up proactive capacity monitoring",
                    "Implement auto-scaling",
                    "Regular capacity planning reviews"
                ]
            ))
        
        # Hypothesis 3: Dependency failure
        if dependency_analysis:
            for service, analysis in dependency_analysis.items():
                if analysis.get('cascade_probability', 0) > 0.3:
                    hypotheses.append(RootCause(
                        cause_id=str(uuid.uuid4()),
                        cause_type=CauseType.EXTERNAL_DEPENDENCY,
                        description=f"Dependency failure in {service} causing cascade",
                        confidence=ConfidenceLevel.MEDIUM,
                        probability=analysis['cascade_probability'],
                        impact_score=self._calculate_impact_score(incident),
                        time_to_detection=incident.detection_time - incident.start_time,
                        affected_components=[service] + [d['service'] for d in analysis.get('directly_impacted', [])],
                        evidence=[e for e in evidence if service in e.related_components],
                        recommended_actions=[
                            f"Check health of {service}",
                            "Verify network connectivity",
                            "Review dependency timeouts"
                        ],
                        prevention_measures=[
                            "Implement circuit breakers",
                            "Add dependency health checks",
                            "Set up dependency monitoring"
                        ]
                    ))
        
        # Hypothesis 4: Configuration error
        config_indicators = [
            e for e in evidence
            if any(keyword in e.description.lower() for keyword in ['config', 'setting', 'parameter'])
        ]
        if config_indicators or timeline_analysis.get('causal_sequences'):
            hypotheses.append(RootCause(
                cause_id=str(uuid.uuid4()),
                cause_type=CauseType.CONFIGURATION_CHANGE,
                description="Configuration change may have caused the issue",
                confidence=ConfidenceLevel.LOW,
                probability=0.4,
                impact_score=self._calculate_impact_score(incident),
                time_to_detection=incident.detection_time - incident.start_time,
                affected_components=incident.affected_services,
                evidence=config_indicators,
                recommended_actions=[
                    "Review recent configuration changes",
                    "Compare current config with last known good",
                    "Check configuration validation"
                ],
                prevention_measures=[
                    "Implement configuration version control",
                    "Add configuration validation",
                    "Use configuration management tools"
                ]
            ))
        
        return hypotheses
    
    async def _rank_hypotheses(self, hypotheses: List[RootCause], 
                              evidence: List[Evidence]) -> List[RootCause]:
        """Rank hypotheses by likelihood and supporting evidence"""
        for hypothesis in hypotheses:
            # Calculate score based on evidence, probability, and confidence
            evidence_score = sum(e.relevance_score * e.confidence for e in hypothesis.evidence)
            evidence_score = evidence_score / max(1, len(hypothesis.evidence))
            
            # Combine scores
            confidence_multiplier = {'high': 1.0, 'medium': 0.8, 'low': 0.6}[hypothesis.confidence.value]
            final_score = (hypothesis.probability * 0.4 + evidence_score * 0.4 + confidence_multiplier * 0.2)
            
            hypothesis.metadata['final_score'] = final_score
        
        # Sort by final score
        hypotheses.sort(key=lambda h: h.metadata.get('final_score', 0), reverse=True)
        return hypotheses
    
    async def _enrich_with_recommendations(self, causes: List[RootCause]) -> List[RootCause]:
        """Enrich root causes with detailed recommendations"""
        for cause in causes:
            # Add similar incidents
            cause.similar_incidents = await self._find_similar_incidents(cause)
            
            # Enhance recommendations based on cause type
            if cause.cause_type == CauseType.CODE_CHANGE:
                cause.recommended_actions.extend([
                    "Run regression tests",
                    "Check code diff for potential issues",
                    "Verify database migrations if any"
                ])
            elif cause.cause_type == CauseType.RESOURCE_EXHAUSTION:
                cause.recommended_actions.extend([
                    "Monitor resource trends",
                    "Check for memory leaks",
                    "Analyze query performance"
                ])
        
        return causes
    
    def _calculate_metric_relevance(self, anomaly: MetricAnomaly, incident: Incident) -> float:
        """Calculate how relevant a metric anomaly is to the incident"""
        relevance = 0.5  # Base relevance
        
        # Higher relevance if service is affected
        if anomaly.service in incident.affected_services:
            relevance += 0.3
        
        # Higher relevance for timing proximity
        time_diff = abs((anomaly.timestamp - incident.start_time).total_seconds())
        if time_diff <= 300:  # Within 5 minutes
            relevance += 0.2
        elif time_diff <= 900:  # Within 15 minutes
            relevance += 0.1
        
        # Higher relevance for severe anomalies
        if anomaly.severity in ['critical', 'high']:
            relevance += 0.2
        
        return min(1.0, relevance)
    
    def _calculate_impact_score(self, incident: Incident) -> float:
        """Calculate impact score based on incident characteristics"""
        impact = 0.5  # Base impact
        
        # Impact based on number of affected services
        service_factor = min(len(incident.affected_services) / 10, 0.3)
        impact += service_factor
        
        # Impact based on severity
        severity_scores = {'critical': 0.4, 'high': 0.3, 'medium': 0.2, 'low': 0.1}
        impact += severity_scores.get(incident.severity.lower(), 0.1)
        
        # Impact based on duration
        if incident.end_time:
            duration_hours = (incident.end_time - incident.start_time).total_seconds() / 3600
            duration_factor = min(duration_hours / 24, 0.2)  # Up to 20% for duration
            impact += duration_factor
        
        return min(1.0, impact)
    
    async def _find_similar_incidents(self, cause: RootCause) -> List[str]:
        """Find similar historical incidents"""
        similar = []
        
        for incident in self.historical_incidents:
            # Simple similarity based on cause type and affected components
            if (hasattr(incident, 'root_cause_type') and 
                incident.root_cause_type == cause.cause_type):
                
                # Check component overlap
                incident_components = set(incident.get('affected_components', []))
                cause_components = set(cause.affected_components)
                overlap = len(incident_components & cause_components)
                
                if overlap > 0:
                    similar.append(incident.get('incident_id', 'unknown'))
        
        return similar[:5]  # Return top 5 similar incidents

# Example usage
async def main():
    # Create root cause analysis engine
    rca_engine = RootCauseAnalysisEngine()
    
    # Add some service dependencies
    dependencies = [
        ServiceDependency("api", "database", "sync", 0.9, 50.0, ["timeout", "connection_error"]),
        ServiceDependency("frontend", "api", "sync", 0.8, 200.0, ["http_error", "timeout"]),
        ServiceDependency("api", "cache", "sync", 0.6, 10.0, ["miss", "timeout"]),
        ServiceDependency("worker", "queue", "async", 0.7, 5.0, ["queue_full", "timeout"])
    ]
    
    for dep in dependencies:
        rca_engine.dependency_analyzer.add_dependency(dep)
    
    # Create sample incident
    incident = Incident(
        incident_id="INC-2024-001",
        incident_type=IncidentType.PERFORMANCE_DEGRADATION,
        title="API Response Time Spike",
        description="Significant increase in API response times",
        start_time=datetime.now() - timedelta(hours=2),
        detection_time=datetime.now() - timedelta(hours=1, minutes=45),
        end_time=datetime.now() - timedelta(minutes=30),
        severity="high",
        affected_services=["api", "frontend"],
        symptoms=["Slow response times", "User complaints", "Timeout errors"]
    )
    
    # Create sample metrics
    metrics = [
        MetricAnomaly(
            metric_name="response_time",
            service="api",
            timestamp=datetime.now() - timedelta(hours=1, minutes=50),
            value=2500.0,
            expected_value=200.0,
            deviation=2300.0,
            severity="high",
            anomaly_type="spike"
        ),
        MetricAnomaly(
            metric_name="cpu_usage",
            service="api",
            timestamp=datetime.now() - timedelta(hours=1, minutes=45),
            value=95.0,
            expected_value=60.0,
            deviation=35.0,
            severity="critical",
            anomaly_type="spike"
        )
    ]
    
    # Create sample logs
    logs = [
        LogEvent(
            timestamp=datetime.now() - timedelta(hours=1, minutes=50),
            service="api",
            level="ERROR",
            message="Database connection timeout after 30s",
            structured_data={"query_time": 30000, "connection_pool": "exhausted"},
            error_signature="db_timeout"
        ),
        LogEvent(
            timestamp=datetime.now() - timedelta(hours=1, minutes=48),
            service="api",
            level="ERROR",
            message="Failed to process request: Connection timeout",
            structured_data={"endpoint": "/users", "request_id": "req-123"},
            stack_trace="at DatabaseClient.query()\nat UserService.getUsers()"
        )
    ]
    
    # Create sample deployment
    deployments = [
        DeploymentEvent(
            deployment_id="deploy-123",
            service="api",
            timestamp=datetime.now() - timedelta(hours=2, minutes=30),
            version_from="v1.2.3",
            version_to="v1.2.4",
            deployment_type="rolling",
            status="success",
            changes=[
                {"type": "feature", "description": "Added new user search endpoint"},
                {"type": "fix", "description": "Fixed memory leak in connection pool"}
            ]
        )
    ]
    
    # Perform root cause analysis
    root_causes = await rca_engine.analyze_incident(incident, metrics, logs, deployments)
    
    print("Root Cause Analysis Results:")
    print("=" * 50)
    
    for i, cause in enumerate(root_causes, 1):
        print(f"\n{i}. Root Cause: {cause.description}")
        print(f"   Type: {cause.cause_type.value}")
        print(f"   Confidence: {cause.confidence.value}")
        print(f"   Probability: {cause.probability:.2%}")
        print(f"   Impact Score: {cause.impact_score:.2f}")
        print(f"   Affected Components: {', '.join(cause.affected_components)}")
        print(f"   Evidence Count: {len(cause.evidence)}")
        
        if cause.evidence:
            print("   Key Evidence:")
            for evidence in cause.evidence[:3]:
                print(f"     - {evidence.description} (relevance: {evidence.relevance_score:.2f})")
        
        print("   Recommended Actions:")
        for action in cause.recommended_actions[:3]:
            print(f"     - {action}")

if __name__ == "__main__":
    asyncio.run(main())