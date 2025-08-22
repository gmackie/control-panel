import asyncio
import json
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable, Set
from enum import Enum
import logging
import aiohttp
from concurrent.futures import ThreadPoolExecutor
import subprocess
import time

class PlaybookStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"

class ActionType(Enum):
    ISOLATE_SYSTEM = "isolate_system"
    BLOCK_IP = "block_ip"
    DISABLE_USER = "disable_user"
    QUARANTINE_FILE = "quarantine_file"
    SEND_ALERT = "send_alert"
    COLLECT_EVIDENCE = "collect_evidence"
    UPDATE_FIREWALL = "update_firewall"
    RESET_PASSWORD = "reset_password"
    REVOKE_ACCESS = "revoke_access"
    SCAN_SYSTEM = "scan_system"
    BACKUP_DATA = "backup_data"
    NOTIFY_TEAM = "notify_team"

class IncidentPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class IncidentStatus(Enum):
    NEW = "new"
    INVESTIGATING = "investigating"
    CONTAINING = "containing"
    ERADICATING = "eradicating"
    RECOVERING = "recovering"
    CLOSED = "closed"

@dataclass
class PlaybookAction:
    id: str
    type: ActionType
    description: str
    parameters: Dict[str, Any]
    timeout: int = 300  # 5 minutes default
    retry_count: int = 3
    depends_on: List[str] = field(default_factory=list)
    condition: Optional[str] = None
    approval_required: bool = False

@dataclass
class PlaybookExecution:
    id: str
    playbook_id: str
    incident_id: str
    status: PlaybookStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    actions_completed: List[str] = field(default_factory=list)
    actions_failed: List[str] = field(default_factory=list)
    execution_log: List[Dict[str, Any]] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SecurityIncident:
    id: str
    title: str
    description: str
    priority: IncidentPriority
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    assigned_to: Optional[str] = None
    source_system: str = ""
    affected_assets: List[str] = field(default_factory=list)
    indicators: List[Dict[str, Any]] = field(default_factory=list)
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    artifacts: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class ResponsePlaybook:
    id: str
    name: str
    description: str
    trigger_conditions: List[str]
    actions: List[PlaybookAction]
    approval_required: bool = False
    auto_execute: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    last_modified: datetime = field(default_factory=datetime.now)

