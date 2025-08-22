import asyncio
import json
import re
import hashlib
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple, Union
from enum import Enum
import logging
import uuid
from collections import defaultdict, deque
import numpy as np

class IntentType(Enum):
    CLUSTER_STATUS = "cluster_status"
    SERVICE_STATUS = "service_status"
    DEPLOYMENT_INFO = "deployment_info"
    RESOURCE_USAGE = "resource_usage"
    INCIDENT_ANALYSIS = "incident_analysis"
    CAPACITY_PLANNING = "capacity_planning"
    TROUBLESHOOTING = "troubleshooting"
    SCALE_RESOURCE = "scale_resource"
    RESTART_SERVICE = "restart_service"
    VIEW_LOGS = "view_logs"
    MONITOR_ALERTS = "monitor_alerts"
    HELP = "help"
    GREETING = "greeting"
    UNKNOWN = "unknown"

class EntityType(Enum):
    SERVICE_NAME = "service_name"
    NAMESPACE = "namespace"
    POD_NAME = "pod_name"
    DEPLOYMENT_NAME = "deployment_name"
    NODE_NAME = "node_name"
    METRIC_NAME = "metric_name"
    TIME_PERIOD = "time_period"
    RESOURCE_TYPE = "resource_type"
    NUMBER = "number"

class ConversationState(Enum):
    INITIAL = "initial"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    COLLECTING_INFO = "collecting_info"
    EXECUTING_ACTION = "executing_action"
    COMPLETED = "completed"

class ResponseType(Enum):
    TEXT = "text"
    TABLE = "table"
    CHART = "chart"
    ACTION_CONFIRMATION = "action_confirmation"
    ERROR = "error"
    SUGGESTIONS = "suggestions"

@dataclass
class Entity:
    entity_type: EntityType
    value: str
    confidence: float
    start_pos: int
    end_pos: int

@dataclass
class Intent:
    intent_type: IntentType
    confidence: float
    entities: List[Entity] = field(default_factory=list)

@dataclass
class ChatMessage:
    message_id: str
    user_id: str
    text: str
    timestamp: datetime
    intent: Optional[Intent] = None
    session_id: Optional[str] = None

