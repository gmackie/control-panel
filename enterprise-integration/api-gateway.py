import asyncio
import time
import json
import hashlib
import hmac
import jwt
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Tuple
from enum import Enum
import logging
import uuid
import aiohttp
import aioredis
from urllib.parse import urlparse, parse_qs
import re

class AuthType(Enum):
    API_KEY = "api_key"
    JWT_BEARER = "jwt_bearer"
    OAUTH2 = "oauth2"
    BASIC_AUTH = "basic_auth"
    CUSTOM = "custom"
    NONE = "none"

class RateLimitType(Enum):
    REQUESTS_PER_SECOND = "rps"
    REQUESTS_PER_MINUTE = "rpm"
    REQUESTS_PER_HOUR = "rph"
    REQUESTS_PER_DAY = "rpd"
    CONCURRENT_REQUESTS = "concurrent"

class LoadBalancingStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin"
    LEAST_CONNECTIONS = "least_connections"
    IP_HASH = "ip_hash"
    RANDOM = "random"
    HEALTH_BASED = "health_based"

class CachingStrategy(Enum):
    NO_CACHE = "no_cache"
    CACHE_RESPONSE = "cache_response"
    CACHE_REQUEST = "cache_request"
    SMART_CACHE = "smart_cache"
    INVALIDATE_ON_UPDATE = "invalidate_on_update"

@dataclass
class APIEndpoint:
    id: str
    path: str
    methods: List[str]
    upstream_url: str
    auth_type: AuthType
    rate_limits: Dict[RateLimitType, int]
    cache_config: Dict[str, Any]
    transformations: List[Dict[str, Any]] = field(default_factory=list)
    middlewares: List[str] = field(default_factory=list)
    timeout: int = 30
    retry_attempts: int = 3
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class UpstreamService:
    id: str
    name: str
    base_url: str
    health_check_url: str
    weight: int = 1
    max_connections: int = 100
    timeout: int = 30
    health_status: str = "unknown"  # healthy, unhealthy, unknown
    last_health_check: Optional[datetime] = None
    connection_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RateLimitRule:
    id: str
    key_type: str  # "ip", "api_key", "user_id", "custom"
    limit_type: RateLimitType
    limit_value: int
    window_size: int  # seconds
    burst_limit: Optional[int] = None
    applies_to: List[str] = field(default_factory=list)  # endpoint IDs or patterns

@dataclass
class APIRequest:
    id: str
    timestamp: datetime
    method: str
    path: str
    headers: Dict[str, str]
    query_params: Dict[str, str]
    body: Optional[str]
    client_ip: str
    user_agent: str
    api_key: Optional[str] = None
    user_id: Optional[str] = None
    endpoint_id: Optional[str] = None

@dataclass
class APIResponse:
    status_code: int
    headers: Dict[str, str]
    body: str
    response_time_ms: float
    from_cache: bool = False
    upstream_service: Optional[str] = None

@dataclass
class RequestContext:
    request: APIRequest
    endpoint: Optional[APIEndpoint] = None
    upstream_service: Optional[UpstreamService] = None
    rate_limit_key: Optional[str] = None
    auth_context: Dict[str, Any] = field(default_factory=dict)
    transformations_applied: List[str] = field(default_factory=list)

