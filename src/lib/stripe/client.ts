/**
 * Stripe API Client
 * Monitor payments, subscriptions, customers, and revenue metrics
 */

export interface StripeCustomer {
  id: string;
  object: 'customer';
  email: string | null;
  name: string | null;
  description: string | null;
  created: number;
  currency: string | null;
  default_source: string | null;
  delinquent: boolean;
  balance: number;
  metadata: Record<string, string>;
  subscriptions?: {
    data: StripeSubscription[];
    has_more: boolean;
    total_count: number;
  };
}

export interface StripeSubscription {
  id: string;
  object: 'subscription';
  customer: string;
  status: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'paused';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  ended_at: number | null;
  created: number;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        product: string;
        unit_amount: number | null;
        currency: string;
        recurring: {
          interval: 'day' | 'week' | 'month' | 'year';
          interval_count: number;
        } | null;
      };
      quantity: number;
    }>;
  };
  metadata: Record<string, string>;
}

export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_received: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  customer: string | null;
  created: number;
  description: string | null;
  metadata: Record<string, string>;
}

export interface StripeInvoice {
  id: string;
  object: 'invoice';
  customer: string;
  subscription: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  currency: string;
  created: number;
  due_date: number | null;
  paid: boolean;
  period_start: number;
  period_end: number;
}

export interface StripeProduct {
  id: string;
  object: 'product';
  name: string;
  description: string | null;
  active: boolean;
  created: number;
  updated: number;
  default_price: string | null;
  metadata: Record<string, string>;
}

export interface StripeBalanceTransaction {
  id: string;
  object: 'balance_transaction';
  amount: number;
  currency: string;
  description: string | null;
  fee: number;
  net: number;
  status: 'available' | 'pending';
  type: string;
  created: number;
}

export interface StripeAccount {
  id: string;
  object: 'account';
  business_profile: {
    name: string | null;
    url: string | null;
  } | null;
  capabilities: Record<string, 'active' | 'inactive' | 'pending'>;
  country: string;
  default_currency: string;
  email: string;
  settings: {
    dashboard: {
      display_name: string | null;
    };
  };
}

export interface StripeBalance {
  object: 'balance';
  available: Array<{
    amount: number;
    currency: string;
  }>;
  pending: Array<{
    amount: number;
    currency: string;
  }>;
}

export class StripeClient {
  private baseUrl = 'https://api.stripe.com/v1';
  private secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stripe API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Account
  async getAccount(): Promise<StripeAccount> {
    return this.request<StripeAccount>('/account');
  }

  async getBalance(): Promise<StripeBalance> {
    return this.request<StripeBalance>('/balance');
  }

  // Customers
  async listCustomers(options?: {
    limit?: number;
    starting_after?: string;
    email?: string;
  }): Promise<{ data: StripeCustomer[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.starting_after) params.set('starting_after', options.starting_after);
    if (options?.email) params.set('email', options.email);

    return this.request(`/customers?${params}`);
  }

  async getCustomer(customerId: string): Promise<StripeCustomer> {
    return this.request<StripeCustomer>(`/customers/${customerId}`);
  }

  // Subscriptions
  async listSubscriptions(options?: {
    limit?: number;
    status?: string;
    customer?: string;
    price?: string;
  }): Promise<{ data: StripeSubscription[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.status) params.set('status', options.status);
    if (options?.customer) params.set('customer', options.customer);
    if (options?.price) params.set('price', options.price);

    return this.request(`/subscriptions?${params}`);
  }

  async getSubscription(subscriptionId: string): Promise<StripeSubscription> {
    return this.request<StripeSubscription>(`/subscriptions/${subscriptionId}`);
  }

  // Payment Intents
  async listPaymentIntents(options?: {
    limit?: number;
    customer?: string;
    created?: { gte?: number; lte?: number };
  }): Promise<{ data: StripePaymentIntent[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.customer) params.set('customer', options.customer);
    if (options?.created?.gte) params.set('created[gte]', options.created.gte.toString());
    if (options?.created?.lte) params.set('created[lte]', options.created.lte.toString());

    return this.request(`/payment_intents?${params}`);
  }

  // Invoices
  async listInvoices(options?: {
    limit?: number;
    customer?: string;
    status?: string;
    subscription?: string;
  }): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.customer) params.set('customer', options.customer);
    if (options?.status) params.set('status', options.status);
    if (options?.subscription) params.set('subscription', options.subscription);

    return this.request(`/invoices?${params}`);
  }

  // Products
  async listProducts(options?: {
    limit?: number;
    active?: boolean;
  }): Promise<{ data: StripeProduct[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.active !== undefined) params.set('active', options.active.toString());

    return this.request(`/products?${params}`);
  }

  // Balance Transactions (for revenue tracking)
  async listBalanceTransactions(options?: {
    limit?: number;
    type?: string;
    created?: { gte?: number; lte?: number };
  }): Promise<{ data: StripeBalanceTransaction[]; has_more: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.type) params.set('type', options.type);
    if (options?.created?.gte) params.set('created[gte]', options.created.gte.toString());
    if (options?.created?.lte) params.set('created[lte]', options.created.lte.toString());

    return this.request(`/balance_transactions?${params}`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.getAccount();
      return true;
    } catch {
      return false;
    }
  }
}

// Service layer
export class StripeService {
  private client: StripeClient;

