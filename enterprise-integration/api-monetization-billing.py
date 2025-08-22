import asyncio
import json
import decimal
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Callable, Union
from enum import Enum
import logging
import uuid
import calendar
from collections import defaultdict
import math

class PricingModel(Enum):
    FREE = "free"
    PAY_PER_USE = "pay_per_use"
    TIERED = "tiered"
    SUBSCRIPTION = "subscription"
    FREEMIUM = "freemium"
    REVENUE_SHARE = "revenue_share"
    HYBRID = "hybrid"

class BillingPeriod(Enum):
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class UsageMetric(Enum):
    API_CALLS = "api_calls"
    DATA_TRANSFER = "data_transfer"
    COMPUTE_TIME = "compute_time"
    STORAGE = "storage"
    BANDWIDTH = "bandwidth"
    TRANSACTIONS = "transactions"
    USERS = "users"
    CUSTOM = "custom"

class ChargeType(Enum):
    FIXED = "fixed"
    VARIABLE = "variable"
    PERCENTAGE = "percentage"
    OVERAGE = "overage"

class InvoiceStatus(Enum):
    DRAFT = "draft"
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class DiscountType(Enum):
    PERCENTAGE = "percentage"
    FIXED_AMOUNT = "fixed_amount"
    FREE_TIER = "free_tier"
    VOLUME_DISCOUNT = "volume_discount"

@dataclass
class PricingTier:
    min_usage: int
    max_usage: Optional[int]  # None means unlimited
    price_per_unit: decimal.Decimal
    flat_fee: decimal.Decimal = decimal.Decimal('0')
    overage_rate: Optional[decimal.Decimal] = None

@dataclass
class PricingPlan:
    id: str
    name: str
    description: str
    model: PricingModel
    billing_period: BillingPeriod
    base_price: decimal.Decimal
    currency: str = "USD"
    tiers: List[PricingTier] = field(default_factory=list)
    included_usage: Dict[UsageMetric, int] = field(default_factory=dict)
    overage_rates: Dict[UsageMetric, decimal.Decimal] = field(default_factory=dict)
    free_trial_days: int = 0
    setup_fee: decimal.Decimal = decimal.Decimal('0')
    is_active: bool = True
    features: List[str] = field(default_factory=list)
    rate_limits: Dict[str, int] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class UsageRecord:
    id: str
    customer_id: str
    api_id: str
    endpoint: str
    metric: UsageMetric
    quantity: int
    timestamp: datetime
    billing_period: str  # e.g., "2024-01"
    metadata: Dict[str, Any] = field(default_factory=dict)
    unit_price: Optional[decimal.Decimal] = None
    total_cost: Optional[decimal.Decimal] = None

@dataclass
class Customer:
    id: str
    name: str
    email: str
    company: Optional[str]
    plan_id: str
    subscription_start: datetime
    subscription_end: Optional[datetime] = None
    billing_address: Dict[str, str] = field(default_factory=dict)
    payment_method: Dict[str, str] = field(default_factory=dict)
    tax_exempt: bool = False
    tax_rate: decimal.Decimal = decimal.Decimal('0')
    credit_balance: decimal.Decimal = decimal.Decimal('0')
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Discount:
    id: str
    name: str
    type: DiscountType
    value: decimal.Decimal  # percentage (0-100) or fixed amount
    applies_to: List[str]  # plan IDs or "all"
    valid_from: datetime
    valid_until: Optional[datetime] = None
    max_uses: Optional[int] = None
    current_uses: int = 0
    customer_eligibility: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True

@dataclass
class InvoiceLineItem:
    id: str
    description: str
    quantity: int
    unit_price: decimal.Decimal
    amount: decimal.Decimal
    metric: Optional[UsageMetric] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    proration: bool = False

@dataclass
class Invoice:
    id: str
    customer_id: str
    invoice_number: str
    status: InvoiceStatus
    billing_period_start: datetime
    billing_period_end: datetime
    subtotal: decimal.Decimal
    tax_amount: decimal.Decimal
    discount_amount: decimal.Decimal
    total_amount: decimal.Decimal
    currency: str
    due_date: datetime
    created_at: datetime = field(default_factory=datetime.now)
    paid_at: Optional[datetime] = None
    line_items: List[InvoiceLineItem] = field(default_factory=list)
    applied_discounts: List[str] = field(default_factory=list)
    payment_attempts: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

