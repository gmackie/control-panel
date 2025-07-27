import { NextRequest, NextResponse } from 'next/server'
import { StripeMetrics } from '@/types'

// Mock Stripe metrics - replace with actual Stripe API integration
export async function GET(request: NextRequest) {
  try {
    // In production, fetch from Stripe API:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    // const subscriptions = await stripe.subscriptions.list()
    // const charges = await stripe.charges.list()
    
    const mockMetrics: StripeMetrics = {
      mrr: 45320,
      arr: 543840,
      newCustomers: 23,
      churnedCustomers: 2,
      revenue: {
        today: 1523,
        month: 45320,
        year: 489230,
      },
      topPlans: [
        { name: 'Pro', customers: 234, revenue: 23400 },
        { name: 'Business', customers: 89, revenue: 17800 },
        { name: 'Starter', customers: 456, revenue: 4560 },
      ],
    }
    
    return NextResponse.json(mockMetrics)
  } catch (error) {
    console.error('Failed to fetch Stripe metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Stripe metrics' },
      { status: 500 }
    )
  }
}