class ActionExecutor:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.action_handlers = {
            ActionType.ISOLATE_SYSTEM: self._isolate_system,
            ActionType.BLOCK_IP: self._block_ip,
            ActionType.DISABLE_USER: self._disable_user,
            ActionType.QUARANTINE_FILE: self._quarantine_file,
            ActionType.SEND_ALERT: self._send_alert,
            ActionType.COLLECT_EVIDENCE: self._collect_evidence,
            ActionType.UPDATE_FIREWALL: self._update_firewall,
            ActionType.RESET_PASSWORD: self._reset_password,
            ActionType.REVOKE_ACCESS: self._revoke_access,
            ActionType.SCAN_SYSTEM: self._scan_system,
            ActionType.BACKUP_DATA: self._backup_data,
            ActionType.NOTIFY_TEAM: self._notify_team
        }
        
    async def execute_action(self, action: PlaybookAction, context: Dict[str, Any]) -> Dict[str, Any]:
        handler = self.action_handlers.get(action.type)
        if not handler:
            raise ValueError(f"No handler found for action type: {action.type}")
            
        try:
            result = await asyncio.wait_for(
                handler(action.parameters, context),
                timeout=action.timeout
            )
            return {
                'success': True,
                'result': result,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            
    async def _isolate_system(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        system_id = params.get('system_id')
        isolation_type = params.get('type', 'network')
        
        if isolation_type == 'network':
            # Simulate network isolation
            await asyncio.sleep(2)
            return {
                'action': 'network_isolation',
                'system_id': system_id,
                'status': 'isolated',
                'method': 'firewall_rules'
            }
        elif isolation_type == 'full':
            # Simulate full system isolation
            await asyncio.sleep(3)
            return {
                'action': 'full_isolation',
                'system_id': system_id,
                'status': 'isolated',
                'method': 'vm_snapshot_and_shutdown'
            }
            
    async def _block_ip(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        ip_address = params.get('ip_address')
        duration = params.get('duration', 3600)  # 1 hour default
        
        # Simulate firewall rule addition
        await asyncio.sleep(1)
        return {
            'action': 'ip_blocked',
            'ip_address': ip_address,
            'duration': duration,
            'rule_id': f"block_{ip_address.replace('.', '_')}_{int(time.time())}"
        }
        
    async def _disable_user(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        user_id = params.get('user_id')
        disable_type = params.get('type', 'temporary')
        
        # Simulate user account disabling
        await asyncio.sleep(1)
        return {
            'action': 'user_disabled',
            'user_id': user_id,
            'type': disable_type,
            'timestamp': datetime.now().isoformat()
        }
        
    async def _quarantine_file(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        file_path = params.get('file_path')
        system_id = params.get('system_id')
        
        # Simulate file quarantine
        await asyncio.sleep(2)
        quarantine_id = str(uuid.uuid4())
        return {
            'action': 'file_quarantined',
            'file_path': file_path,
            'system_id': system_id,
            'quarantine_id': quarantine_id,
            'quarantine_location': f"/quarantine/{quarantine_id}"
        }
        
    async def _send_alert(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        recipients = params.get('recipients', [])
        message = params.get('message', '')
        urgency = params.get('urgency', 'medium')
        
        # Simulate alert sending
        await asyncio.sleep(1)
        return {
            'action': 'alert_sent',
            'recipients': recipients,
            'message': message,
            'urgency': urgency,
            'delivery_status': 'sent'
        }
        
    async def _collect_evidence(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        system_id = params.get('system_id')
        evidence_types = params.get('types', ['logs', 'memory', 'network'])
        
        # Simulate evidence collection
        await asyncio.sleep(5)
        evidence_id = str(uuid.uuid4())
        return {
            'action': 'evidence_collected',
            'system_id': system_id,
            'evidence_id': evidence_id,
            'types': evidence_types,
            'storage_location': f"/evidence/{evidence_id}",
            'size_mb': 1250
        }
        
    async def _update_firewall(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        rules = params.get('rules', [])
        firewall_id = params.get('firewall_id', 'default')
        
        # Simulate firewall update
        await asyncio.sleep(2)
        return {
            'action': 'firewall_updated',
            'firewall_id': firewall_id,
            'rules_added': len(rules),
            'status': 'active'
        }
        
    async def _reset_password(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        user_id = params.get('user_id')
        notify_user = params.get('notify_user', True)
        
        # Simulate password reset
        await asyncio.sleep(1)
        return {
            'action': 'password_reset',
            'user_id': user_id,
            'notify_user': notify_user,
            'reset_method': 'email'
        }
        
    async def _revoke_access(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        user_id = params.get('user_id')
        systems = params.get('systems', [])
        
        # Simulate access revocation
        await asyncio.sleep(1)
        return {
            'action': 'access_revoked',
            'user_id': user_id,
            'systems': systems,
            'tokens_revoked': len(systems) * 2
        }
        
    async def _scan_system(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        system_id = params.get('system_id')
        scan_type = params.get('type', 'full')
        
        # Simulate system scan
        await asyncio.sleep(10)
        return {
            'action': 'system_scanned',
            'system_id': system_id,
            'scan_type': scan_type,
            'threats_found': 3,
            'scan_duration': 10,
            'status': 'completed'
        }
        
    async def _backup_data(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        system_id = params.get('system_id')
        data_paths = params.get('paths', [])
        
        # Simulate data backup
        await asyncio.sleep(8)
        backup_id = str(uuid.uuid4())
        return {
            'action': 'data_backed_up',
            'system_id': system_id,
            'backup_id': backup_id,
            'paths': data_paths,
            'backup_size_gb': 15.7
        }
        
    async def _notify_team(self, params: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        team = params.get('team', 'security')
        message = params.get('message', '')
        channels = params.get('channels', ['email', 'slack'])
        
        # Simulate team notification
        await asyncio.sleep(1)
        return {
            'action': 'team_notified',
            'team': team,
            'channels': channels,
            'message': message,
            'delivery_status': 'delivered'
        }

class PlaybookEngine:
    def __init__(self):
        self.action_executor = ActionExecutor()
        self.running_executions = {}
        self.execution_history = []
        
    async def execute_playbook(self, playbook: ResponsePlaybook, incident: SecurityIncident, 
                             variables: Dict[str, Any] = None) -> PlaybookExecution:
        execution = PlaybookExecution(
            id=str(uuid.uuid4()),
            playbook_id=playbook.id,
            incident_id=incident.id,
            status=PlaybookStatus.RUNNING,
            started_at=datetime.now(),
            variables=variables or {}
        )
        
        self.running_executions[execution.id] = execution
        
        try:
            # Execute actions in dependency order
            action_results = {}
            for action in self._sort_actions_by_dependencies(playbook.actions):
                if not self._check_action_condition(action, execution.variables, action_results):
                    continue
                    
                if action.approval_required:
                    approval = await self._request_approval(action, incident)
                    if not approval:
                        execution.execution_log.append({
                            'timestamp': datetime.now().isoformat(),
                            'action_id': action.id,
                            'status': 'skipped',
                            'reason': 'approval_denied'
                        })
                        continue
                        
                # Execute action with retries
                success = False
                for attempt in range(action.retry_count):
                    result = await self.action_executor.execute_action(action, {
                        'incident': incident,
                        'execution': execution,
                        'variables': execution.variables
                    })
                    
                    execution.execution_log.append({
                        'timestamp': datetime.now().isoformat(),
                        'action_id': action.id,
                        'attempt': attempt + 1,
                        'result': result
                    })
                    
                    if result['success']:
                        execution.actions_completed.append(action.id)
                        action_results[action.id] = result['result']
                        success = True
                        break
                    else:
                        if attempt == action.retry_count - 1:
                            execution.actions_failed.append(action.id)
                            
                if not success:
                    # Determine if failure is critical
                    if action.parameters.get('critical', False):
                        execution.status = PlaybookStatus.FAILED
                        break
                        
            if execution.status == PlaybookStatus.RUNNING:
                execution.status = PlaybookStatus.COMPLETED
                
            execution.completed_at = datetime.now()
            
        except Exception as e:
            execution.status = PlaybookStatus.FAILED
            execution.completed_at = datetime.now()
            execution.execution_log.append({
                'timestamp': datetime.now().isoformat(),
                'error': str(e),
                'status': 'execution_failed'
            })
            
        finally:
            if execution.id in self.running_executions:
                del self.running_executions[execution.id]
            self.execution_history.append(execution)
            
        return execution
        
    def _sort_actions_by_dependencies(self, actions: List[PlaybookAction]) -> List[PlaybookAction]:
        sorted_actions = []
        action_dict = {action.id: action for action in actions}
        completed = set()
        
        def can_execute(action):
            return all(dep in completed for dep in action.depends_on)
            
        while len(sorted_actions) < len(actions):
            for action in actions:
                if action.id not in completed and can_execute(action):
                    sorted_actions.append(action)
                    completed.add(action.id)
                    break
            else:
                # Handle circular dependencies or missing dependencies
                remaining = [a for a in actions if a.id not in completed]
                sorted_actions.extend(remaining)
                break
                
        return sorted_actions
        
    def _check_action_condition(self, action: PlaybookAction, variables: Dict[str, Any], 
                               results: Dict[str, Any]) -> bool:
        if not action.condition:
            return True
            
        # Simple condition evaluation (in practice, would use a proper expression parser)
        try:
            context = {'variables': variables, 'results': results}
            return eval(action.condition, {"__builtins__": {}}, context)
        except:
            return True  # Default to execute if condition parsing fails
            
    async def _request_approval(self, action: PlaybookAction, incident: SecurityIncident) -> bool:
        # Simulate approval request
        await asyncio.sleep(2)
        return True  # Auto-approve for demo

class IncidentManager:
    def __init__(self):
        self.incidents = {}
        self.incident_counter = 1
        
    def create_incident(self, title: str, description: str, priority: IncidentPriority,
                       source_system: str = "", indicators: List[Dict[str, Any]] = None) -> SecurityIncident:
        incident = SecurityIncident(
            id=f"INC-{self.incident_counter:06d}",
            title=title,
            description=description,
            priority=priority,
            status=IncidentStatus.NEW,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            source_system=source_system,
            indicators=indicators or []
        )
        
        self.incidents[incident.id] = incident
        self.incident_counter += 1
        
        # Add creation to timeline
        incident.timeline.append({
            'timestamp': incident.created_at.isoformat(),
            'action': 'incident_created',
            'description': f"Incident created from {source_system}",
            'priority': priority.value
        })
        
        return incident
        
    def update_incident_status(self, incident_id: str, status: IncidentStatus, 
                             notes: str = "") -> bool:
        if incident_id not in self.incidents:
            return False
            
        incident = self.incidents[incident_id]
        old_status = incident.status
        incident.status = status
        incident.updated_at = datetime.now()
        
        incident.timeline.append({
            'timestamp': incident.updated_at.isoformat(),
            'action': 'status_changed',
            'description': f"Status changed from {old_status.value} to {status.value}",
            'notes': notes
        })
        
        return True
        
    def assign_incident(self, incident_id: str, assignee: str) -> bool:
        if incident_id not in self.incidents:
            return False
            
        incident = self.incidents[incident_id]
        incident.assigned_to = assignee
        incident.updated_at = datetime.now()
        
        incident.timeline.append({
            'timestamp': incident.updated_at.isoformat(),
            'action': 'assigned',
            'description': f"Incident assigned to {assignee}"
        })
        
        return True
        
    def add_artifact(self, incident_id: str, artifact_type: str, 
                    artifact_data: Dict[str, Any]) -> bool:
        if incident_id not in self.incidents:
            return False
            
        incident = self.incidents[incident_id]
        artifact = {
            'id': str(uuid.uuid4()),
            'type': artifact_type,
            'timestamp': datetime.now().isoformat(),
            'data': artifact_data
        }
        
        incident.artifacts.append(artifact)
        incident.updated_at = datetime.now()
        
        return True

class SecurityOrchestrationPlatform:
    def __init__(self):
        self.incident_manager = IncidentManager()
        self.playbook_engine = PlaybookEngine()
        self.playbooks = {}
        self.triggers = {}
        self.metrics = {
            'incidents_created': 0,
            'playbooks_executed': 0,
            'actions_successful': 0,
            'actions_failed': 0,
            'mean_response_time': 0.0
        }
        
    def register_playbook(self, playbook: ResponsePlaybook):
        self.playbooks[playbook.id] = playbook
        
        # Register triggers
        for condition in playbook.trigger_conditions:
            if condition not in self.triggers:
                self.triggers[condition] = []
            self.triggers[condition].append(playbook.id)
            
    async def handle_security_event(self, event_data: Dict[str, Any]) -> List[str]:
        # Create incident from event
        incident = self.incident_manager.create_incident(
            title=event_data.get('title', 'Security Event'),
            description=event_data.get('description', ''),
            priority=IncidentPriority(event_data.get('priority', 'medium')),
            source_system=event_data.get('source', 'unknown'),
            indicators=event_data.get('indicators', [])
        )
        
        self.metrics['incidents_created'] += 1
        
        # Find matching playbooks
        triggered_playbooks = []
        for trigger, playbook_ids in self.triggers.items():
            if self._evaluate_trigger(trigger, event_data):
                triggered_playbooks.extend(playbook_ids)
                
        # Execute triggered playbooks
        execution_ids = []
        for playbook_id in set(triggered_playbooks):
            playbook = self.playbooks[playbook_id]
            
            if playbook.auto_execute or await self._request_playbook_approval(playbook, incident):
                execution = await self.playbook_engine.execute_playbook(
                    playbook, incident, event_data.get('variables', {})
                )
                execution_ids.append(execution.id)
                self.metrics['playbooks_executed'] += 1
                
                # Update incident status based on playbook execution
                if execution.status == PlaybookStatus.COMPLETED:
                    self.incident_manager.update_incident_status(
                        incident.id, IncidentStatus.CONTAINING,
                        f"Automated response playbook {playbook.name} completed successfully"
                    )
                elif execution.status == PlaybookStatus.FAILED:
                    self.incident_manager.update_incident_status(
                        incident.id, IncidentStatus.INVESTIGATING,
                        f"Automated response playbook {playbook.name} failed - manual intervention required"
                    )
                    
        return execution_ids
        
    def _evaluate_trigger(self, trigger: str, event_data: Dict[str, Any]) -> bool:
        # Simple trigger evaluation (in practice, would use a proper rule engine)
        if trigger == "malware_detected":
            return event_data.get('threat_type') == 'malware'
        elif trigger == "brute_force_detected":
            return event_data.get('threat_type') == 'brute_force'
        elif trigger == "data_exfiltration_detected":
            return event_data.get('threat_type') == 'data_exfiltration'
        elif trigger == "high_severity":
            return event_data.get('severity') in ['high', 'critical']
        elif trigger == "insider_threat":
            return event_data.get('threat_type') == 'insider_threat'
        return False
        
    async def _request_playbook_approval(self, playbook: ResponsePlaybook, 
                                       incident: SecurityIncident) -> bool:
        if not playbook.approval_required:
            return True
        # Simulate approval request
        await asyncio.sleep(1)
        return True  # Auto-approve for demo
        
    def get_incident_status(self, incident_id: str) -> Optional[Dict[str, Any]]:
        if incident_id not in self.incident_manager.incidents:
            return None
            
        incident = self.incident_manager.incidents[incident_id]
        return {
            'id': incident.id,
            'title': incident.title,
            'status': incident.status.value,
            'priority': incident.priority.value,
            'created_at': incident.created_at.isoformat(),
            'updated_at': incident.updated_at.isoformat(),
            'assigned_to': incident.assigned_to,
            'timeline_events': len(incident.timeline),
            'artifacts_count': len(incident.artifacts)
        }
        
    def get_platform_metrics(self) -> Dict[str, Any]:
        return {
            **self.metrics,
            'active_incidents': len([i for i in self.incident_manager.incidents.values() 
                                   if i.status != IncidentStatus.CLOSED]),
            'total_incidents': len(self.incident_manager.incidents),
            'registered_playbooks': len(self.playbooks),
            'running_executions': len(self.playbook_engine.running_executions)
        }

# Predefined playbooks
def create_malware_response_playbook() -> ResponsePlaybook:
    return ResponsePlaybook(
        id="malware_response_v1",
        name="Malware Incident Response",
        description="Automated response to malware detection",
        trigger_conditions=["malware_detected", "high_severity"],
        auto_execute=True,
        actions=[
            PlaybookAction(
                id="isolate_infected_system",
                type=ActionType.ISOLATE_SYSTEM,
                description="Isolate the infected system from network",
                parameters={"system_id": "${event.system_id}", "type": "network"},
                timeout=60
            ),
            PlaybookAction(
                id="collect_malware_evidence",
                type=ActionType.COLLECT_EVIDENCE,
                description="Collect evidence from infected system",
                parameters={"system_id": "${event.system_id}", "types": ["memory", "disk", "network"]},
                depends_on=["isolate_infected_system"],
                timeout=300
            ),
            PlaybookAction(
                id="notify_security_team",
                type=ActionType.NOTIFY_TEAM,
                description="Notify security team of malware incident",
                parameters={"team": "security", "message": "Malware detected and contained", "channels": ["email", "slack"]},
                timeout=30
            ),
            PlaybookAction(
                id="quarantine_malware_file",
                type=ActionType.QUARANTINE_FILE,
                description="Quarantine the malware file",
                parameters={"file_path": "${event.file_path}", "system_id": "${event.system_id}"},
                timeout=60
            ),
            PlaybookAction(
                id="scan_related_systems",
                type=ActionType.SCAN_SYSTEM,
                description="Scan systems that may be affected",
                parameters={"system_id": "${event.related_systems}", "type": "malware"},
                depends_on=["quarantine_malware_file"],
                timeout=600
            )
        ]
    )

def create_brute_force_response_playbook() -> ResponsePlaybook:
    return ResponsePlaybook(
        id="brute_force_response_v1",
        name="Brute Force Attack Response",
        description="Automated response to brute force attacks",
        trigger_conditions=["brute_force_detected"],
        auto_execute=True,
        actions=[
            PlaybookAction(
                id="block_attacker_ip",
                type=ActionType.BLOCK_IP,
                description="Block the attacking IP address",
                parameters={"ip_address": "${event.source_ip}", "duration": 3600},
                timeout=30
            ),
            PlaybookAction(
                id="disable_targeted_account",
                type=ActionType.DISABLE_USER,
                description="Temporarily disable the targeted user account",
                parameters={"user_id": "${event.target_user}", "type": "temporary"},
                timeout=30
            ),
            PlaybookAction(
                id="reset_user_password",
                type=ActionType.RESET_PASSWORD,
                description="Reset password for targeted account",
                parameters={"user_id": "${event.target_user}", "notify_user": True},
                depends_on=["disable_targeted_account"],
                timeout=60
            ),
            PlaybookAction(
                id="update_firewall_rules",
                type=ActionType.UPDATE_FIREWALL,
                description="Update firewall rules to prevent similar attacks",
                parameters={"rules": [{"action": "deny", "source": "${event.source_subnet}"}]},
                timeout=120
            ),
            PlaybookAction(
                id="notify_user_security",
                type=ActionType.SEND_ALERT,
                description="Notify user of security incident",
                parameters={"recipients": ["${event.target_user}"], "message": "Your account was targeted in a brute force attack. Your password has been reset.", "urgency": "high"},
                depends_on=["reset_user_password"],
                timeout=30
            )
        ]
    )

# Example usage
async def main():
    platform = SecurityOrchestrationPlatform()
    
    # Register playbooks
    platform.register_playbook(create_malware_response_playbook())
    platform.register_playbook(create_brute_force_response_playbook())
    
    # Simulate malware detection event
    malware_event = {
        'title': 'Malware Detected on Workstation',
        'description': 'Suspicious executable detected by antivirus',
        'priority': 'high',
        'severity': 'high',
        'threat_type': 'malware',
        'source': 'antivirus_system',
        'system_id': 'WS-001',
        'file_path': '/tmp/suspicious.exe',
        'related_systems': ['WS-002', 'WS-003'],
        'indicators': [
            {'type': 'file_hash', 'value': 'a1b2c3d4e5f6...'},
            {'type': 'ip', 'value': '192.168.1.100'}
        ]
    }
    
    # Handle the event
    execution_ids = await platform.handle_security_event(malware_event)
    print(f"Triggered executions: {execution_ids}")
    
    # Check platform metrics
    metrics = platform.get_platform_metrics()
    print(f"Platform metrics: {metrics}")
    
    # Simulate brute force event
    brute_force_event = {
        'title': 'Brute Force Attack Detected',
        'description': 'Multiple failed login attempts detected',
        'priority': 'medium',
        'threat_type': 'brute_force',
        'source': 'auth_system',
        'source_ip': '10.0.0.50',
        'target_user': 'admin',
        'source_subnet': '10.0.0.0/24',
        'failed_attempts': 15
    }
    
    execution_ids = await platform.handle_security_event(brute_force_event)
    print(f"Brute force response executions: {execution_ids}")

if __name__ == "__main__":
    asyncio.run(main())