@dataclass
class ChatResponse:
    response_id: str
    message_id: str
    response_type: ResponseType
    content: Dict[str, Any]
    suggestions: List[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass
class ConversationContext:
    session_id: str
    user_id: str
    state: ConversationState
    last_intent: Optional[IntentType] = None
    entities: Dict[str, str] = field(default_factory=dict)
    pending_action: Optional[Dict[str, Any]] = None
    history: List[ChatMessage] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

class NLPProcessor:
    def __init__(self):
        self.intent_patterns = {
            IntentType.CLUSTER_STATUS: [
                r"(cluster|nodes?|infrastructure) (status|health|state)",
                r"how (is|are) (the )?(cluster|nodes?)",
                r"show (me )?(cluster|node) (info|status|health)",
                r"what.{0,20}(state|condition) of.{0,10}cluster",
            ],
            IntentType.SERVICE_STATUS: [
                r"(service|services?) (status|health|state)",
                r"(is|are) (\w+) (service|running|up|down)",
                r"check (\w+) (service|health)",
                r"show (me )?(service|services?) (status|health)",
            ],
            IntentType.DEPLOYMENT_INFO: [
                r"(deployment|deployments?) (info|status|details)",
                r"show (me )?(deployment|app) (\w+)",
                r"what.{0,20}(version|image) of (\w+)",
                r"(list|show) (all )?deployments?",
            ],
            IntentType.RESOURCE_USAGE: [
                r"(cpu|memory|disk|resource) (usage|utilization)",
                r"how much (cpu|memory|resources?)",
                r"show (me )?(resource|cpu|memory) (usage|stats)",
                r"(resource|system) (consumption|metrics)",
            ],
            IntentType.INCIDENT_ANALYSIS: [
                r"(analyze|investigate|check) (incident|issue|problem)",
                r"what.{0,20}(wrong|issue|problem)",
                r"root cause (analysis|investigation)",
                r"troubleshoot (\w+)",
            ],
            IntentType.CAPACITY_PLANNING: [
                r"capacity (planning|forecast|prediction)",
                r"(when|will) (need|require) more (resources?|capacity)",
                r"(predict|forecast) (resource|capacity) (needs?|requirements?)",
                r"scaling (recommendations?|suggestions?)",
            ],
            IntentType.SCALE_RESOURCE: [
                r"scale (up|down|out|in) (\w+)",
                r"(increase|decrease|add|remove) (replicas?|instances?)",
                r"(scale|resize) (\w+) to (\d+)",
                r"(auto.?scale|autoscaling) (\w+)",
            ],
            IntentType.RESTART_SERVICE: [
                r"restart (\w+)",
                r"(reboot|reload) (\w+) (service|pod|deployment)",
                r"(bounce|cycle) (\w+)",
                r"(kill|stop|start) (\w+)",
            ],
            IntentType.VIEW_LOGS: [
                r"(show|view|get) (logs?|log) (of|for|from) (\w+)",
                r"(\w+) (logs?|log)",
                r"tail (logs?|log) (\w+)",
                r"(recent|latest) (logs?|log)",
            ],
            IntentType.MONITOR_ALERTS: [
                r"(show|list|view) (alerts?|alarms?)",
                r"(active|current|open) (alerts?|incidents?)",
                r"(alert|alarm) (status|summary)",
                r"what.{0,20}(alerts?|alarms?) (are )?active",
            ],
            IntentType.HELP: [
                r"help",
                r"what can (you|i) do",
                r"(available )?commands?",
                r"(how to|usage|instructions)",
            ],
            IntentType.GREETING: [
                r"(hi|hello|hey|good (morning|afternoon|evening))",
                r"(what.?s up|how are you)",
                r"greetings?",
            ],
        }
        
        self.entity_patterns = {
            EntityType.SERVICE_NAME: [
                r"\b(prometheus|grafana|gitea|postgres|redis|nginx|api|frontend|backend|database)\b",
                r"\b(\w+\-\w+)\b",  # service-name pattern
            ],
            EntityType.NAMESPACE: [
                r"(in|from|namespace) (\w+)",
                r"(\w+) namespace",
                r"\-n (\w+)",
            ],
            EntityType.TIME_PERIOD: [
                r"(last|past|previous) (\d+) (minutes?|hours?|days?)",
                r"(\d+) (minutes?|hours?|days?) ago",
                r"(today|yesterday|this week|last week)",
            ],
            EntityType.RESOURCE_TYPE: [
                r"\b(cpu|memory|disk|storage|network|bandwidth)\b",
                r"\b(cores?|ram|gb|mb|tb)\b",
            ],
            EntityType.NUMBER: [
                r"\b(\d+)\b",
            ],
        }
        
        self.context_keywords = {
            "urgent": ["urgent", "critical", "emergency", "immediately", "asap", "now"],
            "negative": ["down", "failed", "error", "issue", "problem", "broken", "not working"],
            "positive": ["good", "healthy", "working", "fine", "ok", "green", "stable"],
            "time_sensitive": ["quick", "fast", "soon", "urgent", "immediately"],
        }

    async def process_message(self, message: ChatMessage) -> Intent:
        """Process a chat message and extract intent and entities"""
        text = message.text.lower().strip()
        
        # Detect intent
        intent_type, intent_confidence = await self._detect_intent(text)
        
        # Extract entities
        entities = await self._extract_entities(text, intent_type)
        
        # Create intent object
        intent = Intent(
            intent_type=intent_type,
            confidence=intent_confidence,
            entities=entities
        )
        
        message.intent = intent
        return intent

    async def _detect_intent(self, text: str) -> Tuple[IntentType, float]:
        """Detect the intent from text"""
        best_intent = IntentType.UNKNOWN
        best_confidence = 0.0
        
        for intent_type, patterns in self.intent_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    # Calculate confidence based on pattern specificity and match quality
                    confidence = self._calculate_intent_confidence(text, pattern, match)
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_intent = intent_type
        
        return best_intent, best_confidence

    def _calculate_intent_confidence(self, text: str, pattern: str, match: re.Match) -> float:
        """Calculate confidence score for intent detection"""
        base_confidence = 0.7
        
        # Boost confidence for exact matches
        if match.group() == text:
            base_confidence += 0.2
        
        # Boost confidence for longer patterns
        pattern_length_bonus = min(len(pattern) / 100, 0.1)
        base_confidence += pattern_length_bonus
        
        # Boost confidence for specific service names
        if any(service in text for service in ["prometheus", "grafana", "gitea", "postgres"]):
            base_confidence += 0.1
        
        return min(base_confidence, 1.0)

    async def _extract_entities(self, text: str, intent_type: IntentType) -> List[Entity]:
        """Extract entities from text"""
        entities = []
        
        for entity_type, patterns in self.entity_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    # Determine the entity value
                    if entity_type == EntityType.NAMESPACE and match.groups():
                        value = match.group(2) if len(match.groups()) >= 2 else match.group(1)
                    elif entity_type == EntityType.TIME_PERIOD and match.groups():
                        value = match.group(0)
                    elif match.groups():
                        value = match.group(1)
                    else:
                        value = match.group(0)
                    
                    entity = Entity(
                        entity_type=entity_type,
                        value=value.strip(),
                        confidence=0.8,
                        start_pos=match.start(),
                        end_pos=match.end()
                    )
                    entities.append(entity)
        
        # Remove duplicate entities
        unique_entities = []
        seen = set()
        for entity in entities:
            key = (entity.entity_type, entity.value.lower())
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)
        
        return unique_entities

    def extract_context_signals(self, text: str) -> Dict[str, bool]:
        """Extract context signals from text"""
        signals = {}
        
        for signal_type, keywords in self.context_keywords.items():
            signals[signal_type] = any(keyword in text.lower() for keyword in keywords)
        
        return signals

