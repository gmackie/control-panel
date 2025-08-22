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
      const userResponse = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': apiKey,
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

      // Fetch available voices
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      let voices = [];
      if (voicesResponse.ok) {
        const voicesData = await voicesResponse.json();
        voices = voicesData.voices || [];
      }

      // Determine subscription tier and limits
      const subscription = {
        tier: userData.subscription?.tier || 'free',
        charactersUsed: userData.subscription?.character_count || 0,
        charactersLimit: userData.subscription?.character_limit || 10000,
        voicesLimit: userData.subscription?.voice_limit || 10,
        canCloneVoices: userData.subscription?.can_extend_character_limit || false,
        canUseProjects: userData.subscription?.can_use_instant_voice_cloning || false,
      };

      return NextResponse.json({
        isValid: true,
        subscription,
        voices,
      });
    } catch (error: any) {
      console.error('ElevenLabs validation error:', error);
      
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
    console.error('Error validating ElevenLabs API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}