class RateLimiter:
    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.redis = redis_client
        self.memory_store = {}  # Fallback for when Redis is not available
        
    async def check_rate_limit(self, key: str, rule: RateLimitRule) -> Tuple[bool, Dict[str, Any]]:
        current_time = int(time.time())
        window_start = current_time - rule.window_size
        
        if self.redis:
            return await self._check_rate_limit_redis(key, rule, current_time, window_start)
        else:
            return await self._check_rate_limit_memory(key, rule, current_time, window_start)
            
    async def _check_rate_limit_redis(self, key: str, rule: RateLimitRule, 
                                    current_time: int, window_start: int) -> Tuple[bool, Dict[str, Any]]:
        pipe = self.redis.pipeline()
        
        # Remove old entries
        pipe.zremrangebyscore(f"rate_limit:{key}", 0, window_start)
        
        # Count current requests
        pipe.zcard(f"rate_limit:{key}")
        
        # Add current request
        pipe.zadd(f"rate_limit:{key}", {str(uuid.uuid4()): current_time})
        
        # Set expiration
        pipe.expire(f"rate_limit:{key}", rule.window_size + 1)
        
        results = await pipe.execute()
        current_count = results[1]
        
        allowed = current_count < rule.limit_value
        
        return allowed, {
            'current_count': current_count,
            'limit': rule.limit_value,
            'window_size': rule.window_size,
            'reset_time': current_time + rule.window_size,
            'allowed': allowed
        }
        
    async def _check_rate_limit_memory(self, key: str, rule: RateLimitRule,
                                     current_time: int, window_start: int) -> Tuple[bool, Dict[str, Any]]:
        if key not in self.memory_store:
            self.memory_store[key] = []
            
        # Remove old entries
        self.memory_store[key] = [
            timestamp for timestamp in self.memory_store[key]
            if timestamp > window_start
        ]
        
        current_count = len(self.memory_store[key])
        allowed = current_count < rule.limit_value
        
        if allowed:
            self.memory_store[key].append(current_time)
            
        return allowed, {
            'current_count': current_count,
            'limit': rule.limit_value,
            'window_size': rule.window_size,
            'reset_time': current_time + rule.window_size,
            'allowed': allowed
        }

class LoadBalancer:
    def __init__(self, strategy: LoadBalancingStrategy = LoadBalancingStrategy.ROUND_ROBIN):
        self.strategy = strategy
        self.round_robin_counters = {}
        
    async def select_upstream(self, service_id: str, 
                            upstreams: List[UpstreamService],
                            request_context: RequestContext) -> Optional[UpstreamService]:
        healthy_upstreams = [u for u in upstreams if u.health_status == "healthy"]
        
        if not healthy_upstreams:
            # Fallback to all upstreams if none are healthy
            healthy_upstreams = upstreams
            
        if not healthy_upstreams:
            return None
            
        if self.strategy == LoadBalancingStrategy.ROUND_ROBIN:
            return await self._round_robin_select(service_id, healthy_upstreams)
        elif self.strategy == LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
            return await self._weighted_round_robin_select(service_id, healthy_upstreams)
        elif self.strategy == LoadBalancingStrategy.LEAST_CONNECTIONS:
            return await self._least_connections_select(healthy_upstreams)
        elif self.strategy == LoadBalancingStrategy.IP_HASH:
            return await self._ip_hash_select(healthy_upstreams, request_context.request.client_ip)
        elif self.strategy == LoadBalancingStrategy.RANDOM:
            return await self._random_select(healthy_upstreams)
        else:
            return healthy_upstreams[0]
            
    async def _round_robin_select(self, service_id: str, 
                                upstreams: List[UpstreamService]) -> UpstreamService:
        if service_id not in self.round_robin_counters:
            self.round_robin_counters[service_id] = 0
            
        selected = upstreams[self.round_robin_counters[service_id] % len(upstreams)]
        self.round_robin_counters[service_id] += 1
        
        return selected
        
    async def _weighted_round_robin_select(self, service_id: str,
                                         upstreams: List[UpstreamService]) -> UpstreamService:
        total_weight = sum(u.weight for u in upstreams)
        
        if service_id not in self.round_robin_counters:
            self.round_robin_counters[service_id] = 0
            
        counter = self.round_robin_counters[service_id] % total_weight
        current_weight = 0
        
        for upstream in upstreams:
            current_weight += upstream.weight
            if counter < current_weight:
                self.round_robin_counters[service_id] += 1
                return upstream
                
        return upstreams[0]
        
    async def _least_connections_select(self, upstreams: List[UpstreamService]) -> UpstreamService:
        return min(upstreams, key=lambda u: u.connection_count)
        
    async def _ip_hash_select(self, upstreams: List[UpstreamService], 
                            client_ip: str) -> UpstreamService:
        hash_value = hash(client_ip)
        return upstreams[hash_value % len(upstreams)]
        
    async def _random_select(self, upstreams: List[UpstreamService]) -> UpstreamService:
        import random
        return random.choice(upstreams)

