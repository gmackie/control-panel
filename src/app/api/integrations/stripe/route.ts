import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripeService } from '@/lib/stripe/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'stats';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') || undefined;

    switch (action) {
      case 'stats':
        const stats = await stripeService.getDashboardStats();
        return NextResponse.json(stats);

      case 'account':
        const account = await stripeService.getAccount();
        return NextResponse.json(account);

      case 'balance':
        const balance = await stripeService.getBalance();
        return NextResponse.json(balance);

      case 'customers':
        const customers = await stripeService.getCustomers(limit);
        return NextResponse.json({ customers });

      case 'subscriptions':
        const subscriptions = await stripeService.getSubscriptions(status);
        return NextResponse.json({ subscriptions });

      case 'active-subscriptions':
        const activeSubscriptions = await stripeService.getActiveSubscriptions();
        return NextResponse.json({ subscriptions: activeSubscriptions });

      case 'payments':
        const days = parseInt(searchParams.get('days') || '30', 10);
        const payments = await stripeService.getRecentPayments(days);
        return NextResponse.json({ payments });

      case 'invoices':
        const invoices = await stripeService.getInvoices(status);
        return NextResponse.json({ invoices });

      case 'products':
        const products = await stripeService.getProducts();
        return NextResponse.json({ products });

      case 'health':
        const healthy = await stripeService.healthCheck();
        return NextResponse.json({ healthy, service: 'stripe' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Stripe API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