class ConversationManager:
    def __init__(self):
        self.sessions = {}
        self.session_timeout = timedelta(hours=1)
        
    async def get_or_create_session(self, user_id: str, session_id: Optional[str] = None) -> ConversationContext:
        """Get existing session or create new one"""
        if session_id and session_id in self.sessions:
            context = self.sessions[session_id]
            context.updated_at = datetime.now()
            return context
        
        # Create new session
        new_session_id = session_id or str(uuid.uuid4())
        context = ConversationContext(
            session_id=new_session_id,
            user_id=user_id,
            state=ConversationState.INITIAL
        )
        self.sessions[new_session_id] = context
        return context

    async def update_context(self, context: ConversationContext, message: ChatMessage, intent: Intent):
        """Update conversation context with new message and intent"""
        context.history.append(message)
        context.last_intent = intent.intent_type
        context.updated_at = datetime.now()
        
        # Update entities
        for entity in intent.entities:
            context.entities[entity.entity_type.value] = entity.value
        
        # Update state based on intent
        if intent.intent_type in [IntentType.SCALE_RESOURCE, IntentType.RESTART_SERVICE]:
            context.state = ConversationState.AWAITING_CONFIRMATION
            context.pending_action = {
                "action": intent.intent_type.value,
                "entities": {e.entity_type.value: e.value for e in intent.entities}
            }
        elif context.state == ConversationState.AWAITING_CONFIRMATION:
            if any(word in message.text.lower() for word in ["yes", "confirm", "proceed", "ok"]):
                context.state = ConversationState.EXECUTING_ACTION
            elif any(word in message.text.lower() for word in ["no", "cancel", "abort", "stop"]):
                context.state = ConversationState.INITIAL
                context.pending_action = None

    async def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        current_time = datetime.now()
        expired_sessions = [
            session_id for session_id, context in self.sessions.items()
            if current_time - context.updated_at > self.session_timeout
        ]
        
        for session_id in expired_sessions:
            del self.sessions[session_id]

