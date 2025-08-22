import asyncio
import json
import semver
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union
from enum import Enum
import logging
import uuid
import aiohttp
import yaml
from pathlib import Path

class VersioningStrategy(Enum):
    URL_PATH = "url_path"  # /v1/users, /v2/users
    QUERY_PARAMETER = "query_parameter"  # /users?version=1
    HEADER_BASED = "header_based"  # Accept: application/vnd.api+json;version=1
    CONTENT_TYPE = "content_type"  # Content-Type: application/vnd.api.v1+json
    SUBDOMAIN = "subdomain"  # v1.api.example.com
    ACCEPT_HEADER = "accept_header"  # Accept: application/json; version=1.0

class APIStatus(Enum):
    DEVELOPMENT = "development"
    ALPHA = "alpha"
    BETA = "beta"
    STABLE = "stable"
    DEPRECATED = "deprecated"
    RETIRED = "retired"

class CompatibilityLevel(Enum):
    BREAKING = "breaking"  # Major version change required
    NON_BREAKING = "non_breaking"  # Minor version change
    PATCH = "patch"  # Patch version change
    COMPATIBLE = "compatible"  # No version change needed

class MigrationStrategy(Enum):
    IMMEDIATE = "immediate"  # Immediate cutover
    GRADUAL = "gradual"  # Gradual traffic migration
    PARALLEL = "parallel"  # Run versions in parallel
    FEATURE_FLAG = "feature_flag"  # Feature flag controlled

@dataclass
class APIVersion:
    version: str  # Semantic version (e.g., "1.2.3")
    status: APIStatus
    release_date: datetime
    deprecation_date: Optional[datetime] = None
    retirement_date: Optional[datetime] = None
    changelog: List[str] = field(default_factory=list)
    breaking_changes: List[str] = field(default_factory=list)
    migration_guide: Optional[str] = None
    support_contacts: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class APIDefinition:
    id: str
    name: str
    description: str
    base_path: str
    current_version: str
    versions: Dict[str, APIVersion]
    versioning_strategy: VersioningStrategy
    default_version: str
    supported_versions: List[str]
    schema_definitions: Dict[str, Dict] = field(default_factory=dict)  # OpenAPI schemas
    endpoints: Dict[str, List[Dict]] = field(default_factory=dict)  # Version -> Endpoints
    rate_limits: Dict[str, Dict] = field(default_factory=dict)  # Version -> Rate limits
    authentication: Dict[str, Dict] = field(default_factory=dict)  # Version -> Auth config
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class VersionMigration:
    id: str
    api_id: str
    from_version: str
    to_version: str
    strategy: MigrationStrategy
    start_date: datetime
    completion_date: Optional[datetime] = None
    traffic_percentage: float = 0.0  # For gradual migration
    rollback_plan: Optional[str] = None
    validation_rules: List[Dict[str, Any]] = field(default_factory=list)
    is_active: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class CompatibilityCheck:
    from_version: str
    to_version: str
    compatibility_level: CompatibilityLevel
    breaking_changes: List[str]
    migration_required: bool
    automated_migration_available: bool
    validation_errors: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

@dataclass
class VersionUsageMetrics:
    version: str
    request_count: int
    unique_clients: int
    error_rate: float
    avg_response_time: float
    last_used: datetime
    geographical_distribution: Dict[str, int] = field(default_factory=dict)
    client_versions: Dict[str, int] = field(default_factory=dict)

