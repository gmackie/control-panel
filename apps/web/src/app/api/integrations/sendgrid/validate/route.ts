import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, applicationId } = await request.json();

    if (!apiKey) {
      return NextResponse.json({
        isValid: false,
        error: 'API key is required',
      });
    }

    try {
      // Validate API key by fetching user info
      const userResponse = await fetch('https://api.sendgrid.com/v3/user/profile', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return NextResponse.json({
          isValid: false,
          error: 'Invalid API key',
        });
      }

      const userData = await userResponse.json();

      // Fetch account statistics
      const statsResponse = await fetch('https://api.sendgrid.com/v3/stats', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      let stats = null;
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.length > 0) {
          // Get the most recent stats
          stats = statsData[0].stats[0];
        }
      }

      // Fetch templates
      const templatesResponse = await fetch('https://api.sendgrid.com/v3/templates', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      let templates = [];
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        templates = templatesData.templates || [];
      }

      // Fetch sender reputation
      const reputationResponse = await fetch('https://api.sendgrid.com/v3/whitelabel/ips', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      let reputation = 80; // Default reputation
      if (reputationResponse.ok) {
        const reputationData = await reputationResponse.json();
        if (reputationData.length > 0) {
          reputation = Math.round(reputationData[0].reputation || 80);
        }
      }

      return NextResponse.json({
        isValid: true,
        user: {
          username: userData.username,
          email: userData.email,
          reputation: reputation,
        },
        stats,
        templates: templates.slice(0, 10), // Limit to 10 templates
      });
    } catch (error: any) {
      console.error('SendGrid validation error:', error);
      
      let errorMessage = 'Failed to validate API key';
      if (error.message?.includes('401')) {
        errorMessage = 'Invalid API key';
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
    console.error('Error validating SendGrid API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}