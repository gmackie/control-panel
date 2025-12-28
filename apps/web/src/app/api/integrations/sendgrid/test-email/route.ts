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
      apiKey, 
      toEmail, 
      fromEmail, 
      fromName, 
      subject, 
      content, 
      settings, 
      applicationId 
    } = await request.json();

    if (!apiKey || !toEmail || !fromEmail || !subject || !content) {
      return NextResponse.json({ 
        error: 'Required fields: apiKey, toEmail, fromEmail, subject, content' 
      }, { status: 400 });
    }

    try {
      const emailData = {
        personalizations: [
          {
            to: [{ email: toEmail }],
            subject: subject,
          },
        ],
        from: {
          email: fromEmail,
          name: fromName || 'Test Sender',
        },
        content: [
          {
            type: 'text/plain',
            value: content,
          },
          {
            type: 'text/html',
            value: `<p>${content}</p>`,
          },
        ],
        tracking_settings: {
          click_tracking: {
            enable: settings?.trackClicks || false,
          },
          open_tracking: {
            enable: settings?.trackOpens || false,
          },
          subscription_tracking: {
            enable: settings?.subscriptionTracking || false,
          },
          ganalytics: {
            enable: settings?.googleAnalytics || false,
          },
        },
        ...(settings?.replyToEmail && {
          reply_to: {
            email: settings.replyToEmail,
          },
        }),
      };

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('SendGrid email error:', errorData);
        return NextResponse.json({ 
          error: `Email send failed: ${response.status}` 
        }, { status: response.status });
      }

      // SendGrid returns 202 with no body on success
      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
      });
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      return NextResponse.json({ 
        error: 'Failed to send email' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in SendGrid email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}