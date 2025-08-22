import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountSid, authToken, applicationId } = await request.json();

    if (!accountSid || !authToken) {
      return NextResponse.json({
        isValid: false,
        error: 'Account SID and Auth Token are required',
      });
    }

    try {
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      // Validate credentials by fetching account info
      const accountResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!accountResponse.ok) {
        return NextResponse.json({
          isValid: false,
          error: 'Invalid credentials',
        });
      }

      const accountData = await accountResponse.json();

      // Fetch phone numbers
      const numbersResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      let phoneNumbers = [];
      if (numbersResponse.ok) {
        const numbersData = await numbersResponse.json();
        phoneNumbers = numbersData.incoming_phone_numbers || [];
      }

      // Fetch account balance
      const balanceResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`, {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      let balance = null;
      if (balanceResponse.ok) {
        balance = await balanceResponse.json();
      }

      return NextResponse.json({
        isValid: true,
        account: {
          accountSid: accountData.sid,
          friendlyName: accountData.friendly_name,
          status: accountData.status,
          type: accountData.type,
        },
        phoneNumbers: phoneNumbers.map((number: any) => ({
          sid: number.sid,
          friendlyName: number.friendly_name,
          phoneNumber: number.phone_number,
          capabilities: number.capabilities,
        })),
        balance,
      });
    } catch (error: any) {
      console.error('Twilio validation error:', error);
      
      let errorMessage = 'Failed to validate credentials';
      if (error.message?.includes('401')) {
        errorMessage = 'Invalid Account SID or Auth Token';
      } else if (error.message?.includes('429')) {
        errorMessage = 'Rate limit exceeded';
      } else if (error.message?.includes('NETWORK')) {
        errorMessage = 'Network error - check your connection';
      }

      return NextResponse.json({
        isValid: false,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('Error validating Twilio credentials:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}