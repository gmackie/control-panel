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
      // Validate API key by fetching credits
      const creditsResponse = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!creditsResponse.ok) {
        return NextResponse.json({
          isValid: false,
          error: 'Invalid API key',
        });
      }

      const creditsData = await creditsResponse.json();

      // Fetch available models
      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      let models = [];
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json();
        models = modelsData.data || [];
      }

      // Parse credits information
      const credits = {
        balance: creditsData.data?.credit_balance || 0,
        limit: creditsData.data?.credit_limit || 100,
        used: (creditsData.data?.credit_limit || 100) - (creditsData.data?.credit_balance || 0),
      };

      return NextResponse.json({
        isValid: true,
        credits,
        models: models.map((model: any) => ({
          id: model.id,
          name: model.name || model.id,
          pricing: {
            prompt: parseFloat(model.pricing?.prompt || '0'),
            completion: parseFloat(model.pricing?.completion || '0'),
          },
          context_length: model.context_length || 4096,
          capabilities: model.top_provider?.modalities || [],
        })),
      });
    } catch (error: any) {
      console.error('OpenRouter validation error:', error);
      
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
    console.error('Error validating OpenRouter API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}