class UsageTracker:
    def __init__(self):
        self.usage_records = []
        self.aggregated_usage = defaultdict(lambda: defaultdict(int))
        
    async def track_usage(self, customer_id: str, api_id: str, endpoint: str,
                         metric: UsageMetric, quantity: int = 1,
                         metadata: Dict[str, Any] = None) -> str:
        """Track API usage for billing purposes"""
        
        usage_record = UsageRecord(
            id=str(uuid.uuid4()),
            customer_id=customer_id,
            api_id=api_id,
            endpoint=endpoint,
            metric=metric,
            quantity=quantity,
            timestamp=datetime.now(),
            billing_period=datetime.now().strftime("%Y-%m"),
            metadata=metadata or {}
        )
        
        self.usage_records.append(usage_record)
        
        # Update aggregated usage
        period_key = usage_record.billing_period
        metric_key = f"{customer_id}:{api_id}:{metric.value}"
        self.aggregated_usage[period_key][metric_key] += quantity
        
        return usage_record.id
        
    async def get_customer_usage(self, customer_id: str, 
                               period_start: datetime, period_end: datetime,
                               metric: Optional[UsageMetric] = None) -> Dict[str, int]:
        """Get usage data for a customer in a specific period"""
        
        usage_data = defaultdict(int)
        
        for record in self.usage_records:
            if (record.customer_id == customer_id and
                period_start <= record.timestamp <= period_end and
                (metric is None or record.metric == metric)):
                
                key = f"{record.api_id}:{record.metric.value}"
                usage_data[key] += record.quantity
        
        return dict(usage_data)
        
    async def get_usage_analytics(self, customer_id: str,
                                period_start: datetime, period_end: datetime) -> Dict[str, Any]:
        """Get detailed usage analytics for a customer"""
        
        total_calls = 0
        endpoint_usage = defaultdict(int)
        hourly_usage = defaultdict(int)
        daily_usage = defaultdict(int)
        
        for record in self.usage_records:
            if (record.customer_id == customer_id and
                period_start <= record.timestamp <= period_end):
                
                total_calls += record.quantity
                endpoint_usage[record.endpoint] += record.quantity
                
                hour_key = record.timestamp.strftime("%Y-%m-%d %H:00")
                hourly_usage[hour_key] += record.quantity
                
                day_key = record.timestamp.strftime("%Y-%m-%d")
                daily_usage[day_key] += record.quantity
        
        # Calculate peak usage
        peak_hour = max(hourly_usage.items(), key=lambda x: x[1]) if hourly_usage else ("", 0)
        peak_day = max(daily_usage.items(), key=lambda x: x[1]) if daily_usage else ("", 0)
        
        return {
            'total_api_calls': total_calls,
            'endpoint_breakdown': dict(endpoint_usage),
            'peak_hour': {'time': peak_hour[0], 'calls': peak_hour[1]},
            'peak_day': {'date': peak_day[0], 'calls': peak_day[1]},
            'daily_average': total_calls / max(1, len(daily_usage)),
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat()
        }

