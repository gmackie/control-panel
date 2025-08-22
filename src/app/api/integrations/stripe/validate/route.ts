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
      return NextResponse.json({
        isValid: false,
        mode: 'test',
        error: 'Secret key is required',
      });
    }

    // Detect mode from key prefix
    const mode = secretKey.startsWith('sk_test_') ? 'test' : 
                 secretKey.startsWith('sk_live_') ? 'live' : null;

    if (!mode) {
      return NextResponse.json({
        isValid: false,
        mode: 'test',
        error: 'Invalid key format. Must start with sk_test_ or sk_live_',
      });
    }

    // Validate with Stripe API
    try {
      const stripeResponse = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
        },
      });

      if (stripeResponse.ok) {
        const account = await stripeResponse.json();
        
        return NextResponse.json({
          isValid: true,
          mode,
          accountName: account.business_profile?.name || account.settings?.dashboard?.display_name || 'Stripe Account',
          accountId: account.id,
          features: {
            payments: account.capabilities?.card_payments === 'active',
            subscriptions: account.capabilities?.transfers === 'active',
            invoicing: account.capabilities?.invoice_sending === 'active',
            tax: account.capabilities?.tax_reporting_us === 'active',
          },
        });
      } else if (stripeResponse.status === 401) {
        return NextResponse.json({
          isValid: false,
          mode,
          error: 'Invalid API key',
        });
      } else {
        return NextResponse.json({
          isValid: false,
          mode,
          error: 'Failed to validate API key',
        });
      }
    } catch (error) {
      console.error('Stripe validation error:', error);
      return NextResponse.json({
        isValid: false,
        mode,
        error: 'Network error while validating key',
      });
    }
  } catch (error) {
    console.error('Error validating Stripe key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}