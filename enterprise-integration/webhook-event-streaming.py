import asyncio
import json
import hashlib
import hmac
import time
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union, AsyncIterator
from enum import Enum
import logging
import uuid
import aiohttp
import aioredis
from urllib.parse import urlparse
import base64
from collections import defaultdict
import heapq

class EventType(Enum):
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_DELETED = "user.deleted"
    ORDER_PLACED = "order.placed"
    ORDER_COMPLETED = "order.completed"
    ORDER_CANCELLED = "order.cancelled"
    PAYMENT_PROCESSED = "payment.processed"
    PAYMENT_FAILED = "payment.failed"
    SYSTEM_ALERT = "system.alert"
    CUSTOM = "custom"

class DeliveryMode(Enum):
    AT_LEAST_ONCE = "at_least_once"
    AT_MOST_ONCE = "at_most_once"
    EXACTLY_ONCE = "exactly_once"

class RetryStrategy(Enum):
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    FIXED_INTERVAL = "fixed_interval"
    IMMEDIATE = "immediate"

class WebhookStatus(Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    FAILED = "failed"

class EventStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    DELIVERED = "delivered"
    FAILED = "failed"
    EXPIRED = "expired"

class StreamPartitionStrategy(Enum):
    ROUND_ROBIN = "round_robin"
    KEY_HASH = "key_hash"
    RANDOM = "random"
    STICKY_SESSIONS = "sticky_sessions"

@dataclass
class Event:
    id: str
    event_type: EventType
    timestamp: datetime
    source: str
    data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None
    trace_id: Optional[str] = None
    version: str = "1.0"
    ttl: Optional[int] = None  # Time to live in seconds
    priority: int = 5  # 1-10, 10 being highest
    tags: List[str] = field(default_factory=list)

@dataclass
class WebhookEndpoint:
    id: str
    url: str
    name: str
    description: str
    event_types: List[EventType]
    secret: str
    headers: Dict[str, str] = field(default_factory=dict)
    timeout: int = 30
    retry_config: Dict[str, Any] = field(default_factory=dict)
    filters: List[Dict[str, Any]] = field(default_factory=list)
    transformation: Optional[Dict[str, Any]] = None
    status: WebhookStatus = WebhookStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    failure_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class WebhookDelivery:
    id: str
    webhook_id: str
    event_id: str
    status: EventStatus
    attempt_count: int = 0
    max_attempts: int = 3
    next_attempt: Optional[datetime] = None
    last_attempt: Optional[datetime] = None
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class EventStream:
    id: str
    name: str
    description: str
    event_types: List[EventType]
    partition_strategy: StreamPartitionStrategy
    partition_count: int = 1
    retention_hours: int = 24
    max_events_per_partition: int = 10000
    delivery_mode: DeliveryMode = DeliveryMode.AT_LEAST_ONCE
    is_active: bool = True
    consumers: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class EventStreamConsumer:
    id: str
    name: str
    stream_id: str
    consumer_group: str
    partition_assignments: List[int] = field(default_factory=list)
    offset_positions: Dict[int, int] = field(default_factory=dict)  # partition -> offset
    last_heartbeat: Optional[datetime] = None
    status: str = "active"  # active, paused, failed
    processing_timeout: int = 300  # 5 minutes
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class EventStreamMessage:
    partition: int
    offset: int
    event: Event
    timestamp: datetime
    headers: Dict[str, str] = field(default_factory=dict)

class WebhookSigner:
    @staticmethod
    def generate_signature(payload: str, secret: str, algorithm: str = "sha256") -> str:
        """Generate HMAC signature for webhook payload"""
        signature = hmac.new(
            secret.encode('utf-8'),
            payload.encode('utf-8'),
            getattr(hashlib, algorithm)
        ).hexdigest()
        return f"{algorithm}={signature}"
    
    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        try:
            algorithm, expected_signature = signature.split('=', 1)
            computed_signature = hmac.new(
                secret.encode('utf-8'),
                payload.encode('utf-8'),
                getattr(hashlib, algorithm)
            ).hexdigest()
            return hmac.compare_digest(expected_signature, computed_signature)
        except (ValueError, AttributeError):
            return False

class EventFilter:
    @staticmethod
    async def apply_filters(event: Event, filters: List[Dict[str, Any]]) -> bool:
        """Apply filters to determine if event should be delivered"""
        for filter_config in filters:
            if not await EventFilter._evaluate_filter(event, filter_config):
                return False
        return True
    
    @staticmethod
    async def _evaluate_filter(event: Event, filter_config: Dict[str, Any]) -> bool:
        filter_type = filter_config.get('type')
        
        if filter_type == 'field_match':
            field_path = filter_config.get('field')
            expected_value = filter_config.get('value')
            operator = filter_config.get('operator', 'eq')
            
            actual_value = EventFilter._extract_field_value(event.data, field_path)
            
            if operator == 'eq':
                return actual_value == expected_value
            elif operator == 'ne':
                return actual_value != expected_value
            elif operator == 'in':
                return actual_value in expected_value
            elif operator == 'contains':
                return expected_value in str(actual_value)
            elif operator == 'regex':
                import re
                return bool(re.search(expected_value, str(actual_value)))
                
        elif filter_type == 'metadata_match':
            key = filter_config.get('key')
            value = filter_config.get('value')
            return event.metadata.get(key) == value
            
        elif filter_type == 'tag_match':
            required_tags = filter_config.get('tags', [])
            return all(tag in event.tags for tag in required_tags)
            
        return True
    
    @staticmethod
    def _extract_field_value(data: Dict[str, Any], field_path: str) -> Any:
        """Extract field value using dot notation"""
        parts = field_path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

class EventTransformer:
    @staticmethod
    async def transform_event(event: Event, transformation: Dict[str, Any]) -> Event:
        """Transform event data based on configuration"""
        transform_type = transformation.get('type')
        
        if transform_type == 'field_mapping':
            return await EventTransformer._apply_field_mapping(event, transformation)
        elif transform_type == 'data_enrichment':
            return await EventTransformer._apply_data_enrichment(event, transformation)
        elif transform_type == 'format_conversion':
            return await EventTransformer._apply_format_conversion(event, transformation)
        else:
            return event
    
    @staticmethod
    async def _apply_field_mapping(event: Event, config: Dict[str, Any]) -> Event:
        mapping_rules = config.get('mappings', [])
        new_data = {}
        
        for rule in mapping_rules:
            source_field = rule.get('source')
            target_field = rule.get('target')
            default_value = rule.get('default')
            
            source_value = EventTransformer._extract_field_value(event.data, source_field)
            if source_value is not None:
                EventTransformer._set_field_value(new_data, target_field, source_value)
            elif default_value is not None:
                EventTransformer._set_field_value(new_data, target_field, default_value)
        
        event.data = new_data
        return event
    
    @staticmethod
    async def _apply_data_enrichment(event: Event, config: Dict[str, Any]) -> Event:
        enrichments = config.get('enrichments', [])
        
        for enrichment in enrichments:
            enrichment_type = enrichment.get('type')
            
            if enrichment_type == 'timestamp':
                event.data['enriched_timestamp'] = datetime.now().isoformat()
            elif enrichment_type == 'correlation_id':
                event.data['correlation_id'] = event.correlation_id
            elif enrichment_type == 'constant':
                field_name = enrichment.get('field')
                value = enrichment.get('value')
                event.data[field_name] = value
        
        return event
    
    @staticmethod
    async def _apply_format_conversion(event: Event, config: Dict[str, Any]) -> Event:
        # Placeholder for format conversion logic
        return event
    
    @staticmethod
    def _extract_field_value(data: Dict[str, Any], field_path: str) -> Any:
        parts = field_path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current
    
    @staticmethod
    def _set_field_value(data: Dict[str, Any], field_path: str, value: Any):
        parts = field_path.split('.')
        current = data
        
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            current = current[part]
        
        current[parts[-1]] = value

class RetryManager:
    def __init__(self):
        self.retry_queue = []  # Priority queue for retries
        self.retry_strategies = {
            RetryStrategy.EXPONENTIAL_BACKOFF: self._exponential_backoff,
            RetryStrategy.LINEAR_BACKOFF: self._linear_backoff,
            RetryStrategy.FIXED_INTERVAL: self._fixed_interval,
            RetryStrategy.IMMEDIATE: self._immediate_retry
        }
    
    async def schedule_retry(self, delivery: WebhookDelivery, retry_config: Dict[str, Any]):
        """Schedule a retry for failed delivery"""
        strategy = RetryStrategy(retry_config.get('strategy', 'exponential_backoff'))
        max_attempts = retry_config.get('max_attempts', 5)
        
        if delivery.attempt_count >= max_attempts:
            delivery.status = EventStatus.FAILED
            return
        
        delay_seconds = await self.retry_strategies[strategy](
            delivery.attempt_count, retry_config
        )
        
        delivery.next_attempt = datetime.now() + timedelta(seconds=delay_seconds)
        
        # Add to priority queue (using negative timestamp for min-heap)
        heapq.heappush(
            self.retry_queue,
            (-delivery.next_attempt.timestamp(), delivery.id, delivery)
        )
    
    async def get_ready_retries(self) -> List[WebhookDelivery]:
        """Get deliveries ready for retry"""
        ready_deliveries = []
        current_time = datetime.now().timestamp()
        
        while self.retry_queue and -self.retry_queue[0][0] <= current_time:
            _, delivery_id, delivery = heapq.heappop(self.retry_queue)
            ready_deliveries.append(delivery)
        
        return ready_deliveries
    
    async def _exponential_backoff(self, attempt: int, config: Dict[str, Any]) -> float:
        base_delay = config.get('base_delay', 1.0)
        max_delay = config.get('max_delay', 300.0)
        multiplier = config.get('multiplier', 2.0)
        
        delay = base_delay * (multiplier ** attempt)
        return min(delay, max_delay)
    
    async def _linear_backoff(self, attempt: int, config: Dict[str, Any]) -> float:
        base_delay = config.get('base_delay', 1.0)
        increment = config.get('increment', 1.0)
        max_delay = config.get('max_delay', 300.0)
        
        delay = base_delay + (increment * attempt)
        return min(delay, max_delay)
    
    async def _fixed_interval(self, attempt: int, config: Dict[str, Any]) -> float:
        return config.get('interval', 30.0)
    
    async def _immediate_retry(self, attempt: int, config: Dict[str, Any]) -> float:
        return 0.0

class EventStreamPartitioner:
    def __init__(self, strategy: StreamPartitionStrategy, partition_count: int):
        self.strategy = strategy
        self.partition_count = partition_count
        self.round_robin_counter = 0
    
    async def get_partition(self, event: Event, partition_key: Optional[str] = None) -> int:
        if self.strategy == StreamPartitionStrategy.ROUND_ROBIN:
            partition = self.round_robin_counter % self.partition_count
            self.round_robin_counter += 1
            return partition
        
        elif self.strategy == StreamPartitionStrategy.KEY_HASH:
            key = partition_key or event.correlation_id or event.id
            hash_value = hash(key)
            return abs(hash_value) % self.partition_count
        
        elif self.strategy == StreamPartitionStrategy.RANDOM:
            import random
            return random.randint(0, self.partition_count - 1)
        
        elif self.strategy == StreamPartitionStrategy.STICKY_SESSIONS:
            # Use source as sticky key
            source_hash = hash(event.source)
            return abs(source_hash) % self.partition_count
        
        else:
            return 0

class EventStreamManager:
    def __init__(self):
        self.streams = {}
        self.partitions = {}  # stream_id -> partition_id -> List[EventStreamMessage]
        self.consumers = {}
        self.consumer_groups = defaultdict(list)
        self.offset_tracker = {}  # stream_id -> partition_id -> max_offset
        
    async def create_stream(self, stream: EventStream):
        self.streams[stream.id] = stream
        
        # Initialize partitions
        self.partitions[stream.id] = {}
        self.offset_tracker[stream.id] = {}
        
        for partition_id in range(stream.partition_count):
            self.partitions[stream.id][partition_id] = []
            self.offset_tracker[stream.id][partition_id] = 0
    
    async def publish_to_stream(self, stream_id: str, event: Event, 
                              partition_key: Optional[str] = None) -> bool:
        if stream_id not in self.streams:
            return False
        
        stream = self.streams[stream_id]
        if not stream.is_active:
            return False
        
        # Check if event type is allowed
        if stream.event_types and event.event_type not in stream.event_types:
            return False
        
        # Determine partition
        partitioner = EventStreamPartitioner(stream.partition_strategy, stream.partition_count)
        partition = await partitioner.get_partition(event, partition_key)
        
        # Get next offset
        next_offset = self.offset_tracker[stream_id][partition] + 1
        self.offset_tracker[stream_id][partition] = next_offset
        
        # Create stream message
        stream_message = EventStreamMessage(
            partition=partition,
            offset=next_offset,
            event=event,
            timestamp=datetime.now(),
            headers={'stream_id': stream_id, 'partition': str(partition)}
        )
        
        # Add to partition
        partition_messages = self.partitions[stream_id][partition]
        partition_messages.append(stream_message)
        
        # Enforce retention policy
        await self._enforce_retention(stream_id, partition)
        
        # Notify consumers
        await self._notify_consumers(stream_id, partition, stream_message)
        
        return True
    
    async def subscribe_consumer(self, consumer: EventStreamConsumer):
        self.consumers[consumer.id] = consumer
        self.consumer_groups[consumer.consumer_group].append(consumer.id)
        
        # Assign partitions if not already assigned
        if not consumer.partition_assignments:
            await self._assign_partitions(consumer)
    
    async def consume_messages(self, consumer_id: str, max_messages: int = 10) -> List[EventStreamMessage]:
        if consumer_id not in self.consumers:
            return []
        
        consumer = self.consumers[consumer_id]
        consumer.last_heartbeat = datetime.now()
        
        messages = []
        
        for partition in consumer.partition_assignments:
            if len(messages) >= max_messages:
                break
            
            current_offset = consumer.offset_positions.get(partition, 0)
            partition_messages = self.partitions[consumer.stream_id][partition]
            
            # Find messages after current offset
            for message in partition_messages:
                if message.offset > current_offset and len(messages) < max_messages:
                    messages.append(message)
            
        return messages
    
    async def commit_offset(self, consumer_id: str, partition: int, offset: int):
        if consumer_id not in self.consumers:
            return False
        
        consumer = self.consumers[consumer_id]
        consumer.offset_positions[partition] = offset
        return True
    
    async def _enforce_retention(self, stream_id: str, partition: int):
        stream = self.streams[stream_id]
        partition_messages = self.partitions[stream_id][partition]
        
        # Remove old messages based on retention policy
        cutoff_time = datetime.now() - timedelta(hours=stream.retention_hours)
        
        # Keep messages within retention time and respect max events limit
        filtered_messages = [
            msg for msg in partition_messages
            if msg.timestamp > cutoff_time
        ]
        
        # Limit to max events per partition
        if len(filtered_messages) > stream.max_events_per_partition:
            filtered_messages = filtered_messages[-stream.max_events_per_partition:]
        
        self.partitions[stream_id][partition] = filtered_messages
    
    async def _assign_partitions(self, consumer: EventStreamConsumer):
        stream = self.streams[consumer.stream_id]
        group_consumers = self.consumer_groups[consumer.consumer_group]
        
        # Simple round-robin partition assignment
        partitions_per_consumer = stream.partition_count // len(group_consumers)
        remaining_partitions = stream.partition_count % len(group_consumers)
        
        consumer_index = group_consumers.index(consumer.id)
        start_partition = consumer_index * partitions_per_consumer
        end_partition = start_partition + partitions_per_consumer
        
        if consumer_index < remaining_partitions:
            end_partition += 1
        
        consumer.partition_assignments = list(range(start_partition, end_partition))
    
    async def _notify_consumers(self, stream_id: str, partition: int, message: EventStreamMessage):
        # Notify consumers assigned to this partition
        for consumer in self.consumers.values():
            if (consumer.stream_id == stream_id and 
                partition in consumer.partition_assignments):
                # In a real implementation, this would trigger a callback or notification
                logging.debug(f"Notifying consumer {consumer.id} of new message in partition {partition}")

class WebhookEventSystem:
    def __init__(self):
        self.webhook_endpoints = {}
        self.deliveries = {}
        self.retry_manager = RetryManager()
        self.stream_manager = EventStreamManager()
        self.event_store = []  # Simple in-memory store
        self.delivery_workers = []
        self.retry_workers = []
        
    async def initialize(self):
        # Start background workers
        self.delivery_workers = [
            asyncio.create_task(self._delivery_worker())
            for _ in range(3)  # 3 delivery workers
        ]
        
        self.retry_workers = [
            asyncio.create_task(self._retry_worker())
            for _ in range(2)  # 2 retry workers
        ]
    
    async def shutdown(self):
        # Cancel all workers
        for worker in self.delivery_workers + self.retry_workers:
            worker.cancel()
        
        await asyncio.gather(*self.delivery_workers, *self.retry_workers, return_exceptions=True)
    
    async def register_webhook(self, endpoint: WebhookEndpoint):
        self.webhook_endpoints[endpoint.id] = endpoint
    
    async def unregister_webhook(self, endpoint_id: str):
        if endpoint_id in self.webhook_endpoints:
            del self.webhook_endpoints[endpoint_id]
    
    async def publish_event(self, event: Event, 
                          target_webhooks: Optional[List[str]] = None,
                          target_streams: Optional[List[str]] = None) -> str:
        """Publish event to webhooks and/or streams"""
        
        # Store event
        self.event_store.append(event)
        
        # Deliver to webhooks
        if target_webhooks is None:
            # Find matching webhooks based on event type
            target_webhooks = [
                webhook_id for webhook_id, webhook in self.webhook_endpoints.items()
                if (webhook.status == WebhookStatus.ACTIVE and
                    (not webhook.event_types or event.event_type in webhook.event_types))
            ]
        
        for webhook_id in target_webhooks:
            if webhook_id in self.webhook_endpoints:
                await self._create_webhook_delivery(event, webhook_id)
        
        # Publish to streams
        if target_streams:
            for stream_id in target_streams:
                await self.stream_manager.publish_to_stream(stream_id, event)
        
        return event.id
    
    async def _create_webhook_delivery(self, event: Event, webhook_id: str):
        webhook = self.webhook_endpoints[webhook_id]
        
        # Apply filters
        if not await EventFilter.apply_filters(event, webhook.filters):
            return
        
        # Create delivery record
        delivery = WebhookDelivery(
            id=str(uuid.uuid4()),
            webhook_id=webhook_id,
            event_id=event.id,
            status=EventStatus.PENDING,
            max_attempts=webhook.retry_config.get('max_attempts', 3)
        )
        
        self.deliveries[delivery.id] = delivery
    
    async def _delivery_worker(self):
        """Background worker for processing webhook deliveries"""
        while True:
            try:
                # Find pending deliveries
                pending_deliveries = [
                    delivery for delivery in self.deliveries.values()
                    if delivery.status == EventStatus.PENDING
                ]
                
                if not pending_deliveries:
                    await asyncio.sleep(1)
                    continue
                
                # Process one delivery
                delivery = pending_deliveries[0]
                await self._attempt_delivery(delivery)
                
            except Exception as e:
                logging.error(f"Delivery worker error: {e}")
                await asyncio.sleep(1)
    
    async def _retry_worker(self):
        """Background worker for processing retries"""
        while True:
            try:
                ready_retries = await self.retry_manager.get_ready_retries()
                
                for delivery in ready_retries:
                    await self._attempt_delivery(delivery)
                
                await asyncio.sleep(5)  # Check for retries every 5 seconds
                
            except Exception as e:
                logging.error(f"Retry worker error: {e}")
                await asyncio.sleep(5)
    
    async def _attempt_delivery(self, delivery: WebhookDelivery):
        """Attempt to deliver webhook"""
        delivery.status = EventStatus.PROCESSING
        delivery.attempt_count += 1
        delivery.last_attempt = datetime.now()
        
        webhook = self.webhook_endpoints.get(delivery.webhook_id)
        if not webhook:
            delivery.status = EventStatus.FAILED
            delivery.error_message = "Webhook endpoint not found"
            return
        
        # Find the event
        event = next((e for e in self.event_store if e.id == delivery.event_id), None)
        if not event:
            delivery.status = EventStatus.FAILED
            delivery.error_message = "Event not found"
            return
        
        try:
            # Apply transformation if configured
            transformed_event = event
            if webhook.transformation:
                transformed_event = await EventTransformer.transform_event(event, webhook.transformation)
            
            # Prepare payload
            payload_data = {
                'id': transformed_event.id,
                'event_type': transformed_event.event_type.value,
                'timestamp': transformed_event.timestamp.isoformat(),
                'source': transformed_event.source,
                'data': transformed_event.data,
                'metadata': transformed_event.metadata
            }
            
            if transformed_event.correlation_id:
                payload_data['correlation_id'] = transformed_event.correlation_id
            
            payload = json.dumps(payload_data)
            
            # Generate signature
            signature = WebhookSigner.generate_signature(payload, webhook.secret)
            
            # Prepare headers
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'WebhookEventSystem/1.0',
                'X-Webhook-Signature': signature,
                'X-Webhook-ID': webhook.id,
                'X-Event-ID': event.id,
                'X-Event-Type': event.event_type.value,
                **webhook.headers
            }
            
            # Make HTTP request
            timeout = aiohttp.ClientTimeout(total=webhook.timeout)
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    webhook.url,
                    data=payload,
                    headers=headers
                ) as response:
                    delivery.response_status = response.status
                    delivery.response_body = await response.text()
                    
                    if response.status < 400:
                        delivery.status = EventStatus.DELIVERED
                        webhook.last_success = datetime.now()
                        webhook.failure_count = 0
                    else:
                        await self._handle_delivery_failure(delivery, webhook, f"HTTP {response.status}")
        
        except asyncio.TimeoutError:
            await self._handle_delivery_failure(delivery, webhook, "Request timeout")
        except Exception as e:
            await self._handle_delivery_failure(delivery, webhook, str(e))
    
    async def _handle_delivery_failure(self, delivery: WebhookDelivery, 
                                     webhook: WebhookEndpoint, error_message: str):
        delivery.error_message = error_message
        webhook.last_failure = datetime.now()
        webhook.failure_count += 1
        
        # Check if should retry
        if delivery.attempt_count < delivery.max_attempts:
            await self.retry_manager.schedule_retry(delivery, webhook.retry_config)
        else:
            delivery.status = EventStatus.FAILED
            
            # Disable webhook if too many consecutive failures
            if webhook.failure_count >= 10:
                webhook.status = WebhookStatus.FAILED
                logging.warning(f"Webhook {webhook.id} disabled due to repeated failures")
    
    async def get_webhook_stats(self, webhook_id: str) -> Dict[str, Any]:
        """Get statistics for a webhook endpoint"""
        if webhook_id not in self.webhook_endpoints:
            return {}
        
        webhook = self.webhook_endpoints[webhook_id]
        
        # Count deliveries by status
        webhook_deliveries = [d for d in self.deliveries.values() if d.webhook_id == webhook_id]
        
        status_counts = defaultdict(int)
        for delivery in webhook_deliveries:
            status_counts[delivery.status.value] += 1
        
        # Calculate success rate
        total_deliveries = len(webhook_deliveries)
        successful_deliveries = status_counts[EventStatus.DELIVERED.value]
        success_rate = (successful_deliveries / total_deliveries * 100) if total_deliveries > 0 else 0
        
        # Calculate average response time (simplified)
        avg_response_time = 0  # Would calculate from actual timing data
        
        return {
            'webhook_id': webhook_id,
            'status': webhook.status.value,
            'total_deliveries': total_deliveries,
            'successful_deliveries': successful_deliveries,
            'failed_deliveries': status_counts[EventStatus.FAILED.value],
            'pending_deliveries': status_counts[EventStatus.PENDING.value],
            'success_rate': success_rate,
            'failure_count': webhook.failure_count,
            'last_success': webhook.last_success.isoformat() if webhook.last_success else None,
            'last_failure': webhook.last_failure.isoformat() if webhook.last_failure else None,
            'avg_response_time_ms': avg_response_time
        }
    
    async def get_event_delivery_status(self, event_id: str) -> Dict[str, Any]:
        """Get delivery status for an event across all webhooks"""
        event_deliveries = [d for d in self.deliveries.values() if d.event_id == event_id]
        
        delivery_status = []
        for delivery in event_deliveries:
            webhook = self.webhook_endpoints.get(delivery.webhook_id)
            
            delivery_status.append({
                'webhook_id': delivery.webhook_id,
                'webhook_name': webhook.name if webhook else 'Unknown',
                'status': delivery.status.value,
                'attempt_count': delivery.attempt_count,
                'last_attempt': delivery.last_attempt.isoformat() if delivery.last_attempt else None,
                'response_status': delivery.response_status,
                'error_message': delivery.error_message
            })
        
        return {
            'event_id': event_id,
            'total_webhooks': len(delivery_status),
            'successful_deliveries': len([d for d in delivery_status if d['status'] == 'delivered']),
            'failed_deliveries': len([d for d in delivery_status if d['status'] == 'failed']),
            'pending_deliveries': len([d for d in delivery_status if d['status'] == 'pending']),
            'deliveries': delivery_status
        }
    
    async def replay_failed_deliveries(self, webhook_id: str, hours_back: int = 24) -> int:
        """Replay failed deliveries for a webhook"""
        cutoff_time = datetime.now() - timedelta(hours=hours_back)
        
        failed_deliveries = [
            d for d in self.deliveries.values()
            if (d.webhook_id == webhook_id and 
                d.status == EventStatus.FAILED and
                d.created_at > cutoff_time)
        ]
        
        replayed_count = 0
        for delivery in failed_deliveries:
            # Reset delivery for retry
            delivery.status = EventStatus.PENDING
            delivery.attempt_count = 0
            delivery.error_message = None
            replayed_count += 1
        
        return replayed_count

