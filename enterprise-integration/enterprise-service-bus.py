import asyncio
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union
from enum import Enum
import logging
import uuid
import aiohttp
import yaml
from urllib.parse import urlparse
import re

class MessageFormat(Enum):
    JSON = "json"
    XML = "xml"
    CSV = "csv"
    PLAIN_TEXT = "plain_text"
    BINARY = "binary"
    AVRO = "avro"
    PROTOBUF = "protobuf"

class TransportProtocol(Enum):
    HTTP = "http"
    HTTPS = "https"
    TCP = "tcp"
    UDP = "udp"
    AMQP = "amqp"
    KAFKA = "kafka"
    MQTT = "mqtt"
    WEBSOCKET = "websocket"
    FTP = "ftp"
    SFTP = "sftp"

class MessagePattern(Enum):
    REQUEST_REPLY = "request_reply"
    FIRE_AND_FORGET = "fire_and_forget"
    PUBLISH_SUBSCRIBE = "publish_subscribe"
    POINT_TO_POINT = "point_to_point"
    SCATTER_GATHER = "scatter_gather"
    CONTENT_BASED_ROUTER = "content_based_router"

class IntegrationPattern(Enum):
    MESSAGE_TRANSLATOR = "message_translator"
    CONTENT_ENRICHER = "content_enricher"
    MESSAGE_FILTER = "message_filter"
    SPLITTER = "splitter"
    AGGREGATOR = "aggregator"
    RESEQUENCER = "resequencer"
    DEAD_LETTER_QUEUE = "dead_letter_queue"

@dataclass
class Message:
    id: str
    correlation_id: str
    timestamp: datetime
    headers: Dict[str, str]
    payload: Any
    format: MessageFormat
    source_endpoint: str
    destination_endpoint: Optional[str] = None
    reply_to: Optional[str] = None
    ttl: Optional[int] = None  # Time to live in seconds
    priority: int = 5  # 1-10, 10 being highest
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Endpoint:
    id: str
    name: str
    url: str
    protocol: TransportProtocol
    format: MessageFormat
    authentication: Dict[str, Any] = field(default_factory=dict)
    headers: Dict[str, str] = field(default_factory=dict)
    timeout: int = 30
    retry_attempts: int = 3
    retry_delay: int = 1000  # milliseconds
    circuit_breaker_config: Dict[str, Any] = field(default_factory=dict)
    rate_limit: Optional[int] = None  # messages per second
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Route:
    id: str
    name: str
    source_endpoint: str
    destination_endpoints: List[str]
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    transformations: List[Dict[str, Any]] = field(default_factory=list)
    patterns: List[IntegrationPattern] = field(default_factory=list)
    error_handling: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TransformationRule:
    id: str
    name: str
    source_format: MessageFormat
    target_format: MessageFormat
    mapping_rules: List[Dict[str, Any]]
    custom_script: Optional[str] = None
    validation_schema: Optional[Dict[str, Any]] = None

@dataclass
class CircuitBreakerState:
    endpoint_id: str
    state: str  # "closed", "open", "half_open"
    failure_count: int = 0
    last_failure_time: Optional[datetime] = None
    next_attempt_time: Optional[datetime] = None
    success_count: int = 0

