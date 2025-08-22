#!/usr/bin/env python3
"""
Zero-Trust Security Architecture Implementation
Implements comprehensive zero-trust security model with never trust, always verify principles
"""

import os
import json
import hashlib
import time
import jwt
import secrets
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from collections import defaultdict, deque
import threading
import ipaddress
import re
import base64

class TrustLevel(Enum):
    """Trust levels in zero-trust model"""
    UNTRUSTED = "untrusted"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERIFIED = "verified"

class AuthenticationMethod(Enum):
    """Authentication methods"""
    PASSWORD = "password"
    MFA = "mfa"
    BIOMETRIC = "biometric"
    CERTIFICATE = "certificate"
    HARDWARE_TOKEN = "hardware_token"
    SAML = "saml"
    OAUTH = "oauth"
    KERBEROS = "kerberos"

class ResourceSensitivity(Enum):
    """Resource sensitivity levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    SENSITIVE = "sensitive"
    CONFIDENTIAL = "confidential"
    TOP_SECRET = "top_secret"

class PolicyAction(Enum):
    """Policy enforcement actions"""
    ALLOW = "allow"
    DENY = "deny"
    CHALLENGE = "challenge"
    MONITOR = "monitor"
    REDIRECT = "redirect"
    QUARANTINE = "quarantine"

class RiskScore(Enum):
    """Risk score levels"""
    VERY_LOW = 0
    LOW = 25
    MEDIUM = 50
    HIGH = 75
    CRITICAL = 100

@dataclass
class Identity:
    """Identity representation in zero-trust model"""
    id: str
    username: str
    email: str
    display_name: str
    identity_type: str  # user, service, device, application
    trust_level: TrustLevel
    authentication_methods: List[AuthenticationMethod]
    attributes: Dict[str, Any]
    roles: List[str]
    groups: List[str]
    created_at: datetime
    last_authenticated: Optional[datetime]
    authentication_history: List[Dict]
    risk_score: int
    is_active: bool
    requires_mfa: bool
    allowed_locations: List[str]
    device_fingerprints: List[str]
    tags: Dict[str, str]

@dataclass
class Device:
    """Device representation for device trust"""
    id: str
    device_name: str
    device_type: str  # laptop, mobile, server, iot
    owner_id: str
    fingerprint: str
    trust_level: TrustLevel
    operating_system: str
    os_version: str
    last_seen: datetime
    ip_addresses: List[str]
    mac_addresses: List[str]
    certificates: List[str]
    compliance_status: str  # compliant, non_compliant, unknown
    security_policies: List[str]
    installed_software: List[Dict]
    vulnerability_scan_results: List[Dict]
    encryption_status: str
    antivirus_status: str
    patch_level: str
    risk_score: int
    is_managed: bool
    location: Optional[str]
    metadata: Dict[str, Any]

@dataclass
class NetworkSegment:
    """Network segment for micro-segmentation"""
    id: str
    name: str
    description: str
    cidr_blocks: List[str]
    zone_type: str  # dmz, internal, restricted, quarantine
    trust_level: TrustLevel
    allowed_protocols: List[str]
    security_policies: List[str]
    monitoring_enabled: bool
    encryption_required: bool
    access_logs_retention: int
    firewall_rules: List[Dict]
    intrusion_detection: bool
    data_classification: ResourceSensitivity
    compliance_requirements: List[str]
    connected_segments: List[str]
    created_at: datetime
    updated_at: datetime

@dataclass
class AccessPolicy:
    """Zero-trust access policy"""
    id: str
    name: str
    description: str
    priority: int
    enabled: bool
    conditions: Dict[str, Any]
    action: PolicyAction
    resource_patterns: List[str]
    identity_patterns: List[str]
    device_requirements: Dict[str, Any]
    location_restrictions: List[str]
    time_restrictions: Dict[str, Any]
    risk_threshold: int
    authentication_requirements: List[AuthenticationMethod]
    session_controls: Dict[str, Any]
    monitoring_level: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    last_matched: Optional[datetime]
    match_count: int

@dataclass
class AccessRequest:
    """Access request for evaluation"""
    id: str
    identity_id: str
    device_id: Optional[str]
    resource: str
    action: str
    source_ip: str
    user_agent: Optional[str]
    timestamp: datetime
    context: Dict[str, Any]
    risk_factors: List[str]
    calculated_risk: int
    trust_score: float
    authentication_method: Optional[AuthenticationMethod]
    session_id: Optional[str]
    location: Optional[str]
    decision: Optional[PolicyAction]
    policy_matched: Optional[str]
    additional_verification_required: bool
    decision_time: Optional[datetime]
    decision_latency_ms: Optional[float]

@dataclass
class SecurityEvent:
    """Security event for monitoring"""
    id: str
    event_type: str
    severity: str
    source: str
    identity_id: Optional[str]
    device_id: Optional[str]
    resource: str
    description: str
    indicators: List[str]
    risk_score: int
    timestamp: datetime
    resolved: bool
    resolution_notes: Optional[str]
    false_positive: bool
    investigation_status: str
    related_events: List[str]
    context: Dict[str, Any]

class ZeroTrustEngine:
    """Main zero-trust security engine"""
    
    def __init__(self):
        self.identities: Dict[str, Identity] = {}
        self.devices: Dict[str, Device] = {}
        self.network_segments: Dict[str, NetworkSegment] = {}
        self.access_policies: Dict[str, AccessPolicy] = {}
        self.security_events: Dict[str, SecurityEvent] = {}
        
        # Request processing
        self.access_requests: deque = deque(maxlen=10000)
        self.active_sessions: Dict[str, Dict] = {}
        
        # Risk and trust scoring
        self.risk_calculator = RiskCalculator()
        self.trust_evaluator = TrustEvaluator()
        
        # Policy engine
        self.policy_engine = PolicyEngine()
        
        # Monitoring and analytics
        self.monitoring_active = False
        self.event_queue = deque(maxlen=5000)
        
        # Initialize sample data
        self._initialize_sample_data()
    
    def _initialize_sample_data(self):
        """Initialize sample zero-trust data"""
        
        # Sample identities
        admin_identity = Identity(
            id="admin_001",
            username="admin",
            email="admin@company.com",
            display_name="System Administrator",
            identity_type="user",
            trust_level=TrustLevel.HIGH,
            authentication_methods=[AuthenticationMethod.MFA, AuthenticationMethod.CERTIFICATE],
            attributes={"department": "IT", "clearance_level": "high", "contractor": False},
            roles=["admin", "security_admin"],
            groups=["administrators", "security_team"],
            created_at=datetime.now() - timedelta(days=365),
            last_authenticated=datetime.now() - timedelta(hours=2),
            authentication_history=[
                {"timestamp": datetime.now() - timedelta(hours=2), "method": "mfa", "success": True},
                {"timestamp": datetime.now() - timedelta(hours=6), "method": "mfa", "success": True}
            ],
            risk_score=15,
            is_active=True,
            requires_mfa=True,
            allowed_locations=["headquarters", "remote"],
            device_fingerprints=["fp_admin_laptop_001", "fp_admin_mobile_001"],
            tags={"role": "administrator", "clearance": "high"}
        )
        self.add_identity(admin_identity)
        
        # Regular user identity
        user_identity = Identity(
            id="user_001",
            username="jdoe",
            email="john.doe@company.com",
            display_name="John Doe",
            identity_type="user",
            trust_level=TrustLevel.MEDIUM,
            authentication_methods=[AuthenticationMethod.PASSWORD, AuthenticationMethod.MFA],
            attributes={"department": "Engineering", "clearance_level": "standard", "contractor": False},
            roles=["developer", "user"],
            groups=["engineering", "developers"],
            created_at=datetime.now() - timedelta(days=200),
            last_authenticated=datetime.now() - timedelta(minutes=30),
            authentication_history=[
                {"timestamp": datetime.now() - timedelta(minutes=30), "method": "password", "success": True},
                {"timestamp": datetime.now() - timedelta(hours=8), "method": "mfa", "success": True}
            ],
            risk_score=35,
            is_active=True,
            requires_mfa=False,
            allowed_locations=["headquarters", "home"],
            device_fingerprints=["fp_user_laptop_001"],
            tags={"role": "developer", "department": "engineering"}
        )
        self.add_identity(user_identity)
        
        # Service identity
        service_identity = Identity(
            id="service_api_001",
            username="api-service",
            email="api-service@company.com",
            display_name="API Service",
            identity_type="service",
            trust_level=TrustLevel.VERIFIED,
            authentication_methods=[AuthenticationMethod.CERTIFICATE],
            attributes={"service_type": "api", "environment": "production"},
            roles=["service", "api_access"],
            groups=["services", "production"],
            created_at=datetime.now() - timedelta(days=100),
            last_authenticated=datetime.now() - timedelta(minutes=5),
            authentication_history=[],
            risk_score=10,
            is_active=True,
            requires_mfa=False,
            allowed_locations=["datacenter"],
            device_fingerprints=["fp_api_server_001"],
            tags={"type": "service", "environment": "production"}
        )
        self.add_identity(service_identity)
        
        # Sample devices
        admin_laptop = Device(
            id="device_laptop_001",
            device_name="Admin-Laptop-001",
            device_type="laptop",
            owner_id="admin_001",
            fingerprint="fp_admin_laptop_001",
            trust_level=TrustLevel.HIGH,
            operating_system="Windows",
            os_version="11.0.22000",
            last_seen=datetime.now() - timedelta(hours=1),
            ip_addresses=["192.168.1.100", "10.0.1.50"],
            mac_addresses=["00:1B:44:11:3A:B7"],
            certificates=["cert_device_001"],
            compliance_status="compliant",
            security_policies=["corporate_laptop_policy"],
            installed_software=[
                {"name": "Endpoint Protection", "version": "2.1.5", "status": "active"},
                {"name": "VPN Client", "version": "1.8.2", "status": "active"}
            ],
            vulnerability_scan_results=[
                {"scan_date": datetime.now() - timedelta(days=1), "critical": 0, "high": 0, "medium": 2, "low": 5}
            ],
            encryption_status="encrypted",
            antivirus_status="active",
            patch_level="current",
            risk_score=20,
            is_managed=True,
            location="headquarters",
            metadata={"asset_tag": "LAPTOP-001", "purchase_date": "2023-01-15"}
        )
        self.add_device(admin_laptop)
        
        # Sample network segments
        dmz_segment = NetworkSegment(
            id="segment_dmz",
            name="DMZ Segment",
            description="Demilitarized zone for external-facing services",
            cidr_blocks=["10.0.100.0/24"],
            zone_type="dmz",
            trust_level=TrustLevel.LOW,
            allowed_protocols=["HTTP", "HTTPS", "DNS"],
            security_policies=["dmz_security_policy"],
            monitoring_enabled=True,
            encryption_required=True,
            access_logs_retention=90,
            firewall_rules=[
                {"rule": "allow_inbound_https", "action": "allow", "port": 443, "protocol": "tcp"}
            ],
            intrusion_detection=True,
            data_classification=ResourceSensitivity.INTERNAL,
            compliance_requirements=["SOC2", "ISO27001"],
            connected_segments=["segment_internal"],
            created_at=datetime.now() - timedelta(days=30),
            updated_at=datetime.now() - timedelta(days=1)
        )
        self.add_network_segment(dmz_segment)
        
        # Internal segment
        internal_segment = NetworkSegment(
            id="segment_internal",
            name="Internal Corporate Network",
            description="Internal corporate network for employees",
            cidr_blocks=["10.0.10.0/24", "10.0.11.0/24"],
            zone_type="internal",
            trust_level=TrustLevel.MEDIUM,
            allowed_protocols=["HTTP", "HTTPS", "SSH", "RDP", "DNS", "NTP"],
            security_policies=["internal_security_policy"],
            monitoring_enabled=True,
            encryption_required=False,
            access_logs_retention=30,
            firewall_rules=[
                {"rule": "allow_internal_communication", "action": "allow", "source": "internal", "destination": "internal"}
            ],
            intrusion_detection=True,
            data_classification=ResourceSensitivity.INTERNAL,
            compliance_requirements=["SOC2"],
            connected_segments=["segment_dmz", "segment_restricted"],
            created_at=datetime.now() - timedelta(days=60),
            updated_at=datetime.now() - timedelta(days=5)
        )
        self.add_network_segment(internal_segment)
        
        # Sample access policies
        admin_policy = AccessPolicy(
            id="policy_admin_access",
            name="Administrator Access Policy",
            description="High privilege access for administrators",
            priority=1,
            enabled=True,
            conditions={
                "identity_roles": ["admin", "security_admin"],
                "trust_level_min": TrustLevel.HIGH.value,
                "mfa_required": True,
                "device_managed": True
            },
            action=PolicyAction.ALLOW,
            resource_patterns=["/*"],
            identity_patterns=["admin_*", "*@company.com"],
            device_requirements={
                "compliance_status": "compliant",
                "encryption_required": True,
                "antivirus_required": True
            },
            location_restrictions=["headquarters", "secure_facility"],
            time_restrictions={
                "business_hours_only": False,
                "max_session_duration": 480  # 8 hours
            },
            risk_threshold=50,
            authentication_requirements=[AuthenticationMethod.MFA],
            session_controls={
                "max_concurrent_sessions": 3,
                "idle_timeout": 30,
                "require_reauth": True
            },
            monitoring_level="high",
            created_by="security_admin",
            created_at=datetime.now() - timedelta(days=90),
            updated_at=datetime.now() - timedelta(days=10),
            last_matched=datetime.now() - timedelta(hours=2),
            match_count=145
        )
        self.add_access_policy(admin_policy)
        
        # User access policy
        user_policy = AccessPolicy(
            id="policy_user_access",
            name="Standard User Access Policy",
            description="Standard access for regular users",
            priority=10,
            enabled=True,
            conditions={
                "identity_roles": ["user", "developer"],
                "trust_level_min": TrustLevel.MEDIUM.value,
                "business_hours_only": True
            },
            action=PolicyAction.ALLOW,
            resource_patterns=["/api/*", "/dashboard/*", "/docs/*"],
            identity_patterns=["*@company.com"],
            device_requirements={
                "compliance_status": "compliant"
            },
            location_restrictions=["headquarters", "home", "remote"],
            time_restrictions={
                "business_hours_only": True,
                "max_session_duration": 480
            },
            risk_threshold=75,
            authentication_requirements=[AuthenticationMethod.PASSWORD],
            session_controls={
                "max_concurrent_sessions": 2,
                "idle_timeout": 60
            },
            monitoring_level="medium",
            created_by="security_admin",
            created_at=datetime.now() - timedelta(days=60),
            updated_at=datetime.now() - timedelta(days=5),
            last_matched=datetime.now() - timedelta(minutes=15),
            match_count=2847
        )
        self.add_access_policy(user_policy)
        
        # Restrictive policy for sensitive resources
        sensitive_policy = AccessPolicy(
            id="policy_sensitive_access",
            name="Sensitive Resource Access Policy",
            description="Restricted access to sensitive resources",
            priority=5,
            enabled=True,
            conditions={
                "clearance_level": "high",
                "trust_level_min": TrustLevel.HIGH.value,
                "mfa_required": True,
                "location_verified": True
            },
            action=PolicyAction.CHALLENGE,
            resource_patterns=["/admin/*", "/security/*", "/finance/*"],
            identity_patterns=["admin_*", "security_*"],
            device_requirements={
                "compliance_status": "compliant",
                "encryption_required": True,
                "managed_device": True
            },
            location_restrictions=["headquarters"],
            time_restrictions={
                "business_hours_only": True,
                "max_session_duration": 240  # 4 hours
            },
            risk_threshold=25,
            authentication_requirements=[AuthenticationMethod.MFA, AuthenticationMethod.BIOMETRIC],
            session_controls={
                "max_concurrent_sessions": 1,
                "idle_timeout": 15,
                "continuous_verification": True
            },
            monitoring_level="maximum",
            created_by="ciso",
            created_at=datetime.now() - timedelta(days=120),
            updated_at=datetime.now() - timedelta(days=15),
            last_matched=datetime.now() - timedelta(hours=4),
            match_count=67
        )
        self.add_access_policy(sensitive_policy)
    
    def add_identity(self, identity: Identity) -> bool:
        """Add identity to zero-trust system"""
        self.identities[identity.id] = identity
        print(f"✅ Added identity: {identity.display_name} ({identity.identity_type})")
        return True
    
    def add_device(self, device: Device) -> bool:
        """Add device to zero-trust system"""
        self.devices[device.id] = device
        print(f"✅ Added device: {device.device_name} ({device.device_type})")
        return True
    
    def add_network_segment(self, segment: NetworkSegment) -> bool:
        """Add network segment"""
        self.network_segments[segment.id] = segment
        print(f"✅ Added network segment: {segment.name} ({segment.zone_type})")
        return True
    
    def add_access_policy(self, policy: AccessPolicy) -> bool:
        """Add access policy"""
        self.access_policies[policy.id] = policy
        print(f"✅ Added access policy: {policy.name} (priority: {policy.priority})")
        return True
    
    def evaluate_access_request(self, request: AccessRequest) -> AccessRequest:
        """Evaluate access request against zero-trust policies"""
        
        # Calculate risk score
        request.calculated_risk = self.risk_calculator.calculate_risk(request, self)
        
        # Calculate trust score
        request.trust_score = self.trust_evaluator.calculate_trust(request, self)
        
        # Find matching policies
        matching_policies = self.policy_engine.find_matching_policies(request, self.access_policies)
        
        if not matching_policies:
            request.decision = PolicyAction.DENY
            request.decision_time = datetime.now()
            request.decision_latency_ms = 5.0
            self._create_security_event(
                "policy_no_match",
                "medium",
                f"No matching policy found for access request",
                request
            )
            return request
        
        # Apply highest priority policy
        policy = min(matching_policies, key=lambda p: p.priority)
        request.policy_matched = policy.id
        
        # Evaluate policy conditions
        decision = self.policy_engine.evaluate_policy(policy, request, self)
        request.decision = decision
        request.decision_time = datetime.now()
        request.decision_latency_ms = np.random.uniform(1.0, 10.0)  # Simulate processing time
        
        # Update policy statistics
        policy.last_matched = datetime.now()
        policy.match_count += 1
        
        # Check if additional verification is required
        if decision == PolicyAction.CHALLENGE:
            request.additional_verification_required = True
        
        # Create security event for monitoring
        if decision == PolicyAction.DENY:
            self._create_security_event(
                "access_denied",
                "high",
                f"Access denied for {request.identity_id} to {request.resource}",
                request
            )
        elif request.calculated_risk > 75:
            self._create_security_event(
                "high_risk_access",
                "medium",
                f"High risk access granted for {request.identity_id}",
                request
            )
        
        # Store request for analytics
        self.access_requests.append(request)
        
        print(f"🔒 Access evaluation: {decision.value} for {request.identity_id} -> {request.resource}")
        print(f"   Risk: {request.calculated_risk}, Trust: {request.trust_score:.2f}")
        print(f"   Policy: {policy.name}, Latency: {request.decision_latency_ms:.1f}ms")
        
        return request
    
    def _create_security_event(self, event_type: str, severity: str, description: str, request: AccessRequest):
        """Create security event"""
        event = SecurityEvent(
            id=f"event_{int(time.time())}_{secrets.randbelow(1000)}",
            event_type=event_type,
            severity=severity,
            source="zero_trust_engine",
            identity_id=request.identity_id,
            device_id=request.device_id,
            resource=request.resource,
            description=description,
            indicators=request.risk_factors,
            risk_score=request.calculated_risk,
            timestamp=datetime.now(),
            resolved=False,
            resolution_notes=None,
            false_positive=False,
            investigation_status="new",
            related_events=[],
            context={
                "source_ip": request.source_ip,
                "user_agent": request.user_agent,
                "session_id": request.session_id,
                "location": request.location
            }
        )
        
        self.security_events[event.id] = event
        self.event_queue.append(event)
    
    def continuous_authentication(self, session_id: str) -> Dict[str, Any]:
        """Perform continuous authentication for active session"""
        
        if session_id not in self.active_sessions:
            return {"error": "Session not found"}
        
        session = self.active_sessions[session_id]
        identity = self.identities.get(session["identity_id"])
        device = self.devices.get(session["device_id"]) if session.get("device_id") else None
        
        # Behavioral analysis
        behavioral_score = self._analyze_session_behavior(session_id)
        
        # Device posture check
        device_score = self._check_device_posture(device) if device else 50
        
        # Location verification
        location_score = self._verify_location(session.get("current_location"), identity.allowed_locations if identity else [])
        
        # Calculate continuous trust score
        continuous_trust = (behavioral_score + device_score + location_score) / 3
        
        # Determine action based on trust score
        if continuous_trust < 30:
            action = "terminate_session"
            session["status"] = "terminated"
            session["termination_reason"] = "low_continuous_trust"
        elif continuous_trust < 50:
            action = "require_reauth"
            session["reauth_required"] = True
        elif continuous_trust < 70:
            action = "increase_monitoring"
            session["monitoring_level"] = "high"
        else:
            action = "continue"
        
        session["continuous_trust_score"] = continuous_trust
        session["last_trust_evaluation"] = datetime.now()
        
        return {
            "session_id": session_id,
            "continuous_trust_score": continuous_trust,
            "action": action,
            "behavioral_score": behavioral_score,
            "device_score": device_score,
            "location_score": location_score,
            "timestamp": datetime.now().isoformat()
        }
    
    def _analyze_session_behavior(self, session_id: str) -> float:
        """Analyze session behavior patterns"""
        # Simulate behavioral analysis
        base_score = 75.0
        
        # Add some randomness for demonstration
        anomaly_factor = np.random.normal(0, 10)
        score = max(0, min(100, base_score + anomaly_factor))
        
        return score
    
    def _check_device_posture(self, device: Device) -> float:
        """Check device security posture"""
        if not device:
            return 50.0
        
        score = 100.0
        
        # Check compliance status
        if device.compliance_status != "compliant":
            score -= 30
        
        # Check encryption
        if device.encryption_status != "encrypted":
            score -= 20
        
        # Check antivirus
        if device.antivirus_status != "active":
            score -= 15
        
        # Check patch level
        if device.patch_level not in ["current", "up_to_date"]:
            score -= 10
        
        # Check vulnerability scan results
        if device.vulnerability_scan_results:
            latest_scan = device.vulnerability_scan_results[-1]
            critical_vulns = latest_scan.get("critical", 0)
            high_vulns = latest_scan.get("high", 0)
            
            score -= (critical_vulns * 10 + high_vulns * 5)
        
        return max(0, score)
    
    def _verify_location(self, current_location: Optional[str], allowed_locations: List[str]) -> float:
        """Verify if current location is allowed"""
        if not current_location:
            return 50.0  # Neutral score for unknown location
        
        if current_location in allowed_locations:
            return 100.0
        elif "remote" in allowed_locations or "anywhere" in allowed_locations:
            return 80.0
        else:
            return 20.0  # Low score for disallowed location
    
    def micro_segmentation_check(self, source_ip: str, destination_ip: str, port: int, protocol: str) -> Dict[str, Any]:
        """Check if network communication is allowed based on micro-segmentation"""
        
        source_segment = self._find_network_segment(source_ip)
        destination_segment = self._find_network_segment(destination_ip)
        
        if not source_segment or not destination_segment:
            return {
                "allowed": False,
                "reason": "Unknown network segment",
                "action": "deny"
            }
        
        # Check if segments are connected
        if destination_segment.id not in source_segment.connected_segments:
            return {
                "allowed": False,
                "reason": "Segments not connected",
                "source_segment": source_segment.name,
                "destination_segment": destination_segment.name,
                "action": "deny"
            }
        
        # Check protocol restrictions
        if protocol.upper() not in destination_segment.allowed_protocols:
            return {
                "allowed": False,
                "reason": f"Protocol {protocol} not allowed in {destination_segment.name}",
                "action": "deny"
            }
        
        # Check firewall rules
        allowed_by_rules = self._check_firewall_rules(
            source_segment, destination_segment, port, protocol
        )
        
        if not allowed_by_rules:
            return {
                "allowed": False,
                "reason": "Blocked by firewall rules",
                "action": "deny"
            }
        
        # Check trust level compatibility
        if source_segment.trust_level.value == "untrusted" and destination_segment.trust_level.value in ["high", "verified"]:
            return {
                "allowed": False,
                "reason": "Trust level mismatch",
                "action": "deny"
            }
        
        return {
            "allowed": True,
            "source_segment": source_segment.name,
            "destination_segment": destination_segment.name,
            "trust_levels": {
                "source": source_segment.trust_level.value,
                "destination": destination_segment.trust_level.value
            },
            "action": "allow",
            "monitoring_required": destination_segment.monitoring_enabled
        }
    
    def _find_network_segment(self, ip_address: str) -> Optional[NetworkSegment]:
        """Find network segment for IP address"""
        try:
            ip = ipaddress.ip_address(ip_address)
            
            for segment in self.network_segments.values():
                for cidr_block in segment.cidr_blocks:
                    network = ipaddress.ip_network(cidr_block)
                    if ip in network:
                        return segment
        except Exception:
            pass
        
        return None
    
    def _check_firewall_rules(self, source_segment: NetworkSegment, dest_segment: NetworkSegment, 
                            port: int, protocol: str) -> bool:
        """Check firewall rules between segments"""
        
        # Check destination segment firewall rules
        for rule in dest_segment.firewall_rules:
            if rule.get("action") == "allow":
                rule_port = rule.get("port")
                rule_protocol = rule.get("protocol", "").lower()
                
                if rule_port and rule_port != port:
                    continue
                
                if rule_protocol and rule_protocol != protocol.lower():
                    continue
                
                # Rule matches
                return True
        
        # Default allow for internal-to-internal communication
        if (source_segment.zone_type == "internal" and 
            dest_segment.zone_type == "internal"):
            return True
        
        return False
    
    def adaptive_authentication(self, identity_id: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """Determine adaptive authentication requirements"""
        
        identity = self.identities.get(identity_id)
        if not identity:
            return {"error": "Identity not found"}
        
        # Base authentication requirements
        required_methods = [AuthenticationMethod.PASSWORD]
        risk_factors = []
        additional_challenges = []
        
        # Analyze context for risk factors
        source_ip = context.get("source_ip")
        user_agent = context.get("user_agent")
        location = context.get("location")
        time_of_day = datetime.now().hour
        
        # Check for unusual location
        if location and location not in identity.allowed_locations:
            risk_factors.append("unusual_location")
            required_methods.append(AuthenticationMethod.MFA)
            additional_challenges.append("location_verification")
        
        # Check for unusual time
        if time_of_day < 6 or time_of_day > 22:  # Outside business hours
            risk_factors.append("unusual_time")
            if AuthenticationMethod.MFA not in required_methods:
                required_methods.append(AuthenticationMethod.MFA)
        
        # Check IP reputation (simplified)
        if source_ip and self._is_suspicious_ip(source_ip):
            risk_factors.append("suspicious_ip")
            required_methods.append(AuthenticationMethod.MFA)
            additional_challenges.append("device_verification")
        
        # Check user agent for anomalies
        if user_agent and self._is_unusual_user_agent(user_agent, identity):
            risk_factors.append("unusual_user_agent")
            additional_challenges.append("browser_verification")
        
        # High privilege identities require MFA
        if "admin" in identity.roles or "security_admin" in identity.roles:
            if AuthenticationMethod.MFA not in required_methods:
                required_methods.append(AuthenticationMethod.MFA)
        
        # Calculate adaptive score
        base_score = 50
        risk_penalty = len(risk_factors) * 15
        privilege_bonus = 20 if "admin" in identity.roles else 0
        adaptive_score = max(0, base_score - risk_penalty + privilege_bonus)
        
        return {
            "identity_id": identity_id,
            "required_methods": [method.value for method in required_methods],
            "risk_factors": risk_factors,
            "additional_challenges": additional_challenges,
            "adaptive_score": adaptive_score,
            "recommendation": "high_assurance" if adaptive_score > 70 else "standard_auth",
            "session_controls": {
                "max_duration": 240 if risk_factors else 480,  # 4 or 8 hours
                "idle_timeout": 15 if risk_factors else 30,   # minutes
                "require_reauth": len(risk_factors) > 1
            }
        }
    
    def _is_suspicious_ip(self, ip_address: str) -> bool:
        """Check if IP address is suspicious"""
        # Simplified reputation check
        suspicious_patterns = [
            "192.168.999.",  # Invalid private IP (for demo)
            "10.0.999.",     # Invalid private IP (for demo)
            "172.16.999."    # Invalid private IP (for demo)
        ]
        
        return any(ip_address.startswith(pattern) for pattern in suspicious_patterns)
    
    def _is_unusual_user_agent(self, user_agent: str, identity: Identity) -> bool:
        """Check if user agent is unusual for this identity"""
        # Simplified check - in reality would use ML models
        common_agents = ["Chrome", "Firefox", "Safari", "Edge"]
        return not any(agent in user_agent for agent in common_agents)
    
    def get_zero_trust_dashboard(self) -> Dict[str, Any]:
        """Get zero-trust security dashboard"""
        
        dashboard = {
            "summary": {
                "total_identities": len(self.identities),
                "active_identities": len([i for i in self.identities.values() if i.is_active]),
                "managed_devices": len([d for d in self.devices.values() if d.is_managed]),
                "network_segments": len(self.network_segments),
                "active_policies": len([p for p in self.access_policies.values() if p.enabled]),
                "recent_access_requests": len([r for r in self.access_requests if r.timestamp > datetime.now() - timedelta(hours=24)])
            },
            "trust_levels": {},
            "risk_distribution": {},
            "policy_effectiveness": {},
            "recent_security_events": [],
            "compliance_status": {},
            "device_posture": {}
        }
        
        # Trust level distribution
        trust_counts = defaultdict(int)
        for identity in self.identities.values():
            trust_counts[identity.trust_level.value] += 1
        dashboard["trust_levels"] = dict(trust_counts)
        
        # Risk distribution
        risk_ranges = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for identity in self.identities.values():
            if identity.risk_score < 25:
                risk_ranges["low"] += 1
            elif identity.risk_score < 50:
                risk_ranges["medium"] += 1
            elif identity.risk_score < 75:
                risk_ranges["high"] += 1
            else:
                risk_ranges["critical"] += 1
        dashboard["risk_distribution"] = risk_ranges
        
        # Policy effectiveness
        policy_stats = {}
        for policy in self.access_policies.values():
            policy_stats[policy.name] = {
                "matches": policy.match_count,
                "last_matched": policy.last_matched.isoformat() if policy.last_matched else None,
                "enabled": policy.enabled,
                "priority": policy.priority
            }
        dashboard["policy_effectiveness"] = policy_stats
        
        # Recent security events
        recent_events = list(self.event_queue)[-10:]  # Last 10 events
        dashboard["recent_security_events"] = [
            {
                "id": event.id,
                "type": event.event_type,
                "severity": event.severity,
                "description": event.description,
                "timestamp": event.timestamp.isoformat(),
                "resolved": event.resolved
            } for event in recent_events
        ]
        
        # Device posture
        compliant_devices = len([d for d in self.devices.values() if d.compliance_status == "compliant"])
        total_devices = len(self.devices)
        
        dashboard["device_posture"] = {
            "total_devices": total_devices,
            "compliant": compliant_devices,
            "non_compliant": total_devices - compliant_devices,
            "compliance_rate": (compliant_devices / total_devices) * 100 if total_devices > 0 else 0
        }
        
        return dashboard
    
    def start_monitoring(self):
        """Start zero-trust monitoring"""
        self.monitoring_active = True
        print("🚀 Started zero-trust security monitoring")
    
    def stop_monitoring(self):
        """Stop zero-trust monitoring"""
        self.monitoring_active = False
        print("⏹️ Stopped zero-trust security monitoring")


class RiskCalculator:
    """Risk calculation engine"""
    
    def calculate_risk(self, request: AccessRequest, engine: ZeroTrustEngine) -> int:
        """Calculate risk score for access request"""
        
        base_risk = 50
        risk_factors = []
        
        # Identity risk factors
        identity = engine.identities.get(request.identity_id)
        if identity:
            if identity.risk_score > 50:
                base_risk += (identity.risk_score - 50)
                risk_factors.append("high_identity_risk")
            
            if identity.trust_level in [TrustLevel.UNTRUSTED, TrustLevel.LOW]:
                base_risk += 25
                risk_factors.append("low_trust_level")
        
        # Device risk factors
        if request.device_id:
            device = engine.devices.get(request.device_id)
            if device:
                if device.compliance_status != "compliant":
                    base_risk += 20
                    risk_factors.append("non_compliant_device")
                
                if device.risk_score > 50:
                    base_risk += (device.risk_score - 50) // 2
                    risk_factors.append("high_device_risk")
        
        # Location risk factors
        if request.location and identity:
            if request.location not in identity.allowed_locations:
                base_risk += 30
                risk_factors.append("unusual_location")
        
        # Time-based risk factors
        current_hour = request.timestamp.hour
        if current_hour < 6 or current_hour > 22:
            base_risk += 15
            risk_factors.append("off_hours_access")
        
        # Network-based risk factors
        if self._is_external_ip(request.source_ip):
            base_risk += 20
            risk_factors.append("external_access")
        
        request.risk_factors = risk_factors
        return min(100, max(0, base_risk))
    
    def _is_external_ip(self, ip_address: str) -> bool:
        """Check if IP is external"""
        try:
            ip = ipaddress.ip_address(ip_address)
            return not ip.is_private
        except:
            return True


class TrustEvaluator:
    """Trust evaluation engine"""
    
    def calculate_trust(self, request: AccessRequest, engine: ZeroTrustEngine) -> float:
        """Calculate trust score for access request"""
        
        trust_score = 0.5  # Base neutral trust
        
        # Identity trust
        identity = engine.identities.get(request.identity_id)
        if identity:
            trust_level_scores = {
                TrustLevel.UNTRUSTED: 0.0,
                TrustLevel.LOW: 0.25,
                TrustLevel.MEDIUM: 0.5,
                TrustLevel.HIGH: 0.75,
                TrustLevel.VERIFIED: 1.0
            }
            identity_trust = trust_level_scores.get(identity.trust_level, 0.5)
            trust_score = (trust_score + identity_trust) / 2
        
        # Device trust
        if request.device_id:
            device = engine.devices.get(request.device_id)
            if device:
                device_trust_scores = {
                    TrustLevel.UNTRUSTED: 0.0,
                    TrustLevel.LOW: 0.25,
                    TrustLevel.MEDIUM: 0.5,
                    TrustLevel.HIGH: 0.75,
                    TrustLevel.VERIFIED: 1.0
                }
                device_trust = device_trust_scores.get(device.trust_level, 0.5)
                trust_score = (trust_score + device_trust) / 2
        
        # Authentication method trust
        if request.authentication_method:
            auth_trust_scores = {
                AuthenticationMethod.PASSWORD: 0.3,
                AuthenticationMethod.MFA: 0.8,
                AuthenticationMethod.BIOMETRIC: 0.9,
                AuthenticationMethod.CERTIFICATE: 0.95,
                AuthenticationMethod.HARDWARE_TOKEN: 1.0
            }
            auth_trust = auth_trust_scores.get(request.authentication_method, 0.3)
            trust_score = (trust_score + auth_trust) / 2
        
        return max(0.0, min(1.0, trust_score))


class PolicyEngine:
    """Policy evaluation engine"""
    
    def find_matching_policies(self, request: AccessRequest, policies: Dict[str, AccessPolicy]) -> List[AccessPolicy]:
        """Find policies that match the access request"""
        
        matching_policies = []
        
        for policy in policies.values():
            if not policy.enabled:
                continue
            
            if self._matches_resource_pattern(request.resource, policy.resource_patterns):
                if self._matches_identity_pattern(request.identity_id, policy.identity_patterns):
                    matching_policies.append(policy)
        
        return matching_policies
    
    def evaluate_policy(self, policy: AccessPolicy, request: AccessRequest, engine: ZeroTrustEngine) -> PolicyAction:
        """Evaluate policy against access request"""
        
        # Check risk threshold
        if request.calculated_risk > policy.risk_threshold:
            return PolicyAction.DENY
        
        # Check authentication requirements
        if not self._check_auth_requirements(policy.authentication_requirements, request.authentication_method):
            return PolicyAction.CHALLENGE
        
        # Check device requirements
        if request.device_id and not self._check_device_requirements(policy.device_requirements, request.device_id, engine):
            return PolicyAction.DENY
        
        # Check location restrictions
        if not self._check_location_restrictions(policy.location_restrictions, request.location):
            return PolicyAction.DENY
        
        # Check time restrictions
        if not self._check_time_restrictions(policy.time_restrictions, request.timestamp):
            return PolicyAction.DENY
        
        # Check identity conditions
        identity = engine.identities.get(request.identity_id)
        if identity and not self._check_identity_conditions(policy.conditions, identity):
            return PolicyAction.DENY
        
        return policy.action
    
    def _matches_resource_pattern(self, resource: str, patterns: List[str]) -> bool:
        """Check if resource matches any pattern"""
        for pattern in patterns:
            if pattern == "/*":  # Wildcard
                return True
            elif pattern.endswith("*"):
                if resource.startswith(pattern[:-1]):
                    return True
            elif pattern == resource:
                return True
        return False
    
    def _matches_identity_pattern(self, identity_id: str, patterns: List[str]) -> bool:
        """Check if identity matches any pattern"""
        for pattern in patterns:
            if pattern.endswith("*"):
                if identity_id.startswith(pattern[:-1]):
                    return True
            elif "*" in pattern:
                # Simple wildcard matching
                pattern_regex = pattern.replace("*", ".*")
                if re.match(pattern_regex, identity_id):
                    return True
            elif pattern == identity_id:
                return True
        return False
    
    def _check_auth_requirements(self, required_methods: List[AuthenticationMethod], actual_method: Optional[AuthenticationMethod]) -> bool:
        """Check if authentication requirements are met"""
        if not required_methods:
            return True
        
        if not actual_method:
            return False
        
        return actual_method in required_methods
    
    def _check_device_requirements(self, requirements: Dict[str, Any], device_id: str, engine: ZeroTrustEngine) -> bool:
        """Check device requirements"""
        device = engine.devices.get(device_id)
        if not device:
            return False
        
        for req_key, req_value in requirements.items():
            if req_key == "compliance_status" and device.compliance_status != req_value:
                return False
            elif req_key == "encryption_required" and req_value and device.encryption_status != "encrypted":
                return False
            elif req_key == "managed_device" and req_value and not device.is_managed:
                return False
        
        return True
    
    def _check_location_restrictions(self, restrictions: List[str], location: Optional[str]) -> bool:
        """Check location restrictions"""
        if not restrictions:
            return True
        
        if not location:
            return "anywhere" in restrictions
        
        return location in restrictions
    
    def _check_time_restrictions(self, restrictions: Dict[str, Any], timestamp: datetime) -> bool:
        """Check time restrictions"""
        if not restrictions:
            return True
        
        if restrictions.get("business_hours_only"):
            hour = timestamp.hour
            weekday = timestamp.weekday()
            
            # Business hours: 9 AM to 5 PM, Monday to Friday
            if not (9 <= hour <= 17 and weekday < 5):
                return False
        
        return True
    
    def _check_identity_conditions(self, conditions: Dict[str, Any], identity: Identity) -> bool:
        """Check identity-specific conditions"""
        for condition_key, condition_value in conditions.items():
            if condition_key == "identity_roles":
                if not any(role in identity.roles for role in condition_value):
                    return False
            elif condition_key == "trust_level_min":
                min_trust = TrustLevel(condition_value)
                trust_levels = [TrustLevel.UNTRUSTED, TrustLevel.LOW, TrustLevel.MEDIUM, TrustLevel.HIGH, TrustLevel.VERIFIED]
                if trust_levels.index(identity.trust_level) < trust_levels.index(min_trust):
                    return False
            elif condition_key == "mfa_required":
                if condition_value and not identity.requires_mfa:
                    return False
        
        return True


def main():
    """Test zero-trust security architecture"""
    print("🔒 Zero-Trust Security Architecture")
    print("=" * 50)
    
    # Initialize zero-trust engine
    zt_engine = ZeroTrustEngine()
    
    # Display identities
    print(f"\n👥 Identities ({len(zt_engine.identities)}):")
    for identity in zt_engine.identities.values():
        print(f"  - {identity.display_name} ({identity.identity_type})")
        print(f"    Trust: {identity.trust_level.value}, Risk: {identity.risk_score}")
        print(f"    Roles: {', '.join(identity.roles)}")
        print(f"    Auth methods: {[m.value for m in identity.authentication_methods]}")
    
    # Display devices
    print(f"\n💻 Devices ({len(zt_engine.devices)}):")
    for device in zt_engine.devices.values():
        print(f"  - {device.device_name} ({device.device_type})")
        print(f"    Trust: {device.trust_level.value}, Risk: {device.risk_score}")
        print(f"    Compliance: {device.compliance_status}")
        print(f"    Owner: {device.owner_id}")
    
    # Display network segments
    print(f"\n🌐 Network Segments ({len(zt_engine.network_segments)}):")
    for segment in zt_engine.network_segments.values():
        print(f"  - {segment.name} ({segment.zone_type})")
        print(f"    CIDR: {', '.join(segment.cidr_blocks)}")
        print(f"    Trust: {segment.trust_level.value}")
        print(f"    Protocols: {', '.join(segment.allowed_protocols)}")
    
    # Display access policies
    print(f"\n📋 Access Policies ({len(zt_engine.access_policies)}):")
    for policy in zt_engine.access_policies.values():
        print(f"  - {policy.name} (Priority: {policy.priority})")
        print(f"    Action: {policy.action.value}")
        print(f"    Resources: {', '.join(policy.resource_patterns[:2])}")
        print(f"    Matches: {policy.match_count}")
    
    # Test access requests
    print(f"\n🔐 Testing Access Requests:")
    
    # Test 1: Admin access from trusted device
    admin_request = AccessRequest(
        id="req_001",
        identity_id="admin_001",
        device_id="device_laptop_001",
        resource="/admin/dashboard",
        action="read",
        source_ip="192.168.1.100",
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        timestamp=datetime.now(),
        context={"location": "headquarters", "session_type": "interactive"},
        risk_factors=[],
        calculated_risk=0,
        trust_score=0.0,
        authentication_method=AuthenticationMethod.MFA,
        session_id="sess_001",
        location="headquarters",
        decision=None,
        policy_matched=None,
        additional_verification_required=False,
        decision_time=None,
        decision_latency_ms=None
    )
    
    result1 = zt_engine.evaluate_access_request(admin_request)
    
    # Test 2: Regular user access
    user_request = AccessRequest(
        id="req_002",
        identity_id="user_001",
        device_id=None,
        resource="/api/data",
        action="read",
        source_ip="203.0.113.100",
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        timestamp=datetime.now(),
        context={"location": "remote", "session_type": "api"},
        risk_factors=[],
        calculated_risk=0,
        trust_score=0.0,
        authentication_method=AuthenticationMethod.PASSWORD,
        session_id="sess_002",
        location="remote",
        decision=None,
        policy_matched=None,
        additional_verification_required=False,
        decision_time=None,
        decision_latency_ms=None
    )
    
    result2 = zt_engine.evaluate_access_request(user_request)
    
    # Test 3: Suspicious access attempt
    suspicious_request = AccessRequest(
        id="req_003",
        identity_id="user_001",
        device_id=None,
        resource="/admin/sensitive",
        action="write",
        source_ip="192.168.999.100",  # Suspicious IP
        user_agent="curl/7.68.0",
        timestamp=datetime.now().replace(hour=3),  # 3 AM
        context={"location": "unknown", "session_type": "api"},
        risk_factors=[],
        calculated_risk=0,
        trust_score=0.0,
        authentication_method=AuthenticationMethod.PASSWORD,
        session_id="sess_003",
        location="unknown",
        decision=None,
        policy_matched=None,
        additional_verification_required=False,
        decision_time=None,
        decision_latency_ms=None
    )
    
    result3 = zt_engine.evaluate_access_request(suspicious_request)
    
    # Test micro-segmentation
    print(f"\n🔒 Testing Micro-Segmentation:")
    segmentation_result = zt_engine.micro_segmentation_check(
        source_ip="10.0.10.100",      # Internal segment
        destination_ip="10.0.100.50",  # DMZ segment
        port=443,
        protocol="tcp"
    )
    
    print(f"  Network access: {'✅ Allowed' if segmentation_result['allowed'] else '❌ Denied'}")
    if not segmentation_result['allowed']:
        print(f"  Reason: {segmentation_result['reason']}")
    else:
        print(f"  Source: {segmentation_result['source_segment']}")
        print(f"  Destination: {segmentation_result['destination_segment']}")
    
    # Test adaptive authentication
    print(f"\n🔄 Testing Adaptive Authentication:")
    adaptive_auth = zt_engine.adaptive_authentication(
        identity_id="user_001",
        context={
            "source_ip": "203.0.113.100",
            "location": "unknown",
            "user_agent": "curl/7.68.0"
        }
    )
    
    print(f"  Required methods: {', '.join(adaptive_auth['required_methods'])}")
    print(f"  Risk factors: {', '.join(adaptive_auth['risk_factors'])}")
    print(f"  Additional challenges: {', '.join(adaptive_auth['additional_challenges'])}")
    print(f"  Adaptive score: {adaptive_auth['adaptive_score']}")
    
    # Test continuous authentication
    print(f"\n🔄 Testing Continuous Authentication:")
    
    # Create active session
    zt_engine.active_sessions["sess_001"] = {
        "identity_id": "admin_001",
        "device_id": "device_laptop_001",
        "current_location": "headquarters",
        "started_at": datetime.now() - timedelta(hours=1),
        "last_activity": datetime.now(),
        "status": "active"
    }
    
    continuous_auth = zt_engine.continuous_authentication("sess_001")
    
    print(f"  Trust score: {continuous_auth['continuous_trust_score']:.1f}")
    print(f"  Action: {continuous_auth['action']}")
    print(f"  Behavioral: {continuous_auth['behavioral_score']:.1f}")
    print(f"  Device: {continuous_auth['device_score']:.1f}")
    print(f"  Location: {continuous_auth['location_score']:.1f}")
    
    # Get zero-trust dashboard
    print(f"\n📊 Zero-Trust Dashboard:")
    dashboard = zt_engine.get_zero_trust_dashboard()
    
    summary = dashboard["summary"]
    print(f"  Identities: {summary['active_identities']}/{summary['total_identities']} active")
    print(f"  Managed devices: {summary['managed_devices']}")
    print(f"  Network segments: {summary['network_segments']}")
    print(f"  Active policies: {summary['active_policies']}")
    
    print(f"\n  Trust Level Distribution:")
    for level, count in dashboard["trust_levels"].items():
        print(f"    {level}: {count}")
    
    print(f"\n  Risk Distribution:")
    for risk, count in dashboard["risk_distribution"].items():
        print(f"    {risk}: {count}")
    
    device_posture = dashboard["device_posture"]
    print(f"\n  Device Compliance: {device_posture['compliance_rate']:.1f}%")
    print(f"    Compliant: {device_posture['compliant']}")
    print(f"    Non-compliant: {device_posture['non_compliant']}")
    
    if dashboard["recent_security_events"]:
        print(f"\n  Recent Security Events:")
        for event in dashboard["recent_security_events"][:3]:
            print(f"    - {event['type']}: {event['description']}")
            print(f"      Severity: {event['severity']}, Resolved: {event['resolved']}")
    
    # Start monitoring
    print(f"\n🔍 Starting Zero-Trust Monitoring:")
    zt_engine.start_monitoring()
    print(f"  Monitoring active: {zt_engine.monitoring_active}")
    
    print(f"\n✅ Zero-trust security architecture operational!")


if __name__ == "__main__":
    main()