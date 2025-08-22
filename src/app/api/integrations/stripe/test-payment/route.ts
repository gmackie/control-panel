import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { secretKey, applicationId } = await request.json();

    if (!secretKey) {
      return NextResponse.json({ error: 'Secret key is required' }, { status: 400 });
    }

    // Only allow test mode keys for test payments
    if (!secretKey.startsWith('sk_test_')) {
      return NextResponse.json({ 
        error: 'Test payments can only be created with test mode keys' 
      }, { status: 400 });
    }

    try {
      // Create a test payment intent
      const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          amount: '100', // $1.00 in cents
          currency: 'usd',
          description: 'Integration test payment',
          metadata: JSON.stringify({
            applicationId,
            test: 'true',
            timestamp: new Date().toISOString(),
          }),
        }),
      });

      if (!paymentIntentResponse.ok) {
        const error = await paymentIntentResponse.json();
        return NextResponse.json({ 
          error: error.error?.message || 'Failed to create test payment' 
        }, { status: 400 });
      }

      const paymentIntent = await paymentIntentResponse.json();

      // Confirm the payment intent with a test card
      const confirmResponse = await fetch(
        `https://api.stripe.com/v1/payment_intents/${paymentIntent.id}/confirm`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            payment_method: 'pm_card_visa', // Stripe's test card
          }),
        }
      );

      if (!confirmResponse.ok) {
        const error = await confirmResponse.json();
        return NextResponse.json({ 
          error: error.error?.message || 'Failed to confirm test payment' 
        }, { status: 400 });
      }

      const confirmedPayment = await confirmResponse.json();

      return NextResponse.json({
        success: true,
        paymentId: confirmedPayment.id,
        amount: confirmedPayment.amount,
        currency: confirmedPayment.currency,
        status: confirmedPayment.status,
        message: 'Test payment successful',
      });
    } catch (error) {
      console.error('Stripe test payment error:', error);
      return NextResponse.json({ 
        error: 'Network error while creating test payment' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating test payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}