class MessageTransformer:
    def __init__(self):
        self.transformation_rules = {}
        self.custom_transformers = {}
        
    def register_transformation_rule(self, rule: TransformationRule):
        self.transformation_rules[rule.id] = rule
        
    def register_custom_transformer(self, name: str, transformer_func: Callable):
        self.custom_transformers[name] = transformer_func
        
    async def transform_message(self, message: Message, 
                              transformation_config: Dict[str, Any]) -> Message:
        transform_type = transformation_config.get('type')
        
        if transform_type == 'format_conversion':
            return await self._convert_format(message, transformation_config)
        elif transform_type == 'field_mapping':
            return await self._map_fields(message, transformation_config)
        elif transform_type == 'content_enrichment':
            return await self._enrich_content(message, transformation_config)
        elif transform_type == 'custom':
            return await self._apply_custom_transformation(message, transformation_config)
        else:
            return message
            
    async def _convert_format(self, message: Message, config: Dict[str, Any]) -> Message:
        target_format = MessageFormat(config.get('target_format', 'json'))
        
        if message.format == target_format:
            return message
            
        # Convert payload based on formats
        if message.format == MessageFormat.JSON and target_format == MessageFormat.XML:
            xml_payload = self._json_to_xml(message.payload)
            message.payload = xml_payload
        elif message.format == MessageFormat.XML and target_format == MessageFormat.JSON:
            json_payload = self._xml_to_json(message.payload)
            message.payload = json_payload
        elif target_format == MessageFormat.JSON:
            # Convert any format to JSON
            if isinstance(message.payload, str):
                try:
                    message.payload = json.loads(message.payload)
                except:
                    message.payload = {"data": message.payload}
                    
        message.format = target_format
        return message
        
    async def _map_fields(self, message: Message, config: Dict[str, Any]) -> Message:
        mapping_rules = config.get('mapping_rules', [])
        
        if message.format == MessageFormat.JSON and isinstance(message.payload, dict):
            new_payload = {}
            
            for rule in mapping_rules:
                source_field = rule.get('source')
                target_field = rule.get('target')
                default_value = rule.get('default')
                
                if source_field in message.payload:
                    new_payload[target_field] = message.payload[source_field]
                elif default_value is not None:
                    new_payload[target_field] = default_value
                    
            message.payload = new_payload
            
        return message
        
    async def _enrich_content(self, message: Message, config: Dict[str, Any]) -> Message:
        enrichment_rules = config.get('enrichment_rules', [])
        
        for rule in enrichment_rules:
            enrichment_type = rule.get('type')
            
            if enrichment_type == 'add_timestamp':
                message.payload['enriched_timestamp'] = datetime.now().isoformat()
            elif enrichment_type == 'add_correlation_id':
                message.payload['correlation_id'] = message.correlation_id
            elif enrichment_type == 'lookup_data':
                # Simulate data lookup
                lookup_key = rule.get('lookup_key')
                if lookup_key in message.payload:
                    message.payload[f"{lookup_key}_enriched"] = f"enriched_{message.payload[lookup_key]}"
                    
        return message
        
    async def _apply_custom_transformation(self, message: Message, config: Dict[str, Any]) -> Message:
        transformer_name = config.get('transformer_name')
        
        if transformer_name in self.custom_transformers:
            transformer_func = self.custom_transformers[transformer_name]
            return await transformer_func(message, config)
            
        return message
        
    def _json_to_xml(self, json_data: Any) -> str:
        if isinstance(json_data, dict):
            root = ET.Element("root")
            self._dict_to_xml(json_data, root)
            return ET.tostring(root, encoding='unicode')
        else:
            return f"<data>{json_data}</data>"
            
    def _dict_to_xml(self, data: Dict, parent: ET.Element):
        for key, value in data.items():
            child = ET.SubElement(parent, key)
            if isinstance(value, dict):
                self._dict_to_xml(value, child)
            elif isinstance(value, list):
                for item in value:
                    item_elem = ET.SubElement(child, "item")
                    if isinstance(item, dict):
                        self._dict_to_xml(item, item_elem)
                    else:
                        item_elem.text = str(item)
            else:
                child.text = str(value)
                
    def _xml_to_json(self, xml_data: str) -> Dict:
        try:
            root = ET.fromstring(xml_data)
            return self._xml_element_to_dict(root)
        except:
            return {"xml_data": xml_data}
            
    def _xml_element_to_dict(self, element: ET.Element) -> Dict:
        result = {}
        
        # Handle attributes
        if element.attrib:
            result['@attributes'] = element.attrib
            
        # Handle text content
        if element.text and element.text.strip():
            if len(element) == 0:
                return element.text.strip()
            else:
                result['text'] = element.text.strip()
                
        # Handle child elements
        for child in element:
            child_data = self._xml_element_to_dict(child)
            
            if child.tag in result:
                if not isinstance(result[child.tag], list):
                    result[child.tag] = [result[child.tag]]
                result[child.tag].append(child_data)
            else:
                result[child.tag] = child_data
                
        return result