class PricingEngine:
    def __init__(self):
        self.pricing_plans = {}
        self.custom_pricing_rules = {}
        
    def register_pricing_plan(self, plan: PricingPlan):
        """Register a pricing plan"""
        self.pricing_plans[plan.id] = plan
        
    async def calculate_usage_cost(self, customer: Customer, usage_data: Dict[str, int],
                                 period_start: datetime, period_end: datetime) -> Dict[str, Any]:
        """Calculate cost for customer usage in a billing period"""
        
        if customer.plan_id not in self.pricing_plans:
            raise ValueError(f"Pricing plan {customer.plan_id} not found")
        
        plan = self.pricing_plans[customer.plan_id]
        
        if plan.model == PricingModel.FREE:
            return await self._calculate_free_cost(plan, usage_data)
        elif plan.model == PricingModel.PAY_PER_USE:
            return await self._calculate_pay_per_use_cost(plan, usage_data)
        elif plan.model == PricingModel.TIERED:
            return await self._calculate_tiered_cost(plan, usage_data)
        elif plan.model == PricingModel.SUBSCRIPTION:
            return await self._calculate_subscription_cost(plan, usage_data, period_start, period_end)
        elif plan.model == PricingModel.FREEMIUM:
            return await self._calculate_freemium_cost(plan, usage_data)
        else:
            return await self._calculate_hybrid_cost(plan, usage_data, period_start, period_end)
            
    async def _calculate_free_cost(self, plan: PricingPlan, usage_data: Dict[str, int]) -> Dict[str, Any]:
        """Calculate cost for free plans"""
        return {
            'base_cost': decimal.Decimal('0'),
            'usage_cost': decimal.Decimal('0'),
            'overage_cost': decimal.Decimal('0'),
            'total_cost': decimal.Decimal('0'),
            'included_usage_remaining': plan.included_usage,
            'breakdown': []
        }
        
    async def _calculate_pay_per_use_cost(self, plan: PricingPlan, usage_data: Dict[str, int]) -> Dict[str, Any]:
        """Calculate cost for pay-per-use plans"""
        total_cost = decimal.Decimal('0')
        breakdown = []
        
        for usage_key, quantity in usage_data.items():
            api_id, metric_name = usage_key.split(':', 1)
            metric = UsageMetric(metric_name)
            
            if metric in plan.overage_rates:
                unit_cost = plan.overage_rates[metric]
                line_cost = unit_cost * quantity
                total_cost += line_cost
                
                breakdown.append({
                    'api_id': api_id,
                    'metric': metric_name,
                    'quantity': quantity,
                    'unit_cost': float(unit_cost),
                    'line_cost': float(line_cost)
                })
        
        return {
            'base_cost': decimal.Decimal('0'),
            'usage_cost': total_cost,
            'overage_cost': decimal.Decimal('0'),
            'total_cost': total_cost,
            'breakdown': breakdown
        }
        
    async def _calculate_tiered_cost(self, plan: PricingPlan, usage_data: Dict[str, int]) -> Dict[str, Any]:
        """Calculate cost for tiered pricing plans"""
        # Get total usage across all APIs
        total_usage = sum(usage_data.values())
        
        if not plan.tiers:
            return await self._calculate_pay_per_use_cost(plan, usage_data)
        
        total_cost = decimal.Decimal('0')
        remaining_usage = total_usage
        breakdown = []
        
        for tier in sorted(plan.tiers, key=lambda t: t.min_usage):
            if remaining_usage <= 0:
                break
                
            # Calculate usage in this tier
            tier_max = tier.max_usage or float('inf')
            tier_usage = min(remaining_usage, tier_max - tier.min_usage + 1)
            
            if tier_usage > 0:
                tier_cost = tier.flat_fee + (tier.price_per_unit * tier_usage)
                total_cost += tier_cost
                remaining_usage -= tier_usage
                
                breakdown.append({
                    'tier': f"{tier.min_usage}-{tier.max_usage or 'unlimited'}",
                    'usage': tier_usage,
                    'rate': float(tier.price_per_unit),
                    'flat_fee': float(tier.flat_fee),
                    'tier_cost': float(tier_cost)
                })
        
        return {
            'base_cost': decimal.Decimal('0'),
            'usage_cost': total_cost,
            'overage_cost': decimal.Decimal('0'),
            'total_cost': total_cost,
            'breakdown': breakdown
        }
        
    async def _calculate_subscription_cost(self, plan: PricingPlan, usage_data: Dict[str, int],
                                         period_start: datetime, period_end: datetime) -> Dict[str, Any]:
        """Calculate cost for subscription plans with overage charges"""
        
        # Calculate prorated base cost
        if plan.billing_period == BillingPeriod.MONTHLY:
            days_in_period = (period_end - period_start).days + 1
            days_in_month = calendar.monthrange(period_start.year, period_start.month)[1]
            proration_factor = decimal.Decimal(days_in_period) / decimal.Decimal(days_in_month)
        else:
            proration_factor = decimal.Decimal('1')  # No proration for other periods
            
        base_cost = plan.base_price * proration_factor
        overage_cost = decimal.Decimal('0')
        breakdown = []
        
        # Calculate overage charges
        for usage_key, quantity in usage_data.items():
            api_id, metric_name = usage_key.split(':', 1)
            metric = UsageMetric(metric_name)
            
            included_quantity = plan.included_usage.get(metric, 0)
            overage_quantity = max(0, quantity - included_quantity)
            
            if overage_quantity > 0 and metric in plan.overage_rates:
                unit_cost = plan.overage_rates[metric]
                line_overage_cost = unit_cost * overage_quantity
                overage_cost += line_overage_cost
                
                breakdown.append({
                    'api_id': api_id,
                    'metric': metric_name,
                    'total_usage': quantity,
                    'included_usage': included_quantity,
                    'overage_usage': overage_quantity,
                    'overage_rate': float(unit_cost),
                    'overage_cost': float(line_overage_cost)
                })
        
        return {
            'base_cost': base_cost,
            'usage_cost': decimal.Decimal('0'),
            'overage_cost': overage_cost,
            'total_cost': base_cost + overage_cost,
            'proration_factor': float(proration_factor),
            'breakdown': breakdown
        }
        
    async def _calculate_freemium_cost(self, plan: PricingPlan, usage_data: Dict[str, int]) -> Dict[str, Any]:
        """Calculate cost for freemium plans (free tier + overage)"""
        overage_cost = decimal.Decimal('0')
        breakdown = []
        
        for usage_key, quantity in usage_data.items():
            api_id, metric_name = usage_key.split(':', 1)
            metric = UsageMetric(metric_name)
            
            free_tier_limit = plan.included_usage.get(metric, 0)
            overage_quantity = max(0, quantity - free_tier_limit)
            
            if overage_quantity > 0 and metric in plan.overage_rates:
                unit_cost = plan.overage_rates[metric]
                line_overage_cost = unit_cost * overage_quantity
                overage_cost += line_overage_cost
                
                breakdown.append({
                    'api_id': api_id,
                    'metric': metric_name,
                    'total_usage': quantity,
                    'free_tier_limit': free_tier_limit,
                    'billable_usage': overage_quantity,
                    'rate': float(unit_cost),
                    'cost': float(line_overage_cost)
                })
        
        return {
            'base_cost': decimal.Decimal('0'),
            'usage_cost': overage_cost,
            'overage_cost': decimal.Decimal('0'),
            'total_cost': overage_cost,
            'breakdown': breakdown
        }
        
    async def _calculate_hybrid_cost(self, plan: PricingPlan, usage_data: Dict[str, int],
                                   period_start: datetime, period_end: datetime) -> Dict[str, Any]:
        """Calculate cost for hybrid plans (combination of subscription + usage)"""
        subscription_result = await self._calculate_subscription_cost(plan, usage_data, period_start, period_end)
        usage_result = await self._calculate_pay_per_use_cost(plan, usage_data)
        
        return {
            'base_cost': subscription_result['base_cost'],
            'usage_cost': usage_result['usage_cost'],
            'overage_cost': subscription_result['overage_cost'],
            'total_cost': subscription_result['total_cost'] + usage_result['usage_cost'],
            'subscription_breakdown': subscription_result['breakdown'],
            'usage_breakdown': usage_result['breakdown']
        }