class ResponseGenerator:
    def __init__(self):
        self.response_templates = {
            IntentType.GREETING: [
                "Hello! I'm your Kubernetes assistant. How can I help you manage your cluster today?",
                "Hi there! Ready to help you with your infrastructure. What would you like to know?",
                "Welcome! I can help you with cluster status, deployments, troubleshooting, and more.",
            ],
            IntentType.HELP: [
                "I can help you with:\n• Cluster and service status\n• Resource usage and monitoring\n• Deployments and scaling\n• Incident analysis\n• Log viewing\n• Capacity planning",
                "Here's what I can do:\n• Check system health\n• Analyze performance\n• Troubleshoot issues\n• Scale resources\n• View logs and metrics",
            ],
            IntentType.UNKNOWN: [
                "I'm not sure I understand. Could you rephrase that?",
                "I didn't catch that. Try asking about cluster status, services, or deployments.",
                "Could you be more specific? I can help with monitoring, troubleshooting, or resource management.",
            ],
        }
        
        self.suggestion_templates = {
            IntentType.CLUSTER_STATUS: [
                "Show service status",
                "Check resource usage",
                "View recent alerts",
            ],
            IntentType.SERVICE_STATUS: [
                "View service logs",
                "Check deployment details",
                "Scale this service",
            ],
            IntentType.INCIDENT_ANALYSIS: [
                "View related logs",
                "Check resource metrics",
                "Run root cause analysis",
            ],
        }

    async def generate_response(self, intent: Intent, context: ConversationContext, 
                               system_data: Dict[str, Any] = None) -> ChatResponse:
        """Generate response based on intent and context"""
        
        if context.state == ConversationState.AWAITING_CONFIRMATION:
            return await self._generate_confirmation_response(context)
        
        if intent.intent_type == IntentType.GREETING:
            return await self._generate_greeting_response(intent, context)
        elif intent.intent_type == IntentType.HELP:
            return await self._generate_help_response(intent, context)
        elif intent.intent_type == IntentType.CLUSTER_STATUS:
            return await self._generate_cluster_status_response(intent, context, system_data)
        elif intent.intent_type == IntentType.SERVICE_STATUS:
            return await self._generate_service_status_response(intent, context, system_data)
        elif intent.intent_type == IntentType.RESOURCE_USAGE:
            return await self._generate_resource_usage_response(intent, context, system_data)
        elif intent.intent_type == IntentType.VIEW_LOGS:
            return await self._generate_logs_response(intent, context, system_data)
        elif intent.intent_type == IntentType.SCALE_RESOURCE:
            return await self._generate_scale_confirmation_response(intent, context)
        elif intent.intent_type == IntentType.RESTART_SERVICE:
            return await self._generate_restart_confirmation_response(intent, context)
        else:
            return await self._generate_unknown_response(intent, context)

    async def _generate_greeting_response(self, intent: Intent, context: ConversationContext) -> ChatResponse:
        """Generate greeting response"""
        template = np.random.choice(self.response_templates[IntentType.GREETING])
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": template},
            suggestions=[
                "Show cluster status",
                "Check service health",
                "View resource usage",
                "Help"
            ]
        )

    async def _generate_help_response(self, intent: Intent, context: ConversationContext) -> ChatResponse:
        """Generate help response"""
        help_text = """I can assist you with:

**📊 Monitoring & Status**
• `cluster status` - Check overall cluster health
• `service status` - View service health and availability
• `resource usage` - Monitor CPU, memory, and storage

**🔍 Troubleshooting**
• `analyze incident` - Investigate issues and root causes
• `show logs for [service]` - View application logs
• `check alerts` - List active alerts and warnings

**⚙️ Management**
• `scale [service] to [number]` - Scale deployments
• `restart [service]` - Restart services or pods
• `capacity planning` - Forecast resource needs

**💡 Examples:**
• "Show me the status of prometheus"
• "Scale api to 3 replicas"
• "View logs for frontend service"
• "What's wrong with the cluster?"
"""
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": help_text},
            suggestions=[
                "cluster status",
                "service status", 
                "resource usage",
                "show alerts"
            ]
        )

    async def _generate_cluster_status_response(self, intent: Intent, context: ConversationContext, 
                                              system_data: Dict[str, Any]) -> ChatResponse:
        """Generate cluster status response"""
        if not system_data:
            return await self._generate_error_response("Unable to fetch cluster data")
        
        cluster_data = system_data.get("cluster", {})
        
        # Create status summary
        total_nodes = cluster_data.get("total_nodes", 0)
        ready_nodes = cluster_data.get("ready_nodes", 0)
        total_pods = cluster_data.get("total_pods", 0)
        running_pods = cluster_data.get("running_pods", 0)
        cpu_usage = cluster_data.get("cpu_usage_percent", 0)
        memory_usage = cluster_data.get("memory_usage_percent", 0)
        
        status_emoji = "🟢" if ready_nodes == total_nodes and running_pods > 0 else "🟡"
        
        status_text = f"""{status_emoji} **Cluster Status**

**Nodes:** {ready_nodes}/{total_nodes} ready
**Pods:** {running_pods}/{total_pods} running
**CPU Usage:** {cpu_usage:.1f}%
**Memory Usage:** {memory_usage:.1f}%

Overall health: {"Healthy" if ready_nodes == total_nodes else "Degraded"}
"""
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": status_text},
            suggestions=[
                "Show service status",
                "Check resource details",
                "View recent alerts"
            ]
        )

    async def _generate_service_status_response(self, intent: Intent, context: ConversationContext,
                                              system_data: Dict[str, Any]) -> ChatResponse:
        """Generate service status response"""
        if not system_data:
            return await self._generate_error_response("Unable to fetch service data")
        
        services = system_data.get("services", [])
        
        # Check if specific service requested
        service_name = context.entities.get("service_name")
        if service_name:
            service = next((s for s in services if s.get("name") == service_name), None)
            if service:
                return await self._generate_single_service_response(service, context)
            else:
                return await self._generate_error_response(f"Service '{service_name}' not found")
        
        # Generate overview of all services
        healthy_count = sum(1 for s in services if s.get("status") == "healthy")
        total_count = len(services)
        
        status_text = f"**Service Overview**\n\n"
        status_text += f"**{healthy_count}/{total_count}** services healthy\n\n"
        
        # Show top services by status
        for service in services[:10]:
            status_emoji = "🟢" if service.get("status") == "healthy" else "🔴"
            status_text += f"{status_emoji} **{service.get('name')}** - {service.get('status')}\n"
        
        if len(services) > 10:
            status_text += f"\n... and {len(services) - 10} more services"
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": status_text},
            suggestions=[
                "Check specific service",
                "View unhealthy services",
                "Show resource usage"
            ]
        )

    async def _generate_single_service_response(self, service: Dict[str, Any], 
                                              context: ConversationContext) -> ChatResponse:
        """Generate response for single service status"""
        name = service.get("name", "Unknown")
        status = service.get("status", "unknown")
        replicas = service.get("replicas", {})
        
        status_emoji = "🟢" if status == "healthy" else "🔴"
        
        response_text = f"{status_emoji} **{name}**\n\n"
        response_text += f"**Status:** {status.title()}\n"
        response_text += f"**Replicas:** {replicas.get('ready', 0)}/{replicas.get('desired', 0)}\n"
        
        if service.get("cpu_usage"):
            response_text += f"**CPU:** {service['cpu_usage']:.1f}%\n"
        if service.get("memory_usage"):
            response_text += f"**Memory:** {service['memory_usage']:.1f}%\n"
        
        if service.get("last_deployed"):
            response_text += f"**Last Deployed:** {service['last_deployed']}\n"
        
        suggestions = [
            f"View {name} logs",
            f"Scale {name}",
            "Check dependencies"
        ]
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": response_text},
            suggestions=suggestions
        )

    async def _generate_resource_usage_response(self, intent: Intent, context: ConversationContext,
                                              system_data: Dict[str, Any]) -> ChatResponse:
        """Generate resource usage response"""
        if not system_data:
            return await self._generate_error_response("Unable to fetch resource data")
        
        resources = system_data.get("resources", {})
        
        response_text = "**📊 Resource Usage**\n\n"
        
        # CPU Usage
        cpu_data = resources.get("cpu", {})
        response_text += f"**CPU:** {cpu_data.get('usage_percent', 0):.1f}% "
        response_text += f"({cpu_data.get('used_cores', 0):.1f}/{cpu_data.get('total_cores', 0)} cores)\n"
        
        # Memory Usage
        memory_data = resources.get("memory", {})
        response_text += f"**Memory:** {memory_data.get('usage_percent', 0):.1f}% "
        response_text += f"({memory_data.get('used_gb', 0):.1f}/{memory_data.get('total_gb', 0)} GB)\n"
        
        # Storage Usage
        storage_data = resources.get("storage", {})
        if storage_data:
            response_text += f"**Storage:** {storage_data.get('usage_percent', 0):.1f}% "
            response_text += f"({storage_data.get('used_gb', 0):.1f}/{storage_data.get('total_gb', 0)} GB)\n"
        
        # Network Usage
        network_data = resources.get("network", {})
        if network_data:
            response_text += f"**Network In:** {network_data.get('in_mbps', 0):.1f} Mbps\n"
            response_text += f"**Network Out:** {network_data.get('out_mbps', 0):.1f} Mbps\n"
        
        # Resource health indicator
        avg_usage = np.mean([
            cpu_data.get('usage_percent', 0),
            memory_data.get('usage_percent', 0)
        ])
        
        if avg_usage < 70:
            health_indicator = "🟢 Healthy"
        elif avg_usage < 85:
            health_indicator = "🟡 Moderate"
        else:
            health_indicator = "🔴 High Usage"
        
        response_text += f"\n**Status:** {health_indicator}"
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": response_text},
            suggestions=[
                "Show top consumers",
                "Capacity planning",
                "Resource optimization"
            ]
        )

    async def _generate_logs_response(self, intent: Intent, context: ConversationContext,
                                    system_data: Dict[str, Any]) -> ChatResponse:
        """Generate logs response"""
        service_name = context.entities.get("service_name")
        if not service_name:
            return await self._generate_error_response("Please specify which service logs you want to view")
        
        logs = system_data.get("logs", []) if system_data else []
        
        if not logs:
            return await self._generate_error_response(f"No recent logs found for {service_name}")
        
        response_text = f"**📋 Recent Logs for {service_name}**\n\n"
        
        # Show last 10 log entries
        for log_entry in logs[-10:]:
            timestamp = log_entry.get("timestamp", "")
            level = log_entry.get("level", "INFO")
            message = log_entry.get("message", "")
            
            level_emoji = {"ERROR": "🔴", "WARN": "🟡", "INFO": "ℹ️"}.get(level, "ℹ️")
            response_text += f"{level_emoji} `{timestamp}` {message}\n"
        
        suggestions = [
            f"Show more {service_name} logs",
            f"Filter error logs",
            f"Restart {service_name}"
        ]
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": response_text},
            suggestions=suggestions
        )

    async def _generate_scale_confirmation_response(self, intent: Intent, context: ConversationContext) -> ChatResponse:
        """Generate scaling confirmation response"""
        service_name = context.entities.get("service_name", "service")
        replicas = context.entities.get("number", "N")
        
        response_text = f"⚠️ **Scaling Confirmation**\n\n"
        response_text += f"Are you sure you want to scale **{service_name}** to **{replicas}** replicas?\n\n"
        response_text += "This action will modify the deployment. Type 'yes' to confirm or 'no' to cancel."
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.ACTION_CONFIRMATION,
            content={"text": response_text},
            suggestions=["Yes, proceed", "No, cancel"]
        )

    async def _generate_restart_confirmation_response(self, intent: Intent, context: ConversationContext) -> ChatResponse:
        """Generate restart confirmation response"""
        service_name = context.entities.get("service_name", "service")
        
        response_text = f"⚠️ **Restart Confirmation**\n\n"
        response_text += f"Are you sure you want to restart **{service_name}**?\n\n"
        response_text += "This will cause temporary downtime. Type 'yes' to confirm or 'no' to cancel."
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.ACTION_CONFIRMATION,
            content={"text": response_text},
            suggestions=["Yes, restart", "No, cancel"]
        )

    async def _generate_confirmation_response(self, context: ConversationContext) -> ChatResponse:
        """Generate response for pending confirmation"""
        action = context.pending_action
        if not action:
            return await self._generate_error_response("No pending action found")
        
        response_text = f"Please confirm the {action['action']} action by typing 'yes' or 'no'."
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.ACTION_CONFIRMATION,
            content={"text": response_text},
            suggestions=["Yes", "No"]
        )

    async def _generate_unknown_response(self, intent: Intent, context: ConversationContext) -> ChatResponse:
        """Generate response for unknown intent"""
        template = np.random.choice(self.response_templates[IntentType.UNKNOWN])
        
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id=context.history[-1].message_id if context.history else "",
            response_type=ResponseType.TEXT,
            content={"text": template},
            suggestions=[
                "Help",
                "Show cluster status",
                "Check services",
                "Resource usage"
            ]
        )

    async def _generate_error_response(self, error_message: str) -> ChatResponse:
        """Generate error response"""
        return ChatResponse(
            response_id=str(uuid.uuid4()),
            message_id="",
            response_type=ResponseType.ERROR,
            content={"text": f"❌ {error_message}"},
            suggestions=["Help", "Try again"]
        )