class ResponseCache:
    def __init__(self, redis_client: Optional[aioredis.Redis] = None):
        self.redis = redis_client
        self.memory_cache = {}
        self.default_ttl = 300  # 5 minutes
        
    async def get(self, key: str) -> Optional[str]:
        if self.redis:
            return await self.redis.get(key)
        else:
            cache_entry = self.memory_cache.get(key)
            if cache_entry and cache_entry['expires'] > time.time():
                return cache_entry['value']
            elif cache_entry:
                del self.memory_cache[key]
            return None
            
    async def set(self, key: str, value: str, ttl: int = None) -> None:
        if ttl is None:
            ttl = self.default_ttl
            
        if self.redis:
            await self.redis.setex(key, ttl, value)
        else:
            self.memory_cache[key] = {
                'value': value,
                'expires': time.time() + ttl
            }
            
    async def delete(self, key: str) -> None:
        if self.redis:
            await self.redis.delete(key)
        else:
            self.memory_cache.pop(key, None)
            
    def generate_cache_key(self, request: APIRequest) -> str:
        # Generate cache key based on method, path, and query params
        key_parts = [
            request.method,
            request.path,
            json.dumps(sorted(request.query_params.items()))
        ]
        
        # Include relevant headers for cache key
        relevant_headers = ['accept', 'content-type', 'authorization']
        for header in relevant_headers:
            if header in request.headers:
                key_parts.append(f"{header}:{request.headers[header]}")
                
        key_string = '|'.join(key_parts)
        return hashlib.sha256(key_string.encode()).hexdigest()