class DiscountManager:
    def __init__(self):
        self.discounts = {}
        self.customer_discounts = defaultdict(list)
        
    def create_discount(self, discount: Discount):
        """Create a new discount"""
        self.discounts[discount.id] = discount
        
    async def apply_discounts(self, customer: Customer, subtotal: decimal.Decimal,
                            line_items: List[InvoiceLineItem]) -> Tuple[decimal.Decimal, List[str]]:
        """Apply applicable discounts to an invoice"""
        
        total_discount = decimal.Decimal('0')
        applied_discount_ids = []
        
        # Get applicable discounts for customer
        applicable_discounts = await self._get_applicable_discounts(customer)
        
        for discount in applicable_discounts:
            if not self._can_use_discount(discount):
                continue
                
            discount_amount = await self._calculate_discount_amount(discount, subtotal, line_items)
            
            if discount_amount > 0:
                total_discount += discount_amount
                applied_discount_ids.append(discount.id)
                discount.current_uses += 1
        
        return total_discount, applied_discount_ids
        
    async def _get_applicable_discounts(self, customer: Customer) -> List[Discount]:
        """Get discounts applicable to a customer"""
        applicable = []
        
        for discount in self.discounts.values():
            if not discount.is_active:
                continue
                
            # Check date validity
            now = datetime.now()
            if now < discount.valid_from or (discount.valid_until and now > discount.valid_until):
                continue
                
            # Check plan eligibility
            if discount.applies_to != ["all"] and customer.plan_id not in discount.applies_to:
                continue
                
            # Check customer eligibility criteria
            if not self._check_customer_eligibility(customer, discount):
                continue
                
            applicable.append(discount)
        
        # Sort by discount value (highest first)
        return sorted(applicable, key=lambda d: d.value, reverse=True)
        
    def _can_use_discount(self, discount: Discount) -> bool:
        """Check if discount can still be used"""
        if discount.max_uses is None:
            return True
        return discount.current_uses < discount.max_uses
        
    async def _calculate_discount_amount(self, discount: Discount, subtotal: decimal.Decimal,
                                       line_items: List[InvoiceLineItem]) -> decimal.Decimal:
        """Calculate discount amount"""
        
        if discount.type == DiscountType.PERCENTAGE:
            return subtotal * (discount.value / 100)
        elif discount.type == DiscountType.FIXED_AMOUNT:
            return min(discount.value, subtotal)
        elif discount.type == DiscountType.VOLUME_DISCOUNT:
            # Volume discount based on total usage
            total_quantity = sum(item.quantity for item in line_items)
            if total_quantity >= 10000:  # Example threshold
                return subtotal * (discount.value / 100)
        
        return decimal.Decimal('0')
        
    def _check_customer_eligibility(self, customer: Customer, discount: Discount) -> bool:
        """Check if customer meets discount eligibility criteria"""
        eligibility = discount.customer_eligibility
        
        if 'new_customers_only' in eligibility and eligibility['new_customers_only']:
            # Check if customer is new (subscribed within last 30 days)
            days_since_signup = (datetime.now() - customer.subscription_start).days
            if days_since_signup > 30:
                return False
                
        if 'min_subscription_value' in eligibility:
            # Would check customer's subscription value
            pass
            
        return True

