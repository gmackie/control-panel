import asyncio
import json
import hashlib
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union, Type
from enum import Enum
import logging
import uuid
import aiohttp
from collections import defaultdict
import re

class FieldType(Enum):
    SCALAR = "scalar"
    OBJECT = "object"
    LIST = "list"
    NON_NULL = "non_null"
    UNION = "union"
    INTERFACE = "interface"
    ENUM = "enum"

class DirectiveLocation(Enum):
    QUERY = "QUERY"
    MUTATION = "MUTATION"
    SUBSCRIPTION = "SUBSCRIPTION"
    FIELD = "FIELD"
    FRAGMENT_DEFINITION = "FRAGMENT_DEFINITION"
    FRAGMENT_SPREAD = "FRAGMENT_SPREAD"
    INLINE_FRAGMENT = "INLINE_FRAGMENT"
    SCHEMA = "SCHEMA"
    SCALAR = "SCALAR"
    OBJECT = "OBJECT"
    FIELD_DEFINITION = "FIELD_DEFINITION"
    ARGUMENT_DEFINITION = "ARGUMENT_DEFINITION"
    INTERFACE = "INTERFACE"
    UNION = "UNION"
    ENUM = "ENUM"
    ENUM_VALUE = "ENUM_VALUE"
    INPUT_OBJECT = "INPUT_OBJECT"
    INPUT_FIELD_DEFINITION = "INPUT_FIELD_DEFINITION"

class CacheScope(Enum):
    PUBLIC = "public"
    PRIVATE = "private"

@dataclass
class GraphQLField:
    name: str
    type: str
    args: Dict[str, str] = field(default_factory=dict)
    description: Optional[str] = None
    deprecated: bool = False
    deprecation_reason: Optional[str] = None
    directives: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class GraphQLType:
    name: str
    kind: FieldType
    fields: Dict[str, GraphQLField] = field(default_factory=dict)
    description: Optional[str] = None
    interfaces: List[str] = field(default_factory=list)
    possible_types: List[str] = field(default_factory=list)  # For unions
    enum_values: List[str] = field(default_factory=list)  # For enums
    directives: List[Dict[str, Any]] = field(default_factory=list)

@dataclass
class GraphQLDirective:
    name: str
    description: Optional[str]
    locations: List[DirectiveLocation]
    args: Dict[str, str] = field(default_factory=dict)
    repeatable: bool = False

@dataclass
class ServiceSchema:
    service_id: str
    service_name: str
    endpoint_url: str
    schema_sdl: str  # Schema Definition Language
    types: Dict[str, GraphQLType] = field(default_factory=dict)
    queries: Dict[str, GraphQLField] = field(default_factory=dict)
    mutations: Dict[str, GraphQLField] = field(default_factory=dict)
    subscriptions: Dict[str, GraphQLField] = field(default_factory=dict)
    directives: Dict[str, GraphQLDirective] = field(default_factory=dict)
    version: str = "1.0.0"
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class FederationKey:
    type_name: str
    fields: List[str]
    resolvable: bool = True

@dataclass
class EntityRef:
    type_name: str
    key_fields: Dict[str, Any]
    
@dataclass
class QueryPlan:
    id: str
    operations: List[Dict[str, Any]]
    estimated_cost: int
    cache_key: Optional[str] = None
    cache_ttl: Optional[int] = None

@dataclass
class ExecutionResult:
    data: Optional[Dict[str, Any]] = None
    errors: List[Dict[str, Any]] = field(default_factory=list)
    extensions: Dict[str, Any] = field(default_factory=dict)