class MessageFilter:
    def __init__(self):
        self.filter_rules = {}
        
    def register_filter_rule(self, rule_id: str, condition: Dict[str, Any]):
        self.filter_rules[rule_id] = condition
        
    async def should_process_message(self, message: Message, 
                                   filter_conditions: List[Dict[str, Any]]) -> bool:
        for condition in filter_conditions:
            if not await self._evaluate_condition(message, condition):
                return False
        return True
        
    async def _evaluate_condition(self, message: Message, condition: Dict[str, Any]) -> bool:
        condition_type = condition.get('type')
        
        if condition_type == 'header_match':
            header_name = condition.get('header_name')
            expected_value = condition.get('expected_value')
            return message.headers.get(header_name) == expected_value
            
        elif condition_type == 'payload_contains':
            search_value = condition.get('search_value')
            if isinstance(message.payload, str):
                return search_value in message.payload
            elif isinstance(message.payload, dict):
                return self._dict_contains_value(message.payload, search_value)
                
        elif condition_type == 'xpath':
            xpath_expression = condition.get('xpath')
            expected_value = condition.get('expected_value')
            # Implement XPath evaluation for XML payloads
            return True  # Placeholder
            
        elif condition_type == 'jsonpath':
            jsonpath_expression = condition.get('jsonpath')
            expected_value = condition.get('expected_value')
            # Implement JSONPath evaluation
            return True  # Placeholder
            
        return True
        
    def _dict_contains_value(self, data: Dict, search_value: Any) -> bool:
        for value in data.values():
            if value == search_value:
                return True
            elif isinstance(value, dict):
                if self._dict_contains_value(value, search_value):
                    return True
            elif isinstance(value, list):
                if search_value in value:
                    return True
        return False

class CircuitBreaker:
    def __init__(self):
        self.states = {}
        self.failure_threshold = 5
        self.timeout_duration = 30  # seconds
        self.half_open_max_calls = 3
        
    async def call_endpoint(self, endpoint_id: str, call_func: Callable) -> Any:
        state = self._get_or_create_state(endpoint_id)
        
        if state.state == "open":
            if datetime.now() >= state.next_attempt_time:
                state.state = "half_open"
                state.success_count = 0
            else:
                raise Exception(f"Circuit breaker is open for endpoint {endpoint_id}")
                
        try:
            result = await call_func()
            
            if state.state == "half_open":
                state.success_count += 1
                if state.success_count >= self.half_open_max_calls:
                    state.state = "closed"
                    state.failure_count = 0
            elif state.state == "closed":
                state.failure_count = 0
                
            return result
            
        except Exception as e:
            state.failure_count += 1
            state.last_failure_time = datetime.now()
            
            if state.failure_count >= self.failure_threshold:
                state.state = "open"
                state.next_attempt_time = datetime.now() + timedelta(seconds=self.timeout_duration)
                
            raise e
            
    def _get_or_create_state(self, endpoint_id: str) -> CircuitBreakerState:
        if endpoint_id not in self.states:
            self.states[endpoint_id] = CircuitBreakerState(
                endpoint_id=endpoint_id,
                state="closed"
            )
        return self.states[endpoint_id]

class MessageRouter:
    def __init__(self):
        self.routes = {}
        self.content_based_rules = {}
        
    def register_route(self, route: Route):
        self.routes[route.id] = route
        
    async def route_message(self, message: Message) -> List[str]:
        """Returns list of destination endpoint IDs"""
        matching_routes = []
        
        for route in self.routes.values():
            if not route.is_active:
                continue
                
            if route.source_endpoint == message.source_endpoint:
                if await self._evaluate_route_conditions(message, route):
                    matching_routes.extend(route.destination_endpoints)
                    
        # Remove duplicates while preserving order
        seen = set()
        result = []
        for endpoint in matching_routes:
            if endpoint not in seen:
                seen.add(endpoint)
                result.append(endpoint)
                
        return result
        
    async def _evaluate_route_conditions(self, message: Message, route: Route) -> bool:
        for condition in route.conditions:
            if not await self._evaluate_condition(message, condition):
                return False
        return True
        
    async def _evaluate_condition(self, message: Message, condition: Dict[str, Any]) -> bool:
        condition_type = condition.get('type')
        
        if condition_type == 'message_type':
            expected_type = condition.get('message_type')
            return message.headers.get('message_type') == expected_type
            
        elif condition_type == 'content_based':
            field_path = condition.get('field_path')
            operator = condition.get('operator')  # eq, ne, gt, lt, contains
            value = condition.get('value')
            
            field_value = self._get_field_value(message.payload, field_path)
            
            if operator == 'eq':
                return field_value == value
            elif operator == 'ne':
                return field_value != value
            elif operator == 'gt':
                return field_value > value
            elif operator == 'lt':
                return field_value < value
            elif operator == 'contains':
                return value in str(field_value)
                
        return True
        
    def _get_field_value(self, payload: Any, field_path: str) -> Any:
        """Extract field value using dot notation (e.g., 'user.name')"""
        if not isinstance(payload, dict):
            return None
            
        parts = field_path.split('.')
        current = payload
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
                
        return current