# Example usage
async def main():
    webhook_system = WebhookEventSystem()
    await webhook_system.initialize()
    
    # Create webhook endpoint
    webhook = WebhookEndpoint(
        id="user-webhook",
        url="https://api.example.com/webhooks/users",
        name="User Events Webhook",
        description="Receives user lifecycle events",
        event_types=[EventType.USER_CREATED, EventType.USER_UPDATED],
        secret="webhook-secret-key",
        headers={"Authorization": "Bearer api-token"},
        retry_config={
            'strategy': 'exponential_backoff',
            'max_attempts': 5,
            'base_delay': 1.0,
            'max_delay': 300.0
        },
        filters=[
            {
                'type': 'field_match',
                'field': 'user.active',
                'value': True,
                'operator': 'eq'
            }
        ]
    )
    
    await webhook_system.register_webhook(webhook)
    
    # Create event stream
    user_stream = EventStream(
        id="user-events",
        name="User Events Stream",
        description="Stream of all user-related events",
        event_types=[EventType.USER_CREATED, EventType.USER_UPDATED, EventType.USER_DELETED],
        partition_strategy=StreamPartitionStrategy.KEY_HASH,
        partition_count=3,
        retention_hours=48
    )
    
    await webhook_system.stream_manager.create_stream(user_stream)
    
    # Create stream consumer
    consumer = EventStreamConsumer(
        id="analytics-consumer",
        name="Analytics Consumer",
        stream_id="user-events",
        consumer_group="analytics"
    )
    
    await webhook_system.stream_manager.subscribe_consumer(consumer)
    
    # Publish test event
    test_event = Event(
        id=str(uuid.uuid4()),
        event_type=EventType.USER_CREATED,
        timestamp=datetime.now(),
        source="user-service",
        data={
            'user': {
                'id': 12345,
                'email': 'test@example.com',
                'active': True
            }
        },
        correlation_id=str(uuid.uuid4())
    )
    
    # Publish to both webhooks and streams
    await webhook_system.publish_event(
        test_event,
        target_streams=["user-events"]
    )
    
    # Wait a bit for processing
    await asyncio.sleep(2)
    
    # Get webhook stats
    stats = await webhook_system.get_webhook_stats("user-webhook")
    print(f"Webhook Stats: {json.dumps(stats, indent=2)}")
    
    # Get event delivery status
    delivery_status = await webhook_system.get_event_delivery_status(test_event.id)
    print(f"Event Delivery Status: {json.dumps(delivery_status, indent=2)}")
    
    # Consume from stream
    messages = await webhook_system.stream_manager.consume_messages("analytics-consumer", 5)
    print(f"Consumed {len(messages)} messages from stream")
    
    for message in messages:
        print(f"Message: partition={message.partition}, offset={message.offset}, event_type={message.event.event_type.value}")
        # Commit offset after processing
        await webhook_system.stream_manager.commit_offset("analytics-consumer", message.partition, message.offset)
    
    await webhook_system.shutdown()

if __name__ == "__main__":
    asyncio.run(main())