class SchemaParser:
    def __init__(self):
        self.type_definitions = {}
        self.directive_definitions = {}
        
    async def parse_schema_sdl(self, sdl: str) -> ServiceSchema:
        """Parse GraphQL Schema Definition Language"""
        lines = [line.strip() for line in sdl.split('\n') if line.strip()]
        
        schema = ServiceSchema(
            service_id="",
            service_name="",
            endpoint_url="",
            schema_sdl=sdl
        )
        
        current_type = None
        current_section = None
        
        for line in lines:
            if line.startswith('#') or not line:
                continue
                
            # Parse type definitions
            if line.startswith('type '):
                current_type = self._parse_type_definition(line)
                schema.types[current_type.name] = current_type
                current_section = 'type'
                
            elif line.startswith('interface '):
                current_type = self._parse_interface_definition(line)
                schema.types[current_type.name] = current_type
                current_section = 'interface'
                
            elif line.startswith('union '):
                current_type = self._parse_union_definition(line)
                schema.types[current_type.name] = current_type
                current_section = 'union'
                
            elif line.startswith('enum '):
                current_type = self._parse_enum_definition(line)
                schema.types[current_type.name] = current_type
                current_section = 'enum'
                
            elif line.startswith('input '):
                current_type = self._parse_input_definition(line)
                schema.types[current_type.name] = current_type
                current_section = 'input'
                
            elif line.startswith('directive '):
                directive = self._parse_directive_definition(line)
                schema.directives[directive.name] = directive
                
            elif current_type and current_section in ['type', 'interface', 'input']:
                # Parse field within type
                if ':' in line and not line.startswith('}'):
                    field = self._parse_field_definition(line)
                    if field:
                        current_type.fields[field.name] = field
                        
                        # Add to schema root types
                        if current_type.name == 'Query':
                            schema.queries[field.name] = field
                        elif current_type.name == 'Mutation':
                            schema.mutations[field.name] = field
                        elif current_type.name == 'Subscription':
                            schema.subscriptions[field.name] = field
                            
            elif current_type and current_section == 'enum':
                # Parse enum values
                if not line.startswith('}') and line.isalnum():
                    current_type.enum_values.append(line)
                    
        return schema
        
    def _parse_type_definition(self, line: str) -> GraphQLType:
        # Parse: type User implements Node {
        parts = line.split()
        type_name = parts[1]
        
        interfaces = []
        if 'implements' in line:
            implements_part = line.split('implements')[1].split('{')[0].strip()
            interfaces = [iface.strip() for iface in implements_part.split(',')]
            
        return GraphQLType(
            name=type_name,
            kind=FieldType.OBJECT,
            interfaces=interfaces
        )
        
    def _parse_interface_definition(self, line: str) -> GraphQLType:
        parts = line.split()
        interface_name = parts[1]
        
        return GraphQLType(
            name=interface_name,
            kind=FieldType.INTERFACE
        )
        
    def _parse_union_definition(self, line: str) -> GraphQLType:
        # Parse: union SearchResult = User | Post | Comment
        parts = line.split('=')
        union_name = parts[0].split()[1].strip()
        possible_types = [t.strip() for t in parts[1].split('|')] if len(parts) > 1 else []
        
        return GraphQLType(
            name=union_name,
            kind=FieldType.UNION,
            possible_types=possible_types
        )
        
    def _parse_enum_definition(self, line: str) -> GraphQLType:
        parts = line.split()
        enum_name = parts[1]
        
        return GraphQLType(
            name=enum_name,
            kind=FieldType.ENUM
        )
        
    def _parse_input_definition(self, line: str) -> GraphQLType:
        parts = line.split()
        input_name = parts[1]
        
        return GraphQLType(
            name=input_name,
            kind=FieldType.OBJECT  # Input objects are treated as objects
        )
        
    def _parse_field_definition(self, line: str) -> Optional[GraphQLField]:
        # Parse: name: String! @deprecated(reason: "Use fullName instead")
        if ':' not in line:
            return None
            
        field_part, type_part = line.split(':', 1)
        field_name = field_part.strip()
        
        # Extract arguments if present
        args = {}
        if '(' in field_name:
            field_name, args_part = field_name.split('(', 1)
            args_part = args_part.rstrip(')')
            # Simple argument parsing - would need more robust parsing for complex cases
            for arg in args_part.split(','):
                if ':' in arg:
                    arg_name, arg_type = arg.split(':', 1)
                    args[arg_name.strip()] = arg_type.strip()
        
        # Extract type and directives
        type_and_directives = type_part.strip()
        field_type = type_and_directives.split('@')[0].strip()
        
        # Parse directives
        directives = []
        if '@' in type_and_directives:
            directive_part = '@' + type_and_directives.split('@', 1)[1]
            directives = self._parse_directives(directive_part)
        
        # Check for deprecation
        deprecated = any(d.get('name') == 'deprecated' for d in directives)
        deprecation_reason = None
        if deprecated:
            deprecated_directive = next(d for d in directives if d.get('name') == 'deprecated')
            deprecation_reason = deprecated_directive.get('args', {}).get('reason')
        
        return GraphQLField(
            name=field_name,
            type=field_type,
            args=args,
            directives=directives,
            deprecated=deprecated,
            deprecation_reason=deprecation_reason
        )
        
    def _parse_directive_definition(self, line: str) -> GraphQLDirective:
        # Parse: directive @deprecated(reason: String = "No longer supported") on FIELD_DEFINITION | ENUM_VALUE
        parts = line.split('@')[1].split('on')
        directive_name_and_args = parts[0].strip()
        locations_part = parts[1].strip() if len(parts) > 1 else ""
        
        # Extract directive name and arguments
        if '(' in directive_name_and_args:
            directive_name = directive_name_and_args.split('(')[0]
            # Parse arguments - simplified
            args = {}
        else:
            directive_name = directive_name_and_args
            args = {}
        
        # Parse locations
        locations = []
        if locations_part:
            location_names = [loc.strip() for loc in locations_part.split('|')]
            for loc_name in location_names:
                try:
                    locations.append(DirectiveLocation(loc_name))
                except ValueError:
                    pass  # Skip unknown locations
        
        return GraphQLDirective(
            name=directive_name,
            description=None,
            locations=locations,
            args=args
        )
        
    def _parse_directives(self, directive_text: str) -> List[Dict[str, Any]]:
        """Parse directive annotations like @deprecated(reason: "Use newField")"""
        directives = []
        
        # Simple directive parsing - would need more sophisticated parsing for complex cases
        directive_matches = re.findall(r'@(\w+)(?:\(([^)]+)\))?', directive_text)
        
        for directive_name, args_text in directive_matches:
            directive = {'name': directive_name, 'args': {}}
            
            if args_text:
                # Parse arguments - simplified
                for arg_pair in args_text.split(','):
                    if ':' in arg_pair:
                        key, value = arg_pair.split(':', 1)
                        key = key.strip()
                        value = value.strip().strip('"\'')
                        directive['args'][key] = value
            
            directives.append(directive)
        
        return directives