class SchemaValidator:
    def __init__(self):
        self.schemas = {}
        
    def register_schema(self, version: str, schema: Dict[str, Any]):
        self.schemas[version] = schema
        
    async def validate_request(self, version: str, endpoint: str, 
                             request_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        if version not in self.schemas:
            return False, [f"Schema for version {version} not found"]
            
        schema = self.schemas[version]
        endpoint_schema = schema.get('paths', {}).get(endpoint, {})
        
        # Simplified validation - in production, use jsonschema library
        errors = []
        
        # Validate required fields
        for method, method_schema in endpoint_schema.items():
            if method.upper() == request_data.get('method', '').upper():
                request_body_schema = method_schema.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema', {})
                
                required_fields = request_body_schema.get('required', [])
                request_body = request_data.get('body', {})
                
                for field in required_fields:
                    if field not in request_body:
                        errors.append(f"Required field '{field}' is missing")
                        
        return len(errors) == 0, errors
        
    async def validate_response(self, version: str, endpoint: str, method: str,
                              status_code: int, response_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        # Simplified response validation
        return True, []

class VersionMatcher:
    def __init__(self, strategy: VersioningStrategy):
        self.strategy = strategy
        
    async def extract_version(self, request_data: Dict[str, Any]) -> Optional[str]:
        if self.strategy == VersioningStrategy.URL_PATH:
            return self._extract_from_url_path(request_data.get('path', ''))
        elif self.strategy == VersioningStrategy.QUERY_PARAMETER:
            return request_data.get('query_params', {}).get('version')
        elif self.strategy == VersioningStrategy.HEADER_BASED:
            return self._extract_from_header(request_data.get('headers', {}))
        elif self.strategy == VersioningStrategy.ACCEPT_HEADER:
            return self._extract_from_accept_header(request_data.get('headers', {}))
        else:
            return None
            
    def _extract_from_url_path(self, path: str) -> Optional[str]:
        # Extract version from URL like /v1/users or /api/v2/orders
        import re
        match = re.search(r'/v(\d+(?:\.\d+)*)', path)
        return match.group(1) if match else None
        
    def _extract_from_header(self, headers: Dict[str, str]) -> Optional[str]:
        # Extract from custom header like API-Version: 1.0
        return headers.get('API-Version') or headers.get('X-API-Version')
        
    def _extract_from_accept_header(self, headers: Dict[str, str]) -> Optional[str]:
        # Extract from Accept header like Accept: application/json; version=1.0
        accept_header = headers.get('Accept', '')
        import re
        match = re.search(r'version=([^;,\s]+)', accept_header)
        return match.group(1) if match else None

class BreakingChangeDetector:
    def __init__(self):
        self.change_rules = {
            'removed_endpoint': CompatibilityLevel.BREAKING,
            'removed_field': CompatibilityLevel.BREAKING,
            'changed_field_type': CompatibilityLevel.BREAKING,
            'added_required_field': CompatibilityLevel.BREAKING,
            'changed_response_structure': CompatibilityLevel.BREAKING,
            'added_optional_field': CompatibilityLevel.NON_BREAKING,
            'added_endpoint': CompatibilityLevel.NON_BREAKING,
            'deprecated_field': CompatibilityLevel.NON_BREAKING,
            'bug_fix': CompatibilityLevel.PATCH,
            'performance_improvement': CompatibilityLevel.PATCH
        }
        
    async def analyze_changes(self, old_schema: Dict[str, Any], 
                            new_schema: Dict[str, Any]) -> CompatibilityCheck:
        breaking_changes = []
        compatibility_level = CompatibilityLevel.COMPATIBLE
        
        # Compare endpoints
        old_paths = set(old_schema.get('paths', {}).keys())
        new_paths = set(new_schema.get('paths', {}).keys())
        
        removed_paths = old_paths - new_paths
        if removed_paths:
            breaking_changes.extend([f"Removed endpoint: {path}" for path in removed_paths])
            compatibility_level = CompatibilityLevel.BREAKING
            
        # Compare schemas for existing endpoints
        for path in old_paths.intersection(new_paths):
            old_path_spec = old_schema['paths'][path]
            new_path_spec = new_schema['paths'][path]
            
            path_changes = await self._compare_path_specs(old_path_spec, new_path_spec, path)
            breaking_changes.extend(path_changes)
            
            if path_changes:
                compatibility_level = max(compatibility_level, CompatibilityLevel.BREAKING)
                
        return CompatibilityCheck(
            from_version="old",
            to_version="new",
            compatibility_level=compatibility_level,
            breaking_changes=breaking_changes,
            migration_required=compatibility_level == CompatibilityLevel.BREAKING,
            automated_migration_available=False,
            recommendations=self._generate_recommendations(breaking_changes)
        )
        
    async def _compare_path_specs(self, old_spec: Dict, new_spec: Dict, path: str) -> List[str]:
        changes = []
        
        # Compare HTTP methods
        old_methods = set(old_spec.keys())
        new_methods = set(new_spec.keys())
        
        removed_methods = old_methods - new_methods
        if removed_methods:
            changes.extend([f"Removed method {method} from {path}" for method in removed_methods])
            
        # Compare request/response schemas for common methods
        for method in old_methods.intersection(new_methods):
            if method in ['get', 'post', 'put', 'patch', 'delete']:
                method_changes = await self._compare_method_specs(
                    old_spec[method], new_spec[method], f"{method.upper()} {path}"
                )
                changes.extend(method_changes)
                
        return changes
        
    async def _compare_method_specs(self, old_method: Dict, new_method: Dict, identifier: str) -> List[str]:
        changes = []
        
        # Compare request body schemas
        old_request = old_method.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema', {})
        new_request = new_method.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema', {})
        
        if old_request or new_request:
            request_changes = await self._compare_schemas(old_request, new_request, f"{identifier} request")
            changes.extend(request_changes)
            
        # Compare response schemas
        old_responses = old_method.get('responses', {})
        new_responses = new_method.get('responses', {})
        
        for status_code in old_responses.keys():
            if status_code in new_responses:
                old_response_schema = old_responses[status_code].get('content', {}).get('application/json', {}).get('schema', {})
                new_response_schema = new_responses[status_code].get('content', {}).get('application/json', {}).get('schema', {})
                
                response_changes = await self._compare_schemas(
                    old_response_schema, new_response_schema, f"{identifier} response {status_code}"
                )
                changes.extend(response_changes)
                
        return changes
        
    async def _compare_schemas(self, old_schema: Dict, new_schema: Dict, context: str) -> List[str]:
        changes = []
        
        old_properties = old_schema.get('properties', {})
        new_properties = new_schema.get('properties', {})
        old_required = set(old_schema.get('required', []))
        new_required = set(new_schema.get('required', []))
        
        # Check for removed properties
        removed_properties = set(old_properties.keys()) - set(new_properties.keys())
        if removed_properties:
            changes.extend([f"Removed field '{prop}' from {context}" for prop in removed_properties])
            
        # Check for new required properties
        new_required_props = new_required - old_required
        if new_required_props:
            changes.extend([f"Added required field '{prop}' to {context}" for prop in new_required_props])
            
        # Check for type changes in existing properties
        for prop in set(old_properties.keys()).intersection(set(new_properties.keys())):
            old_type = old_properties[prop].get('type')
            new_type = new_properties[prop].get('type')
            
            if old_type != new_type:
                changes.append(f"Changed type of field '{prop}' from {old_type} to {new_type} in {context}")
                
        return changes
        
    def _generate_recommendations(self, breaking_changes: List[str]) -> List[str]:
        recommendations = []
        
        if any('Removed' in change for change in breaking_changes):
            recommendations.append("Consider deprecating removed fields/endpoints before removal")
            recommendations.append("Provide migration guide for removed functionality")
            
        if any('required field' in change for change in breaking_changes):
            recommendations.append("Consider making new required fields optional with sensible defaults")
            
        if any('Changed type' in change for change in breaking_changes):
            recommendations.append("Consider supporting both old and new types during transition period")
            
        return recommendations

class MigrationManager:
    def __init__(self):
        self.active_migrations = {}
        self.migration_history = []
        
    async def create_migration(self, migration: VersionMigration) -> str:
        self.active_migrations[migration.id] = migration
        return migration.id
        
    async def start_migration(self, migration_id: str) -> bool:
        if migration_id not in self.active_migrations:
            return False
            
        migration = self.active_migrations[migration_id]
        migration.is_active = True
        migration.start_date = datetime.now()
        
        if migration.strategy == MigrationStrategy.GRADUAL:
            # Start with small traffic percentage
            migration.traffic_percentage = 5.0
            
        return True
        
    async def update_migration_progress(self, migration_id: str, 
                                      traffic_percentage: float) -> bool:
        if migration_id not in self.active_migrations:
            return False
            
        migration = self.active_migrations[migration_id]
        migration.traffic_percentage = min(100.0, max(0.0, traffic_percentage))
        
        if migration.traffic_percentage >= 100.0:
            await self.complete_migration(migration_id)
            
        return True
        
    async def complete_migration(self, migration_id: str) -> bool:
        if migration_id not in self.active_migrations:
            return False
            
        migration = self.active_migrations[migration_id]
        migration.completion_date = datetime.now()
        migration.is_active = False
        
        self.migration_history.append(migration)
        del self.active_migrations[migration_id]
        
        return True
        
    async def rollback_migration(self, migration_id: str) -> bool:
        if migration_id not in self.active_migrations:
            return False
            
        migration = self.active_migrations[migration_id]
        migration.traffic_percentage = 0.0
        migration.is_active = False
        
        # Execute rollback plan if available
        if migration.rollback_plan:
            logging.info(f"Executing rollback plan for migration {migration_id}")
            # Implementation would depend on specific rollback procedures
            
        return True
        
    async def get_migration_status(self, migration_id: str) -> Optional[Dict[str, Any]]:
        migration = self.active_migrations.get(migration_id)
        if not migration:
            return None
            
        return {
            'id': migration.id,
            'api_id': migration.api_id,
            'from_version': migration.from_version,
            'to_version': migration.to_version,
            'strategy': migration.strategy.value,
            'is_active': migration.is_active,
            'traffic_percentage': migration.traffic_percentage,
            'start_date': migration.start_date.isoformat() if migration.start_date else None,
            'completion_date': migration.completion_date.isoformat() if migration.completion_date else None
        }

class VersionUsageTracker:
    def __init__(self):
        self.usage_data = {}
        self.client_tracking = {}
        
    async def track_request(self, api_id: str, version: str, client_id: str,
                          response_time: float, status_code: int, client_info: Dict[str, Any]):
        key = f"{api_id}:{version}"
        
        if key not in self.usage_data:
            self.usage_data[key] = VersionUsageMetrics(
                version=version,
                request_count=0,
                unique_clients=0,
                error_rate=0.0,
                avg_response_time=0.0,
                last_used=datetime.now(),
                geographical_distribution={},
                client_versions={}
            )
            
        metrics = self.usage_data[key]
        metrics.request_count += 1
        metrics.last_used = datetime.now()
        
        # Update response time (rolling average)
        metrics.avg_response_time = (
            (metrics.avg_response_time * (metrics.request_count - 1) + response_time) /
            metrics.request_count
        )
        
        # Track error rate
        if status_code >= 400:
            error_count = getattr(metrics, '_error_count', 0) + 1
            setattr(metrics, '_error_count', error_count)
            metrics.error_rate = error_count / metrics.request_count * 100
            
        # Track unique clients
        client_key = f"{api_id}:{version}:{client_id}"
        if client_key not in self.client_tracking:
            self.client_tracking[client_key] = True
            metrics.unique_clients += 1
            
        # Track geographical distribution
        location = client_info.get('location', 'unknown')
        metrics.geographical_distribution[location] = metrics.geographical_distribution.get(location, 0) + 1
        
        # Track client versions
        client_version = client_info.get('client_version', 'unknown')
        metrics.client_versions[client_version] = metrics.client_versions.get(client_version, 0) + 1
        
    async def get_usage_metrics(self, api_id: str, version: Optional[str] = None) -> Dict[str, VersionUsageMetrics]:
        if version:
            key = f"{api_id}:{version}"
            return {version: self.usage_data.get(key)} if key in self.usage_data else {}
        else:
            # Return all versions for the API
            result = {}
            for key, metrics in self.usage_data.items():
                if key.startswith(f"{api_id}:"):
                    version_part = key.split(':', 1)[1]
                    result[version_part] = metrics
            return result
            
    async def get_version_adoption_report(self, api_id: str) -> Dict[str, Any]:
        api_metrics = await self.get_usage_metrics(api_id)
        
        total_requests = sum(metrics.request_count for metrics in api_metrics.values())
        
        adoption_data = {}
        for version, metrics in api_metrics.items():
            adoption_percentage = (metrics.request_count / total_requests * 100) if total_requests > 0 else 0
            
            adoption_data[version] = {
                'request_count': metrics.request_count,
                'adoption_percentage': adoption_percentage,
                'unique_clients': metrics.unique_clients,
                'error_rate': metrics.error_rate,
                'avg_response_time': metrics.avg_response_time,
                'last_used': metrics.last_used.isoformat(),
                'days_since_last_use': (datetime.now() - metrics.last_used).days
            }
            
        return {
            'api_id': api_id,
            'total_requests': total_requests,
            'version_adoption': adoption_data,
            'most_used_version': max(adoption_data.keys(), key=lambda v: adoption_data[v]['request_count']) if adoption_data else None
        }

class APIVersioningLifecycleManager:
    def __init__(self):
        self.apis = {}
        self.schema_validator = SchemaValidator()
        self.breaking_change_detector = BreakingChangeDetector()
        self.migration_manager = MigrationManager()
        self.usage_tracker = VersionUsageTracker()
        
    def register_api(self, api_definition: APIDefinition):
        self.apis[api_definition.id] = api_definition
        
        # Register schemas for validation
        for version, schema in api_definition.schema_definitions.items():
            self.schema_validator.register_schema(version, schema)
            
    async def create_new_version(self, api_id: str, new_version: str, 
                               schema: Dict[str, Any], changelog: List[str]) -> bool:
        if api_id not in self.apis:
            return False
            
        api = self.apis[api_id]
        
        # Validate version format
        try:
            semver.VersionInfo.parse(new_version)
        except ValueError:
            logging.error(f"Invalid semantic version format: {new_version}")
            return False
            
        # Check if version already exists
        if new_version in api.versions:
            logging.error(f"Version {new_version} already exists for API {api_id}")
            return False
            
        # Analyze compatibility with current version
        current_schema = api.schema_definitions.get(api.current_version, {})
        compatibility_check = await self.breaking_change_detector.analyze_changes(
            current_schema, schema
        )
        
        # Create new version
        api_version = APIVersion(
            version=new_version,
            status=APIStatus.DEVELOPMENT,
            release_date=datetime.now(),
            changelog=changelog,
            breaking_changes=compatibility_check.breaking_changes
        )
        
        api.versions[new_version] = api_version
        api.schema_definitions[new_version] = schema
        self.schema_validator.register_schema(new_version, schema)
        
        return True
        
    async def promote_version(self, api_id: str, version: str, new_status: APIStatus) -> bool:
        if api_id not in self.apis:
            return False
            
        api = self.apis[api_id]
        if version not in api.versions:
            return False
            
        api_version = api.versions[version]
        old_status = api_version.status
        api_version.status = new_status
        
        # Update API current version if promoting to stable
        if new_status == APIStatus.STABLE:
            api.current_version = version
            if version not in api.supported_versions:
                api.supported_versions.append(version)
                
        logging.info(f"Promoted API {api_id} version {version} from {old_status.value} to {new_status.value}")
        return True
        
    async def deprecate_version(self, api_id: str, version: str, 
                              deprecation_date: Optional[datetime] = None,
                              retirement_date: Optional[datetime] = None) -> bool:
        if api_id not in self.apis:
            return False
            
        api = self.apis[api_id]
        if version not in api.versions:
            return False
            
        api_version = api.versions[version]
        api_version.status = APIStatus.DEPRECATED
        api_version.deprecation_date = deprecation_date or datetime.now()
        
        if retirement_date:
            api_version.retirement_date = retirement_date
        else:
            # Default retirement date: 6 months after deprecation
            api_version.retirement_date = api_version.deprecation_date + timedelta(days=180)
            
        # Remove from supported versions
        if version in api.supported_versions:
            api.supported_versions.remove(version)
            
        return True
        
    async def retire_version(self, api_id: str, version: str) -> bool:
        if api_id not in self.apis:
            return False
            
        api = self.apis[api_id]
        if version not in api.versions:
            return False
            
        api_version = api.versions[version]
        api_version.status = APIStatus.RETIRED
        
        # Remove from all active lists
        if version in api.supported_versions:
            api.supported_versions.remove(version)
            
        return True
        
    async def resolve_version(self, api_id: str, request_data: Dict[str, Any]) -> Optional[str]:
        if api_id not in self.apis:
            return None
            
        api = self.apis[api_id]
        version_matcher = VersionMatcher(api.versioning_strategy)
        
        # Try to extract version from request
        requested_version = await version_matcher.extract_version(request_data)
        
        if requested_version:
            # Validate that the requested version is supported
            if requested_version in api.supported_versions:
                return requested_version
            else:
                # Try to find compatible version
                return await self._find_compatible_version(api, requested_version)
        else:
            # Return default version
            return api.default_version
            
    async def _find_compatible_version(self, api: APIDefinition, requested_version: str) -> Optional[str]:
        try:
            requested_semver = semver.VersionInfo.parse(requested_version)
            
            # Find the highest compatible version
            compatible_versions = []
            for supported_version in api.supported_versions:
                try:
                    supported_semver = semver.VersionInfo.parse(supported_version)
                    
                    # Same major version is considered compatible
                    if supported_semver.major == requested_semver.major:
                        compatible_versions.append((supported_version, supported_semver))
                        
                except ValueError:
                    continue
                    
            if compatible_versions:
                # Return the highest compatible version
                compatible_versions.sort(key=lambda x: x[1], reverse=True)
                return compatible_versions[0][0]
                
        except ValueError:
            pass
            
        # Fallback to default version
        return api.default_version
        
    async def create_migration_plan(self, api_id: str, from_version: str, 
                                  to_version: str, strategy: MigrationStrategy) -> Optional[str]:
        if api_id not in self.apis:
            return None
            
        api = self.apis[api_id]
        
        if from_version not in api.versions or to_version not in api.versions:
            return None
            
        # Analyze compatibility
        from_schema = api.schema_definitions.get(from_version, {})
        to_schema = api.schema_definitions.get(to_version, {})
        
        compatibility_check = await self.breaking_change_detector.analyze_changes(
            from_schema, to_schema
        )
        
        migration = VersionMigration(
            id=str(uuid.uuid4()),
            api_id=api_id,
            from_version=from_version,
            to_version=to_version,
            strategy=strategy,
            start_date=datetime.now(),
            validation_rules=[
                {
                    'type': 'compatibility_check',
                    'level': compatibility_check.compatibility_level.value,
                    'breaking_changes': compatibility_check.breaking_changes
                }
            ]
        )
        
        migration_id = await self.migration_manager.create_migration(migration)
        return migration_id
        
    async def get_api_lifecycle_status(self, api_id: str) -> Dict[str, Any]:
        if api_id not in self.apis:
            return {}
            
        api = self.apis[api_id]
        
        # Get usage metrics for all versions
        usage_report = await self.usage_tracker.get_version_adoption_report(api_id)
        
        # Get active migrations
        active_migrations = [
            await self.migration_manager.get_migration_status(migration_id)
            for migration_id in self.migration_manager.active_migrations.keys()
            if self.migration_manager.active_migrations[migration_id].api_id == api_id
        ]
        
        # Analyze version health
        version_health = {}
        for version, api_version in api.versions.items():
            days_since_release = (datetime.now() - api_version.release_date).days
            
            health_status = "healthy"
            if api_version.status == APIStatus.DEPRECATED:
                if api_version.retirement_date and datetime.now() > api_version.retirement_date:
                    health_status = "overdue_retirement"
                else:
                    health_status = "deprecated"
            elif api_version.status == APIStatus.RETIRED:
                health_status = "retired"
            elif days_since_release > 365 and api_version.status == APIStatus.STABLE:
                health_status = "aging"
                
            version_health[version] = {
                'status': api_version.status.value,
                'health': health_status,
                'days_since_release': days_since_release,
                'deprecation_date': api_version.deprecation_date.isoformat() if api_version.deprecation_date else None,
                'retirement_date': api_version.retirement_date.isoformat() if api_version.retirement_date else None
            }
            
        return {
            'api_id': api_id,
            'current_version': api.current_version,
            'supported_versions': api.supported_versions,
            'total_versions': len(api.versions),
            'version_health': version_health,
            'usage_statistics': usage_report,
            'active_migrations': active_migrations,
            'lifecycle_recommendations': await self._generate_lifecycle_recommendations(api)
        }
        
    async def _generate_lifecycle_recommendations(self, api: APIDefinition) -> List[str]:
        recommendations = []
        
        # Check for old deprecated versions
        for version, api_version in api.versions.items():
            if (api_version.status == APIStatus.DEPRECATED and 
                api_version.retirement_date and
                datetime.now() > api_version.retirement_date):
                recommendations.append(f"Version {version} is overdue for retirement")
                
        # Check for versions with low adoption
        usage_metrics = await self.usage_tracker.get_usage_metrics(api.id)
        for version, metrics in usage_metrics.items():
            if metrics and (datetime.now() - metrics.last_used).days > 90:
                recommendations.append(f"Version {version} has not been used in 90+ days - consider deprecation")
                
        # Check version distribution
        if len(api.supported_versions) > 5:
            recommendations.append("Consider consolidating versions - supporting too many versions increases maintenance overhead")
            
        return recommendations

# Example usage
async def main():
    lifecycle_manager = APIVersioningLifecycleManager()
    
    # Create API definition
    user_api = APIDefinition(
        id="user-api",
        name="User Management API",
        description="API for managing user accounts and profiles",
        base_path="/api/users",
        current_version="1.0.0",
        versions={
            "1.0.0": APIVersion(
                version="1.0.0",
                status=APIStatus.STABLE,
                release_date=datetime.now() - timedelta(days=365),
                changelog=["Initial release with basic user operations"]
            )
        },
        versioning_strategy=VersioningStrategy.URL_PATH,
        default_version="1.0.0",
        supported_versions=["1.0.0"],
        schema_definitions={
            "1.0.0": {
                "paths": {
                    "/users": {
                        "get": {
                            "responses": {
                                "200": {
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "id": {"type": "integer"},
                                                        "name": {"type": "string"},
                                                        "email": {"type": "string"}
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    )
    
    lifecycle_manager.register_api(user_api)
    
    # Create new version with breaking changes
    new_schema = {
        "paths": {
            "/users": {
                "get": {
                    "responses": {
                        "200": {
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "type": "object",
                                        "properties": {
                                            "users": {
                                                "type": "array",
                                                "items": {
                                                    "type": "object",
                                                    "properties": {
                                                        "id": {"type": "integer"},
                                                        "full_name": {"type": "string"},  # Changed from 'name'
                                                        "email": {"type": "string"},
                                                        "created_at": {"type": "string"}  # New field
                                                    },
                                                    "required": ["id", "full_name", "email"]
                                                }
                                            },
                                            "total_count": {"type": "integer"}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    # Create version 2.0.0
    success = await lifecycle_manager.create_new_version(
        "user-api",
        "2.0.0",
        new_schema,
        ["Changed response format to include pagination", "Renamed 'name' field to 'full_name'"]
    )
    print(f"Created version 2.0.0: {success}")
    
    # Promote to stable
    await lifecycle_manager.promote_version("user-api", "2.0.0", APIStatus.STABLE)
    
    # Create migration plan
    migration_id = await lifecycle_manager.create_migration_plan(
        "user-api", "1.0.0", "2.0.0", MigrationStrategy.GRADUAL
    )
    print(f"Created migration plan: {migration_id}")
    
    # Simulate some usage
    await lifecycle_manager.usage_tracker.track_request(
        "user-api", "1.0.0", "client-1", 150.0, 200, 
        {"location": "US", "client_version": "mobile-1.0"}
    )
    
    await lifecycle_manager.usage_tracker.track_request(
        "user-api", "2.0.0", "client-2", 120.0, 200,
        {"location": "EU", "client_version": "web-2.1"}
    )
    
    # Get lifecycle status
    status = await lifecycle_manager.get_api_lifecycle_status("user-api")
    print(f"Lifecycle status: {json.dumps(status, indent=2, default=str)}")

if __name__ == "__main__":
    asyncio.run(main())