import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, voiceId, text, settings, applicationId } = await request.json();

    if (!apiKey || !voiceId || !text) {
      return NextResponse.json({ 
        error: 'API key, voice ID, and text are required' 
      }, { status: 400 });
    }

    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: (settings?.stability || 50) / 100,
            similarity_boost: (settings?.similarityBoost || 75) / 100,
            style: (settings?.style || 0) / 100,
            use_speaker_boost: settings?.useSpeakerBoost || true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('ElevenLabs TTS error:', errorData);
        return NextResponse.json({ 
          error: `TTS generation failed: ${response.status}` 
        }, { status: response.status });
      }

      // Stream the audio back to the client
      const audioBuffer = await response.arrayBuffer();
      
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      });
    } catch (error: any) {
      console.error('ElevenLabs TTS error:', error);
      return NextResponse.json({ 
        error: 'Failed to generate speech' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in ElevenLabs TTS:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}