class ChatbotNLPInterface:
    def __init__(self):
        self.nlp_processor = NLPProcessor()
        self.conversation_manager = ConversationManager()
        self.response_generator = ResponseGenerator()
        self.analytics = defaultdict(int)
        
    async def process_message(self, user_id: str, message_text: str, 
                            session_id: Optional[str] = None,
                            system_data: Optional[Dict[str, Any]] = None) -> ChatResponse:
        """Process incoming chat message and generate response"""
        
        # Create message object
        message = ChatMessage(
            message_id=str(uuid.uuid4()),
            user_id=user_id,
            text=message_text,
            timestamp=datetime.now(),
            session_id=session_id
        )
        
        # Get or create conversation context
        context = await self.conversation_manager.get_or_create_session(user_id, session_id)
        
        # Process message with NLP
        intent = await self.nlp_processor.process_message(message)
        
        # Update conversation context
        await self.conversation_manager.update_context(context, message, intent)
        
        # Generate response
        response = await self.response_generator.generate_response(intent, context, system_data)
        
        # Update analytics
        self.analytics[f"intent_{intent.intent_type.value}"] += 1
        self.analytics["total_messages"] += 1
        
        return response
    
    async def get_conversation_history(self, session_id: str) -> List[ChatMessage]:
        """Get conversation history for a session"""
        if session_id in self.conversation_manager.sessions:
            return self.conversation_manager.sessions[session_id].history
        return []
    
    async def get_analytics(self) -> Dict[str, Any]:
        """Get chatbot analytics"""
        total_sessions = len(self.conversation_manager.sessions)
        active_sessions = sum(
            1 for context in self.conversation_manager.sessions.values()
            if (datetime.now() - context.updated_at).total_seconds() < 300  # Active in last 5 minutes
        )
        
        return {
            "total_messages": self.analytics["total_messages"],
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "intent_distribution": {
                k.replace("intent_", ""): v for k, v in self.analytics.items()
                if k.startswith("intent_")
            },
            "top_intents": sorted(
                [(k.replace("intent_", ""), v) for k, v in self.analytics.items() if k.startswith("intent_")],
                key=lambda x: x[1],
                reverse=True
            )[:5]
        }
    
    async def clear_session(self, session_id: str) -> bool:
        """Clear a conversation session"""
        if session_id in self.conversation_manager.sessions:
            del self.conversation_manager.sessions[session_id]
            return True
        return False
    
    async def cleanup_expired_sessions(self):
        """Clean up expired sessions"""
        await self.conversation_manager.cleanup_expired_sessions()