  constructor() {
    this.client = new StripeClient(
      process.env.STRIPE_SECRET_KEY || ''
    );
  }

  async getAccount() {
    return this.client.getAccount();
  }

  async getBalance() {
    return this.client.getBalance();
  }

  async getCustomers(limit = 20) {
    const { data } = await this.client.listCustomers({ limit });
    return data;
  }

  async getSubscriptions(status?: string) {
    const { data } = await this.client.listSubscriptions({ 
      limit: 100,
      status: status || 'all'
    });
    return data;
  }

  async getActiveSubscriptions() {
    const { data } = await this.client.listSubscriptions({ 
      limit: 100,
      status: 'active'
    });
    return data;
  }

  async getRecentPayments(days = 30) {
    const startDate = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const { data } = await this.client.listPaymentIntents({ 
      limit: 100,
      created: { gte: startDate }
    });
    return data;
  }

  async getInvoices(status?: string) {
    const { data } = await this.client.listInvoices({ 
      limit: 100,
      status
    });
    return data;
  }

  async getProducts() {
    const { data } = await this.client.listProducts({ limit: 100, active: true });
    return data;
  }

  async getDashboardStats() {
    const now = Math.floor(Date.now() / 1000);
    const last30d = now - 30 * 24 * 60 * 60;
    const last7d = now - 7 * 24 * 60 * 60;

    const [
      balance,
      customers,
      subscriptions,
      payments,
      invoices,
      transactions
    ] = await Promise.all([
      this.client.getBalance(),
      this.client.listCustomers({ limit: 100 }),
      this.client.listSubscriptions({ limit: 100 }),
      this.client.listPaymentIntents({ limit: 100, created: { gte: last30d } }),
      this.client.listInvoices({ limit: 100 }),
      this.client.listBalanceTransactions({ limit: 100, created: { gte: last30d } }),
    ]);

    // Calculate subscription metrics
    const activeSubscriptions = subscriptions.data.filter(s => s.status === 'active');
    const trialingSubscriptions = subscriptions.data.filter(s => s.status === 'trialing');
    const canceledSubscriptions = subscriptions.data.filter(s => s.status === 'canceled');
    const pastDueSubscriptions = subscriptions.data.filter(s => s.status === 'past_due');

    // Calculate MRR from active subscriptions
    const mrr = activeSubscriptions.reduce((total, sub) => {
      const item = sub.items.data[0];
      if (!item?.price?.unit_amount) return total;
      
      const amount = item.price.unit_amount * (item.quantity || 1);
      const interval = item.price.recurring?.interval;
      const intervalCount = item.price.recurring?.interval_count || 1;
      
      // Normalize to monthly
      if (interval === 'year') return total + (amount / (12 * intervalCount));
      if (interval === 'month') return total + (amount / intervalCount);
      if (interval === 'week') return total + (amount * 4.33 / intervalCount);
      if (interval === 'day') return total + (amount * 30 / intervalCount);
      return total;
    }, 0);

    // Payment success metrics
    const successfulPayments = payments.data.filter(p => p.status === 'succeeded');
    const failedPayments = payments.data.filter(p => p.status === 'canceled' || p.status === 'requires_payment_method');
    
    const totalRevenue30d = successfulPayments.reduce((sum, p) => sum + p.amount_received, 0);
    const recentPayments7d = payments.data.filter(p => p.created > last7d && p.status === 'succeeded');
    const totalRevenue7d = recentPayments7d.reduce((sum, p) => sum + p.amount_received, 0);

    // Invoice metrics
    const paidInvoices = invoices.data.filter(i => i.status === 'paid');
    const openInvoices = invoices.data.filter(i => i.status === 'open');
    const overdueInvoices = openInvoices.filter(i => i.due_date && i.due_date < now);

    // Balance info
    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0);

    // Fees
    const totalFees30d = transactions.data.reduce((sum, t) => sum + t.fee, 0);

    return {
      // Balances (in cents, divide by 100 for dollars)
      availableBalance,
      pendingBalance,
      
      // Customer metrics
      totalCustomers: customers.data.length,
      
      // Subscription metrics
      totalSubscriptions: subscriptions.data.length,
      activeSubscriptions: activeSubscriptions.length,
      trialingSubscriptions: trialingSubscriptions.length,
      canceledSubscriptions: canceledSubscriptions.length,
      pastDueSubscriptions: pastDueSubscriptions.length,
      
      // Revenue metrics (in cents)
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      revenue30d: totalRevenue30d,
      revenue7d: totalRevenue7d,
      
      // Payment metrics
      successfulPayments30d: successfulPayments.length,
      failedPayments30d: failedPayments.length,
      paymentSuccessRate: payments.data.length > 0 
        ? ((successfulPayments.length / payments.data.length) * 100).toFixed(1)
        : '100.0',
      
      // Invoice metrics
      paidInvoices: paidInvoices.length,
      openInvoices: openInvoices.length,
      overdueInvoices: overdueInvoices.length,
      
      // Fee metrics
      totalFees30d,
      
      // Churn indicator
      churnRate: subscriptions.data.length > 0
        ? ((canceledSubscriptions.length / subscriptions.data.length) * 100).toFixed(1)
        : '0.0',
    };
  }

  async healthCheck() {
    return this.client.healthCheck();
  }
}

export const stripeService = new StripeService();