class InvoiceGenerator:
    def __init__(self, pricing_engine: PricingEngine, discount_manager: DiscountManager):
        self.pricing_engine = pricing_engine
        self.discount_manager = discount_manager
        self.invoices = {}
        self.invoice_counter = 1
        
    async def generate_invoice(self, customer: Customer, usage_data: Dict[str, int],
                             period_start: datetime, period_end: datetime) -> Invoice:
        """Generate an invoice for a customer's usage"""
        
        # Calculate costs
        cost_breakdown = await self.pricing_engine.calculate_usage_cost(
            customer, usage_data, period_start, period_end
        )
        
        # Create line items
        line_items = await self._create_line_items(customer, cost_breakdown, period_start, period_end)
        
        # Calculate subtotal
        subtotal = sum(item.amount for item in line_items)
        
        # Apply discounts
        discount_amount, applied_discounts = await self.discount_manager.apply_discounts(
            customer, subtotal, line_items
        )
        
        # Calculate tax
        tax_amount = self._calculate_tax(customer, subtotal - discount_amount)
        
        # Create invoice
        invoice = Invoice(
            id=str(uuid.uuid4()),
            customer_id=customer.id,
            invoice_number=f"INV-{self.invoice_counter:08d}",
            status=InvoiceStatus.PENDING,
            billing_period_start=period_start,
            billing_period_end=period_end,
            subtotal=subtotal,
            tax_amount=tax_amount,
            discount_amount=discount_amount,
            total_amount=subtotal - discount_amount + tax_amount,
            currency="USD",
            due_date=datetime.now() + timedelta(days=30),
            line_items=line_items,
            applied_discounts=applied_discounts
        )
        
        self.invoices[invoice.id] = invoice
        self.invoice_counter += 1
        
        return invoice
        
    async def _create_line_items(self, customer: Customer, cost_breakdown: Dict[str, Any],
                               period_start: datetime, period_end: datetime) -> List[InvoiceLineItem]:
        """Create invoice line items from cost breakdown"""
        line_items = []
        
        # Base subscription fee
        if cost_breakdown.get('base_cost', 0) > 0:
            line_items.append(InvoiceLineItem(
                id=str(uuid.uuid4()),
                description=f"Subscription fee ({period_start.strftime('%Y-%m-%d')} - {period_end.strftime('%Y-%m-%d')})",
                quantity=1,
                unit_price=cost_breakdown['base_cost'],
                amount=cost_breakdown['base_cost'],
                period_start=period_start,
                period_end=period_end
            ))
        
        # Usage-based charges
        for item in cost_breakdown.get('breakdown', []):
            if 'api_id' in item:
                description = f"API Usage - {item['api_id']} ({item['metric']})"
                line_items.append(InvoiceLineItem(
                    id=str(uuid.uuid4()),
                    description=description,
                    quantity=item.get('quantity', item.get('overage_usage', item.get('billable_usage', 0))),
                    unit_price=decimal.Decimal(str(item.get('rate', item.get('overage_rate', item.get('unit_cost', 0))))),
                    amount=decimal.Decimal(str(item.get('cost', item.get('overage_cost', item.get('line_cost', 0))))),
                    metric=UsageMetric(item['metric']),
                    period_start=period_start,
                    period_end=period_end
                ))
        
        return line_items
        
    def _calculate_tax(self, customer: Customer, taxable_amount: decimal.Decimal) -> decimal.Decimal:
        """Calculate tax amount for invoice"""
        if customer.tax_exempt:
            return decimal.Decimal('0')
        
        return taxable_amount * customer.tax_rate
        
    async def mark_invoice_paid(self, invoice_id: str, payment_date: datetime = None) -> bool:
        """Mark an invoice as paid"""
        if invoice_id not in self.invoices:
            return False
            
        invoice = self.invoices[invoice_id]
        invoice.status = InvoiceStatus.PAID
        invoice.paid_at = payment_date or datetime.now()
        
        return True
        
    async def get_customer_invoices(self, customer_id: str, 
                                  limit: int = 10) -> List[Invoice]:
        """Get invoices for a customer"""
        customer_invoices = [
            invoice for invoice in self.invoices.values()
            if invoice.customer_id == customer_id
        ]
        
        # Sort by creation date (newest first)
        customer_invoices.sort(key=lambda inv: inv.created_at, reverse=True)
        
        return customer_invoices[:limit]

