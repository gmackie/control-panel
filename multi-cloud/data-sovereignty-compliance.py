#!/usr/bin/env python3
"""
Data Sovereignty & Compliance Management System
Ensures data residency, privacy compliance, and regulatory adherence across multi-cloud environments
"""

import os
import json
import hashlib
import time
from typing import Dict, List, Optional, Any, Tuple, Set, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from collections import defaultdict
import threading
import re

class ComplianceFramework(Enum):
    """Supported compliance frameworks"""
    GDPR = "gdpr"  # General Data Protection Regulation (EU)
    CCPA = "ccpa"  # California Consumer Privacy Act
    HIPAA = "hipaa"  # Health Insurance Portability and Accountability Act
    SOC2 = "soc2"  # Service Organization Control 2
    ISO27001 = "iso27001"  # ISO/IEC 27001
    PCI_DSS = "pci_dss"  # Payment Card Industry Data Security Standard
    PIPEDA = "pipeda"  # Personal Information Protection and Electronic Documents Act (Canada)
    LGPD = "lgpd"  # Lei Geral de Proteção de Dados (Brazil)
    PDPA = "pdpa"  # Personal Data Protection Act (Singapore)
    DATA_PROTECTION_ACT = "dpa"  # UK Data Protection Act
    FERPA = "ferpa"  # Family Educational Rights and Privacy Act
    GLBA = "glba"  # Gramm-Leach-Bliley Act

