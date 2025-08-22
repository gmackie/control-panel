#!/usr/bin/env python3
"""
Cross-Cloud Networking Mesh System
Provides secure, high-performance networking across multiple cloud providers and edge locations
"""

import os
import json
import asyncio
import hashlib
import ipaddress
import time
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import numpy as np
from collections import defaultdict
import threading
import queue

class NetworkType(Enum):
    """Types of network connections"""
    VPN = "vpn"
    DIRECT_CONNECT = "direct_connect"
    PEERING = "peering"
    TRANSIT_GATEWAY = "transit_gateway"
    SD_WAN = "sd_wan"
    MESH = "mesh"
    HUB_SPOKE = "hub_spoke"

class SecurityProtocol(Enum):
    """Security protocols for connections"""
    IPSEC = "ipsec"
    WIREGUARD = "wireguard"
    TLS = "tls"
    MACSEC = "macsec"
    CUSTOM = "custom"

class TrafficType(Enum):
    """Types of network traffic"""
    DATA = "data"
    CONTROL = "control"
    MANAGEMENT = "management"
    BACKUP = "backup"
    REPLICATION = "replication"
    VIDEO = "video"
    VOICE = "voice"
    IOT = "iot"

@dataclass
class NetworkEndpoint:
    """Network endpoint in a cloud or edge location"""
    id: str
    name: str
    provider: str  # AWS, GCP, Azure, Edge, etc.
    region: str
    vpc_id: Optional[str]
    cidr_block: str
    public_ip: Optional[str]
    private_ip: str
    gateway_ip: Optional[str]
    dns_servers: List[str]
    subnets: List[Dict[str, Any]]
    security_groups: List[str]
    routing_table: Dict[str, str]
    bandwidth_mbps: int
    latency_ms: float
    packet_loss: float
    jitter_ms: float
    availability_zones: List[str]
    tags: Dict[str, str]
    status: str  # active, degraded, offline
    last_health_check: datetime

@dataclass
class NetworkConnection:
    """Connection between two network endpoints"""
    id: str
    name: str
    type: NetworkType
    source_endpoint_id: str
    destination_endpoint_id: str
    bandwidth_mbps: int
    latency_ms: float
    packet_loss: float
    jitter_ms: float
    security_protocol: SecurityProtocol
    encryption_key: Optional[str]
    tunnel_id: Optional[str]
    bgp_config: Optional[Dict[str, Any]]
    qos_policies: Dict[TrafficType, int]  # Traffic type to priority
    cost_per_gb: float
    status: str  # established, pending, failed
    established_at: Optional[datetime]
    last_ping: Optional[datetime]
    metrics: Dict[str, float]
    failover_connection_id: Optional[str]

@dataclass
class TrafficPolicy:
    """Traffic routing and management policy"""
    id: str
    name: str
    description: str
    source_cidr: str
    destination_cidr: str
    traffic_type: TrafficType
    preferred_path: List[str]  # List of connection IDs
    backup_path: List[str]
    load_balancing: str  # round-robin, weighted, least-latency
    priority: int
    bandwidth_limit_mbps: Optional[int]
    latency_requirement_ms: Optional[float]
    packet_loss_threshold: Optional[float]
    encryption_required: bool
    geo_restrictions: List[str]  # Restricted regions
    active: bool
    created_at: datetime
    updated_at: datetime

@dataclass
class NetworkPath:
    """Calculated network path between endpoints"""
    source_endpoint_id: str
    destination_endpoint_id: str
    path: List[str]  # List of endpoint IDs
    connections: List[str]  # List of connection IDs
    total_latency_ms: float
    total_bandwidth_mbps: int
    total_cost: float
    reliability_score: float
    security_score: float