# Example usage
async def main():
    chatbot = ChatbotNLPInterface()
    
    # Simulate system data
    system_data = {
        "cluster": {
            "total_nodes": 3,
            "ready_nodes": 3,
            "total_pods": 45,
            "running_pods": 42,
            "cpu_usage_percent": 65.2,
            "memory_usage_percent": 78.5
        },
        "services": [
            {
                "name": "prometheus",
                "status": "healthy",
                "replicas": {"ready": 1, "desired": 1},
                "cpu_usage": 25.3,
                "memory_usage": 45.7
            },
            {
                "name": "grafana",
                "status": "healthy",
                "replicas": {"ready": 1, "desired": 1},
                "cpu_usage": 15.2,
                "memory_usage": 32.1
            }
        ],
        "resources": {
            "cpu": {
                "usage_percent": 65.2,
                "used_cores": 6.5,
                "total_cores": 10.0
            },
            "memory": {
                "usage_percent": 78.5,
                "used_gb": 15.7,
                "total_gb": 20.0
            }
        }
    }
    
    # Test conversations
    test_messages = [
        "Hello",
        "Show me cluster status",
        "How is prometheus doing?",
        "What's the CPU usage?",
        "Scale prometheus to 3 replicas",
        "yes",
        "Show logs for grafana"
    ]
    
    user_id = "test_user"
    session_id = None
    
    for message_text in test_messages:
        print(f"\n🧑 User: {message_text}")
        
        response = await chatbot.process_message(
            user_id=user_id,
            message_text=message_text,
            session_id=session_id,
            system_data=system_data
        )
        
        if not session_id:
            # Extract session ID from first response
            session_id = response.response_id  # Simplified for demo
        
        print(f"🤖 Bot: {response.content['text']}")
        
        if response.suggestions:
            print(f"💡 Suggestions: {', '.join(response.suggestions)}")
    
    # Show analytics
    analytics = await chatbot.get_analytics()
    print(f"\n📊 Analytics: {json.dumps(analytics, indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())