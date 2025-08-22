import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, model, prompt, settings, applicationId } = await request.json();

    if (!apiKey || !model || !prompt) {
      return NextResponse.json({ 
        error: 'API key, model, and prompt are required' 
      }, { status: 400 });
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
          'X-Title': 'GMAC.IO Control Panel',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: settings?.maxTokens || 100,
          temperature: settings?.temperature || 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenRouter completion error:', errorData);
        return NextResponse.json({ 
          error: `Completion failed: ${response.status}` 
        }, { status: response.status });
      }

      const completionData = await response.json();
      
      return NextResponse.json({
        completion: completionData.choices?.[0]?.message?.content || 'No response generated',
        usage: {
          prompt_tokens: completionData.usage?.prompt_tokens || 0,
          completion_tokens: completionData.usage?.completion_tokens || 0,
          total_tokens: completionData.usage?.total_tokens || 0,
        },
        model: completionData.model,
      });
    } catch (error: any) {
      console.error('OpenRouter completion error:', error);
      return NextResponse.json({ 
        error: 'Failed to generate completion' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in OpenRouter completion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}