class DataClassification(Enum):
    """Data classification levels"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    PII = "pii"  # Personally Identifiable Information
    PHI = "phi"  # Protected Health Information
    PCI = "pci"  # Payment Card Information
    FINANCIAL = "financial"
    BIOMETRIC = "biometric"

class DataResidencyStatus(Enum):
    """Data residency compliance status"""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    UNDER_REVIEW = "under_review"
    MIGRATION_REQUIRED = "migration_required"
    EXCEPTION_APPROVED = "exception_approved"

class AuditStatus(Enum):
    """Audit and assessment status"""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    IN_PROGRESS = "in_progress"
    NOT_ASSESSED = "not_assessed"

@dataclass
class DataResidencyRule:
    """Data residency rule definition"""
    id: str
    name: str
    description: str
    framework: ComplianceFramework
    data_types: List[DataClassification]
    allowed_regions: List[str]
    prohibited_regions: List[str]
    allowed_countries: List[str]
    prohibited_countries: List[str]
    encryption_required: bool
    anonymization_required: bool
    retention_period_days: Optional[int]
    cross_border_transfer_allowed: bool
    transfer_mechanisms: List[str]  # Standard Contractual Clauses, Adequacy Decision, etc.
    exceptions: List[str]
    created_at: datetime
    updated_at: datetime
    active: bool

@dataclass
class DataAsset:
    """Data asset representation"""
    id: str
    name: str
    description: str
    classification: DataClassification
    location: str  # Cloud region/zone
    provider: str
    service_type: str  # database, storage, compute, etc.
    data_types: List[str]  # email, phone, address, etc.
    volume_gb: float
    record_count: Optional[int]
    creation_date: datetime
    last_accessed: Optional[datetime]
    owner: str
    custodian: str
    encryption_status: str  # encrypted, unencrypted, partially_encrypted
    anonymization_status: str  # anonymized, pseudonymized, identifiable
    retention_policy: Optional[str]
    tags: Dict[str, str]
    metadata: Dict[str, Any]

@dataclass
class ComplianceAssessment:
    """Compliance assessment result"""
    id: str
    asset_id: str
    rule_id: str
    framework: ComplianceFramework
    status: AuditStatus
    compliance_score: float  # 0.0 to 100.0
    issues: List[str]
    recommendations: List[str]
    risk_level: str  # low, medium, high, critical
    assessment_date: datetime
    next_assessment_date: Optional[datetime]
    remediation_deadline: Optional[datetime]
    assessor: str
    evidence: List[str]
    notes: str

@dataclass
class DataTransfer:
    """Cross-border data transfer record"""
    id: str
    source_asset_id: str
    destination_region: str
    destination_country: str
    transfer_mechanism: str
    purpose: str
    data_volume_gb: float
    transfer_date: datetime
    authorized_by: str
    legal_basis: str
    retention_period: Optional[str]
    encryption_method: str
    status: str  # pending, approved, completed, rejected
    approval_date: Optional[datetime]
    completion_date: Optional[datetime]

@dataclass
class ComplianceViolation:
    """Compliance violation record"""
    id: str
    asset_id: str
    rule_id: str
    framework: ComplianceFramework
    violation_type: str
    description: str
    severity: str  # low, medium, high, critical
    detected_date: datetime
    resolved_date: Optional[datetime]
    resolution_description: Optional[str]
    business_impact: str
    regulatory_risk: str
    remediation_cost: float
    responsible_party: str
    status: str  # open, in_progress, resolved, dismissed

class DataSovereigntyComplianceManager:
    """Main data sovereignty and compliance management system"""
    
    def __init__(self):
        self.residency_rules: Dict[str, DataResidencyRule] = {}
        self.data_assets: Dict[str, DataAsset] = {}
        self.assessments: Dict[str, ComplianceAssessment] = {}
        self.transfers: Dict[str, DataTransfer] = {}
        self.violations: Dict[str, ComplianceViolation] = {}
        
        # Regional compliance mappings
        self.region_country_mapping = self._initialize_region_mappings()
        self.adequacy_decisions = self._initialize_adequacy_decisions()
        
        # Monitoring and alerting
        self.monitoring_active = False
        self.alert_thresholds = {
            "violation_count": 5,
            "high_risk_assessments": 3,
            "overdue_assessments": 10
        }
        
        # Initialize sample data
        self._initialize_sample_rules()
        self._initialize_sample_assets()
    
    def _initialize_region_mappings(self) -> Dict[str, str]:
        """Initialize cloud region to country mappings"""
        return {
            # AWS Regions
            "us-east-1": "United States",
            "us-west-2": "United States",
            "eu-west-1": "Ireland",
            "eu-central-1": "Germany",
            "ap-southeast-1": "Singapore",
            "ap-northeast-1": "Japan",
            "ca-central-1": "Canada",
            "sa-east-1": "Brazil",
            
            # GCP Regions
            "us-central1": "United States",
            "europe-west1": "Belgium",
            "asia-southeast1": "Singapore",
            "australia-southeast1": "Australia",
            
            # Azure Regions
            "East US": "United States",
            "West Europe": "Netherlands",
            "Southeast Asia": "Singapore",
            "Japan East": "Japan",
            "UK South": "United Kingdom",
            "Germany West Central": "Germany",
            "France Central": "France",
            "Canada Central": "Canada",
            "Australia East": "Australia",
            "Brazil South": "Brazil"
        }
    
    def _initialize_adequacy_decisions(self) -> Dict[str, List[str]]:
        """Initialize EU adequacy decisions for GDPR compliance"""
        return {
            "gdpr_adequate_countries": [
                "Andorra", "Argentina", "Canada", "Faroe Islands", "Guernsey",
                "Israel", "Isle of Man", "Japan", "Jersey", "New Zealand",
                "South Korea", "Switzerland", "United Kingdom", "Uruguay"
            ],
            "privacy_shield_countries": [],  # Privacy Shield invalidated
            "standard_contractual_clauses": [
                "United States", "India", "China", "Russia", "Turkey"
            ]
        }
    
    def _initialize_sample_rules(self):
        """Initialize sample compliance rules"""
        
        # GDPR Rule
        gdpr_rule = DataResidencyRule(
            id="gdpr_eu_residency",
            name="GDPR EU Data Residency",
            description="Personal data of EU residents must remain within EU/EEA or adequate countries",
            framework=ComplianceFramework.GDPR,
            data_types=[DataClassification.PII],
            allowed_regions=["eu-west-1", "eu-central-1", "europe-west1", "West Europe"],
            prohibited_regions=["us-east-1", "us-west-2", "ap-southeast-1"],
            allowed_countries=[
                "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
                "Denmark", "Estonia", "Finland", "France", "Germany", "Greece",
                "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
                "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia",
                "Slovenia", "Spain", "Sweden", "United Kingdom", "Switzerland"
            ],
            prohibited_countries=["United States", "China", "Russia"],
            encryption_required=True,
            anonymization_required=False,
            retention_period_days=2555,  # 7 years
            cross_border_transfer_allowed=True,
            transfer_mechanisms=["Adequacy Decision", "Standard Contractual Clauses", "Binding Corporate Rules"],
            exceptions=["Emergency situations", "Explicit consent", "Contract performance"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            active=True
        )
        self.add_residency_rule(gdpr_rule)
        
        # HIPAA Rule
        hipaa_rule = DataResidencyRule(
            id="hipaa_phi_protection",
            name="HIPAA PHI Protection",
            description="Protected Health Information must meet HIPAA security and privacy requirements",
            framework=ComplianceFramework.HIPAA,
            data_types=[DataClassification.PHI],
            allowed_regions=["us-east-1", "us-west-2", "ca-central-1", "Canada Central"],
            prohibited_regions=["eu-west-1", "ap-southeast-1", "sa-east-1"],
            allowed_countries=["United States", "Canada"],
            prohibited_countries=["China", "Russia", "Iran", "North Korea"],
            encryption_required=True,
            anonymization_required=False,
            retention_period_days=2555,  # 7 years
            cross_border_transfer_allowed=False,
            transfer_mechanisms=["Business Associate Agreement"],
            exceptions=["Medical emergency", "Public health authority"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            active=True
        )
        self.add_residency_rule(hipaa_rule)
        
        # PCI DSS Rule
        pci_rule = DataResidencyRule(
            id="pci_dss_cardholder_data",
            name="PCI DSS Cardholder Data Protection",
            description="Cardholder data must be protected according to PCI DSS standards",
            framework=ComplianceFramework.PCI_DSS,
            data_types=[DataClassification.PCI],
            allowed_regions=[],  # Can be anywhere if properly secured
            prohibited_regions=[],
            allowed_countries=[],
            prohibited_countries=["Iran", "North Korea", "Syria", "Sudan"],
            encryption_required=True,
            anonymization_required=True,  # Tokenization preferred
            retention_period_days=1095,  # 3 years
            cross_border_transfer_allowed=True,
            transfer_mechanisms=["PCI DSS Compliant Transfer", "Tokenization"],
            exceptions=["Fraud prevention", "Legal requirement"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            active=True
        )
        self.add_residency_rule(pci_rule)
        
        # China Data Localization
        china_rule = DataResidencyRule(
            id="china_cybersecurity_law",
            name="China Cybersecurity Law Data Localization",
            description="Personal information and important data of Chinese citizens must stay in China",
            framework=ComplianceFramework.GDPR,  # Using GDPR as placeholder
            data_types=[DataClassification.PII, DataClassification.CONFIDENTIAL],
            allowed_regions=["cn-north-1", "cn-northwest-1"],
            prohibited_regions=["us-east-1", "eu-west-1"],
            allowed_countries=["China"],
            prohibited_countries=["United States", "Japan", "South Korea"],
            encryption_required=True,
            anonymization_required=False,
            retention_period_days=None,
            cross_border_transfer_allowed=False,
            transfer_mechanisms=["Security Assessment", "Government Approval"],
            exceptions=["Cross-border business operations"],
            created_at=datetime.now(),
            updated_at=datetime.now(),
            active=True
        )
        self.add_residency_rule(china_rule)
    
    def _initialize_sample_assets(self):
        """Initialize sample data assets"""
        
        # Customer database
        customer_db = DataAsset(
            id="customer_db_eu",
            name="Customer Database EU",
            description="Primary customer database containing EU customer data",
            classification=DataClassification.PII,
            location="eu-west-1",
            provider="AWS",
            service_type="RDS PostgreSQL",
            data_types=["email", "name", "address", "phone", "preferences"],
            volume_gb=150.0,
            record_count=250000,
            creation_date=datetime.now() - timedelta(days=365),
            last_accessed=datetime.now() - timedelta(hours=2),
            owner="data-team@company.com",
            custodian="devops@company.com",
            encryption_status="encrypted",
            anonymization_status="identifiable",
            retention_policy="7_years",
            tags={"environment": "production", "criticality": "high"},
            metadata={"backup_frequency": "daily", "replication": "multi_az"}
        )
        self.add_data_asset(customer_db)
        
        # US Healthcare data
        healthcare_db = DataAsset(
            id="healthcare_db_us",
            name="Healthcare Database US",
            description="Patient health records for US customers",
            classification=DataClassification.PHI,
            location="us-east-1",
            provider="AWS",
            service_type="RDS MySQL",
            data_types=["medical_records", "insurance", "ssn", "medical_history"],
            volume_gb=500.0,
            record_count=100000,
            creation_date=datetime.now() - timedelta(days=200),
            last_accessed=datetime.now() - timedelta(hours=1),
            owner="healthcare-team@company.com",
            custodian="security@company.com",
            encryption_status="encrypted",
            anonymization_status="identifiable",
            retention_policy="7_years",
            tags={"environment": "production", "criticality": "critical"},
            metadata={"hipaa_compliant": True, "audit_logging": True}
        )
        self.add_data_asset(healthcare_db)
        
        # Payment data storage
        payment_storage = DataAsset(
            id="payment_data_global",
            name="Payment Data Storage",
            description="Tokenized payment card data",
            classification=DataClassification.PCI,
            location="us-west-2",
            provider="AWS",
            service_type="S3",
            data_types=["tokenized_cards", "transaction_history", "merchant_data"],
            volume_gb=75.0,
            record_count=500000,
            creation_date=datetime.now() - timedelta(days=100),
            last_accessed=datetime.now() - timedelta(minutes=30),
            owner="payments@company.com",
            custodian="security@company.com",
            encryption_status="encrypted",
            anonymization_status="pseudonymized",
            retention_policy="3_years",
            tags={"environment": "production", "criticality": "critical"},
            metadata={"pci_compliant": True, "tokenization": "format_preserving"}
        )
        self.add_data_asset(payment_storage)
    
    def add_residency_rule(self, rule: DataResidencyRule) -> bool:
        """Add a data residency rule"""
        self.residency_rules[rule.id] = rule
        print(f"✅ Added residency rule: {rule.name} ({rule.framework.value})")
        return True
    
    def add_data_asset(self, asset: DataAsset) -> bool:
        """Add a data asset"""
        self.data_assets[asset.id] = asset
        print(f"✅ Added data asset: {asset.name} ({asset.classification.value})")
        
        # Automatically assess compliance
        self._assess_asset_compliance(asset)
        return True
    
    def _assess_asset_compliance(self, asset: DataAsset):
        """Automatically assess asset compliance against all applicable rules"""
        for rule_id, rule in self.residency_rules.items():
            if asset.classification in rule.data_types or not rule.data_types:
                assessment = self._perform_compliance_assessment(asset, rule)
                self.assessments[assessment.id] = assessment
    
    def _perform_compliance_assessment(
        self, 
        asset: DataAsset, 
        rule: DataResidencyRule
    ) -> ComplianceAssessment:
        """Perform detailed compliance assessment"""
        
        issues = []
        recommendations = []
        compliance_score = 100.0
        
        # Check region compliance
        asset_country = self.region_country_mapping.get(asset.location, "Unknown")
        
        if rule.allowed_regions and asset.location not in rule.allowed_regions:
            issues.append(f"Asset in non-allowed region: {asset.location}")
            compliance_score -= 30
        
        if rule.prohibited_regions and asset.location in rule.prohibited_regions:
            issues.append(f"Asset in prohibited region: {asset.location}")
            compliance_score -= 40
        
        if rule.allowed_countries and asset_country not in rule.allowed_countries:
            issues.append(f"Asset in non-allowed country: {asset_country}")
            compliance_score -= 35
        
        if rule.prohibited_countries and asset_country in rule.prohibited_countries:
            issues.append(f"Asset in prohibited country: {asset_country}")
            compliance_score -= 50
        
        # Check encryption requirements
        if rule.encryption_required and asset.encryption_status != "encrypted":
            issues.append("Encryption required but not implemented")
            compliance_score -= 25
            recommendations.append("Enable encryption at rest and in transit")
        
        # Check anonymization requirements
        if rule.anonymization_required and asset.anonymization_status == "identifiable":
            issues.append("Anonymization required but not implemented")
            compliance_score -= 20
            recommendations.append("Implement data anonymization or pseudonymization")
        
        # Check retention policy
        if rule.retention_period_days:
            asset_age_days = (datetime.now() - asset.creation_date).days
            if asset_age_days > rule.retention_period_days:
                issues.append(f"Asset exceeds retention period ({asset_age_days} > {rule.retention_period_days} days)")
                compliance_score -= 15
                recommendations.append("Review and apply data retention policies")
        
        # Determine risk level and status
        if compliance_score >= 90:
            status = AuditStatus.PASSED
            risk_level = "low"
        elif compliance_score >= 70:
            status = AuditStatus.WARNING
            risk_level = "medium"
        elif compliance_score >= 50:
            status = AuditStatus.FAILED
            risk_level = "high"
        else:
            status = AuditStatus.FAILED
            risk_level = "critical"
        
        # Add general recommendations
        if not recommendations:
            recommendations.append("Asset appears compliant - continue monitoring")
        
        if issues:
            recommendations.append("Address identified compliance issues promptly")
            recommendations.append("Document any approved exceptions or mitigations")
        
        assessment = ComplianceAssessment(
            id=f"assessment_{asset.id}_{rule.id}_{int(time.time())}",
            asset_id=asset.id,
            rule_id=rule.id,
            framework=rule.framework,
            status=status,
            compliance_score=max(0, compliance_score),
            issues=issues,
            recommendations=recommendations,
            risk_level=risk_level,
            assessment_date=datetime.now(),
            next_assessment_date=datetime.now() + timedelta(days=90),  # Quarterly
            remediation_deadline=datetime.now() + timedelta(days=30) if issues else None,
            assessor="automated_system",
            evidence=[f"Asset location: {asset.location}", f"Country: {asset_country}"],
            notes=f"Automated assessment against {rule.name}"
        )
        
        # Create violation if non-compliant
        if status == AuditStatus.FAILED and issues:
            self._create_violation(asset, rule, issues, risk_level)
        
        return assessment
    
    def _create_violation(
        self, 
        asset: DataAsset, 
        rule: DataResidencyRule, 
        issues: List[str], 
        risk_level: str
    ):
        """Create compliance violation record"""
        
        violation = ComplianceViolation(
            id=f"violation_{asset.id}_{rule.id}_{int(time.time())}",
            asset_id=asset.id,
            rule_id=rule.id,
            framework=rule.framework,
            violation_type="data_residency" if "region" in str(issues) else "compliance_requirement",
            description=f"Compliance violation for {asset.name}: {'; '.join(issues)}",
            severity=risk_level,
            detected_date=datetime.now(),
            resolved_date=None,
            resolution_description=None,
            business_impact=self._assess_business_impact(risk_level),
            regulatory_risk=self._assess_regulatory_risk(rule.framework, risk_level),
            remediation_cost=self._estimate_remediation_cost(issues, asset.volume_gb),
            responsible_party=asset.owner,
            status="open"
        )
        
        self.violations[violation.id] = violation
        print(f"🚨 Created violation: {violation.description}")
    
    def _assess_business_impact(self, risk_level: str) -> str:
        """Assess business impact of violation"""
        impact_mapping = {
            "low": "Minimal business impact expected",
            "medium": "Moderate impact on operations and reputation",
            "high": "Significant impact on business operations",
            "critical": "Severe impact with potential service disruption"
        }
        return impact_mapping.get(risk_level, "Unknown impact")
    
    def _assess_regulatory_risk(self, framework: ComplianceFramework, risk_level: str) -> str:
        """Assess regulatory risk of violation"""
        framework_risks = {
            ComplianceFramework.GDPR: {
                "low": "Warning from supervisory authority",
                "medium": "Fine up to €10M or 2% of revenue",
                "high": "Fine up to €20M or 4% of revenue",
                "critical": "Maximum GDPR fines plus operational restrictions"
            },
            ComplianceFramework.HIPAA: {
                "low": "Corrective action plan required",
                "medium": "Civil monetary penalties $100-$50,000 per violation",
                "high": "Penalties $10,000-$1.5M per incident",
                "critical": "Criminal charges and maximum penalties"
            },
            ComplianceFramework.PCI_DSS: {
                "low": "Increased monitoring requirements",
                "medium": "Fines $5,000-$10,000 per month",
                "high": "Fines $50,000-$90,000 per month",
                "critical": "Loss of payment processing privileges"
            }
        }
        
        return framework_risks.get(framework, {}).get(risk_level, "Regulatory action possible")
    
    def _estimate_remediation_cost(self, issues: List[str], volume_gb: float) -> float:
        """Estimate cost to remediate violations"""
        base_cost = 1000.0  # Base remediation cost
        
        # Cost factors
        if any("region" in issue.lower() for issue in issues):
            base_cost += volume_gb * 0.5  # Data migration costs
        
        if any("encryption" in issue.lower() for issue in issues):
            base_cost += 2000.0  # Encryption implementation
        
        if any("anonymization" in issue.lower() for issue in issues):
            base_cost += volume_gb * 0.1  # Anonymization processing
        
        if any("retention" in issue.lower() for issue in issues):
            base_cost += 500.0  # Policy implementation
        
        return base_cost
    
    def request_data_transfer(
        self, 
        asset_id: str,
        destination_region: str,
        purpose: str,
        legal_basis: str,
        authorized_by: str
    ) -> Optional[DataTransfer]:
        """Request cross-border data transfer"""
        
        if asset_id not in self.data_assets:
            print(f"❌ Asset {asset_id} not found")
            return None
        
        asset = self.data_assets[asset_id]
        destination_country = self.region_country_mapping.get(destination_region, "Unknown")
        
        # Find applicable rules
        applicable_rules = []
        for rule in self.residency_rules.values():
            if asset.classification in rule.data_types and rule.active:
                applicable_rules.append(rule)
        
        # Check if transfer is allowed
        transfer_allowed = True
        transfer_mechanism = "Standard Transfer"
        
        for rule in applicable_rules:
            if not rule.cross_border_transfer_allowed:
                transfer_allowed = False
                break
            
            if destination_country in rule.prohibited_countries:
                transfer_allowed = False
                break
            
            # Determine transfer mechanism for GDPR
            if rule.framework == ComplianceFramework.GDPR:
                if destination_country in self.adequacy_decisions["gdpr_adequate_countries"]:
                    transfer_mechanism = "Adequacy Decision"
                else:
                    transfer_mechanism = "Standard Contractual Clauses"
        
        transfer = DataTransfer(
            id=f"transfer_{asset_id}_{int(time.time())}",
            source_asset_id=asset_id,
            destination_region=destination_region,
            destination_country=destination_country,
            transfer_mechanism=transfer_mechanism,
            purpose=purpose,
            data_volume_gb=asset.volume_gb,
            transfer_date=datetime.now(),
            authorized_by=authorized_by,
            legal_basis=legal_basis,
            retention_period=asset.retention_policy,
            encryption_method="AES-256",
            status="approved" if transfer_allowed else "rejected",
            approval_date=datetime.now() if transfer_allowed else None,
            completion_date=None
        )
        
        self.transfers[transfer.id] = transfer
        
        if transfer_allowed:
            print(f"✅ Transfer approved: {asset.name} to {destination_region}")
            print(f"   Mechanism: {transfer_mechanism}")
        else:
            print(f"❌ Transfer rejected: {asset.name} to {destination_region}")
            print(f"   Reason: Cross-border transfer not allowed by applicable rules")
        
        return transfer
    
    def get_compliance_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive compliance dashboard"""
        
        dashboard = {
            "summary": {
                "total_assets": len(self.data_assets),
                "total_assessments": len(self.assessments),
                "open_violations": len([v for v in self.violations.values() if v.status == "open"]),
                "pending_transfers": len([t for t in self.transfers.values() if t.status == "pending"])
            },
            "compliance_scores": {},
            "violations": {},
            "risk_distribution": {},
            "framework_compliance": {},
            "data_residency_status": {},
            "transfer_activity": {},
            "upcoming_assessments": []
        }
        
        # Calculate compliance scores by framework
        framework_scores = defaultdict(list)
        for assessment in self.assessments.values():
            framework_scores[assessment.framework].append(assessment.compliance_score)
        
        for framework, scores in framework_scores.items():
            dashboard["compliance_scores"][framework.value] = {
                "average": np.mean(scores),
                "min": min(scores),
                "max": max(scores),
                "count": len(scores)
            }
        
        # Violation statistics
        open_violations = [v for v in self.violations.values() if v.status == "open"]
        violation_by_severity = defaultdict(int)
        violation_by_framework = defaultdict(int)
        
        for violation in open_violations:
            violation_by_severity[violation.severity] += 1
            violation_by_framework[violation.framework.value] += 1
        
        dashboard["violations"] = {
            "by_severity": dict(violation_by_severity),
            "by_framework": dict(violation_by_framework),
            "total_remediation_cost": sum(v.remediation_cost for v in open_violations)
        }
        
        # Risk distribution
        risk_counts = defaultdict(int)
        for assessment in self.assessments.values():
            risk_counts[assessment.risk_level] += 1
        dashboard["risk_distribution"] = dict(risk_counts)
        
        # Framework compliance
        for framework in ComplianceFramework:
            framework_assessments = [a for a in self.assessments.values() if a.framework == framework]
            if framework_assessments:
                passed = len([a for a in framework_assessments if a.status == AuditStatus.PASSED])
                total = len(framework_assessments)
                dashboard["framework_compliance"][framework.value] = {
                    "compliance_rate": (passed / total) * 100 if total > 0 else 0,
                    "total_assessments": total,
                    "passed": passed,
                    "failed": len([a for a in framework_assessments if a.status == AuditStatus.FAILED])
                }
        
        # Data residency status
        residency_status = defaultdict(int)
        for asset in self.data_assets.values():
            country = self.region_country_mapping.get(asset.location, "Unknown")
            residency_status[country] += 1
        dashboard["data_residency_status"] = dict(residency_status)
        
        # Transfer activity
        recent_transfers = [t for t in self.transfers.values() 
                          if t.transfer_date > datetime.now() - timedelta(days=30)]
        
        transfer_by_status = defaultdict(int)
        for transfer in recent_transfers:
            transfer_by_status[transfer.status] += 1
        
        dashboard["transfer_activity"] = {
            "recent_transfers": len(recent_transfers),
            "by_status": dict(transfer_by_status),
            "total_volume_gb": sum(t.data_volume_gb for t in recent_transfers)
        }
        
        # Upcoming assessments
        upcoming = [a for a in self.assessments.values() 
                   if a.next_assessment_date and a.next_assessment_date <= datetime.now() + timedelta(days=30)]
        upcoming.sort(key=lambda x: x.next_assessment_date)
        
        dashboard["upcoming_assessments"] = [
            {
                "asset_name": self.data_assets[a.asset_id].name,
                "framework": a.framework.value,
                "due_date": a.next_assessment_date.isoformat() if a.next_assessment_date else None,
                "current_score": a.compliance_score
            } for a in upcoming[:10]
        ]
        
        return dashboard
    
    def generate_compliance_report(self, framework: Optional[ComplianceFramework] = None) -> Dict[str, Any]:
        """Generate detailed compliance report"""
        
        assessments = list(self.assessments.values())
        if framework:
            assessments = [a for a in assessments if a.framework == framework]
        
        report = {
            "report_date": datetime.now().isoformat(),
            "framework": framework.value if framework else "All Frameworks",
            "executive_summary": {},
            "detailed_findings": [],
            "risk_analysis": {},
            "recommendations": [],
            "action_plan": []
        }
        
        if not assessments:
            report["executive_summary"]["message"] = "No assessments found for specified criteria"
            return report
        
        # Executive summary
        total_assessments = len(assessments)
        passed = len([a for a in assessments if a.status == AuditStatus.PASSED])
        failed = len([a for a in assessments if a.status == AuditStatus.FAILED])
        avg_score = np.mean([a.compliance_score for a in assessments])
        
        report["executive_summary"] = {
            "total_assessments": total_assessments,
            "compliance_rate": (passed / total_assessments) * 100,
            "average_score": avg_score,
            "passed": passed,
            "failed": failed,
            "warnings": len([a for a in assessments if a.status == AuditStatus.WARNING])
        }
        
        # Detailed findings
        for assessment in assessments[:10]:  # Top 10 by risk
            asset = self.data_assets.get(assessment.asset_id)
            rule = self.residency_rules.get(assessment.rule_id)
            
            finding = {
                "asset": asset.name if asset else "Unknown",
                "rule": rule.name if rule else "Unknown",
                "status": assessment.status.value,
                "score": assessment.compliance_score,
                "risk_level": assessment.risk_level,
                "issues": assessment.issues,
                "recommendations": assessment.recommendations
            }
            report["detailed_findings"].append(finding)
        
        # Risk analysis
        risk_counts = defaultdict(int)
        for assessment in assessments:
            risk_counts[assessment.risk_level] += 1
        
        report["risk_analysis"] = {
            "distribution": dict(risk_counts),
            "high_risk_assets": [
                self.data_assets[a.asset_id].name 
                for a in assessments 
                if a.risk_level in ["high", "critical"] and a.asset_id in self.data_assets
            ][:5]
        }
        
        # Recommendations
        all_recommendations = set()
        for assessment in assessments:
            all_recommendations.update(assessment.recommendations)
        
        report["recommendations"] = list(all_recommendations)[:10]
        
        # Action plan
        high_risk_assessments = [a for a in assessments if a.risk_level in ["high", "critical"]]
        for assessment in high_risk_assessments[:5]:
            asset = self.data_assets.get(assessment.asset_id)
            action = {
                "priority": "High" if assessment.risk_level == "critical" else "Medium",
                "asset": asset.name if asset else "Unknown",
                "action": "Address compliance violations",
                "deadline": assessment.remediation_deadline.isoformat() if assessment.remediation_deadline else None,
                "responsible": asset.owner if asset else "Unknown"
            }
            report["action_plan"].append(action)
        
        return report
    
    def simulate_data_breach_impact(self, asset_id: str) -> Dict[str, Any]:
        """Simulate potential impact of data breach"""
        
        if asset_id not in self.data_assets:
            return {"error": "Asset not found"}
        
        asset = self.data_assets[asset_id]
        
        # Find applicable assessments
        asset_assessments = [a for a in self.assessments.values() if a.asset_id == asset_id]
        
        impact = {
            "asset_name": asset.name,
            "data_classification": asset.classification.value,
            "record_count": asset.record_count,
            "regulatory_frameworks": [],
            "potential_fines": {},
            "notification_requirements": [],
            "business_impact": {},
            "remediation_actions": []
        }
        
        # Determine applicable frameworks
        frameworks = set(a.framework for a in asset_assessments)
        impact["regulatory_frameworks"] = [f.value for f in frameworks]
        
        # Calculate potential fines
        record_count = asset.record_count or 1000
        
        if ComplianceFramework.GDPR in frameworks:
            # GDPR: up to €20M or 4% of revenue (using €10M as example)
            gdpr_fine = min(10000000, record_count * 150)  # €150 per record
            impact["potential_fines"]["GDPR"] = f"€{gdpr_fine:,.2f}"
        
        if ComplianceFramework.HIPAA in frameworks:
            # HIPAA: $100-$50,000 per violation, up to $1.5M per incident
            hipaa_fine = min(1500000, record_count * 250)  # $250 per record
            impact["potential_fines"]["HIPAA"] = f"${hipaa_fine:,.2f}"
        
        if ComplianceFramework.PCI_DSS in frameworks:
            # PCI DSS: $5-$90 per compromised record
            pci_fine = record_count * 50  # $50 per record
            impact["potential_fines"]["PCI_DSS"] = f"${pci_fine:,.2f}"
        
        # Notification requirements
        if ComplianceFramework.GDPR in frameworks:
            impact["notification_requirements"].extend([
                "Data Protection Authority within 72 hours",
                "Data subjects without undue delay",
                "Media notification if high risk to individuals"
            ])
        
        if ComplianceFramework.HIPAA in frameworks:
            impact["notification_requirements"].extend([
                "HHS within 60 days",
                "Affected individuals within 60 days",
                "Media notification if breach affects 500+ individuals"
            ])
        
        # Business impact
        impact["business_impact"] = {
            "reputation_damage": "High - customer trust erosion",
            "operational_disruption": "Medium - investigation and remediation efforts",
            "legal_costs": f"${record_count * 5:,.2f} - estimated legal fees",
            "customer_compensation": f"${record_count * 100:,.2f} - credit monitoring etc.",
            "revenue_loss": "10-15% for 12-18 months (industry average)"
        }
        
        # Remediation actions
        impact["remediation_actions"] = [
            "Immediate containment and forensic investigation",
            "Notification of authorities and affected individuals",
            "Credit monitoring services for affected parties",
            "Security improvements and penetration testing",
            "Staff training and process improvements",
            "Regular compliance audits and monitoring",
            "Consider cyber insurance claim if applicable"
        ]
        
        return impact
    
    def start_compliance_monitoring(self):
        """Start automated compliance monitoring"""
        self.monitoring_active = True
        print("🚀 Started automated compliance monitoring")
        
        # In a real implementation, this would start background threads
        # for continuous monitoring, automated assessments, etc.
    
    def stop_compliance_monitoring(self):
        """Stop automated compliance monitoring"""
        self.monitoring_active = False
        print("⏹️ Stopped compliance monitoring")