class EndpointConnector:
    def __init__(self):
        self.session = None
        
    async def initialize(self):
        self.session = aiohttp.ClientSession()
        
    async def close(self):
        if self.session:
            await self.session.close()
            
    async def send_message(self, message: Message, endpoint: Endpoint) -> bool:
        try:
            if endpoint.protocol in [TransportProtocol.HTTP, TransportProtocol.HTTPS]:
                return await self._send_http_message(message, endpoint)
            elif endpoint.protocol == TransportProtocol.AMQP:
                return await self._send_amqp_message(message, endpoint)
            elif endpoint.protocol == TransportProtocol.KAFKA:
                return await self._send_kafka_message(message, endpoint)
            else:
                logging.warning(f"Unsupported protocol: {endpoint.protocol}")
                return False
                
        except Exception as e:
            logging.error(f"Failed to send message to {endpoint.id}: {e}")
            return False
            
    async def _send_http_message(self, message: Message, endpoint: Endpoint) -> bool:
        headers = {**endpoint.headers, **message.headers}
        
        # Set content type based on message format
        if message.format == MessageFormat.JSON:
            headers['Content-Type'] = 'application/json'
            payload = json.dumps(message.payload) if isinstance(message.payload, dict) else message.payload
        elif message.format == MessageFormat.XML:
            headers['Content-Type'] = 'application/xml'
            payload = message.payload
        else:
            headers['Content-Type'] = 'text/plain'
            payload = str(message.payload)
            
        # Add authentication headers
        auth_config = endpoint.authentication
        if auth_config.get('type') == 'bearer':
            headers['Authorization'] = f"Bearer {auth_config.get('token')}"
        elif auth_config.get('type') == 'api_key':
            headers[auth_config.get('header_name', 'X-API-Key')] = auth_config.get('api_key')
            
        timeout = aiohttp.ClientTimeout(total=endpoint.timeout)
        
        async with self.session.post(
            endpoint.url,
            headers=headers,
            data=payload,
            timeout=timeout
        ) as response:
            return response.status < 400
            
    async def _send_amqp_message(self, message: Message, endpoint: Endpoint) -> bool:
        # Placeholder for AMQP implementation
        logging.info(f"Sending AMQP message to {endpoint.url}")
        await asyncio.sleep(0.1)  # Simulate network delay
        return True
        
    async def _send_kafka_message(self, message: Message, endpoint: Endpoint) -> bool:
        # Placeholder for Kafka implementation
        logging.info(f"Sending Kafka message to {endpoint.url}")
        await asyncio.sleep(0.1)  # Simulate network delay
        return True

