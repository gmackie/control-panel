import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createApplication, getApplications } from '@/lib/applications/manager';
import { CreateApplicationRequest } from '@/types/applications';

function safeJson<T>(value: T): T {
  // Remove undefined values to satisfy undici/NextResponse.json serializer
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const applications = await getApplications((session.user as any).login || session.user.email!);
    return NextResponse.json({ applications: safeJson(applications) });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateApplicationRequest = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Application name is required' },
        { status: 400 }
      );
    }

    const application = await createApplication(
      body,
      (session.user as any).login || session.user.email!
    );

    return NextResponse.json(safeJson(application), { status: 201 });
  } catch (error) {
    console.error('Error creating application:', error);
    return NextResponse.json(
      { error: 'Failed to create application' },
      { status: 500 }
    );
  }
}