class QueryPlanner:
    def __init__(self):
        self.schema_registry = {}
        self.entity_resolvers = {}
        
    async def create_query_plan(self, query: str, variables: Dict[str, Any] = None) -> QueryPlan:
        """Create an execution plan for a federated GraphQL query"""
        
        # Parse the query to extract requested fields and their dependencies
        query_analysis = await self._analyze_query(query, variables or {})
        
        # Determine which services need to be called
        service_operations = await self._plan_service_operations(query_analysis)
        
        # Optimize the execution plan
        optimized_operations = await self._optimize_operations(service_operations)
        
        # Calculate estimated cost
        estimated_cost = await self._calculate_query_cost(optimized_operations)
        
        # Generate cache key if applicable
        cache_key = await self._generate_cache_key(query, variables)
        
        return QueryPlan(
            id=str(uuid.uuid4()),
            operations=optimized_operations,
            estimated_cost=estimated_cost,
            cache_key=cache_key,
            cache_ttl=300  # 5 minutes default
        )
        
    async def _analyze_query(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze GraphQL query to understand field requirements"""
        
        # Extract operation type (query, mutation, subscription)
        operation_type = "query"
        if query.strip().startswith("mutation"):
            operation_type = "mutation"
        elif query.strip().startswith("subscription"):
            operation_type = "subscription"
        
        # Extract requested fields - simplified parsing
        # In production, would use a proper GraphQL parser
        requested_fields = self._extract_requested_fields(query)
        
        # Determine field ownership based on schema registry
        field_ownership = await self._determine_field_ownership(requested_fields)
        
        return {
            'operation_type': operation_type,
            'requested_fields': requested_fields,
            'field_ownership': field_ownership,
            'variables': variables,
            'requires_entity_resolution': await self._requires_entity_resolution(requested_fields)
        }
        
    def _extract_requested_fields(self, query: str) -> Dict[str, List[str]]:
        """Extract requested fields from GraphQL query"""
        # Simplified field extraction - would use proper GraphQL AST parsing
        fields = defaultdict(list)
        
        # Remove comments and normalize whitespace
        clean_query = re.sub(r'#.*', '', query)
        clean_query = re.sub(r'\s+', ' ', clean_query)
        
        # Extract field selections (very simplified)
        # This is a basic implementation - production would use graphql-core
        field_matches = re.findall(r'(\w+)\s*{([^}]+)}', clean_query)
        
        for field_name, field_content in field_matches:
            sub_fields = re.findall(r'(\w+)', field_content)
            fields[field_name] = sub_fields
            
        return dict(fields)
        
    async def _determine_field_ownership(self, requested_fields: Dict[str, List[str]]) -> Dict[str, str]:
        """Determine which service owns each requested field"""
        ownership = {}
        
        for root_field, sub_fields in requested_fields.items():
            # Find service that owns this root field
            owning_service = None
            
            for service_id, schema in self.schema_registry.items():
                if root_field in schema.queries or root_field in schema.mutations:
                    owning_service = service_id
                    break
            
            if owning_service:
                ownership[root_field] = owning_service
                
                # Check for cross-service field dependencies
                for sub_field in sub_fields:
                    ownership[f"{root_field}.{sub_field}"] = owning_service
        
        return ownership
        
    async def _requires_entity_resolution(self, requested_fields: Dict[str, List[str]]) -> bool:
        """Check if query requires entity resolution across services"""
        # Simplified check - would analyze for @key and @external directives
        return len(requested_fields) > 1
        
    async def _plan_service_operations(self, query_analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Plan operations for each service"""
        operations = []
        field_ownership = query_analysis['field_ownership']
        
        # Group fields by service
        service_fields = defaultdict(list)
        for field, service_id in field_ownership.items():
            if '.' not in field:  # Root fields only
                service_fields[service_id].append(field)
        
        # Create operation for each service
        for service_id, fields in service_fields.items():
            if service_id in self.schema_registry:
                schema = self.schema_registry[service_id]
                
                operation = {
                    'service_id': service_id,
                    'service_url': schema.endpoint_url,
                    'operation_type': query_analysis['operation_type'],
                    'fields': fields,
                    'dependencies': [],
                    'estimated_time': 100,  # milliseconds
                    'parallel_execution': True
                }
                
                operations.append(operation)
        
        return operations
        
    async def _optimize_operations(self, operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Optimize execution plan for better performance"""
        
        # Identify operations that can run in parallel
        independent_operations = []
        dependent_operations = []
        
        for operation in operations:
            if not operation.get('dependencies'):
                independent_operations.append(operation)
            else:
                dependent_operations.append(operation)
        
        # Mark parallel operations
        for op in independent_operations:
            op['execution_group'] = 'parallel_1'
        
        # Plan dependent operations in sequence
        execution_group = 2
        for op in dependent_operations:
            op['execution_group'] = f'sequential_{execution_group}'
            execution_group += 1
        
        return independent_operations + dependent_operations
        
    async def _calculate_query_cost(self, operations: List[Dict[str, Any]]) -> int:
        """Calculate estimated query execution cost"""
        total_cost = 0
        
        for operation in operations:
            # Base cost per operation
            operation_cost = 10
            
            # Add cost based on number of fields
            field_count = len(operation.get('fields', []))
            operation_cost += field_count * 5
            
            # Add cost based on estimated time
            estimated_time = operation.get('estimated_time', 100)
            operation_cost += estimated_time // 10
            
            total_cost += operation_cost
        
        return total_cost
        
    async def _generate_cache_key(self, query: str, variables: Dict[str, Any]) -> Optional[str]:
        """Generate cache key for query result caching"""
        # Create hash from query and variables
        cache_input = f"{query}:{json.dumps(variables, sort_keys=True)}"
        cache_key = hashlib.sha256(cache_input.encode()).hexdigest()[:16]
        return f"gql:{cache_key}"

class QueryExecutor:
    def __init__(self, schema_registry: Dict[str, ServiceSchema]):
        self.schema_registry = schema_registry
        self.session = None
        self.result_cache = {}
        self.execution_metrics = defaultdict(list)
        
    async def initialize(self):
        self.session = aiohttp.ClientSession()
        
    async def shutdown(self):
        if self.session:
            await self.session.close()
            
    async def execute_query_plan(self, plan: QueryPlan, context: Dict[str, Any] = None) -> ExecutionResult:
        """Execute a federated GraphQL query plan"""
        
        # Check cache first
        if plan.cache_key and plan.cache_key in self.result_cache:
            cached_result, cache_time = self.result_cache[plan.cache_key]
            if datetime.now() - cache_time < timedelta(seconds=plan.cache_ttl or 300):
                return cached_result
        
        try:
            start_time = datetime.now()
            
            # Execute operations according to plan
            execution_results = await self._execute_operations(plan.operations, context or {})
            
            # Merge results from all services
            merged_result = await self._merge_execution_results(execution_results)
            
            # Cache result if applicable
            if plan.cache_key and not merged_result.errors:
                self.result_cache[plan.cache_key] = (merged_result, datetime.now())
            
            # Record metrics
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            self.execution_metrics['execution_time'].append(execution_time)
            
            return merged_result
            
        except Exception as e:
            logging.error(f"Query execution error: {e}")
            return ExecutionResult(
                errors=[{'message': str(e), 'extensions': {'code': 'EXECUTION_ERROR'}}]
            )
            
    async def _execute_operations(self, operations: List[Dict[str, Any]], 
                                context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Execute operations against individual services"""
        results = []
        
        # Group operations by execution group
        execution_groups = defaultdict(list)
        for operation in operations:
            group = operation.get('execution_group', 'default')
            execution_groups[group].append(operation)
        
        # Execute groups in order
        for group_name in sorted(execution_groups.keys()):
            group_operations = execution_groups[group_name]
            
            if group_name.startswith('parallel'):
                # Execute in parallel
                tasks = [
                    self._execute_single_operation(op, context)
                    for op in group_operations
                ]
                group_results = await asyncio.gather(*tasks, return_exceptions=True)
            else:
                # Execute sequentially
                group_results = []
                for operation in group_operations:
                    result = await self._execute_single_operation(operation, context)
                    group_results.append(result)
            
            # Handle any exceptions
            for i, result in enumerate(group_results):
                if isinstance(result, Exception):
                    group_results[i] = {
                        'service_id': group_operations[i]['service_id'],
                        'errors': [{'message': str(result)}],
                        'data': None
                    }
            
            results.extend(group_results)
        
        return results
        
    async def _execute_single_operation(self, operation: Dict[str, Any], 
                                      context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute operation against a single service"""
        service_id = operation['service_id']
        service_url = operation['service_url']
        
        # Build GraphQL query for this service
        query = await self._build_service_query(operation)
        
        # Prepare request
        request_data = {
            'query': query,
            'variables': context.get('variables', {})
        }
        
        # Add authorization headers if available
        headers = {'Content-Type': 'application/json'}
        if 'authorization' in context:
            headers['Authorization'] = context['authorization']
        
        try:
            async with self.session.post(
                service_url,
                json=request_data,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                
                result_data = await response.json()
                
                return {
                    'service_id': service_id,
                    'data': result_data.get('data'),
                    'errors': result_data.get('errors', []),
                    'extensions': result_data.get('extensions', {})
                }
                
        except Exception as e:
            return {
                'service_id': service_id,
                'data': None,
                'errors': [{'message': f"Service request failed: {str(e)}"}],
                'extensions': {}
            }
            
    async def _build_service_query(self, operation: Dict[str, Any]) -> str:
        """Build GraphQL query string for a specific service operation"""
        operation_type = operation.get('operation_type', 'query')
        fields = operation.get('fields', [])
        
        # Simple query building - would be more sophisticated in production
        if operation_type == 'query':
            field_selections = ' '.join(fields)
            return f"query {{ {field_selections} }}"
        elif operation_type == 'mutation':
            field_selections = ' '.join(fields)
            return f"mutation {{ {field_selections} }}"
        else:
            return f"{operation_type} {{ {' '.join(fields)} }}"
            
    async def _merge_execution_results(self, results: List[Dict[str, Any]]) -> ExecutionResult:
        """Merge results from multiple services into a single result"""
        merged_data = {}
        all_errors = []
        extensions = {}
        
        for result in results:
            service_id = result['service_id']
            
            # Merge data
            if result['data']:
                merged_data.update(result['data'])
            
            # Collect errors
            if result['errors']:
                for error in result['errors']:
                    error['extensions'] = error.get('extensions', {})
                    error['extensions']['service'] = service_id
                    all_errors.append(error)
            
            # Merge extensions
            if result['extensions']:
                extensions[service_id] = result['extensions']
        
        return ExecutionResult(
            data=merged_data if merged_data else None,
            errors=all_errors,
            extensions=extensions
        )

class FederationGateway:
    def __init__(self):
        self.schema_registry = {}
        self.schema_parser = SchemaParser()
        self.query_planner = QueryPlanner()
        self.query_executor = None
        self.introspection_enabled = True
        self.query_depth_limit = 15
        self.query_complexity_limit = 1000
        
    async def initialize(self):
        self.query_executor = QueryExecutor(self.schema_registry)
        await self.query_executor.initialize()
        self.query_planner.schema_registry = self.schema_registry
        
    async def shutdown(self):
        if self.query_executor:
            await self.query_executor.shutdown()
            
    async def register_service_schema(self, service_id: str, service_name: str,
                                    endpoint_url: str, schema_sdl: str) -> bool:
        """Register a GraphQL service with the federation gateway"""
        try:
            schema = await self.schema_parser.parse_schema_sdl(schema_sdl)
            schema.service_id = service_id
            schema.service_name = service_name
            schema.endpoint_url = endpoint_url
            
            self.schema_registry[service_id] = schema
            
            logging.info(f"Registered service {service_name} ({service_id}) with {len(schema.types)} types")
            return True
            
        except Exception as e:
            logging.error(f"Failed to register service {service_id}: {e}")
            return False
            
    async def execute_query(self, query: str, variables: Dict[str, Any] = None,
                          context: Dict[str, Any] = None) -> ExecutionResult:
        """Execute a federated GraphQL query"""
        
        # Validate query
        validation_result = await self._validate_query(query)
        if validation_result.get('errors'):
            return ExecutionResult(errors=validation_result['errors'])
        
        # Create query plan
        try:
            plan = await self.query_planner.create_query_plan(query, variables)
        except Exception as e:
            return ExecutionResult(
                errors=[{'message': f"Query planning failed: {str(e)}"}]
            )
        
        # Execute query plan
        return await self.query_executor.execute_query_plan(plan, context)
        
    async def _validate_query(self, query: str) -> Dict[str, Any]:
        """Validate GraphQL query against federation constraints"""
        errors = []
        
        # Check query depth
        depth = self._calculate_query_depth(query)
        if depth > self.query_depth_limit:
            errors.append({
                'message': f"Query depth {depth} exceeds limit of {self.query_depth_limit}",
                'extensions': {'code': 'QUERY_DEPTH_LIMIT_EXCEEDED'}
            })
        
        # Check query complexity (simplified)
        complexity = self._calculate_query_complexity(query)
        if complexity > self.query_complexity_limit:
            errors.append({
                'message': f"Query complexity {complexity} exceeds limit of {self.query_complexity_limit}",
                'extensions': {'code': 'QUERY_COMPLEXITY_LIMIT_EXCEEDED'}
            })
        
        return {'errors': errors}
        
    def _calculate_query_depth(self, query: str) -> int:
        """Calculate the depth of a GraphQL query"""
        # Simplified depth calculation
        max_depth = 0
        current_depth = 0
        
        for char in query:
            if char == '{':
                current_depth += 1
                max_depth = max(max_depth, current_depth)
            elif char == '}':
                current_depth -= 1
        
        return max_depth
        
    def _calculate_query_complexity(self, query: str) -> int:
        """Calculate the complexity score of a GraphQL query"""
        # Simplified complexity calculation
        field_count = len(re.findall(r'\b\w+\s*:', query))
        nested_selections = query.count('{')
        
        return field_count * 10 + nested_selections * 5
        
    async def get_federated_schema(self) -> str:
        """Generate unified federated schema SDL"""
        unified_types = {}
        unified_queries = {}
        unified_mutations = {}
        unified_subscriptions = {}
        
        # Merge all service schemas
        for service_id, schema in self.schema_registry.items():
            # Merge types
            for type_name, type_def in schema.types.items():
                if type_name not in unified_types:
                    unified_types[type_name] = type_def
                else:
                    # Handle type conflicts - extend existing type
                    existing_type = unified_types[type_name]
                    for field_name, field_def in type_def.fields.items():
                        if field_name not in existing_type.fields:
                            existing_type.fields[field_name] = field_def
            
            # Merge root fields
            unified_queries.update(schema.queries)
            unified_mutations.update(schema.mutations)
            unified_subscriptions.update(schema.subscriptions)
        
        # Generate SDL
        sdl_parts = []
        
        # Add schema definition
        sdl_parts.append("schema {")
        if unified_queries:
            sdl_parts.append("  query: Query")
        if unified_mutations:
            sdl_parts.append("  mutation: Mutation")
        if unified_subscriptions:
            sdl_parts.append("  subscription: Subscription")
        sdl_parts.append("}")
        sdl_parts.append("")
        
        # Add Query type
        if unified_queries:
            sdl_parts.append("type Query {")
            for field_name, field_def in unified_queries.items():
                args_str = ""
                if field_def.args:
                    args_list = [f"{k}: {v}" for k, v in field_def.args.items()]
                    args_str = f"({', '.join(args_list)})"
                
                deprecation = ""
                if field_def.deprecated:
                    reason = field_def.deprecation_reason or "No longer supported"
                    deprecation = f' @deprecated(reason: "{reason}")'
                
                sdl_parts.append(f"  {field_name}{args_str}: {field_def.type}{deprecation}")
            sdl_parts.append("}")
            sdl_parts.append("")
        
        # Add Mutation type
        if unified_mutations:
            sdl_parts.append("type Mutation {")
            for field_name, field_def in unified_mutations.items():
                args_str = ""
                if field_def.args:
                    args_list = [f"{k}: {v}" for k, v in field_def.args.items()]
                    args_str = f"({', '.join(args_list)})"
                sdl_parts.append(f"  {field_name}{args_str}: {field_def.type}")
            sdl_parts.append("}")
            sdl_parts.append("")
        
        # Add other types
        for type_name, type_def in unified_types.items():
            if type_name not in ['Query', 'Mutation', 'Subscription']:
                if type_def.kind == FieldType.OBJECT:
                    interfaces_str = ""
                    if type_def.interfaces:
                        interfaces_str = f" implements {' & '.join(type_def.interfaces)}"
                    
                    sdl_parts.append(f"type {type_name}{interfaces_str} {{")
                    for field_name, field_def in type_def.fields.items():
                        sdl_parts.append(f"  {field_name}: {field_def.type}")
                    sdl_parts.append("}")
                    sdl_parts.append("")
                elif type_def.kind == FieldType.ENUM:
                    sdl_parts.append(f"enum {type_name} {{")
                    for enum_value in type_def.enum_values:
                        sdl_parts.append(f"  {enum_value}")
                    sdl_parts.append("}")
                    sdl_parts.append("")
        
        return "\n".join(sdl_parts)
        
    async def get_gateway_metrics(self) -> Dict[str, Any]:
        """Get federation gateway metrics"""
        service_count = len(self.schema_registry)
        total_types = sum(len(schema.types) for schema in self.schema_registry.values())
        total_queries = sum(len(schema.queries) for schema in self.schema_registry.values())
        total_mutations = sum(len(schema.mutations) for schema in self.schema_registry.values())
        
        # Calculate average execution time
        execution_times = self.query_executor.execution_metrics.get('execution_time', [])
        avg_execution_time = sum(execution_times) / len(execution_times) if execution_times else 0
        
        return {
            'registered_services': service_count,
            'total_types': total_types,
            'total_queries': total_queries,
            'total_mutations': total_mutations,
            'cache_size': len(self.query_executor.result_cache),
            'avg_execution_time_ms': avg_execution_time,
            'query_depth_limit': self.query_depth_limit,
            'query_complexity_limit': self.query_complexity_limit
        }

# Example usage
async def main():
    gateway = FederationGateway()
    await gateway.initialize()
    
    # Register User service schema
    user_service_schema = """
    type Query {
        user(id: ID!): User
        users(limit: Int = 10): [User!]!
    }
    
    type Mutation {
        createUser(input: CreateUserInput!): User!
        updateUser(id: ID!, input: UpdateUserInput!): User
    }
    
    type User {
        id: ID!
        email: String!
        name: String!
        posts: [Post!]! @external
    }
    
    input CreateUserInput {
        email: String!
        name: String!
    }
    
    input UpdateUserInput {
        email: String
        name: String
    }
    """
    
    await gateway.register_service_schema(
        "user-service",
        "User Service",
        "https://api.example.com/graphql/users",
        user_service_schema
    )
    
    # Register Post service schema
    post_service_schema = """
    type Query {
        post(id: ID!): Post
        posts(authorId: ID, limit: Int = 10): [Post!]!
    }
    
    type Mutation {
        createPost(input: CreatePostInput!): Post!
        updatePost(id: ID!, input: UpdatePostInput!): Post
    }
    
    type Post {
        id: ID!
        title: String!
        content: String!
        author: User! @external
        authorId: ID!
        createdAt: String!
    }
    
    type User @key(fields: "id") {
        id: ID!
        posts: [Post!]!
    }
    
    input CreatePostInput {
        title: String!
        content: String!
        authorId: ID!
    }
    
    input UpdatePostInput {
        title: String
        content: String
    }
    """
    
    await gateway.register_service_schema(
        "post-service",
        "Post Service", 
        "https://api.example.com/graphql/posts",
        post_service_schema
    )
    
    # Test federated query
    test_query = """
    query GetUserWithPosts($userId: ID!) {
        user(id: $userId) {
            id
            name
            email
            posts {
                id
                title
                content
                createdAt
            }
        }
    }
    """
    
    variables = {"userId": "123"}
    
    # Execute federated query
    result = await gateway.execute_query(test_query, variables)
    
    print(f"Query result: {json.dumps(result.data, indent=2)}")
    if result.errors:
        print(f"Errors: {json.dumps(result.errors, indent=2)}")
    
    # Get federated schema
    unified_schema = await gateway.get_federated_schema()
    print(f"Unified Schema:\n{unified_schema}")
    
    # Get gateway metrics
    metrics = await gateway.get_gateway_metrics()
    print(f"Gateway Metrics: {json.dumps(metrics, indent=2)}")
    
    await gateway.shutdown()

if __name__ == "__main__":
    asyncio.run(main())