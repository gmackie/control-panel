"""
Unified Service Orchestration and Management System
Comprehensive service monitoring, interaction, and orchestration for all cluster services
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass, asdict
from enum import Enum
import json
import yaml
import aiohttp
import aioredis
from kubernetes import client, config, watch
from kubernetes.client.rest import ApiException
import docker
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ServiceType(Enum):
    # Core Infrastructure
    KUBERNETES = "kubernetes"
    DOCKER = "docker"
    CONTAINERD = "containerd"
    
    # Storage Services
    LONGHORN = "longhorn"
    MINIO = "minio"
    NFS = "nfs"
    
    # Database Services
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    MONGODB = "mongodb"
    REDIS = "redis"
    
    # Monitoring & Observability
    PROMETHEUS = "prometheus"
    GRAFANA = "grafana"
    ALERTMANAGER = "alertmanager"
    LOKI = "loki"
    TEMPO = "tempo"
    
    # CI/CD & GitOps
    GITEA = "gitea"
    DRONE = "drone"
    ARGOCD = "argocd"
    JENKINS = "jenkins"
    TEKTON = "tekton"
    
    # Service Mesh
    ISTIO = "istio"
    LINKERD = "linkerd"
    CONSUL = "consul"
    
    # Ingress & Load Balancing
    NGINX = "nginx"
    TRAEFIK = "traefik"
    HAPROXY = "haproxy"
    
    # Security & Auth
    KEYCLOAK = "keycloak"
    AUTHENTIK = "authentik"
    OAUTH2_PROXY = "oauth2-proxy"
    VAULT = "vault"
    
    # Messaging & Streaming
    KAFKA = "kafka"
    RABBITMQ = "rabbitmq"
    NATS = "nats"
    
    # Container Registry
    HARBOR = "harbor"
    REGISTRY = "registry"
    
    # Package Management
    VERDACCIO = "verdaccio"
    NEXUS = "nexus"
    
    # Application Services
    APPLICATION = "application"
    MICROSERVICE = "microservice"
    API_GATEWAY = "api_gateway"

class ServiceStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    STARTING = "starting"
    STOPPING = "stopping"
    STOPPED = "stopped"

class DeploymentStrategy(Enum):
    ROLLING_UPDATE = "rolling_update"
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    RECREATE = "recreate"
    A_B_TESTING = "a_b_testing"

@dataclass
class Service:
    service_id: str
    name: str
    service_type: ServiceType
    namespace: str
    status: ServiceStatus
    health_check_url: Optional[str]
    metrics_url: Optional[str]
    api_url: Optional[str]
    ui_url: Optional[str]
    version: str
    replicas: int
    resources: Dict[str, Any]
    labels: Dict[str, str]
    annotations: Dict[str, str]
    dependencies: List[str]
    endpoints: List[Dict[str, Any]]
    last_updated: datetime

@dataclass
class ServiceInteraction:
    interaction_id: str
    source_service: str
    target_service: str
    interaction_type: str  # api_call, database_query, message_publish, etc.
    protocol: str  # http, grpc, tcp, etc.
    frequency: float  # calls per minute
    latency_ms: float
    error_rate: float
    data_flow_direction: str  # unidirectional, bidirectional
    is_critical: bool

@dataclass
class Application:
    app_id: str
    name: str
    description: str
    services: List[str]  # List of service IDs
    ingress_config: Dict[str, Any]
    environment_variables: Dict[str, str]
    secrets: List[str]
    config_maps: List[str]
    deployment_strategy: DeploymentStrategy
    version: str
    git_repo: Optional[str]
    ci_cd_pipeline: Optional[str]
    monitoring_dashboards: List[str]
    health_endpoints: Dict[str, str]
    created_at: datetime
    updated_at: datetime

@dataclass
class ServiceAction:
    action_id: str
    service_id: str
    action_type: str  # restart, scale, update, rollback, etc.
    parameters: Dict[str, Any]
    initiated_by: str
    initiated_at: datetime
    status: str  # pending, in_progress, completed, failed
    result: Optional[Dict[str, Any]]
    error_message: Optional[str]

class KubernetesManager:
    def __init__(self):
        try:
            # Try in-cluster config first
            config.load_incluster_config()
        except:
            # Fall back to local kubeconfig
            config.load_kube_config()
        
        self.v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()
        self.batch_v1 = client.BatchV1Api()
        
    async def get_all_services(self) -> List[Service]:
        """Get all services from Kubernetes cluster"""
        services = []
        
        try:
            # Get all namespaces
            namespaces = self.v1.list_namespace()
            
            for ns in namespaces.items:
                namespace = ns.metadata.name
                
                # Skip system namespaces
                if namespace in ['kube-system', 'kube-public', 'kube-node-lease']:
                    continue
                
                # Get services in namespace
                k8s_services = self.v1.list_namespaced_service(namespace)
                
                for svc in k8s_services.items:
                    service = await self._k8s_service_to_service(svc, namespace)
                    services.append(service)
                
                # Get deployments
                deployments = self.apps_v1.list_namespaced_deployment(namespace)
                
                for dep in deployments.items:
                    service = await self._k8s_deployment_to_service(dep, namespace)
                    services.append(service)
                    
        except ApiException as e:
            logger.error(f"Error fetching Kubernetes services: {e}")
            
        return services
    
    async def _k8s_service_to_service(self, k8s_svc, namespace: str) -> Service:
        """Convert Kubernetes service to Service object"""
        service_type = self._determine_service_type(k8s_svc.metadata.labels)
        
        # Get endpoints
        endpoints = []
        if k8s_svc.spec.cluster_ip:
            for port in k8s_svc.spec.ports or []:
                endpoints.append({
                    "name": port.name or "default",
                    "port": port.port,
                    "protocol": port.protocol,
                    "url": f"http://{k8s_svc.metadata.name}.{namespace}:{port.port}"
                })
        
        return Service(
            service_id=f"{namespace}/{k8s_svc.metadata.name}",
            name=k8s_svc.metadata.name,
            service_type=service_type,
            namespace=namespace,
            status=ServiceStatus.HEALTHY,  # Will be updated by health checks
            health_check_url=self._get_health_url(k8s_svc, namespace),
            metrics_url=self._get_metrics_url(k8s_svc, namespace),
            api_url=endpoints[0]["url"] if endpoints else None,
            ui_url=self._get_ui_url(k8s_svc, namespace),
            version=k8s_svc.metadata.labels.get("version", "unknown"),
            replicas=1,  # Services don't have replicas, will get from deployment
            resources={},
            labels=k8s_svc.metadata.labels or {},
            annotations=k8s_svc.metadata.annotations or {},
            dependencies=self._extract_dependencies(k8s_svc.metadata.annotations),
            endpoints=endpoints,
            last_updated=datetime.now()
        )
    
    async def _k8s_deployment_to_service(self, deployment, namespace: str) -> Service:
        """Convert Kubernetes deployment to Service object"""
        service_type = self._determine_service_type(deployment.metadata.labels)
        
        # Get resource requirements
        resources = {}
        if deployment.spec.template.spec.containers:
            container = deployment.spec.template.spec.containers[0]
            if container.resources:
                resources = {
                    "requests": container.resources.requests or {},
                    "limits": container.resources.limits or {}
                }
        
        return Service(
            service_id=f"{namespace}/deployment/{deployment.metadata.name}",
            name=deployment.metadata.name,
            service_type=service_type,
            namespace=namespace,
            status=self._get_deployment_status(deployment),
            health_check_url=None,
            metrics_url=None,
            api_url=None,
            ui_url=None,
            version=deployment.metadata.labels.get("version", "unknown"),
            replicas=deployment.spec.replicas or 1,
            resources=resources,
            labels=deployment.metadata.labels or {},
            annotations=deployment.metadata.annotations or {},
            dependencies=self._extract_dependencies(deployment.metadata.annotations),
            endpoints=[],
            last_updated=datetime.now()
        )
    
    def _determine_service_type(self, labels: Dict[str, str]) -> ServiceType:
        """Determine service type from labels"""
        if not labels:
            return ServiceType.APPLICATION
        
        app_name = labels.get("app", "").lower()
        component = labels.get("component", "").lower()
        
        # Map common service names to types
        type_mapping = {
            "prometheus": ServiceType.PROMETHEUS,
            "grafana": ServiceType.GRAFANA,
            "alertmanager": ServiceType.ALERTMANAGER,
            "gitea": ServiceType.GITEA,
            "drone": ServiceType.DRONE,
            "argocd": ServiceType.ARGOCD,
            "harbor": ServiceType.HARBOR,
            "postgresql": ServiceType.POSTGRESQL,
            "postgres": ServiceType.POSTGRESQL,
            "mysql": ServiceType.MYSQL,
            "mongodb": ServiceType.MONGODB,
            "redis": ServiceType.REDIS,
            "kafka": ServiceType.KAFKA,
            "rabbitmq": ServiceType.RABBITMQ,
            "nginx": ServiceType.NGINX,
            "traefik": ServiceType.TRAEFIK,
            "istio": ServiceType.ISTIO,
            "keycloak": ServiceType.KEYCLOAK,
            "authentik": ServiceType.AUTHENTIK,
            "vault": ServiceType.VAULT,
            "minio": ServiceType.MINIO,
            "longhorn": ServiceType.LONGHORN,
            "verdaccio": ServiceType.VERDACCIO,
            "registry": ServiceType.REGISTRY
        }
        
        for key, service_type in type_mapping.items():
            if key in app_name or key in component:
                return service_type
        
        return ServiceType.APPLICATION
    
    def _get_deployment_status(self, deployment) -> ServiceStatus:
        """Get deployment status"""
        if deployment.status.replicas == 0:
            return ServiceStatus.STOPPED
        elif deployment.status.ready_replicas == deployment.status.replicas:
            return ServiceStatus.HEALTHY
        elif deployment.status.ready_replicas and deployment.status.ready_replicas > 0:
            return ServiceStatus.DEGRADED
        else:
            return ServiceStatus.UNHEALTHY
    
    def _get_health_url(self, svc, namespace: str) -> Optional[str]:
        """Get health check URL for service"""
        annotations = svc.metadata.annotations or {}
        
        # Check for health check annotation
        if "health-check-path" in annotations:
            path = annotations["health-check-path"]
            if svc.spec.ports:
                port = svc.spec.ports[0].port
                return f"http://{svc.metadata.name}.{namespace}:{port}{path}"
        
        # Default health endpoints for known services
        known_endpoints = {
            "prometheus": "/api/v1/query?query=up",
            "grafana": "/api/health",
            "alertmanager": "/-/healthy",
            "gitea": "/api/v1/version",
            "argocd": "/api/v1/session",
            "harbor": "/api/v2.0/health"
        }
        
        for service_name, endpoint in known_endpoints.items():
            if service_name in svc.metadata.name.lower():
                if svc.spec.ports:
                    port = svc.spec.ports[0].port
                    return f"http://{svc.metadata.name}.{namespace}:{port}{endpoint}"
        
        return None
    
    def _get_metrics_url(self, svc, namespace: str) -> Optional[str]:
        """Get metrics URL for service"""
        annotations = svc.metadata.annotations or {}
        
        # Check for Prometheus scrape annotation
        if annotations.get("prometheus.io/scrape") == "true":
            path = annotations.get("prometheus.io/path", "/metrics")
            port = annotations.get("prometheus.io/port", "9090")
            return f"http://{svc.metadata.name}.{namespace}:{port}{path}"
        
        return None
    
    def _get_ui_url(self, svc, namespace: str) -> Optional[str]:
        """Get UI URL for service"""
        # Services with known UIs
        ui_services = ["grafana", "prometheus", "alertmanager", "gitea", "argocd", "harbor", "keycloak", "authentik"]
        
        for ui_service in ui_services:
            if ui_service in svc.metadata.name.lower():
                if svc.spec.ports:
                    port = svc.spec.ports[0].port
                    return f"http://{svc.metadata.name}.{namespace}:{port}"
        
        return None
    
    def _extract_dependencies(self, annotations: Dict[str, str]) -> List[str]:
        """Extract service dependencies from annotations"""
        if not annotations:
            return []
        
        dependencies = []
        
        # Check for dependency annotation
        if "dependencies" in annotations:
            deps = annotations["dependencies"].split(",")
            dependencies.extend([d.strip() for d in deps])
        
        return dependencies
    
    async def scale_deployment(self, namespace: str, deployment_name: str, replicas: int) -> bool:
        """Scale a deployment"""
        try:
            # Get current deployment
            deployment = self.apps_v1.read_namespaced_deployment(deployment_name, namespace)
            
            # Update replicas
            deployment.spec.replicas = replicas
            
            # Apply update
            self.apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=namespace,
                body=deployment
            )
            
            logger.info(f"Scaled {namespace}/{deployment_name} to {replicas} replicas")
            return True
            
        except ApiException as e:
            logger.error(f"Error scaling deployment: {e}")
            return False
    
    async def restart_deployment(self, namespace: str, deployment_name: str) -> bool:
        """Restart a deployment by updating annotation"""
        try:
            # Add restart annotation
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": datetime.now().isoformat()
                            }
                        }
                    }
                }
            }
            
            self.apps_v1.patch_namespaced_deployment(
                name=deployment_name,
                namespace=namespace,
                body=body
            )
            
            logger.info(f"Restarted {namespace}/{deployment_name}")
            return True
            
        except ApiException as e:
            logger.error(f"Error restarting deployment: {e}")
            return False
    
    async def get_pod_logs(self, namespace: str, pod_name: str, lines: int = 100) -> str:
        """Get pod logs"""
        try:
            logs = self.v1.read_namespaced_pod_log(
                name=pod_name,
                namespace=namespace,
                tail_lines=lines
            )
            return logs
        except ApiException as e:
            logger.error(f"Error fetching pod logs: {e}")
            return f"Error: {e}"
    
    async def execute_in_pod(self, namespace: str, pod_name: str, command: List[str]) -> str:
        """Execute command in pod"""
        try:
            resp = stream(
                self.v1.connect_get_namespaced_pod_exec,
                pod_name,
                namespace,
                command=command,
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False
            )
            return resp
        except ApiException as e:
            logger.error(f"Error executing command in pod: {e}")
            return f"Error: {e}"

class ServiceHealthChecker:
    def __init__(self):
        self.health_status: Dict[str, ServiceStatus] = {}
        
    async def check_service_health(self, service: Service) -> ServiceStatus:
        """Check health of a service"""
        if not service.health_check_url:
            return ServiceStatus.UNKNOWN
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(service.health_check_url, timeout=5) as resp:
                    if resp.status == 200:
                        return ServiceStatus.HEALTHY
                    elif resp.status >= 500:
                        return ServiceStatus.UNHEALTHY
                    else:
                        return ServiceStatus.DEGRADED
                        
        except asyncio.TimeoutError:
            return ServiceStatus.UNHEALTHY
        except Exception as e:
            logger.error(f"Error checking health for {service.name}: {e}")
            return ServiceStatus.UNKNOWN
    
    async def check_all_services(self, services: List[Service]) -> Dict[str, ServiceStatus]:
        """Check health of all services"""
        tasks = []
        for service in services:
            tasks.append(self.check_service_health(service))
        
        results = await asyncio.gather(*tasks)
        
        for service, status in zip(services, results):
            self.health_status[service.service_id] = status
            service.status = status
        
        return self.health_status

class ServiceInteractionMapper:
    def __init__(self):
        self.interactions: List[ServiceInteraction] = []
        
    async def discover_interactions(self, services: List[Service]) -> List[ServiceInteraction]:
        """Discover service interactions"""
        interactions = []
        
        # Analyze service dependencies
        for service in services:
            for dep in service.dependencies:
                # Find dependent service
                dep_service = next((s for s in services if s.name == dep or s.service_id == dep), None)
                
                if dep_service:
                    interaction = ServiceInteraction(
                        interaction_id=f"{service.service_id}_to_{dep_service.service_id}",
                        source_service=service.service_id,
                        target_service=dep_service.service_id,
                        interaction_type="dependency",
                        protocol="http",
                        frequency=10.0,  # Default, would be measured
                        latency_ms=50.0,  # Default, would be measured
                        error_rate=0.01,  # Default, would be measured
                        data_flow_direction="unidirectional",
                        is_critical=True
                    )
                    interactions.append(interaction)
        
        # Analyze network policies and services for more interactions
        # This would involve analyzing Kubernetes NetworkPolicies, Services, and Ingress rules
        
        self.interactions = interactions
        return interactions
    
    def get_service_dependencies(self, service_id: str) -> Dict[str, List[str]]:
        """Get all dependencies for a service"""
        dependencies = {
            "depends_on": [],
            "depended_by": []
        }
        
        for interaction in self.interactions:
            if interaction.source_service == service_id:
                dependencies["depends_on"].append(interaction.target_service)
            elif interaction.target_service == service_id:
                dependencies["depended_by"].append(interaction.source_service)
        
        return dependencies

class ApplicationManager:
    def __init__(self, k8s_manager: KubernetesManager):
        self.k8s_manager = k8s_manager
        self.applications: Dict[str, Application] = {}
        
    async def create_application(self, app: Application) -> str:
        """Create a new application"""
        self.applications[app.app_id] = app
        
        # Deploy application services
        for service_id in app.services:
            # Deploy or update service
            logger.info(f"Deploying service {service_id} for application {app.name}")
        
        logger.info(f"Created application {app.name}")
        return app.app_id
    
    async def deploy_application(self, app_id: str, strategy: DeploymentStrategy) -> bool:
        """Deploy application with specified strategy"""
        app = self.applications.get(app_id)
        if not app:
            return False
        
        if strategy == DeploymentStrategy.ROLLING_UPDATE:
            return await self._rolling_update(app)
        elif strategy == DeploymentStrategy.BLUE_GREEN:
            return await self._blue_green_deployment(app)
        elif strategy == DeploymentStrategy.CANARY:
            return await self._canary_deployment(app)
        else:
            return await self._recreate_deployment(app)
    
    async def _rolling_update(self, app: Application) -> bool:
        """Perform rolling update deployment"""
        logger.info(f"Performing rolling update for {app.name}")
        
        # Update each service one by one
        for service_id in app.services:
            # Parse namespace and deployment name
            parts = service_id.split("/")
            if len(parts) >= 2:
                namespace = parts[0]
                deployment_name = parts[-1]
                
                # Trigger rolling update
                success = await self.k8s_manager.restart_deployment(namespace, deployment_name)
                if not success:
                    logger.error(f"Failed to update {service_id}")
                    return False
                
                # Wait for rollout to complete
                await asyncio.sleep(30)
        
        return True
    
    async def _blue_green_deployment(self, app: Application) -> bool:
        """Perform blue-green deployment"""
        logger.info(f"Performing blue-green deployment for {app.name}")
        
        # Create green environment
        # Deploy new version to green
        # Switch traffic from blue to green
        # Remove blue environment
        
        # Simplified implementation
        return True
    
    async def _canary_deployment(self, app: Application) -> bool:
        """Perform canary deployment"""
        logger.info(f"Performing canary deployment for {app.name}")
        
        # Deploy canary version
        # Gradually shift traffic
        # Monitor metrics
        # Complete or rollback based on metrics
        
        # Simplified implementation
        return True
    
    async def _recreate_deployment(self, app: Application) -> bool:
        """Perform recreate deployment"""
        logger.info(f"Performing recreate deployment for {app.name}")
        
        # Delete existing deployment
        # Create new deployment
        
        # Simplified implementation
        return True
    
    async def rollback_application(self, app_id: str, version: str) -> bool:
        """Rollback application to specific version"""
        app = self.applications.get(app_id)
        if not app:
            return False
        
        logger.info(f"Rolling back {app.name} to version {version}")
        
        # Implement rollback logic
        # This would involve reverting deployments to previous versions
        
        return True
    
    def get_application_status(self, app_id: str) -> Dict[str, Any]:
        """Get application status"""
        app = self.applications.get(app_id)
        if not app:
            return {"error": "Application not found"}
        
        return {
            "app_id": app.app_id,
            "name": app.name,
            "version": app.version,
            "services": app.services,
            "deployment_strategy": app.deployment_strategy.value,
            "health": "healthy",  # Would be calculated from service health
            "last_deployment": app.updated_at.isoformat()
        }

class ServiceOrchestrator:
    def __init__(self):
        self.k8s_manager = KubernetesManager()
        self.health_checker = ServiceHealthChecker()
        self.interaction_mapper = ServiceInteractionMapper()
        self.app_manager = ApplicationManager(self.k8s_manager)
        self.services: Dict[str, Service] = {}
        self.service_actions: List[ServiceAction] = []
        self.redis_client = None
        
    async def initialize(self):
        """Initialize the service orchestrator"""
        try:
            self.redis_client = await aioredis.from_url("redis://localhost:6379")
            logger.info("Connected to Redis")
        except Exception as e:
            logger.warning(f"Could not connect to Redis: {e}")
        
        # Discover initial services
        await self.discover_services()
        
        logger.info("Service orchestrator initialized")
    
    async def discover_services(self) -> Dict[str, Service]:
        """Discover all services in the cluster"""
        services = await self.k8s_manager.get_all_services()
        
        for service in services:
            self.services[service.service_id] = service
        
        # Check health of all services
        await self.health_checker.check_all_services(services)
        
        # Discover interactions
        await self.interaction_mapper.discover_interactions(services)
        
        logger.info(f"Discovered {len(services)} services")
        
        return self.services
    
    async def execute_service_action(self, action: ServiceAction) -> ServiceAction:
        """Execute an action on a service"""
        service = self.services.get(action.service_id)
        if not service:
            action.status = "failed"
            action.error_message = "Service not found"
            return action
        
        action.status = "in_progress"
        self.service_actions.append(action)
        
        try:
            if action.action_type == "scale":
                replicas = action.parameters.get("replicas", 1)
                success = await self.k8s_manager.scale_deployment(
                    service.namespace, 
                    service.name, 
                    replicas
                )
                action.status = "completed" if success else "failed"
                
            elif action.action_type == "restart":
                success = await self.k8s_manager.restart_deployment(
                    service.namespace,
                    service.name
                )
                action.status = "completed" if success else "failed"
                
            elif action.action_type == "update":
                # Implement update logic
                action.status = "completed"
                
            elif action.action_type == "rollback":
                # Implement rollback logic
                action.status = "completed"
                
            else:
                action.status = "failed"
                action.error_message = f"Unknown action type: {action.action_type}"
                
        except Exception as e:
            action.status = "failed"
            action.error_message = str(e)
            logger.error(f"Error executing action {action.action_id}: {e}")
        
        return action
    
    async def get_service_metrics(self, service_id: str) -> Dict[str, Any]:
        """Get metrics for a service"""
        service = self.services.get(service_id)
        if not service or not service.metrics_url:
            return {"error": "Service not found or no metrics available"}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(service.metrics_url, timeout=5) as resp:
                    if resp.status == 200:
                        text = await resp.text()
                        # Parse Prometheus metrics format
                        metrics = self._parse_prometheus_metrics(text)
                        return metrics
                    else:
                        return {"error": f"Failed to fetch metrics: {resp.status}"}
                        
        except Exception as e:
            logger.error(f"Error fetching metrics for {service_id}: {e}")
            return {"error": str(e)}
    
    def _parse_prometheus_metrics(self, text: str) -> Dict[str, Any]:
        """Parse Prometheus metrics format"""
        metrics = {}
        
        for line in text.split("\n"):
            if line and not line.startswith("#"):
                parts = line.split(" ")
                if len(parts) == 2:
                    metric_name = parts[0]
                    metric_value = float(parts[1])
                    metrics[metric_name] = metric_value
        
        return metrics
    
    async def get_service_logs(self, service_id: str, lines: int = 100) -> str:
        """Get logs for a service"""
        service = self.services.get(service_id)
        if not service:
            return "Service not found"
        
        # Get pods for the service
        try:
            pods = self.k8s_manager.v1.list_namespaced_pod(
                namespace=service.namespace,
                label_selector=f"app={service.name}"
            )
            
            if pods.items:
                pod_name = pods.items[0].metadata.name
                logs = await self.k8s_manager.get_pod_logs(service.namespace, pod_name, lines)
                return logs
            else:
                return "No pods found for service"
                
        except Exception as e:
            logger.error(f"Error fetching logs for {service_id}: {e}")
            return f"Error: {e}"
    
    def get_service_topology(self) -> Dict[str, Any]:
        """Get service topology and interactions"""
        nodes = []
        edges = []
        
        # Create nodes for each service
        for service in self.services.values():
            nodes.append({
                "id": service.service_id,
                "label": service.name,
                "type": service.service_type.value,
                "status": service.status.value,
                "namespace": service.namespace
            })
        
        # Create edges for interactions
        for interaction in self.interaction_mapper.interactions:
            edges.append({
                "source": interaction.source_service,
                "target": interaction.target_service,
                "type": interaction.interaction_type,
                "critical": interaction.is_critical
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "total_services": len(nodes),
            "total_interactions": len(edges)
        }
    
    async def monitor_service_changes(self, callback):
        """Monitor for service changes in real-time"""
        w = watch.Watch()
        
        # Watch for deployment changes
        for event in w.stream(self.k8s_manager.apps_v1.list_deployment_for_all_namespaces):
            event_type = event['type']
            deployment = event['object']
            
            await callback({
                "event_type": event_type,
                "resource_type": "deployment",
                "name": deployment.metadata.name,
                "namespace": deployment.metadata.namespace,
                "timestamp": datetime.now().isoformat()
            })
            
            # Update service cache
            await self.discover_services()

# FastAPI Application
app = FastAPI(title="Unified Service Orchestration System", version="1.0.0")
orchestrator = ServiceOrchestrator()

@app.on_event("startup")
async def startup():
    await orchestrator.initialize()

class ServiceActionRequest(BaseModel):
    service_id: str
    action_type: str
    parameters: Dict[str, Any]
    initiated_by: str

class ApplicationRequest(BaseModel):
    name: str
    description: str
    services: List[str]
    deployment_strategy: str
    version: str
    git_repo: Optional[str] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "service-orchestrator"}

@app.get("/services")
async def get_services():
    """Get all discovered services"""
    services = [asdict(s) for s in orchestrator.services.values()]
    return {
        "services": services,
        "total": len(services),
        "healthy": len([s for s in orchestrator.services.values() if s.status == ServiceStatus.HEALTHY]),
        "unhealthy": len([s for s in orchestrator.services.values() if s.status == ServiceStatus.UNHEALTHY])
    }

@app.get("/services/{service_id}")
async def get_service(service_id: str):
    """Get details for a specific service"""
    # Handle URL-encoded service IDs
    service_id = service_id.replace("_", "/")
    
    service = orchestrator.services.get(service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    dependencies = orchestrator.interaction_mapper.get_service_dependencies(service_id)
    
    return {
        "service": asdict(service),
        "dependencies": dependencies,
        "metrics": await orchestrator.get_service_metrics(service_id)
    }

@app.post("/services/{service_id}/actions")
async def execute_action(service_id: str, request: ServiceActionRequest):
    """Execute an action on a service"""
    service_id = service_id.replace("_", "/")
    
    action = ServiceAction(
        action_id=f"action_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        service_id=service_id,
        action_type=request.action_type,
        parameters=request.parameters,
        initiated_by=request.initiated_by,
        initiated_at=datetime.now(),
        status="pending",
        result=None,
        error_message=None
    )
    
    result = await orchestrator.execute_service_action(action)
    
    return asdict(result)

@app.get("/services/{service_id}/logs")
async def get_service_logs(service_id: str, lines: int = 100):
    """Get logs for a service"""
    service_id = service_id.replace("_", "/")
    
    logs = await orchestrator.get_service_logs(service_id, lines)
    
    return {
        "service_id": service_id,
        "logs": logs,
        "lines": lines
    }

@app.get("/services/{service_id}/metrics")
async def get_service_metrics(service_id: str):
    """Get metrics for a service"""
    service_id = service_id.replace("_", "/")
    
    metrics = await orchestrator.get_service_metrics(service_id)
    
    return {
        "service_id": service_id,
        "metrics": metrics,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/topology")
async def get_topology():
    """Get service topology and interactions"""
    return orchestrator.get_service_topology()

@app.post("/applications")
async def create_application(request: ApplicationRequest):
    """Create a new application"""
    app = Application(
        app_id=f"app_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        name=request.name,
        description=request.description,
        services=request.services,
        ingress_config={},
        environment_variables={},
        secrets=[],
        config_maps=[],
        deployment_strategy=DeploymentStrategy(request.deployment_strategy),
        version=request.version,
        git_repo=request.git_repo,
        ci_cd_pipeline=None,
        monitoring_dashboards=[],
        health_endpoints={},
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    app_id = await orchestrator.app_manager.create_application(app)
    
    return {
        "app_id": app_id,
        "status": "created",
        "application": asdict(app)
    }

@app.post("/applications/{app_id}/deploy")
async def deploy_application(app_id: str, strategy: str = "rolling_update"):
    """Deploy an application"""
    deployment_strategy = DeploymentStrategy(strategy)
    
    success = await orchestrator.app_manager.deploy_application(app_id, deployment_strategy)
    
    return {
        "app_id": app_id,
        "deployment_strategy": strategy,
        "success": success,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/applications/{app_id}/rollback")
async def rollback_application(app_id: str, version: str):
    """Rollback an application to a specific version"""
    success = await orchestrator.app_manager.rollback_application(app_id, version)
    
    return {
        "app_id": app_id,
        "version": version,
        "success": success,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/applications/{app_id}/status")
async def get_application_status(app_id: str):
    """Get application status"""
    status = orchestrator.app_manager.get_application_status(app_id)
    return status

@app.post("/refresh")
async def refresh_services(background_tasks: BackgroundTasks):
    """Refresh service discovery"""
    background_tasks.add_task(orchestrator.discover_services)
    
    return {
        "status": "refresh_started",
        "timestamp": datetime.now().isoformat()
    }

@app.websocket("/ws/monitor")
async def websocket_monitor(websocket: WebSocket):
    """WebSocket endpoint for real-time monitoring"""
    await websocket.accept()
    
    try:
        async def send_update(event):
            await websocket.send_json(event)
        
        # Start monitoring
        await orchestrator.monitor_service_changes(send_update)
        
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)