class MessageAggregator:
    def __init__(self):
        self.aggregation_groups = {}
        self.aggregation_strategies = {
            'collect_all': self._collect_all_strategy,
            'first_wins': self._first_wins_strategy,
            'merge_payloads': self._merge_payloads_strategy
        }
        
    async def add_message_to_aggregation(self, message: Message, 
                                       aggregation_config: Dict[str, Any]) -> Optional[Message]:
        group_id = self._get_aggregation_group_id(message, aggregation_config)
        strategy = aggregation_config.get('strategy', 'collect_all')
        completion_size = aggregation_config.get('completion_size', 2)
        timeout_seconds = aggregation_config.get('timeout_seconds', 30)
        
        if group_id not in self.aggregation_groups:
            self.aggregation_groups[group_id] = {
                'messages': [],
                'created_at': datetime.now(),
                'config': aggregation_config
            }
            
        group = self.aggregation_groups[group_id]
        group['messages'].append(message)
        
        # Check if aggregation is complete
        if (len(group['messages']) >= completion_size or
            datetime.now() - group['created_at'] > timedelta(seconds=timeout_seconds)):
            
            # Apply aggregation strategy
            aggregated_message = await self.aggregation_strategies[strategy](
                group['messages'], aggregation_config
            )
            
            # Remove completed group
            del self.aggregation_groups[group_id]
            
            return aggregated_message
            
        return None
        
    def _get_aggregation_group_id(self, message: Message, config: Dict[str, Any]) -> str:
        correlation_field = config.get('correlation_field', 'correlation_id')
        
        if correlation_field == 'correlation_id':
            return message.correlation_id
        else:
            field_value = self._extract_field_value(message.payload, correlation_field)
            return str(field_value) if field_value else message.correlation_id
            
    def _extract_field_value(self, payload: Any, field_path: str) -> Any:
        if not isinstance(payload, dict):
            return None
            
        parts = field_path.split('.')
        current = payload
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
                
        return current
        
    async def _collect_all_strategy(self, messages: List[Message], 
                                  config: Dict[str, Any]) -> Message:
        # Combine all messages into a single aggregated message
        aggregated_payload = {
            'message_count': len(messages),
            'messages': [msg.payload for msg in messages],
            'correlation_id': messages[0].correlation_id
        }
        
        return Message(
            id=str(uuid.uuid4()),
            correlation_id=messages[0].correlation_id,
            timestamp=datetime.now(),
            headers={'message_type': 'aggregated', 'original_count': str(len(messages))},
            payload=aggregated_payload,
            format=MessageFormat.JSON,
            source_endpoint='aggregator'
        )
        
    async def _first_wins_strategy(self, messages: List[Message], 
                                 config: Dict[str, Any]) -> Message:
        # Return the first message, but update headers to indicate aggregation
        first_message = messages[0]
        first_message.headers['aggregated'] = 'true'
        first_message.headers['discarded_count'] = str(len(messages) - 1)
        return first_message
        
    async def _merge_payloads_strategy(self, messages: List[Message], 
                                     config: Dict[str, Any]) -> Message:
        # Merge all JSON payloads into a single payload
        merged_payload = {}
        
        for i, message in enumerate(messages):
            if isinstance(message.payload, dict):
                for key, value in message.payload.items():
                    if key in merged_payload:
                        # Handle conflicts by prefixing with message index
                        merged_payload[f"{key}_{i}"] = value
                    else:
                        merged_payload[key] = value
                        
        return Message(
            id=str(uuid.uuid4()),
            correlation_id=messages[0].correlation_id,
            timestamp=datetime.now(),
            headers={'message_type': 'merged', 'source_count': str(len(messages))},
            payload=merged_payload,
            format=MessageFormat.JSON,
            source_endpoint='aggregator'
        )