class CrossCloudNetworkMesh:
    """Main cross-cloud networking management system"""
    
    def __init__(self):
        self.endpoints: Dict[str, NetworkEndpoint] = {}
        self.connections: Dict[str, NetworkConnection] = {}
        self.policies: Dict[str, TrafficPolicy] = {}
        self.paths_cache: Dict[Tuple[str, str], NetworkPath] = {}
        self.traffic_stats: Dict[str, Dict] = defaultdict(dict)
        self.topology_graph: Dict[str, Set[str]] = defaultdict(set)
        
        # Network optimization parameters
        self.optimization_interval = timedelta(minutes=5)
        self.last_optimization = datetime.now()
        self.health_check_interval = timedelta(seconds=30)
        self.last_health_check = datetime.now()
        
        # Initialize sample network
        self._initialize_sample_network()
    
    def _initialize_sample_network(self):
        """Initialize sample cross-cloud network"""
        
        # AWS US-East endpoint
        aws_endpoint = NetworkEndpoint(
            id="ep-aws-us-east",
            name="AWS US-East VPC",
            provider="AWS",
            region="us-east-1",
            vpc_id="vpc-12345",
            cidr_block="10.0.0.0/16",
            public_ip="54.123.45.67",
            private_ip="10.0.1.1",
            gateway_ip="10.0.0.1",
            dns_servers=["10.0.0.2", "10.0.0.3"],
            subnets=[
                {"id": "subnet-1", "cidr": "10.0.1.0/24", "az": "us-east-1a"},
                {"id": "subnet-2", "cidr": "10.0.2.0/24", "az": "us-east-1b"}
            ],
            security_groups=["sg-web", "sg-app", "sg-db"],
            routing_table={"0.0.0.0/0": "igw-12345", "10.0.0.0/16": "local"},
            bandwidth_mbps=10000,
            latency_ms=5,
            packet_loss=0.001,
            jitter_ms=1,
            availability_zones=["us-east-1a", "us-east-1b"],
            tags={"Environment": "Production", "Network": "Primary"},
            status="active",
            last_health_check=datetime.now()
        )
        self.add_endpoint(aws_endpoint)
        
        # GCP US-Central endpoint
        gcp_endpoint = NetworkEndpoint(
            id="ep-gcp-us-central",
            name="GCP US-Central Network",
            provider="GCP",
            region="us-central1",
            vpc_id="gmac-network",
            cidr_block="10.128.0.0/16",
            public_ip="35.123.45.67",
            private_ip="10.128.1.1",
            gateway_ip="10.128.0.1",
            dns_servers=["10.128.0.2"],
            subnets=[
                {"id": "subnet-gcp-1", "cidr": "10.128.0.0/20", "region": "us-central1"}
            ],
            security_groups=["fw-allow-internal", "fw-allow-web"],
            routing_table={"0.0.0.0/0": "default-gateway", "10.128.0.0/16": "local"},
            bandwidth_mbps=10000,
            latency_ms=8,
            packet_loss=0.001,
            jitter_ms=1.5,
            availability_zones=["us-central1-a", "us-central1-b"],
            tags={"Environment": "Production", "Network": "Secondary"},
            status="active",
            last_health_check=datetime.now()
        )
        self.add_endpoint(gcp_endpoint)
        
        # Azure East US endpoint
        azure_endpoint = NetworkEndpoint(
            id="ep-azure-east-us",
            name="Azure East US VNet",
            provider="Azure",
            region="eastus",
            vpc_id="vnet-gmac",
            cidr_block="10.1.0.0/16",
            public_ip="40.123.45.67",
            private_ip="10.1.1.1",
            gateway_ip="10.1.0.1",
            dns_servers=["10.1.0.2"],
            subnets=[
                {"id": "subnet-azure-1", "cidr": "10.1.0.0/24", "name": "default"}
            ],
            security_groups=["nsg-default"],
            routing_table={"0.0.0.0/0": "Internet", "10.1.0.0/16": "VNet"},
            bandwidth_mbps=5000,
            latency_ms=6,
            packet_loss=0.002,
            jitter_ms=1.2,
            availability_zones=["eastus-1", "eastus-2"],
            tags={"Environment": "Production", "Network": "Tertiary"},
            status="active",
            last_health_check=datetime.now()
        )
        self.add_endpoint(azure_endpoint)
        
        # Edge location endpoint
        edge_endpoint = NetworkEndpoint(
            id="ep-edge-nyc",
            name="NYC Edge Location",
            provider="Edge",
            region="us-east-edge",
            vpc_id=None,
            cidr_block="192.168.1.0/24",
            public_ip="72.123.45.67",
            private_ip="192.168.1.1",
            gateway_ip="192.168.1.254",
            dns_servers=["8.8.8.8", "8.8.4.4"],
            subnets=[
                {"id": "subnet-edge-1", "cidr": "192.168.1.0/24", "name": "edge-lan"}
            ],
            security_groups=["edge-firewall"],
            routing_table={"0.0.0.0/0": "edge-gateway", "192.168.1.0/24": "local"},
            bandwidth_mbps=1000,
            latency_ms=2,
            packet_loss=0.001,
            jitter_ms=0.5,
            availability_zones=["edge-nyc"],
            tags={"Type": "Edge", "Location": "NYC"},
            status="active",
            last_health_check=datetime.now()
        )
        self.add_endpoint(edge_endpoint)
        
        # Create connections between endpoints
        self._create_mesh_connections()
    
    def _create_mesh_connections(self):
        """Create mesh connections between all endpoints"""
        
        # AWS to GCP connection
        self.create_connection(
            name="AWS-GCP Transit",
            type=NetworkType.TRANSIT_GATEWAY,
            source_endpoint_id="ep-aws-us-east",
            destination_endpoint_id="ep-gcp-us-central",
            bandwidth_mbps=5000,
            security_protocol=SecurityProtocol.IPSEC,
            qos_policies={
                TrafficType.DATA: 8,
                TrafficType.CONTROL: 10,
                TrafficType.BACKUP: 4
            },
            cost_per_gb=0.02
        )
        
        # AWS to Azure connection
        self.create_connection(
            name="AWS-Azure ExpressRoute",
            type=NetworkType.DIRECT_CONNECT,
            source_endpoint_id="ep-aws-us-east",
            destination_endpoint_id="ep-azure-east-us",
            bandwidth_mbps=2000,
            security_protocol=SecurityProtocol.MACSEC,
            qos_policies={
                TrafficType.DATA: 7,
                TrafficType.REPLICATION: 9
            },
            cost_per_gb=0.03
        )
        
        # GCP to Azure connection
        self.create_connection(
            name="GCP-Azure Peering",
            type=NetworkType.PEERING,
            source_endpoint_id="ep-gcp-us-central",
            destination_endpoint_id="ep-azure-east-us",
            bandwidth_mbps=1000,
            security_protocol=SecurityProtocol.IPSEC,
            qos_policies={
                TrafficType.DATA: 6,
                TrafficType.BACKUP: 5
            },
            cost_per_gb=0.025
        )
        
        # Edge to AWS connection
        self.create_connection(
            name="Edge-AWS VPN",
            type=NetworkType.VPN,
            source_endpoint_id="ep-edge-nyc",
            destination_endpoint_id="ep-aws-us-east",
            bandwidth_mbps=500,
            security_protocol=SecurityProtocol.WIREGUARD,
            qos_policies={
                TrafficType.IOT: 9,
                TrafficType.DATA: 7
            },
            cost_per_gb=0.05
        )
    
    def add_endpoint(self, endpoint: NetworkEndpoint) -> bool:
        """Add a network endpoint"""
        self.endpoints[endpoint.id] = endpoint
        print(f"✅ Added network endpoint: {endpoint.name} ({endpoint.provider})")
        return True
    
    def create_connection(
        self,
        name: str,
        type: NetworkType,
        source_endpoint_id: str,
        destination_endpoint_id: str,
        bandwidth_mbps: int,
        security_protocol: SecurityProtocol,
        qos_policies: Dict[TrafficType, int],
        cost_per_gb: float
    ) -> Optional[NetworkConnection]:
        """Create a connection between two endpoints"""
        
        if source_endpoint_id not in self.endpoints or destination_endpoint_id not in self.endpoints:
            print(f"❌ Invalid endpoint IDs")
            return None
        
        source = self.endpoints[source_endpoint_id]
        dest = self.endpoints[destination_endpoint_id]
        
        # Calculate connection metrics
        latency = self._calculate_latency(source, dest)
        packet_loss = (source.packet_loss + dest.packet_loss) / 2
        jitter = (source.jitter_ms + dest.jitter_ms) / 2
        
        connection = NetworkConnection(
            id=f"conn-{hashlib.md5(f'{source_endpoint_id}-{destination_endpoint_id}'.encode()).hexdigest()[:8]}",
            name=name,
            type=type,
            source_endpoint_id=source_endpoint_id,
            destination_endpoint_id=destination_endpoint_id,
            bandwidth_mbps=min(bandwidth_mbps, source.bandwidth_mbps, dest.bandwidth_mbps),
            latency_ms=latency,
            packet_loss=packet_loss,
            jitter_ms=jitter,
            security_protocol=security_protocol,
            encryption_key=self._generate_encryption_key(),
            tunnel_id=f"tun-{hashlib.md5(name.encode()).hexdigest()[:8]}",
            bgp_config=self._generate_bgp_config(source, dest) if type == NetworkType.DIRECT_CONNECT else None,
            qos_policies=qos_policies,
            cost_per_gb=cost_per_gb,
            status="established",
            established_at=datetime.now(),
            last_ping=datetime.now(),
            metrics={},
            failover_connection_id=None
        )
        
        self.connections[connection.id] = connection
        
        # Update topology graph
        self.topology_graph[source_endpoint_id].add(destination_endpoint_id)
        self.topology_graph[destination_endpoint_id].add(source_endpoint_id)
        
        print(f"✅ Created connection: {name} ({type.value})")
        return connection
    
    def _calculate_latency(self, source: NetworkEndpoint, dest: NetworkEndpoint) -> float:
        """Calculate latency between endpoints"""
        # Base latency from endpoint characteristics
        base_latency = (source.latency_ms + dest.latency_ms) / 2
        
        # Add distance-based latency (simplified)
        if source.provider != dest.provider:
            base_latency += 10  # Cross-cloud latency
        
        if source.region != dest.region:
            base_latency += 5  # Cross-region latency
        
        return base_latency
    
    def _generate_encryption_key(self) -> str:
        """Generate encryption key for connection"""
        return hashlib.sha256(f"{time.time()}".encode()).hexdigest()
    
    def _generate_bgp_config(self, source: NetworkEndpoint, dest: NetworkEndpoint) -> Dict:
        """Generate BGP configuration for connection"""
        return {
            "local_asn": 65000 + hash(source.id) % 1000,
            "peer_asn": 65000 + hash(dest.id) % 1000,
            "local_ip": source.private_ip,
            "peer_ip": dest.private_ip,
            "advertised_routes": [source.cidr_block],
            "received_routes": [dest.cidr_block],
            "keepalive": 30,
            "hold_time": 90
        }
    
    def create_traffic_policy(
        self,
        name: str,
        source_cidr: str,
        destination_cidr: str,
        traffic_type: TrafficType,
        requirements: Dict[str, Any]
    ) -> TrafficPolicy:
        """Create a traffic routing policy"""
        
        # Find optimal path
        source_endpoint = self._find_endpoint_by_cidr(source_cidr)
        dest_endpoint = self._find_endpoint_by_cidr(destination_cidr)
        
        if not source_endpoint or not dest_endpoint:
            print(f"❌ Could not find endpoints for CIDR blocks")
            return None
        
        # Calculate paths
        primary_path = self.calculate_optimal_path(
            source_endpoint.id,
            dest_endpoint.id,
            requirements
        )
        
        backup_path = self.calculate_optimal_path(
            source_endpoint.id,
            dest_endpoint.id,
            requirements,
            exclude_connections=primary_path.connections if primary_path else []
        )
        
        policy = TrafficPolicy(
            id=f"policy-{hashlib.md5(name.encode()).hexdigest()[:8]}",
            name=name,
            description=f"Policy for {traffic_type.value} traffic",
            source_cidr=source_cidr,
            destination_cidr=destination_cidr,
            traffic_type=traffic_type,
            preferred_path=primary_path.connections if primary_path else [],
            backup_path=backup_path.connections if backup_path else [],
            load_balancing="least-latency",
            priority=requirements.get("priority", 5),
            bandwidth_limit_mbps=requirements.get("bandwidth_limit"),
            latency_requirement_ms=requirements.get("max_latency"),
            packet_loss_threshold=requirements.get("max_packet_loss"),
            encryption_required=requirements.get("encryption", True),
            geo_restrictions=requirements.get("geo_restrictions", []),
            active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        
        self.policies[policy.id] = policy
        print(f"✅ Created traffic policy: {name}")
        return policy
    
    def _find_endpoint_by_cidr(self, cidr: str) -> Optional[NetworkEndpoint]:
        """Find endpoint that contains the given CIDR"""
        target_network = ipaddress.ip_network(cidr)
        
        for endpoint in self.endpoints.values():
            endpoint_network = ipaddress.ip_network(endpoint.cidr_block)
            if target_network.subnet_of(endpoint_network):
                return endpoint
        
        return None
    
    def calculate_optimal_path(
        self,
        source_endpoint_id: str,
        destination_endpoint_id: str,
        requirements: Dict[str, Any],
        exclude_connections: List[str] = None
    ) -> Optional[NetworkPath]:
        """Calculate optimal network path using Dijkstra's algorithm"""
        
        if source_endpoint_id not in self.endpoints or destination_endpoint_id not in self.endpoints:
            return None
        
        # Check cache
        cache_key = (source_endpoint_id, destination_endpoint_id)
        if cache_key in self.paths_cache and not exclude_connections:
            cached_path = self.paths_cache[cache_key]
            if (datetime.now() - timedelta(minutes=5)).timestamp() < time.time():
                return cached_path
        
        # Build graph with weights based on requirements
        graph = self._build_weighted_graph(requirements, exclude_connections)
        
        # Dijkstra's algorithm
        distances = {node: float('inf') for node in self.endpoints}
        distances[source_endpoint_id] = 0
        previous = {}
        unvisited = set(self.endpoints.keys())
        
        while unvisited:
            current = min(unvisited, key=lambda x: distances[x])
            
            if distances[current] == float('inf'):
                break
            
            if current == destination_endpoint_id:
                break
            
            unvisited.remove(current)
            
            for neighbor in self.topology_graph[current]:
                if neighbor in unvisited:
                    alt_distance = distances[current] + graph[current][neighbor]
                    if alt_distance < distances[neighbor]:
                        distances[neighbor] = alt_distance
                        previous[neighbor] = current
        
        if destination_endpoint_id not in previous:
            return None  # No path found
        
        # Reconstruct path
        path = []
        current = destination_endpoint_id
        while current != source_endpoint_id:
            path.insert(0, current)
            current = previous[current]
        path.insert(0, source_endpoint_id)
        
        # Get connections for path
        connections = []
        for i in range(len(path) - 1):
            conn = self._find_connection(path[i], path[i + 1])
            if conn:
                connections.append(conn.id)
        
        # Calculate path metrics
        total_latency = sum(self.connections[c].latency_ms for c in connections)
        total_bandwidth = min(self.connections[c].bandwidth_mbps for c in connections) if connections else 0
        total_cost = sum(self.connections[c].cost_per_gb for c in connections)
        
        network_path = NetworkPath(
            source_endpoint_id=source_endpoint_id,
            destination_endpoint_id=destination_endpoint_id,
            path=path,
            connections=connections,
            total_latency_ms=total_latency,
            total_bandwidth_mbps=total_bandwidth,
            total_cost=total_cost,
            reliability_score=self._calculate_path_reliability(connections),
            security_score=self._calculate_path_security(connections)
        )
        
        # Cache the path
        if not exclude_connections:
            self.paths_cache[cache_key] = network_path
        
        return network_path
    
    def _build_weighted_graph(self, requirements: Dict, exclude_connections: List[str] = None) -> Dict:
        """Build weighted graph for path calculation"""
        graph = defaultdict(dict)
        exclude_connections = exclude_connections or []
        
        for conn_id, conn in self.connections.items():
            if conn_id in exclude_connections or conn.status != "established":
                continue
            
            # Calculate weight based on requirements
            weight = 0
            
            if requirements.get("optimize_for") == "latency":
                weight = conn.latency_ms
            elif requirements.get("optimize_for") == "cost":
                weight = conn.cost_per_gb * 100
            elif requirements.get("optimize_for") == "bandwidth":
                weight = 10000 / conn.bandwidth_mbps  # Inverse for maximization
            else:  # Default: balanced
                weight = conn.latency_ms + (conn.cost_per_gb * 50) + (10000 / conn.bandwidth_mbps)
            
            # Apply penalties for not meeting requirements
            if requirements.get("max_latency") and conn.latency_ms > requirements["max_latency"]:
                weight *= 10
            
            if requirements.get("min_bandwidth") and conn.bandwidth_mbps < requirements["min_bandwidth"]:
                weight *= 10
            
            graph[conn.source_endpoint_id][conn.destination_endpoint_id] = weight
            graph[conn.destination_endpoint_id][conn.source_endpoint_id] = weight
        
        return graph
    
    def _find_connection(self, endpoint1_id: str, endpoint2_id: str) -> Optional[NetworkConnection]:
        """Find connection between two endpoints"""
        for conn in self.connections.values():
            if (conn.source_endpoint_id == endpoint1_id and conn.destination_endpoint_id == endpoint2_id) or \
               (conn.source_endpoint_id == endpoint2_id and conn.destination_endpoint_id == endpoint1_id):
                return conn
        return None
    
    def _calculate_path_reliability(self, connection_ids: List[str]) -> float:
        """Calculate reliability score for a path"""
        if not connection_ids:
            return 0.0
        
        reliabilities = []
        for conn_id in connection_ids:
            conn = self.connections[conn_id]
            reliability = (1 - conn.packet_loss) * 100
            reliabilities.append(reliability)
        
        # Path reliability is product of individual reliabilities
        path_reliability = np.prod([r / 100 for r in reliabilities]) * 100
        return path_reliability
    
    def _calculate_path_security(self, connection_ids: List[str]) -> float:
        """Calculate security score for a path"""
        if not connection_ids:
            return 0.0
        
        security_scores = {
            SecurityProtocol.MACSEC: 100,
            SecurityProtocol.IPSEC: 90,
            SecurityProtocol.WIREGUARD: 85,
            SecurityProtocol.TLS: 80,
            SecurityProtocol.CUSTOM: 70
        }
        
        scores = []
        for conn_id in connection_ids:
            conn = self.connections[conn_id]
            scores.append(security_scores.get(conn.security_protocol, 50))
        
        # Path security is minimum of individual scores
        return min(scores)
    
    def optimize_network(self) -> Dict[str, Any]:
        """Optimize network configuration"""
        optimizations = {
            "timestamp": datetime.now().isoformat(),
            "connection_optimizations": [],
            "path_optimizations": [],
            "cost_savings": 0,
            "latency_improvements": 0
        }
        
        # Optimize connections
        for conn in self.connections.values():
            # Check for underutilized connections
            if conn.bandwidth_mbps > 1000:
                utilization = np.random.uniform(0, 1)  # Simulated
                if utilization < 0.3:
                    optimizations["connection_optimizations"].append({
                        "connection": conn.name,
                        "recommendation": "Downgrade bandwidth to save costs",
                        "current_bandwidth": conn.bandwidth_mbps,
                        "recommended_bandwidth": conn.bandwidth_mbps // 2,
                        "monthly_savings": (conn.bandwidth_mbps - conn.bandwidth_mbps // 2) * 0.05
                    })
                    optimizations["cost_savings"] += (conn.bandwidth_mbps - conn.bandwidth_mbps // 2) * 0.05
        
        # Optimize paths
        for policy in self.policies.values():
            if policy.active and policy.preferred_path:
                # Check if there's a better path available
                new_path = self.calculate_optimal_path(
                    self._find_endpoint_by_cidr(policy.source_cidr).id,
                    self._find_endpoint_by_cidr(policy.destination_cidr).id,
                    {"optimize_for": "latency"}
                )
                
                if new_path and new_path.total_latency_ms < self._get_path_latency(policy.preferred_path) * 0.9:
                    optimizations["path_optimizations"].append({
                        "policy": policy.name,
                        "current_latency": self._get_path_latency(policy.preferred_path),
                        "new_latency": new_path.total_latency_ms,
                        "improvement": self._get_path_latency(policy.preferred_path) - new_path.total_latency_ms
                    })
                    optimizations["latency_improvements"] += self._get_path_latency(policy.preferred_path) - new_path.total_latency_ms
        
        self.last_optimization = datetime.now()
        return optimizations
    
    def _get_path_latency(self, connection_ids: List[str]) -> float:
        """Get total latency for a path"""
        return sum(self.connections[c].latency_ms for c in connection_ids if c in self.connections)
    
    def monitor_health(self) -> Dict[str, Any]:
        """Monitor network health"""
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "endpoints": {},
            "connections": {},
            "alerts": [],
            "overall_health": "healthy"
        }
        
        # Check endpoint health
        for endpoint in self.endpoints.values():
            endpoint_health = {
                "status": endpoint.status,
                "last_check": endpoint.last_health_check.isoformat(),
                "metrics": {
                    "latency": endpoint.latency_ms,
                    "packet_loss": endpoint.packet_loss * 100,
                    "jitter": endpoint.jitter_ms
                }
            }
            
            # Generate alerts
            if endpoint.packet_loss > 0.01:
                health_status["alerts"].append({
                    "type": "high_packet_loss",
                    "endpoint": endpoint.name,
                    "value": endpoint.packet_loss * 100,
                    "threshold": 1.0,
                    "severity": "warning"
                })
            
            health_status["endpoints"][endpoint.name] = endpoint_health
        
        # Check connection health
        for conn in self.connections.values():
            conn_health = {
                "status": conn.status,
                "latency": conn.latency_ms,
                "packet_loss": conn.packet_loss * 100,
                "bandwidth_utilization": np.random.uniform(0.3, 0.9) * 100  # Simulated
            }
            
            # Generate alerts
            if conn.latency_ms > 50:
                health_status["alerts"].append({
                    "type": "high_latency",
                    "connection": conn.name,
                    "value": conn.latency_ms,
                    "threshold": 50,
                    "severity": "warning"
                })
            
            health_status["connections"][conn.name] = conn_health
        
        # Determine overall health
        if len(health_status["alerts"]) > 5:
            health_status["overall_health"] = "degraded"
        elif len(health_status["alerts"]) > 10:
            health_status["overall_health"] = "critical"
        
        self.last_health_check = datetime.now()
        return health_status
    
    def simulate_failover(self, connection_id: str) -> Dict[str, Any]:
        """Simulate connection failover"""
        if connection_id not in self.connections:
            return {"error": "Connection not found"}
        
        conn = self.connections[connection_id]
        affected_policies = []
        
        # Find affected traffic policies
        for policy in self.policies.values():
            if connection_id in policy.preferred_path:
                affected_policies.append(policy)
        
        # Perform failover
        failover_results = {
            "failed_connection": conn.name,
            "affected_policies": len(affected_policies),
            "failover_actions": []
        }
        
        for policy in affected_policies:
            if policy.backup_path:
                failover_results["failover_actions"].append({
                    "policy": policy.name,
                    "action": "switched_to_backup",
                    "new_path": policy.backup_path,
                    "expected_latency_increase": 5  # ms
                })
                
                # Update policy to use backup path
                policy.preferred_path, policy.backup_path = policy.backup_path, policy.preferred_path
            else:
                # Calculate new path excluding failed connection
                new_path = self.calculate_optimal_path(
                    self._find_endpoint_by_cidr(policy.source_cidr).id,
                    self._find_endpoint_by_cidr(policy.destination_cidr).id,
                    {"optimize_for": "latency"},
                    exclude_connections=[connection_id]
                )
                
                if new_path:
                    failover_results["failover_actions"].append({
                        "policy": policy.name,
                        "action": "rerouted",
                        "new_path": new_path.connections,
                        "expected_latency_increase": new_path.total_latency_ms - self._get_path_latency(policy.preferred_path)
                    })
                    policy.preferred_path = new_path.connections
                else:
                    failover_results["failover_actions"].append({
                        "policy": policy.name,
                        "action": "no_alternative_path",
                        "impact": "service_disruption"
                    })
        
        # Mark connection as failed
        conn.status = "failed"
        
        return failover_results
    
    def get_network_topology(self) -> Dict[str, Any]:
        """Get current network topology"""
        topology = {
            "endpoints": [],
            "connections": [],
            "policies": [],
            "statistics": {}
        }
        
        # Endpoints
        for endpoint in self.endpoints.values():
            topology["endpoints"].append({
                "id": endpoint.id,
                "name": endpoint.name,
                "provider": endpoint.provider,
                "region": endpoint.region,
                "cidr": endpoint.cidr_block,
                "status": endpoint.status
            })
        
        # Connections
        for conn in self.connections.values():
            source = self.endpoints[conn.source_endpoint_id]
            dest = self.endpoints[conn.destination_endpoint_id]
            
            topology["connections"].append({
                "id": conn.id,
                "name": conn.name,
                "type": conn.type.value,
                "source": source.name,
                "destination": dest.name,
                "bandwidth": conn.bandwidth_mbps,
                "latency": conn.latency_ms,
                "status": conn.status
            })
        
        # Policies
        for policy in self.policies.values():
            if policy.active:
                topology["policies"].append({
                    "name": policy.name,
                    "traffic_type": policy.traffic_type.value,
                    "source": policy.source_cidr,
                    "destination": policy.destination_cidr,
                    "path_count": len(policy.preferred_path)
                })
        
        # Statistics
        topology["statistics"] = {
            "total_endpoints": len(self.endpoints),
            "total_connections": len(self.connections),
            "active_policies": len([p for p in self.policies.values() if p.active]),
            "total_bandwidth": sum(c.bandwidth_mbps for c in self.connections.values()),
            "average_latency": np.mean([c.latency_ms for c in self.connections.values()]),
            "mesh_connectivity": len(self.topology_graph) / len(self.endpoints) if self.endpoints else 0
        }
        
        return topology
    
    def get_traffic_analytics(self) -> Dict[str, Any]:
        """Get traffic analytics and statistics"""
        analytics = {
            "timestamp": datetime.now().isoformat(),
            "traffic_by_type": {},
            "top_routes": [],
            "bandwidth_utilization": {},
            "cost_analysis": {}
        }
        
        # Simulate traffic statistics
        for traffic_type in TrafficType:
            analytics["traffic_by_type"][traffic_type.value] = {
                "volume_gb": np.random.uniform(100, 1000),
                "percentage": np.random.uniform(5, 30)
            }
        
        # Top routes
        for policy in list(self.policies.values())[:5]:
            analytics["top_routes"].append({
                "name": policy.name,
                "traffic_type": policy.traffic_type.value,
                "volume_gb": np.random.uniform(50, 500),
                "avg_latency": self._get_path_latency(policy.preferred_path)
            })
        
        # Bandwidth utilization
        for conn in self.connections.values():
            analytics["bandwidth_utilization"][conn.name] = {
                "capacity_mbps": conn.bandwidth_mbps,
                "used_mbps": conn.bandwidth_mbps * np.random.uniform(0.3, 0.9),
                "utilization_percent": np.random.uniform(30, 90)
            }
        
        # Cost analysis
        total_cost = 0
        for conn in self.connections.values():
            monthly_cost = conn.bandwidth_mbps * 0.05 + np.random.uniform(10, 100)  # Simulated
            analytics["cost_analysis"][conn.name] = monthly_cost
            total_cost += monthly_cost
        
        analytics["cost_analysis"]["total_monthly_cost"] = total_cost
        
        return analytics


def main():
    """Test cross-cloud networking mesh"""
    print("🌐 Cross-Cloud Networking Mesh System")
    print("=" * 50)
    
    # Initialize network mesh
    mesh = CrossCloudNetworkMesh()
    
    # Display network topology
    print("\n🗺️ Network Topology:")
    topology = mesh.get_network_topology()
    
    print(f"\nEndpoints ({len(topology['endpoints'])}):")
    for endpoint in topology["endpoints"]:
        print(f"  - {endpoint['name']} ({endpoint['provider']})")
        print(f"    Region: {endpoint['region']}, CIDR: {endpoint['cidr']}")
    
    print(f"\nConnections ({len(topology['connections'])}):")
    for conn in topology["connections"]:
        print(f"  - {conn['name']} ({conn['type']})")
        print(f"    {conn['source']} ↔ {conn['destination']}")
        print(f"    Bandwidth: {conn['bandwidth']}Mbps, Latency: {conn['latency']}ms")
    
    # Create traffic policies
    print("\n📋 Creating Traffic Policies...")
    
    # Data replication policy
    replication_policy = mesh.create_traffic_policy(
        name="Data Replication Policy",
        source_cidr="10.0.0.0/16",  # AWS
        destination_cidr="10.128.0.0/16",  # GCP
        traffic_type=TrafficType.REPLICATION,
        requirements={
            "optimize_for": "bandwidth",
            "min_bandwidth": 1000,
            "encryption": True,
            "priority": 8
        }
    )
    
    # IoT data policy
    iot_policy = mesh.create_traffic_policy(
        name="IoT Data Policy",
        source_cidr="192.168.1.0/24",  # Edge
        destination_cidr="10.0.0.0/16",  # AWS
        traffic_type=TrafficType.IOT,
        requirements={
            "optimize_for": "latency",
            "max_latency": 10,
            "encryption": True,
            "priority": 9
        }
    )
    
    # Calculate optimal paths
    print("\n🛤️ Calculating Optimal Paths...")
    
    path = mesh.calculate_optimal_path(
        "ep-aws-us-east",
        "ep-gcp-us-central",
        {"optimize_for": "latency"}
    )
    
    if path:
        print(f"  AWS → GCP optimal path:")
        print(f"    Latency: {path.total_latency_ms}ms")
        print(f"    Bandwidth: {path.total_bandwidth_mbps}Mbps")
        print(f"    Cost: ${path.total_cost:.3f}/GB")
        print(f"    Reliability: {path.reliability_score:.1f}%")
        print(f"    Security: {path.security_score:.0f}/100")
    
    # Monitor health
    print("\n💓 Network Health Status:")
    health = mesh.monitor_health()
    
    print(f"  Overall health: {health['overall_health']}")
    print(f"  Active alerts: {len(health['alerts'])}")
    
    for alert in health["alerts"][:3]:
        print(f"    - {alert['type']}: {alert.get('endpoint', alert.get('connection'))}")
        print(f"      Value: {alert['value']:.2f}, Threshold: {alert['threshold']}")
    
    # Optimize network
    print("\n⚡ Network Optimization:")
    optimizations = mesh.optimize_network()
    
    print(f"  Connection optimizations: {len(optimizations['connection_optimizations'])}")
    print(f"  Path optimizations: {len(optimizations['path_optimizations'])}")
    print(f"  Potential cost savings: ${optimizations['cost_savings']:.2f}/month")
    print(f"  Latency improvements: {optimizations['latency_improvements']:.1f}ms")
    
    # Simulate failover
    print("\n🔄 Simulating Connection Failover...")
    failover = mesh.simulate_failover(list(mesh.connections.keys())[0])
    
    print(f"  Failed connection: {failover['failed_connection']}")
    print(f"  Affected policies: {failover['affected_policies']}")
    print(f"  Failover actions: {len(failover['failover_actions'])}")
    
    for action in failover["failover_actions"][:2]:
        print(f"    - {action['policy']}: {action['action']}")
    
    # Traffic analytics
    print("\n📊 Traffic Analytics:")
    analytics = mesh.get_traffic_analytics()
    
    print("  Traffic by type:")
    for traffic_type, stats in list(analytics["traffic_by_type"].items())[:3]:
        print(f"    {traffic_type}: {stats['volume_gb']:.0f}GB ({stats['percentage']:.1f}%)")
    
    print(f"\n  Total monthly cost: ${analytics['cost_analysis']['total_monthly_cost']:.2f}")
    
    print("\n✅ Cross-cloud networking mesh operational!")


if __name__ == "__main__":
    main()