class RevenueAnalytics:
    def __init__(self):
        self.revenue_data = defaultdict(lambda: defaultdict(decimal.Decimal))
        
    async def record_revenue(self, invoice: Invoice):
        """Record revenue from a paid invoice"""
        if invoice.status != InvoiceStatus.PAID:
            return
            
        period_key = invoice.billing_period_start.strftime("%Y-%m")
        
        # Record total revenue
        self.revenue_data[period_key]['total_revenue'] += invoice.total_amount
        
        # Record revenue by line item type
        for item in invoice.line_items:
            if item.metric:
                metric_key = f"usage_{item.metric.value}"
                self.revenue_data[period_key][metric_key] += item.amount
            else:
                self.revenue_data[period_key]['subscription_revenue'] += item.amount
                
    async def get_revenue_report(self, start_period: str, end_period: str) -> Dict[str, Any]:
        """Generate revenue report for a period range"""
        
        total_revenue = decimal.Decimal('0')
        period_breakdown = {}
        metric_breakdown = defaultdict(decimal.Decimal)
        
        # Parse period strings
        start_date = datetime.strptime(start_period, "%Y-%m")
        end_date = datetime.strptime(end_period, "%Y-%m")
        
        current_date = start_date
        while current_date <= end_date:
            period_key = current_date.strftime("%Y-%m")
            
            if period_key in self.revenue_data:
                period_revenue = self.revenue_data[period_key]['total_revenue']
                total_revenue += period_revenue
                period_breakdown[period_key] = float(period_revenue)
                
                # Aggregate metric breakdown
                for metric, amount in self.revenue_data[period_key].items():
                    if metric != 'total_revenue':
                        metric_breakdown[metric] += amount
            else:
                period_breakdown[period_key] = 0.0
                
            # Move to next month
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # Calculate growth rate
        periods = list(period_breakdown.keys())
        if len(periods) >= 2:
            current_revenue = decimal.Decimal(str(period_breakdown[periods[-1]]))
            previous_revenue = decimal.Decimal(str(period_breakdown[periods[-2]]))
            
            if previous_revenue > 0:
                growth_rate = float((current_revenue - previous_revenue) / previous_revenue * 100)
            else:
                growth_rate = 0.0
        else:
            growth_rate = 0.0
        
        return {
            'total_revenue': float(total_revenue),
            'period_breakdown': period_breakdown,
            'metric_breakdown': {k: float(v) for k, v in metric_breakdown.items()},
            'growth_rate_percent': growth_rate,
            'period_count': len(periods),
            'average_monthly_revenue': float(total_revenue / len(periods)) if periods else 0.0
        }