class EnterpriseServiceBus:
    def __init__(self):
        self.endpoints = {}
        self.routes = {}
        self.transformer = MessageTransformer()
        self.message_filter = MessageFilter()
        self.circuit_breaker = CircuitBreaker()
        self.message_router = MessageRouter()
        self.connector = EndpointConnector()
        self.aggregator = MessageAggregator()
        
        # Message queues
        self.message_queues = {}
        self.dead_letter_queue = []
        
        # Metrics
        self.message_count = 0
        self.error_count = 0
        self.processing_times = []
        
    async def initialize(self):
        await self.connector.initialize()
        
    async def shutdown(self):
        await self.connector.close()
        
    def register_endpoint(self, endpoint: Endpoint):
        self.endpoints[endpoint.id] = endpoint
        
    def register_route(self, route: Route):
        self.routes[route.id] = route
        self.message_router.register_route(route)
        
    async def send_message(self, message: Message) -> bool:
        start_time = datetime.now()
        self.message_count += 1
        
        try:
            # Apply message filtering
            if not await self.message_filter.should_process_message(message, []):
                logging.info(f"Message {message.id} filtered out")
                return False
                
            # Route message to determine destinations
            destination_endpoints = await self.message_router.route_message(message)
            
            if not destination_endpoints:
                logging.warning(f"No destinations found for message {message.id}")
                return False
                
            success_count = 0
            
            for endpoint_id in destination_endpoints:
                if endpoint_id not in self.endpoints:
                    logging.error(f"Endpoint {endpoint_id} not found")
                    continue
                    
                endpoint = self.endpoints[endpoint_id]
                
                if not endpoint.is_active:
                    logging.info(f"Endpoint {endpoint_id} is inactive")
                    continue
                    
                # Apply transformations for this endpoint
                transformed_message = message
                
                # Find route-specific transformations
                for route in self.routes.values():
                    if (route.source_endpoint == message.source_endpoint and
                        endpoint_id in route.destination_endpoints):
                        
                        for transformation in route.transformations:
                            transformed_message = await self.transformer.transform_message(
                                transformed_message, transformation
                            )
                            
                # Send message using circuit breaker
                async def send_to_endpoint():
                    return await self.connector.send_message(transformed_message, endpoint)
                    
                try:
                    success = await self.circuit_breaker.call_endpoint(
                        endpoint_id, send_to_endpoint
                    )
                    
                    if success:
                        success_count += 1
                    else:
                        self.error_count += 1
                        
                except Exception as e:
                    logging.error(f"Failed to send to endpoint {endpoint_id}: {e}")
                    self.error_count += 1
                    
                    # Add to dead letter queue
                    self.dead_letter_queue.append({
                        'message': transformed_message,
                        'endpoint_id': endpoint_id,
                        'error': str(e),
                        'timestamp': datetime.now()
                    })
                    
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            self.processing_times.append(processing_time)
            
            # Keep only last 1000 processing times
            if len(self.processing_times) > 1000:
                self.processing_times = self.processing_times[-1000:]
                
            return success_count > 0
            
        except Exception as e:
            logging.error(f"ESB processing error: {e}")
            self.error_count += 1
            return False
            
    async def process_aggregation(self, message: Message, 
                                aggregation_config: Dict[str, Any]) -> Optional[Message]:
        return await self.aggregator.add_message_to_aggregation(message, aggregation_config)
        
    async def split_message(self, message: Message, 
                          splitter_config: Dict[str, Any]) -> List[Message]:
        """Split a message into multiple messages"""
        split_strategy = splitter_config.get('strategy', 'array_elements')
        
        if split_strategy == 'array_elements' and isinstance(message.payload, dict):
            array_field = splitter_config.get('array_field')
            
            if array_field in message.payload and isinstance(message.payload[array_field], list):
                split_messages = []
                
                for i, element in enumerate(message.payload[array_field]):
                    split_message = Message(
                        id=str(uuid.uuid4()),
                        correlation_id=message.correlation_id,
                        timestamp=datetime.now(),
                        headers={**message.headers, 'split_index': str(i)},
                        payload=element,
                        format=message.format,
                        source_endpoint=message.source_endpoint
                    )
                    split_messages.append(split_message)
                    
                return split_messages
                
        return [message]  # Return original message if splitting not applicable
        
    async def get_metrics(self) -> Dict[str, Any]:
        avg_processing_time = (
            sum(self.processing_times) / len(self.processing_times)
            if self.processing_times else 0
        )
        
        active_endpoints = sum(1 for ep in self.endpoints.values() if ep.is_active)
        active_routes = sum(1 for route in self.routes.values() if route.is_active)
        
        circuit_breaker_states = {
            endpoint_id: state.state
            for endpoint_id, state in self.circuit_breaker.states.items()
        }
        
        return {
            'total_messages_processed': self.message_count,
            'total_errors': self.error_count,
            'error_rate': (self.error_count / self.message_count * 100) if self.message_count > 0 else 0,
            'avg_processing_time_ms': avg_processing_time,
            'active_endpoints': active_endpoints,
            'total_endpoints': len(self.endpoints),
            'active_routes': active_routes,
            'total_routes': len(self.routes),
            'dead_letter_queue_size': len(self.dead_letter_queue),
            'circuit_breaker_states': circuit_breaker_states,
            'aggregation_groups_active': len(self.aggregator.aggregation_groups)
        }
        
    async def get_endpoint_health(self) -> Dict[str, Dict[str, Any]]:
        health_status = {}
        
        for endpoint_id, endpoint in self.endpoints.items():
            circuit_state = self.circuit_breaker.states.get(endpoint_id)
            
            health_status[endpoint_id] = {
                'is_active': endpoint.is_active,
                'circuit_breaker_state': circuit_state.state if circuit_state else 'closed',
                'failure_count': circuit_state.failure_count if circuit_state else 0,
                'last_failure': circuit_state.last_failure_time.isoformat() if circuit_state and circuit_state.last_failure_time else None,
                'protocol': endpoint.protocol.value,
                'url': endpoint.url
            }
            
        return health_status
        
    async def replay_dead_letter_messages(self, max_count: int = 10) -> int:
        """Attempt to replay messages from the dead letter queue"""
        replayed_count = 0
        messages_to_retry = self.dead_letter_queue[:max_count]
        
        for dlq_entry in messages_to_retry:
            message = dlq_entry['message']
            endpoint_id = dlq_entry['endpoint_id']
            
            if endpoint_id in self.endpoints:
                endpoint = self.endpoints[endpoint_id]
                
                try:
                    success = await self.connector.send_message(message, endpoint)
                    if success:
                        self.dead_letter_queue.remove(dlq_entry)
                        replayed_count += 1
                        
                except Exception as e:
                    logging.error(f"Failed to replay message {message.id}: {e}")
                    
        return replayed_count

