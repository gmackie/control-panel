import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      accountSid, 
      authToken, 
      from, 
      to, 
      body, 
      applicationId 
    } = await request.json();

    if (!accountSid || !authToken || !from || !to || !body) {
      return NextResponse.json({ 
        error: 'Required fields: accountSid, authToken, from, to, body' 
      }, { status: 400 });
    }

    try {
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      // Prepare form data for Twilio API
      const formData = new URLSearchParams();
      formData.append('From', from);
      formData.append('To', to);
      formData.append('Body', body);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Twilio SMS error:', errorData);
        return NextResponse.json({ 
          error: errorData.message || `SMS send failed: ${response.status}` 
        }, { status: response.status });
      }

      const messageData = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Test SMS sent successfully',
        messageSid: messageData.sid,
        status: messageData.status,
      });
    } catch (error: any) {
      console.error('Twilio SMS error:', error);
      return NextResponse.json({ 
        error: 'Failed to send SMS' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in Twilio SMS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}