class APIMonetizationSystem:
    def __init__(self):
        self.usage_tracker = UsageTracker()
        self.pricing_engine = PricingEngine()
        self.discount_manager = DiscountManager()
        self.invoice_generator = InvoiceGenerator(self.pricing_engine, self.discount_manager)
        self.revenue_analytics = RevenueAnalytics()
        self.customers = {}
        
    async def initialize(self):
        """Initialize the monetization system with default plans"""
        
        # Create default pricing plans
        await self._create_default_pricing_plans()
        
        # Create default discounts
        await self._create_default_discounts()
        
    async def _create_default_pricing_plans(self):
        """Create default pricing plans"""
        
        # Free plan
        free_plan = PricingPlan(
            id="free",
            name="Free Plan",
            description="Perfect for getting started",
            model=PricingModel.FREE,
            billing_period=BillingPeriod.MONTHLY,
            base_price=decimal.Decimal('0'),
            included_usage={
                UsageMetric.API_CALLS: 1000
            },
            rate_limits={'requests_per_minute': 60},
            features=["Basic API access", "Community support"]
        )
        
        # Starter plan
        starter_plan = PricingPlan(
            id="starter",
            name="Starter Plan",
            description="For small projects and developers",
            model=PricingModel.FREEMIUM,
            billing_period=BillingPeriod.MONTHLY,
            base_price=decimal.Decimal('0'),
            included_usage={
                UsageMetric.API_CALLS: 10000
            },
            overage_rates={
                UsageMetric.API_CALLS: decimal.Decimal('0.001')
            },
            rate_limits={'requests_per_minute': 300},
            features=["Enhanced API access", "Email support", "Basic analytics"]
        )
        
        # Professional plan
        pro_plan = PricingPlan(
            id="professional",
            name="Professional Plan",
            description="For growing businesses",
            model=PricingModel.SUBSCRIPTION,
            billing_period=BillingPeriod.MONTHLY,
            base_price=decimal.Decimal('99.00'),
            included_usage={
                UsageMetric.API_CALLS: 100000,
                UsageMetric.DATA_TRANSFER: 10000  # MB
            },
            overage_rates={
                UsageMetric.API_CALLS: decimal.Decimal('0.0005'),
                UsageMetric.DATA_TRANSFER: decimal.Decimal('0.10')
            },
            rate_limits={'requests_per_minute': 1000},
            features=["Full API access", "Priority support", "Advanced analytics", "SLA guarantee"]
        )
        
        # Enterprise plan with tiered pricing
        enterprise_plan = PricingPlan(
            id="enterprise",
            name="Enterprise Plan",
            description="For large scale applications",
            model=PricingModel.TIERED,
            billing_period=BillingPeriod.MONTHLY,
            base_price=decimal.Decimal('0'),
            tiers=[
                PricingTier(
                    min_usage=0,
                    max_usage=1000000,
                    price_per_unit=decimal.Decimal('0.0003'),
                    flat_fee=decimal.Decimal('500')
                ),
                PricingTier(
                    min_usage=1000001,
                    max_usage=5000000,
                    price_per_unit=decimal.Decimal('0.0002'),
                    flat_fee=decimal.Decimal('0')
                ),
                PricingTier(
                    min_usage=5000001,
                    max_usage=None,
                    price_per_unit=decimal.Decimal('0.0001'),
                    flat_fee=decimal.Decimal('0')
                )
            ],
            rate_limits={'requests_per_minute': 5000},
            features=["Unlimited API access", "24/7 support", "Custom analytics", "Dedicated account manager"]
        )
        
        for plan in [free_plan, starter_plan, pro_plan, enterprise_plan]:
            self.pricing_engine.register_pricing_plan(plan)
            
    async def _create_default_discounts(self):
        """Create default discount offers"""
        
        # New customer discount
        new_customer_discount = Discount(
            id="new_customer_20",
            name="New Customer 20% Off",
            type=DiscountType.PERCENTAGE,
            value=decimal.Decimal('20'),
            applies_to=["professional", "enterprise"],
            valid_from=datetime.now(),
            valid_until=datetime.now() + timedelta(days=365),
            max_uses=1000,
            customer_eligibility={'new_customers_only': True}
        )
        
        # Volume discount
        volume_discount = Discount(
            id="volume_discount",
            name="High Volume Discount",
            type=DiscountType.VOLUME_DISCOUNT,
            value=decimal.Decimal('15'),
            applies_to=["all"],
            valid_from=datetime.now(),
            valid_until=None
        )
        
        for discount in [new_customer_discount, volume_discount]:
            self.discount_manager.create_discount(discount)
            
    async def register_customer(self, customer: Customer):
        """Register a new customer"""
        self.customers[customer.id] = customer
        
    async def track_api_usage(self, customer_id: str, api_id: str, endpoint: str,
                            data_size_mb: int = 0, compute_time_ms: int = 0) -> str:
        """Track API usage for billing"""
        
        # Track API call
        call_record_id = await self.usage_tracker.track_usage(
            customer_id, api_id, endpoint, UsageMetric.API_CALLS, 1
        )
        
        # Track data transfer if applicable
        if data_size_mb > 0:
            await self.usage_tracker.track_usage(
                customer_id, api_id, endpoint, UsageMetric.DATA_TRANSFER, data_size_mb
            )
            
        # Track compute time if applicable
        if compute_time_ms > 0:
            await self.usage_tracker.track_usage(
                customer_id, api_id, endpoint, UsageMetric.COMPUTE_TIME, compute_time_ms
            )
            
        return call_record_id
        
    async def generate_monthly_invoices(self, month: int, year: int) -> List[str]:
        """Generate invoices for all customers for a given month"""
        
        period_start = datetime(year, month, 1)
        if month == 12:
            period_end = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            period_end = datetime(year, month + 1, 1) - timedelta(days=1)
            
        invoice_ids = []
        
        for customer in self.customers.values():
            if not customer.is_active:
                continue
                
            # Get customer usage for the period
            usage_data = await self.usage_tracker.get_customer_usage(
                customer.id, period_start, period_end
            )
            
            # Generate invoice
            invoice = await self.invoice_generator.generate_invoice(
                customer, usage_data, period_start, period_end
            )
            
            invoice_ids.append(invoice.id)
            
            # Record revenue if paid
            if invoice.status == InvoiceStatus.PAID:
                await self.revenue_analytics.record_revenue(invoice)
                
        return invoice_ids
        
    async def get_customer_billing_summary(self, customer_id: str) -> Dict[str, Any]:
        """Get billing summary for a customer"""
        
        if customer_id not in self.customers:
            return {}
            
        customer = self.customers[customer_id]
        
        # Get current month usage
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        
        current_usage = await self.usage_tracker.get_customer_usage(
            customer_id, month_start, now
        )
        
        # Get recent invoices
        recent_invoices = await self.invoice_generator.get_customer_invoices(customer_id, 5)
        
        # Calculate estimated current month cost
        estimated_cost = await self.pricing_engine.calculate_usage_cost(
            customer, current_usage, month_start, now
        )
        
        # Get usage analytics
        usage_analytics = await self.usage_tracker.get_usage_analytics(
            customer_id, month_start, now
        )
        
        return {
            'customer_id': customer_id,
            'plan_id': customer.plan_id,
            'current_usage': current_usage,
            'estimated_monthly_cost': float(estimated_cost['total_cost']),
            'usage_analytics': usage_analytics,
            'recent_invoices': [
                {
                    'id': inv.id,
                    'amount': float(inv.total_amount),
                    'status': inv.status.value,
                    'due_date': inv.due_date.isoformat(),
                    'created_at': inv.created_at.isoformat()
                }
                for inv in recent_invoices
            ],
            'credit_balance': float(customer.credit_balance)
        }
        
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get overall system metrics"""
        
        total_customers = len(self.customers)
        active_customers = sum(1 for c in self.customers.values() if c.is_active)
        
        # Plan distribution
        plan_distribution = defaultdict(int)
        for customer in self.customers.values():
            plan_distribution[customer.plan_id] += 1
            
        # Revenue analytics for current month
        current_month = datetime.now().strftime("%Y-%m")
        revenue_report = await self.revenue_analytics.get_revenue_report(current_month, current_month)
        
        return {
            'total_customers': total_customers,
            'active_customers': active_customers,
            'plan_distribution': dict(plan_distribution),
            'monthly_revenue': revenue_report['total_revenue'],
            'total_usage_records': len(self.usage_tracker.usage_records),
            'total_invoices': len(self.invoice_generator.invoices),
            'available_pricing_plans': list(self.pricing_engine.pricing_plans.keys()),
            'active_discounts': len([d for d in self.discount_manager.discounts.values() if d.is_active])
        }

# Example usage
async def main():
    monetization_system = APIMonetizationSystem()
    await monetization_system.initialize()
    
    # Register a test customer
    test_customer = Customer(
        id="cust_001",
        name="Acme Corp",
        email="billing@acme.com",
        company="Acme Corporation",
        plan_id="professional",
        subscription_start=datetime.now() - timedelta(days=30),
        tax_rate=decimal.Decimal('0.08')  # 8% tax
    )
    
    await monetization_system.register_customer(test_customer)
    
    # Simulate API usage
    for i in range(50000):  # 50k API calls
        await monetization_system.track_api_usage(
            "cust_001", "user-api", "/api/v1/users", 
            data_size_mb=1 if i % 10 == 0 else 0
        )
    
    # Generate invoice for current month
    now = datetime.now()
    invoice_ids = await monetization_system.generate_monthly_invoices(now.month, now.year)
    print(f"Generated {len(invoice_ids)} invoices")
    
    # Get customer billing summary
    billing_summary = await monetization_system.get_customer_billing_summary("cust_001")
    print(f"Billing Summary: {json.dumps(billing_summary, indent=2, default=str)}")
    
    # Get system metrics
    system_metrics = await monetization_system.get_system_metrics()
    print(f"System Metrics: {json.dumps(system_metrics, indent=2, default=str)}")

if __name__ == "__main__":
    asyncio.run(main())