class RequestTransformer:
    def __init__(self):
        self.transformations = {
            'add_header': self._add_header,
            'remove_header': self._remove_header,
            'rewrite_path': self._rewrite_path,
            'add_query_param': self._add_query_param,
            'transform_body': self._transform_body,
            'set_timeout': self._set_timeout
        }
        
    async def apply_transformations(self, context: RequestContext, 
                                  transformations: List[Dict[str, Any]]) -> RequestContext:
        for transformation in transformations:
            transform_type = transformation.get('type')
            if transform_type in self.transformations:
                context = await self.transformations[transform_type](context, transformation)
                context.transformations_applied.append(transform_type)
                
        return context
        
    async def _add_header(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        header_name = config.get('name')
        header_value = config.get('value')
        
        if header_name and header_value:
            context.request.headers[header_name] = header_value
            
        return context
        
    async def _remove_header(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        header_name = config.get('name')
        
        if header_name and header_name in context.request.headers:
            del context.request.headers[header_name]
            
        return context
        
    async def _rewrite_path(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        pattern = config.get('pattern')
        replacement = config.get('replacement')
        
        if pattern and replacement:
            context.request.path = re.sub(pattern, replacement, context.request.path)
            
        return context
        
    async def _add_query_param(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        param_name = config.get('name')
        param_value = config.get('value')
        
        if param_name and param_value:
            context.request.query_params[param_name] = param_value
            
        return context
        
    async def _transform_body(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        if context.request.body:
            # Apply body transformations based on config
            transform_type = config.get('transform_type', 'none')
            
            if transform_type == 'json_add_field':
                try:
                    body_json = json.loads(context.request.body)
                    body_json[config.get('field_name')] = config.get('field_value')
                    context.request.body = json.dumps(body_json)
                except:
                    pass  # Invalid JSON, skip transformation
                    
        return context
        
    async def _set_timeout(self, context: RequestContext, config: Dict[str, Any]) -> RequestContext:
        timeout = config.get('timeout')
        
        if timeout and context.endpoint:
            context.endpoint.timeout = timeout
            
        return context

class HealthChecker:
    def __init__(self):
        self.check_interval = 30  # seconds
        self.timeout = 10
        self.running = False
        
    async def start_health_checks(self, upstreams: Dict[str, List[UpstreamService]]):
        self.running = True
        
        while self.running:
            try:
                tasks = []
                for service_upstreams in upstreams.values():
                    for upstream in service_upstreams:
                        tasks.append(self._check_upstream_health(upstream))
                        
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                    
                await asyncio.sleep(self.check_interval)
                
            except Exception as e:
                logging.error(f"Health check error: {e}")
                await asyncio.sleep(self.check_interval)
                
    async def stop_health_checks(self):
        self.running = False
        
    async def _check_upstream_health(self, upstream: UpstreamService):
        try:
            start_time = time.time()
            
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                async with session.get(upstream.health_check_url) as response:
                    response_time = (time.time() - start_time) * 1000
                    
                    if response.status == 200:
                        upstream.health_status = "healthy"
                    else:
                        upstream.health_status = "unhealthy"
                        
                    upstream.last_health_check = datetime.now()
                    upstream.metadata['last_response_time'] = response_time
                    
        except Exception as e:
            upstream.health_status = "unhealthy"
            upstream.last_health_check = datetime.now()
            upstream.metadata['health_check_error'] = str(e)

class AuthenticationHandler:
    def __init__(self):
        self.api_keys = {}  # In production, this would be a database
        self.jwt_secret = "your-jwt-secret-key"
        
    async def authenticate_request(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        if not context.endpoint:
            return False, {'error': 'No endpoint configuration'}
            
        auth_type = context.endpoint.auth_type
        
        if auth_type == AuthType.NONE:
            return True, {}
        elif auth_type == AuthType.API_KEY:
            return await self._authenticate_api_key(context)
        elif auth_type == AuthType.JWT_BEARER:
            return await self._authenticate_jwt(context)
        elif auth_type == AuthType.OAUTH2:
            return await self._authenticate_oauth2(context)
        elif auth_type == AuthType.BASIC_AUTH:
            return await self._authenticate_basic(context)
        else:
            return False, {'error': 'Unsupported authentication type'}
            
    async def _authenticate_api_key(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        # Check for API key in header or query parameter
        api_key = (context.request.headers.get('X-API-Key') or 
                  context.request.headers.get('Authorization', '').replace('Bearer ', '') or
                  context.request.query_params.get('api_key'))
                  
        if not api_key:
            return False, {'error': 'API key required'}
            
        # Validate API key (in production, check against database)
        if api_key in self.api_keys:
            key_info = self.api_keys[api_key]
            context.auth_context = key_info
            context.request.api_key = api_key
            context.request.user_id = key_info.get('user_id')
            return True, key_info
        else:
            return False, {'error': 'Invalid API key'}
            
    async def _authenticate_jwt(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        auth_header = context.request.headers.get('Authorization', '')
        
        if not auth_header.startswith('Bearer '):
            return False, {'error': 'Bearer token required'}
            
        token = auth_header[7:]  # Remove 'Bearer ' prefix
        
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=['HS256'])
            context.auth_context = payload
            context.request.user_id = payload.get('user_id')
            return True, payload
        except jwt.ExpiredSignatureError:
            return False, {'error': 'Token expired'}
        except jwt.InvalidTokenError:
            return False, {'error': 'Invalid token'}
            
    async def _authenticate_oauth2(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        # Placeholder for OAuth2 implementation
        return False, {'error': 'OAuth2 not implemented'}
        
    async def _authenticate_basic(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        # Placeholder for Basic Auth implementation
        return False, {'error': 'Basic Auth not implemented'}
        
    def create_api_key(self, user_id: str, permissions: List[str]) -> str:
        api_key = f"ak_{uuid.uuid4().hex}"
        self.api_keys[api_key] = {
            'user_id': user_id,
            'permissions': permissions,
            'created_at': datetime.now().isoformat(),
            'last_used': None
        }
        return api_key

class APIGateway:
    def __init__(self, redis_url: Optional[str] = None):
        self.endpoints = {}
        self.upstream_services = {}
        self.rate_limit_rules = {}
        
        # Initialize components
        self.redis = None
        if redis_url:
            # In production, initialize Redis connection
            pass
            
        self.rate_limiter = RateLimiter(self.redis)
        self.load_balancer = LoadBalancer()
        self.cache = ResponseCache(self.redis)
        self.transformer = RequestTransformer()
        self.health_checker = HealthChecker()
        self.auth_handler = AuthenticationHandler()
        
        # Metrics
        self.request_count = 0
        self.error_count = 0
        self.response_times = []
        
    async def initialize(self):
        # Create sample API keys
        self.auth_handler.create_api_key("user1", ["read", "write"])
        self.auth_handler.create_api_key("user2", ["read"])
        
        # Start health checking
        asyncio.create_task(self.health_checker.start_health_checks(self.upstream_services))
        
    async def register_endpoint(self, endpoint: APIEndpoint):
        self.endpoints[endpoint.id] = endpoint
        
    async def register_upstream_service(self, service_id: str, upstream: UpstreamService):
        if service_id not in self.upstream_services:
            self.upstream_services[service_id] = []
        self.upstream_services[service_id].append(upstream)
        
    async def add_rate_limit_rule(self, rule: RateLimitRule):
        self.rate_limit_rules[rule.id] = rule
        
    async def process_request(self, request: APIRequest) -> APIResponse:
        start_time = time.time()
        self.request_count += 1
        
        try:
            # Find matching endpoint
            endpoint = await self._find_matching_endpoint(request)
            if not endpoint:
                return APIResponse(
                    status_code=404,
                    headers={'Content-Type': 'application/json'},
                    body=json.dumps({'error': 'Endpoint not found'}),
                    response_time_ms=(time.time() - start_time) * 1000
                )
                
            # Create request context
            context = RequestContext(request=request, endpoint=endpoint)
            
            # Authentication
            auth_success, auth_info = await self.auth_handler.authenticate_request(context)
            if not auth_success:
                return APIResponse(
                    status_code=401,
                    headers={'Content-Type': 'application/json'},
                    body=json.dumps(auth_info),
                    response_time_ms=(time.time() - start_time) * 1000
                )
                
            # Rate limiting
            rate_limit_allowed, rate_limit_info = await self._check_rate_limits(context)
            if not rate_limit_allowed:
                return APIResponse(
                    status_code=429,
                    headers={
                        'Content-Type': 'application/json',
                        'X-RateLimit-Limit': str(rate_limit_info.get('limit', 0)),
                        'X-RateLimit-Remaining': str(max(0, rate_limit_info.get('limit', 0) - rate_limit_info.get('current_count', 0))),
                        'X-RateLimit-Reset': str(rate_limit_info.get('reset_time', 0))
                    },
                    body=json.dumps({'error': 'Rate limit exceeded'}),
                    response_time_ms=(time.time() - start_time) * 1000
                )
                
            # Check cache
            cache_key = self.cache.generate_cache_key(request)
            cached_response = await self.cache.get(cache_key)
            
            if cached_response and endpoint.cache_config.get('enabled', False):
                cache_data = json.loads(cached_response)
                return APIResponse(
                    status_code=cache_data['status_code'],
                    headers=cache_data['headers'],
                    body=cache_data['body'],
                    response_time_ms=(time.time() - start_time) * 1000,
                    from_cache=True
                )
                
            # Apply transformations
            context = await self.transformer.apply_transformations(
                context, endpoint.transformations
            )
            
            # Select upstream service
            service_id = endpoint.metadata.get('service_id', 'default')
            upstreams = self.upstream_services.get(service_id, [])
            
            if not upstreams:
                return APIResponse(
                    status_code=503,
                    headers={'Content-Type': 'application/json'},
                    body=json.dumps({'error': 'No upstream services available'}),
                    response_time_ms=(time.time() - start_time) * 1000
                )
                
            upstream = await self.load_balancer.select_upstream(service_id, upstreams, context)
            if not upstream:
                return APIResponse(
                    status_code=503,
                    headers={'Content-Type': 'application/json'},
                    body=json.dumps({'error': 'No healthy upstream services'}),
                    response_time_ms=(time.time() - start_time) * 1000
                )
                
            context.upstream_service = upstream
            
            # Forward request to upstream
            response = await self._forward_request(context)
            
            # Cache response if configured
            if (endpoint.cache_config.get('enabled', False) and 
                response.status_code == 200 and
                request.method == 'GET'):
                
                cache_data = {
                    'status_code': response.status_code,
                    'headers': response.headers,
                    'body': response.body
                }
                
                ttl = endpoint.cache_config.get('ttl', 300)
                await self.cache.set(cache_key, json.dumps(cache_data), ttl)
                
            response.response_time_ms = (time.time() - start_time) * 1000
            self.response_times.append(response.response_time_ms)
            
            # Keep only last 1000 response times for metrics
            if len(self.response_times) > 1000:
                self.response_times = self.response_times[-1000:]
                
            return response
            
        except Exception as e:
            self.error_count += 1
            logging.error(f"Gateway error: {e}")
            
            return APIResponse(
                status_code=500,
                headers={'Content-Type': 'application/json'},
                body=json.dumps({'error': 'Internal server error'}),
                response_time_ms=(time.time() - start_time) * 1000
            )
            
    async def _find_matching_endpoint(self, request: APIRequest) -> Optional[APIEndpoint]:
        for endpoint in self.endpoints.values():
            if (request.method in endpoint.methods and
                self._path_matches(request.path, endpoint.path)):
                return endpoint
        return None
        
    def _path_matches(self, request_path: str, endpoint_path: str) -> bool:
        # Simple path matching - in production, use more sophisticated routing
        if endpoint_path == request_path:
            return True
            
        # Handle path parameters like /users/{id}
        endpoint_parts = endpoint_path.split('/')
        request_parts = request_path.split('/')
        
        if len(endpoint_parts) != len(request_parts):
            return False
            
        for endpoint_part, request_part in zip(endpoint_parts, request_parts):
            if endpoint_part.startswith('{') and endpoint_part.endswith('}'):
                # Path parameter, matches anything
                continue
            elif endpoint_part != request_part:
                return False
                
        return True
        
    async def _check_rate_limits(self, context: RequestContext) -> Tuple[bool, Dict[str, Any]]:
        for rule in self.rate_limit_rules.values():
            # Check if rule applies to this endpoint
            if (rule.applies_to and 
                context.endpoint.id not in rule.applies_to):
                continue
                
            # Generate rate limit key
            if rule.key_type == "ip":
                key = f"ip:{context.request.client_ip}"
            elif rule.key_type == "api_key" and context.request.api_key:
                key = f"api_key:{context.request.api_key}"
            elif rule.key_type == "user_id" and context.request.user_id:
                key = f"user_id:{context.request.user_id}"
            else:
                continue  # Skip this rule if key type doesn't match
                
            context.rate_limit_key = key
            
            allowed, info = await self.rate_limiter.check_rate_limit(key, rule)
            if not allowed:
                return False, info
                
        return True, {}
        
    async def _forward_request(self, context: RequestContext) -> APIResponse:
        upstream = context.upstream_service
        endpoint = context.endpoint
        request = context.request
        
        # Increment connection count
        upstream.connection_count += 1
        
        try:
            # Build upstream URL
            upstream_url = f"{upstream.base_url.rstrip('/')}{request.path}"
            
            # Add query parameters
            if request.query_params:
                query_string = '&'.join([f"{k}={v}" for k, v in request.query_params.items()])
                upstream_url += f"?{query_string}"
                
            timeout = aiohttp.ClientTimeout(total=endpoint.timeout)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(
                    method=request.method,
                    url=upstream_url,
                    headers=request.headers,
                    data=request.body
                ) as response:
                    
                    response_body = await response.text()
                    response_headers = dict(response.headers)
                    
                    # Add gateway headers
                    response_headers['X-Gateway-Upstream'] = upstream.id
                    response_headers['X-Gateway-Request-ID'] = request.id
                    
                    return APIResponse(
                        status_code=response.status,
                        headers=response_headers,
                        body=response_body,
                        response_time_ms=0,  # Will be set by caller
                        upstream_service=upstream.id
                    )
                    
        except asyncio.TimeoutError:
            return APIResponse(
                status_code=504,
                headers={'Content-Type': 'application/json'},
                body=json.dumps({'error': 'Gateway timeout'}),
                response_time_ms=0
            )
        except Exception as e:
            return APIResponse(
                status_code=502,
                headers={'Content-Type': 'application/json'},
                body=json.dumps({'error': 'Bad gateway', 'details': str(e)}),
                response_time_ms=0
            )
        finally:
            # Decrement connection count
            upstream.connection_count -= 1
            
    async def get_metrics(self) -> Dict[str, Any]:
        avg_response_time = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times else 0
        )
        
        # Count healthy/unhealthy upstreams
        total_upstreams = 0
        healthy_upstreams = 0
        
        for upstreams in self.upstream_services.values():
            for upstream in upstreams:
                total_upstreams += 1
                if upstream.health_status == "healthy":
                    healthy_upstreams += 1
                    
        return {
            'total_requests': self.request_count,
            'total_errors': self.error_count,
            'error_rate': (self.error_count / self.request_count * 100) if self.request_count > 0 else 0,
            'avg_response_time_ms': avg_response_time,
            'registered_endpoints': len(self.endpoints),
            'upstream_services': total_upstreams,
            'healthy_upstreams': healthy_upstreams,
            'rate_limit_rules': len(self.rate_limit_rules),
            'cache_size': len(self.cache.memory_cache) if not self.cache.redis else 'redis'
        }
        
    async def get_endpoint_metrics(self, endpoint_id: str) -> Dict[str, Any]:
        # In production, this would aggregate metrics from a time-series database
        return {
            'endpoint_id': endpoint_id,
            'total_requests': 0,  # Placeholder
            'avg_response_time': 0,
            'error_rate': 0,
            'cache_hit_rate': 0
        }

# Example usage and configuration
async def main():
    gateway = APIGateway()
    await gateway.initialize()
    
    # Register upstream services
    await gateway.register_upstream_service('user-service', UpstreamService(
        id='user-service-1',
        name='User Service Instance 1',
        base_url='http://localhost:3001',
        health_check_url='http://localhost:3001/health',
        weight=1
    ))
    
    await gateway.register_upstream_service('user-service', UpstreamService(
        id='user-service-2',
        name='User Service Instance 2',
        base_url='http://localhost:3002',
        health_check_url='http://localhost:3002/health',
        weight=2
    ))
    
    # Register API endpoints
    await gateway.register_endpoint(APIEndpoint(
        id='users-api',
        path='/api/v1/users',
        methods=['GET', 'POST'],
        upstream_url='http://localhost:3001',
        auth_type=AuthType.API_KEY,
        rate_limits={
            RateLimitType.REQUESTS_PER_MINUTE: 100,
            RateLimitType.REQUESTS_PER_HOUR: 1000
        },
        cache_config={'enabled': True, 'ttl': 300},
        transformations=[
            {'type': 'add_header', 'name': 'X-Gateway-Version', 'value': '1.0'},
            {'type': 'add_query_param', 'name': 'source', 'value': 'gateway'}
        ],
        metadata={'service_id': 'user-service'}
    ))
    
    # Add rate limit rules
    await gateway.add_rate_limit_rule(RateLimitRule(
        id='api-key-limit',
        key_type='api_key',
        limit_type=RateLimitType.REQUESTS_PER_MINUTE,
        limit_value=60,
        window_size=60,
        applies_to=['users-api']
    ))
    
    # Simulate a request
    test_request = APIRequest(
        id=str(uuid.uuid4()),
        timestamp=datetime.now(),
        method='GET',
        path='/api/v1/users',
        headers={
            'X-API-Key': list(gateway.auth_handler.api_keys.keys())[0],
            'User-Agent': 'Test Client/1.0'
        },
        query_params={'limit': '10'},
        body=None,
        client_ip='192.168.1.100',
        user_agent='Test Client/1.0'
    )
    
    # Process the request
    response = await gateway.process_request(test_request)
    print(f"Response Status: {response.status_code}")
    print(f"Response Time: {response.response_time_ms:.2f}ms")
    print(f"From Cache: {response.from_cache}")
    
    # Get gateway metrics
    metrics = await gateway.get_metrics()
    print(f"Gateway Metrics: {metrics}")

if __name__ == "__main__":
    asyncio.run(main())