# Example usage and configuration
async def main():
    esb = EnterpriseServiceBus()
    await esb.initialize()
    
    # Register endpoints
    rest_api_endpoint = Endpoint(
        id='customer-api',
        name='Customer REST API',
        url='https://api.example.com/customers',
        protocol=TransportProtocol.HTTPS,
        format=MessageFormat.JSON,
        authentication={'type': 'bearer', 'token': 'api-token-123'},
        headers={'User-Agent': 'ESB/1.0'}
    )
    
    legacy_soap_endpoint = Endpoint(
        id='legacy-soap',
        name='Legacy SOAP Service',
        url='http://legacy.internal.com/soap',
        protocol=TransportProtocol.HTTP,
        format=MessageFormat.XML,
        timeout=60
    )
    
    esb.register_endpoint(rest_api_endpoint)
    esb.register_endpoint(legacy_soap_endpoint)
    
    # Register transformation rules
    json_to_xml_transform = TransformationRule(
        id='json-to-xml',
        name='JSON to XML Transformation',
        source_format=MessageFormat.JSON,
        target_format=MessageFormat.XML,
        mapping_rules=[
            {'source': 'customer_id', 'target': 'customerId'},
            {'source': 'name', 'target': 'customerName'}
        ]
    )
    
    esb.transformer.register_transformation_rule(json_to_xml_transform)
    
    # Register routes
    customer_route = Route(
        id='customer-integration',
        name='Customer Data Integration',
        source_endpoint='customer-input',
        destination_endpoints=['customer-api', 'legacy-soap'],
        conditions=[
            {'type': 'message_type', 'message_type': 'customer_update'}
        ],
        transformations=[
            {
                'type': 'format_conversion',
                'target_format': 'xml',
                'when_destination': 'legacy-soap'
            },
            {
                'type': 'field_mapping',
                'mapping_rules': [
                    {'source': 'id', 'target': 'customer_id'},
                    {'source': 'full_name', 'target': 'name'}
                ]
            }
        ]
    )
    
    esb.register_route(customer_route)
    
    # Create and send a test message
    test_message = Message(
        id=str(uuid.uuid4()),
        correlation_id=str(uuid.uuid4()),
        timestamp=datetime.now(),
        headers={'message_type': 'customer_update', 'source': 'crm_system'},
        payload={
            'id': 12345,
            'full_name': 'John Doe',
            'email': 'john.doe@example.com',
            'phone': '+1-555-0123'
        },
        format=MessageFormat.JSON,
        source_endpoint='customer-input'
    )
    
    # Send message through the ESB
    success = await esb.send_message(test_message)
    print(f"Message sent successfully: {success}")
    
    # Get ESB metrics
    metrics = await esb.get_metrics()
    print(f"ESB Metrics: {metrics}")
    
    # Get endpoint health
    health = await esb.get_endpoint_health()
    print(f"Endpoint Health: {health}")
    
    await esb.shutdown()

if __name__ == "__main__":
    asyncio.run(main())