def main():
    """Test data sovereignty and compliance system"""
    print("🛡️ Data Sovereignty & Compliance Management System")
    print("=" * 60)
    
    # Initialize compliance manager
    manager = DataSovereigntyComplianceManager()
    
    # Display compliance rules
    print(f"\n📋 Compliance Rules ({len(manager.residency_rules)}):")
    for rule in manager.residency_rules.values():
        print(f"  - {rule.name} ({rule.framework.value})")
        print(f"    Data types: {[dt.value for dt in rule.data_types]}")
        print(f"    Cross-border: {'✅' if rule.cross_border_transfer_allowed else '❌'}")
        print(f"    Encryption: {'Required' if rule.encryption_required else 'Optional'}")
    
    # Display data assets
    print(f"\n💾 Data Assets ({len(manager.data_assets)}):")
    for asset in manager.data_assets.values():
        print(f"  - {asset.name} ({asset.classification.value})")
        print(f"    Location: {asset.location} ({manager.region_country_mapping.get(asset.location, 'Unknown')})")
        print(f"    Volume: {asset.volume_gb}GB, Records: {asset.record_count:,}")
        print(f"    Encryption: {asset.encryption_status}")
    
    # Display compliance assessments
    print(f"\n📊 Compliance Assessments ({len(manager.assessments)}):")
    for assessment in list(manager.assessments.values())[:5]:
        asset_name = manager.data_assets[assessment.asset_id].name
        rule_name = manager.residency_rules[assessment.rule_id].name
        
        print(f"  - {asset_name} vs {rule_name}")
        print(f"    Status: {assessment.status.value}, Score: {assessment.compliance_score:.1f}%")
        print(f"    Risk: {assessment.risk_level}")
        if assessment.issues:
            print(f"    Issues: {len(assessment.issues)} found")
    
    # Display violations
    if manager.violations:
        print(f"\n🚨 Compliance Violations ({len(manager.violations)}):")
        for violation in list(manager.violations.values())[:3]:
            print(f"  - {violation.violation_type} ({violation.severity})")
            print(f"    Asset: {manager.data_assets[violation.asset_id].name}")
            print(f"    Framework: {violation.framework.value}")
            print(f"    Remediation cost: ${violation.remediation_cost:.2f}")
    
    # Test data transfer request
    print(f"\n🌐 Testing Cross-Border Data Transfer:")
    transfer = manager.request_data_transfer(
        asset_id="customer_db_eu",
        destination_region="us-east-1",
        purpose="Analytics processing",
        legal_basis="Legitimate interest",
        authorized_by="data-team@company.com"
    )
    
    if transfer:
        print(f"  Transfer Status: {transfer.status}")
        print(f"  Mechanism: {transfer.transfer_mechanism}")
        print(f"  Volume: {transfer.data_volume_gb}GB")
    
    # Get compliance dashboard
    print(f"\n📈 Compliance Dashboard:")
    dashboard = manager.get_compliance_dashboard()
    
    summary = dashboard["summary"]
    print(f"  Assets: {summary['total_assets']}, Assessments: {summary['total_assessments']}")
    print(f"  Open Violations: {summary['open_violations']}")
    
    print(f"\n  Framework Compliance Rates:")
    for framework, data in dashboard["framework_compliance"].items():
        print(f"    {framework}: {data['compliance_rate']:.1f}% ({data['passed']}/{data['total_assessments']})")
    
    print(f"\n  Risk Distribution:")
    for risk, count in dashboard["risk_distribution"].items():
        print(f"    {risk}: {count} assessments")
    
    if dashboard["upcoming_assessments"]:
        print(f"\n  Upcoming Assessments:")
        for assessment in dashboard["upcoming_assessments"][:3]:
            print(f"    - {assessment['asset_name']} ({assessment['framework']})")
            print(f"      Due: {assessment['due_date'][:10]}, Score: {assessment['current_score']:.1f}%")
    
    # Generate compliance report
    print(f"\n📄 GDPR Compliance Report:")
    report = manager.generate_compliance_report(ComplianceFramework.GDPR)
    
    exec_summary = report["executive_summary"]
    print(f"  Compliance Rate: {exec_summary['compliance_rate']:.1f}%")
    print(f"  Average Score: {exec_summary['average_score']:.1f}")
    print(f"  Status: {exec_summary['passed']} passed, {exec_summary['failed']} failed")
    
    print(f"\n  Top Recommendations:")
    for rec in report["recommendations"][:3]:
        print(f"    - {rec}")
    
    # Simulate data breach impact
    print(f"\n💥 Data Breach Impact Simulation:")
    breach_impact = manager.simulate_data_breach_impact("customer_db_eu")
    
    print(f"  Asset: {breach_impact['asset_name']}")
    print(f"  Records at risk: {breach_impact['record_count']:,}")
    print(f"  Frameworks: {', '.join(breach_impact['regulatory_frameworks'])}")
    
    if breach_impact["potential_fines"]:
        print(f"  Potential Fines:")
        for framework, fine in breach_impact["potential_fines"].items():
            print(f"    {framework}: {fine}")
    
    print(f"  Notification deadlines:")
    for req in breach_impact["notification_requirements"][:2]:
        print(f"    - {req}")
    
    # Start monitoring
    print(f"\n🔍 Starting Compliance Monitoring:")
    manager.start_compliance_monitoring()
    
    print(f"  Monitoring active: {manager.monitoring_active}")
    
    print(f"\n✅ Data sovereignty and compliance system operational!")


if __name__ == "__main__":
    main()